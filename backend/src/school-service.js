import { pool } from "./database.js";

export const ISSUE_CATEGORIES = Object.freeze([
  "WATER",
  "TOILETS",
  "ELECTRICITY",
  "CLASSROOM",
  "FURNITURE",
  "CLEANLINESS",
  "OTHER",
]);

export const REPORT_STATUSES = Object.freeze([
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
]);

const databaseStatus = Object.freeze({
  SUBMITTED: "OPEN",
  UNDER_REVIEW: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
});

const publicStatus = Object.freeze({
  OPEN: "SUBMITTED",
  ASSIGNED: "UNDER_REVIEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
  REOPENED: "IN_PROGRESS",
  CLOSED: "RESOLVED",
});

const categoryLabels = Object.freeze({
  WATER: "Drinking water",
  TOILETS: "Toilets",
  ELECTRICITY: "Electricity",
  CLASSROOM: "Classroom infrastructure",
  FURNITURE: "Furniture",
  CLEANLINESS: "Cleanliness",
  OTHER: "Other",
});

const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");

export async function searchSchools({ q = "", district = "", type = "" } = {}) {
  const result = await pool.query(
    `SELECT s.id, s.name, s.address, s.school_type, s.udise_code,
            d.name AS district_name, b.name AS block_name,
            s.location IS NOT NULL AS has_location
       FROM schools s
       JOIN blocks b ON b.id = s.block_id
       JOIN districts d ON d.id = b.district_id
      WHERE ($1 = '' OR concat_ws(' ', s.name, s.address, b.name, d.name)
                          ILIKE $2 ESCAPE E'\\\\')
        AND ($3 = '' OR d.name ILIKE $3)
        AND ($4 = '' OR s.school_type ILIKE $4)
      ORDER BY s.name, s.id
      LIMIT 100`,
    [
      q.trim(),
      `%${escapeLike(q.trim())}%`,
      district.trim(),
      type.trim() ? `%${escapeLike(type.trim())}%` : "",
    ],
  );
  return result.rows;
}

export async function getSchool(id) {
  const schoolResult = await pool.query(
    `SELECT s.id, s.name, s.address, s.school_type, s.udise_code,
            d.name AS district_name, d.state_name, b.name AS block_name,
            CASE WHEN s.location IS NULL THEN NULL
                 ELSE ST_X(s.location::geometry) END AS longitude,
            CASE WHEN s.location IS NULL THEN NULL
                 ELSE ST_Y(s.location::geometry) END AS latitude
       FROM schools s
       JOIN blocks b ON b.id = s.block_id
       JOIN districts d ON d.id = b.district_id
      WHERE s.id = $1`,
    [id],
  );
  if (!schoolResult.rowCount) return null;

  const facilitiesResult = await pool.query(
    `SELECT f.name, sf.condition_status, sf.verification_status,
            sf.notes, sf.last_inspected_at
       FROM facilities f
       LEFT JOIN school_facilities sf
         ON sf.facility_id = f.id AND sf.school_id = $1 AND f.is_active
      WHERE f.is_active
      ORDER BY f.name`,
    [id],
  );

  return {
    ...schoolResult.rows[0],
    facilities: facilitiesResult.rows.map((facility) => ({
      ...facility,
      condition_status: facility.condition_status ?? "UNKNOWN",
      verification_status: facility.verification_status ?? "UNKNOWN",
    })),
  };
}

const reportSelect = `SELECT i.id, i.school_id, s.name AS school_name,
       d.name AS district_name, i.issue_category AS category,
       i.title, i.description,
       i.status AS database_status, i.verification_status,
       i.priority, i.created_at, i.updated_at, i.resolved_at
  FROM issues i
  JOIN schools s ON s.id = i.school_id
  JOIN blocks b ON b.id = s.block_id
  JOIN districts d ON d.id = b.district_id`;

function mapReport(row) {
  if (!row) return null;
  const { database_status: status, ...report } = row;
  return { ...report, status: publicStatus[status] ?? status };
}

export async function listReports({ schoolId = "", category = "", status = "" } = {}) {
  const result = await pool.query(
    `${reportSelect}
      WHERE ($1 = '' OR i.school_id = $1::bigint)
        AND ($2 = '' OR i.issue_category = $2)
        AND ($3 = '' OR i.status = $3)
      ORDER BY i.created_at DESC
      LIMIT 200`,
    [
      schoolId,
      category,
      status ? (databaseStatus[status] ?? "") : "",
    ],
  );
  return result.rows.map(mapReport);
}

