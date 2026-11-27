# School360 Local Database Setup

Verified on Windows 11 on 2026-11-25.

## Verified environment

| Setting | Verified value |
| --- | --- |
| PostgreSQL installation | `C:\Program Files\PostgreSQL\18` |
| PostgreSQL server | 18.7 |
| Windows service | `postgresql-x64-18` — Running, Automatic |
| `psql.exe` | `C:\Program Files\PostgreSQL\18\bin\psql.exe` |
| Host and port | `localhost:5432` |
| Database | `school360` |
| Database role | `postgres` |
| PostGIS | 3.7.0 |
| PostGIS control file | `C:\Program Files\PostgreSQL\18\share\extension\postgis.control` |
| PostGIS core library | `C:\Program Files\PostgreSQL\18\lib\postgis-3.dll` |

PostGIS raster and topology libraries were also present. The database connection
worked without prompting in this environment. No password is stored in this
documentation or in the project.

The database did not exist before setup. It was created without altering other
databases. PostGIS was enabled, then
[`V1__init.sql`](../database/migrations/V1__init.sql) was applied transactionally.
[`V1__reference_data.sql`](../database/seed/V1__reference_data.sql) loaded ten
facility reference records. A second seed execution inserted zero rows, confirming
that rerunning it does not duplicate those records. No school or UDISE records were
added.

PostGIS reported `POSTGIS="3.7.0 3.7.0"`, `PGSQL="180"`, GEOS 3.15.0, and PROJ 9.8.1.
The installed server reported PostgreSQL 18.7.

## Connection configuration

Use these connection parameters with the installed PostgreSQL binaries:

- Host: `localhost`
- Port: `5432`
- Database: `school360`
- User: `postgres`
- Password: not recorded; if prompted, enter it directly in the terminal.

The commands below use the executable by its full path; PostgreSQL does not need
to be added to `PATH`. They are PowerShell commands:

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$projectRoot = 'C:\Users\hp\OneDrive\Desktop\School360\school360'
```

If authentication requires a password, the client prompts in the terminal. Do not
put a password in a command, environment variable, or project file.

## Create the database safely

Check for the database before creating it. This leaves an existing database intact:

```powershell
$exists = & "$pgBin\psql.exe" -X -U postgres -h localhost -p 5432 -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = 'school360';"
if ($LASTEXITCODE -ne 0) { throw 'Could not check PostgreSQL database list.' }
if ($exists.Trim() -ne '1') {
    & "$pgBin\createdb.exe" -U postgres -h localhost -p 5432 school360
    if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
}
```

Do not drop or recreate an existing database. Before applying the initial migration
to an existing database, inspect its schema and confirm that the School360 tables
are not already present.

## Enable PostGIS

The migration also contains `CREATE EXTENSION IF NOT EXISTS postgis`. To enable and
verify the extension explicitly:

```powershell
& "$pgBin\psql.exe" -X -v ON_ERROR_STOP=1 -U postgres -h localhost -p 5432 -d school360 `
    -c 'CREATE EXTENSION IF NOT EXISTS postgis;' `
    -c 'SELECT PostGIS_Full_Version();'
if ($LASTEXITCODE -ne 0) { throw 'PostGIS setup or verification failed.' }
```

The migration role needs permission to create the extension, and the matching
PostGIS 3.7 files must be installed for PostgreSQL 18.

## Apply migration and seed

Run the migration only once on an empty School360 application schema. `-1` wraps
the migration in one transaction, and `ON_ERROR_STOP` makes `psql` stop on an SQL
error. A failed migration is rolled back:

```powershell
& "$pgBin\psql.exe" -X -1 -v ON_ERROR_STOP=1 -U postgres -h localhost -p 5432 -d school360 `
    -f "$projectRoot\database\migrations\V1__init.sql"
if ($LASTEXITCODE -ne 0) { throw 'V1 migration failed; inspect the psql error before retrying.' }
```

Load the reference seed only after the migration succeeds. It uses
`ON CONFLICT (name) DO NOTHING` and can safely be rerun:

```powershell
& "$pgBin\psql.exe" -X -1 -v ON_ERROR_STOP=1 -U postgres -h localhost -p 5432 -d school360 `
    -f "$projectRoot\database\seed\V1__reference_data.sql"
if ($LASTEXITCODE -ne 0) { throw 'Facility reference seed failed.' }
```

These commands applied the SQL files directly with `psql`; Flyway was not invoked,
so no Flyway schema-history table was created.

## Verification SQL

Connect to `school360` with `psql` and run the following catalog checks:

```sql
-- Expected application tables (result: 10).
WITH expected(name) AS (
    VALUES ('districts'), ('blocks'), ('schools'), ('users'), ('facilities'),
           ('school_facilities'), ('issues'), ('issue_images'),
           ('issue_status_history'), ('verifications')
)
SELECT count(*) AS existing_tables
FROM expected
WHERE to_regclass('public.' || name) IS NOT NULL;

-- Foreign keys (13), primary keys (10), unique constraints (7), checks (8).
SELECT c.contype, count(*) AS constraint_count
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
      'districts', 'blocks', 'schools', 'users', 'facilities',
      'school_facilities', 'issues', 'issue_images',
      'issue_status_history', 'verifications'
  )
GROUP BY c.contype
ORDER BY c.contype;

-- Application indexes, including primary-key and unique-constraint indexes (32).
SELECT count(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'districts', 'blocks', 'schools', 'users', 'facilities',
      'school_facilities', 'issues', 'issue_images',
      'issue_status_history', 'verifications'
  );

-- PostGIS extension version and runtime build details.
SELECT extversion
FROM pg_extension
WHERE extname = 'postgis';
SELECT PostGIS_Full_Version();

-- Facility catalog (10 rows; no schools are seeded).
SELECT count(*) AS facility_count FROM facilities;
SELECT name FROM facilities ORDER BY name;
```

For table-by-table primary keys, foreign keys, unique constraints, check
constraints, and index definitions, query `pg_constraint` and `pg_indexes` for the
ten application tables listed above. The verified schema matches the entities,
primary keys, foreign keys, and relationships in
[`er-diagram.md`](../diagrams/er-diagram.md).

## Verified database results

- Application tables: 10 of 10.
- Foreign keys: 13.
- Primary keys: 10 (one `id` key per table).
- Unique constraints: 7.
- Check constraints: 8.
- Indexes on application tables: 32, including primary-key and unique indexes.
- PostGIS extension: enabled, version 3.7.0.
- Facility reference records: 10.
- Seed rerun: 0 duplicate rows inserted.
- Issue status history: append-only trigger present.

No PostgreSQL installation, service, or authentication configuration changes were
needed. No installation issues remain.
