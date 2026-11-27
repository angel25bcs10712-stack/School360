import { timingSafeEqual } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./database.js";
import {
  createReport,
  getDashboard,
  getReport,
  getSchool,
  ISSUE_CATEGORIES,
  listReports,
  REPORT_STATUSES,
  searchSchools,
  updateReportStatus,
} from "./school-service.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const frontend = join(root, "frontend");
const port = Number(process.env.PORT ?? 3000);
const adminPassword = process.env.ADMIN_PASSWORD || "school360-demo-admin";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 32_768) throw new HttpError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function requireId(value) {
  if (!/^[1-9]\d{0,17}$/.test(value ?? "")) {
    throw new HttpError(400, "A valid numeric ID is required.");
  }
  return value;
}

function validateReport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Report details must be a JSON object.");
  }
  const schoolId = requireId(String(body.schoolId ?? ""));
  if (!ISSUE_CATEGORIES.includes(body.category)) {
    throw new HttpError(400, "Choose a valid issue category.");
  }
  if (typeof body.description !== "string" ||
      body.description.trim().length < 5 ||
      body.description.trim().length > 4000) {
    throw new HttpError(400, "Description must contain 5 to 4000 characters.");
  }
  for (const field of ["reporterName", "reporterContact"]) {
    if (body[field] != null &&
        (typeof body[field] !== "string" || body[field].length > 255)) {
      throw new HttpError(400, `${field} must be 255 characters or fewer.`);
    }
  }
  return {
    schoolId,
    category: body.category,
    description: body.description.trim(),
    reporterName: body.reporterName ?? null,
    reporterContact: body.reporterContact ?? null,
  };
}

function isAdmin(request) {
  const supplied = Buffer.from(request.headers["x-admin-password"] ?? "");
  const expected = Buffer.from(adminPassword);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function handleApi(request, response, url) {
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/health") {
    await pool.query("SELECT 1");
    return sendJson(response, 200, { status: "ok" });
  }
  if (request.method === "GET" && path === "/api/schools") {
    const schools = await searchSchools({
      q: url.searchParams.get("q") ?? "",
      district: url.searchParams.get("district") ?? "",
      type: url.searchParams.get("type") ?? "",
    });
    return sendJson(response, 200, { schools });
  }
  const schoolMatch = path.match(/^\/api\/schools\/([^/]+)$/);
  if (request.method === "GET" && schoolMatch) {
    const school = await getSchool(requireId(schoolMatch[1]));
    if (!school) throw new HttpError(404, "School not found.");
    return sendJson(response, 200, { school });
  }
  if (request.method === "POST" && path === "/api/reports") {
    const report = await createReport(validateReport(await readJson(request)));
    return sendJson(response, 201, { report });
  }
  if (request.method === "GET" && path === "/api/reports") {
    const status = url.searchParams.get("status") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const schoolId = url.searchParams.get("schoolId") ?? "";
    if (status && !REPORT_STATUSES.includes(status)) {
      throw new HttpError(400, "Choose a valid report status.");
    }
    if (category && !ISSUE_CATEGORIES.includes(category)) {
      throw new HttpError(400, "Choose a valid issue category.");
    }
    if (schoolId) requireId(schoolId);
    const reports = await listReports({
      schoolId,
      category,
      status,
    });
    return sendJson(response, 200, { reports });
  }
  const reportMatch = path.match(/^\/api\/reports\/([^/]+)$/);
  if (request.method === "GET" && reportMatch) {
    const report = await getReport(requireId(reportMatch[1]));
    if (!report) throw new HttpError(404, "Report not found.");
    return sendJson(response, 200, { report });
  }
  if (request.method === "GET" && path === "/api/admin/dashboard") {
    const schoolId = url.searchParams.get("schoolId") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const status = url.searchParams.get("status") ?? "";
    if (schoolId) requireId(schoolId);
    if (category && !ISSUE_CATEGORIES.includes(category)) {
      throw new HttpError(400, "Choose a valid issue category.");
    }
    if (status && !REPORT_STATUSES.includes(status)) {
      throw new HttpError(400, "Choose a valid report status.");
    }
    return sendJson(response, 200, {
      dashboard: await getDashboard({
        schoolId,
        category,
        status,
      }),
    });
  }
  const statusMatch = path.match(/^\/api\/admin\/reports\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
    if (!isAdmin(request)) throw new HttpError(401, "Admin password is required.");
    const id = requireId(statusMatch[1]);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Status details must be a JSON object.");
    }
    if (!REPORT_STATUSES.includes(body.status)) {
      throw new HttpError(400, "Choose a valid report status.");
    }
    if (body.comment != null &&
        (typeof body.comment !== "string" || body.comment.length > 1000)) {
      throw new HttpError(400, "Comment must be 1000 characters or fewer.");
    }
    const report = await updateReportStatus(id, body.status, body.comment);
    return sendJson(response, 200, { report });
  }
  throw new HttpError(404, "API route not found.");
}

function serveFrontend(response, pathname) {
  const filename = pathname === "/" ? "index.html" : normalize(pathname).slice(1);
  const resolved = join(frontend, filename);
  if (!resolved.startsWith(`${frontend}\\`) && !resolved.startsWith(`${frontend}/`)) {
    throw new HttpError(404, "Page not found.");
  }
  let fileInfo;
  try {
    fileInfo = statSync(resolved);
  } catch {
    throw new HttpError(404, "Page not found.");
  }
  if (!fileInfo.isFile()) throw new HttpError(404, "Page not found.");
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(resolved)] ?? "application/octet-stream",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  createReadStream(resolved).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else if (request.method === "GET") {
      serveFrontend(response, url.pathname);
    } else {
      throw new HttpError(405, "Method not allowed.");
    }
  } catch (error) {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) console.error("Request failed:", error);
    sendJson(response, statusCode, {
      error: error.message || "An unexpected server error occurred.",
      ...(error.reportId ? { reportId: error.reportId } : {}),
    });
  }
});

async function waitForDatabase() {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.warn(`PostgreSQL is not ready yet (attempt ${attempt}/${maxAttempts}); retrying.`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}

try {
  await waitForDatabase();
  server.listen(port, "0.0.0.0", () => {
    console.log(`School360 Voice listening on port ${port}.`);
  });
} catch (error) {
  console.error("Could not connect to PostgreSQL. Verify DATABASE_URL and database initialization.", error);
  await pool.end();
  process.exitCode = 1;
}