export async function getReport(id) {
  const result = await pool.query(`${reportSelect} WHERE i.id = $1`, [id]);
  return mapReport(result.rows[0]);
}

export async function createReport({
  schoolId,
  category,
  description,
  reporterName = null,
  reporterContact = null,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const school = await client.query(
      "SELECT id FROM schools WHERE id = $1 FOR SHARE",
      [schoolId],
    );
    if (!school.rowCount) {
      const error = new Error("School not found.");
      error.statusCode = 404;
      throw error;
    }

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${schoolId}:${category}`],
    );
    const duplicate = await client.query(
      `SELECT id FROM issues
        WHERE school_id = $1
          AND issue_category = $2
          AND lower(btrim(description)) = lower(btrim($3))
          AND status NOT IN ('RESOLVED', 'REJECTED', 'CLOSED')
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1`,
      [schoolId, category, description],
    );
    if (duplicate.rowCount) {
      const error = new Error("A similar report already exists for this school.");
      error.statusCode = 409;
      error.reportId = duplicate.rows[0].id;
      throw error;
    }

    const reporter = await client.query(
      `SELECT id FROM users
        WHERE email = 'citizen-reports@school360.local'
        FOR SHARE`,
    );
    if (!reporter.rowCount) {
      throw new Error("Report service account is missing; check database initialization.");
    }

    const title = `${categoryLabels[category]}: ${description.trim().slice(0, 170)}`;
    const inserted = await client.query(
      `INSERT INTO issues
         (school_id, reported_by_user_id, title, description, issue_category,
          reporter_name, reporter_contact, status, verification_status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', 'UNVERIFIED', 'MEDIUM')
       RETURNING id`,
      [
        schoolId,
        reporter.rows[0].id,
        title,
        description.trim(),
        category,
        reporterName?.trim() || null,
        reporterContact?.trim() || null,
      ],
    );
    await client.query(
      `INSERT INTO issue_status_history (issue_id, status, comment)
       VALUES ($1, 'OPEN', 'Citizen report submitted through School360 Voice.')`,
      [inserted.rows[0].id],
    );
    await client.query("COMMIT");
    return await getReport(inserted.rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getDashboard({ schoolId = "", category = "", status = "" } = {}) {
  const reportFilter = `WHERE ($1 = '' OR i.school_id = $1::bigint)
                          AND ($2 = '' OR i.issue_category = $2)
                          AND ($3 = '' OR i.status = $3)`;
  const [schools, totals, categories, recent] = await Promise.all([
    pool.query("SELECT count(*)::int AS total FROM schools"),
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (
                WHERE i.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED')
              )::int AS pending,
              count(*) FILTER (WHERE i.status = 'RESOLVED')::int AS resolved
         FROM issues i ${reportFilter}`,
      [schoolId, category, status ? (databaseStatus[status] ?? "") : ""],
    ),
    pool.query(
      `SELECT i.issue_category AS category, count(*)::int AS count
         FROM issues i ${reportFilter}
        GROUP BY i.issue_category ORDER BY count DESC, category`,
      [schoolId, category, status ? (databaseStatus[status] ?? "") : ""],
    ),
    pool.query(
      `${reportSelect} ${reportFilter}
        ORDER BY i.created_at DESC LIMIT 10`,
      [schoolId, category, status ? (databaseStatus[status] ?? "") : ""],
    ),
  ]);
  return {
    totalSchools: schools.rows[0].total,
    totalReports: totals.rows[0].total,
    pendingReports: totals.rows[0].pending,
    resolvedReports: totals.rows[0].resolved,
    reportsByCategory: categories.rows,
    recentReports: recent.rows.map(mapReport),
  };
}

export async function updateReportStatus(id, status, comment = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE issues
          SET status = $2,
              resolved_at = CASE WHEN $2::varchar = 'RESOLVED'
                                 THEN CURRENT_TIMESTAMP ELSE NULL END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id`,
      [id, databaseStatus[status]],
    );
    if (!updated.rowCount) {
      const error = new Error("Report not found.");
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      `INSERT INTO issue_status_history (issue_id, status, comment)
       VALUES ($1, $2, $3)`,
      [id, databaseStatus[status], comment?.trim() || `Status updated to ${status}.`],
    );
    await client.query("COMMIT");
    return await getReport(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
