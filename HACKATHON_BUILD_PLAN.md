# School360 Voice — Build Plan

## Existing project status

- The repository contained a PostgreSQL/PostGIS design: 10 tables, 13 foreign
  keys, a facility reference seed, and an append-only issue-status history trigger.
- The schema had no school/report API, application, or UI. The seed contained
  facilities only; it did not claim any real school or facility conditions.
- Docker CLI and Compose are installed in the current environment. At inspection,
  the Docker Engine was not running.

## Missing functionality

- Hindi-first, browser-native speech input and spoken responses.
- Deterministic intent recognition, school discovery, issue intake, and report lookup.
- A persistent API, report validation, duplicate detection, and admin status updates.
- Database fields for report category, voluntary reporter details, and verification.
- A responsive interface, container setup, demo instructions, and pitch content.

## Architecture decisions

- Keep PostgreSQL/PostGIS and the existing schema; add a forward-only V2 migration.
- Use a small Node.js HTTP API and PostgreSQL `pg` driver. Serve the static browser
  application from the same container to avoid a second service and CORS setup.
- Use the browser Web Speech APIs and a deterministic Hindi/English intent module;
  no external AI or speech-service key is required.
- Label all seeded school and facility rows DEMO DATA, mark infrastructure unknown,
  and provide no invented coordinates.
- Require the demo administrator password only for status mutations. The published
  default is for local demonstration, not production authentication.

## Implementation sequence

1. Inspect the existing SQL schema, reference data, documentation, and repository.
2. Add compatible schema changes and clearly labelled demonstration records.
3. Implement school/report/dashboard APIs with transactional writes and validation.
4. Build a responsive Hindi-first browser app and reusable voice state service.
5. Add Docker Compose, setup notes, a demo script, and pitch-deck content.
6. Run intent tests, syntax checks, Compose configuration checks, then exercise the
   container-backed API if Docker Engine is available.

## Testing strategy

- Unit-test Hindi/English intent classification and report-category extraction.
- Run Node syntax checks and the backend test runner.
- Verify Compose expansion and Docker image/application startup.
- Check health, search, details, database report creation, duplicate rejection,
  status lookup/update, and dashboard aggregation through HTTP.
- Verify no credentials/API keys are needed and all sample infrastructure stays
  explicitly unknown and unverified.

## Verification results and remaining checks

- Intent tests and Node syntax checks pass; Compose configuration validates.
- `docker compose up --build -d` built and started the Node 22 app and PostGIS 16
  database. Both Compose health checks reported healthy.
- Docker-backed HTTP tests verified health, the main page, school search/details,
  unknown/unverified infrastructure, report validation and persistence, duplicate
  rejection, lookup, admin authorization/status changes, and live dashboard counts.
  PostgreSQL confirmed all three append-only status-history entries for the test
  report. Report data also survived `docker compose down` / `up`, verifying the
  named database volume.
- The browser text-driven Hindi report flow was exercised from issue description
  through school selection and confirmation.
- Separate temporary PostgreSQL 18 test databases were removed. The pre-existing
  `school360` database was left untouched.

The integrated browser did not provide a working speech-recognition service during
testing, so microphone recognition and Hindi speech output still need verification
in a supported browser/device with microphone permission and a Hindi voice.
