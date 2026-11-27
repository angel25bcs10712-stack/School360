# School360 Voice

**Speak. Discover. Report. Improve.** A Hindi-first civic-tech prototype for
finding government-school information and reporting infrastructure problems in
Kanpur, Uttar Pradesh.

## Why this exists

Parents and community members can face language, literacy, and navigation barriers
when seeking school infrastructure information or reporting a concern. School360
Voice makes voice the primary interaction and keeps a text fallback available.

## What works

- Hindi browser speech recognition where supported, spoken Hindi responses, and a
  live voice-state indicator; typing remains available without microphone permission.
- A persistent English/हिंदी language switch for the interface, assistant prompts,
  dates, report categories/statuses, and speech locale. School names and submitted
  report descriptions remain in their original language.
- Deterministic Hindi/English intents for school search, infrastructure questions,
  issue reporting, report tracking, and help; no LLM key or network AI is required.
- School search and school facility details from PostgreSQL, including explicit
  verification states.
- Conversational report intake, input validation, duplicate detection, transactional
  database persistence, report IDs displayed after submission, and status history.
- Report IDs are shown in the assistant chat and saved under **My reports** in the
  same browser; users can enter an ID there to check its current status.
- Report lookup and a live dashboard with school/report counts, categories, filters,
  recent items, and password-protected demo status changes.
- One-container Node API + static frontend, PostgreSQL/PostGIS, health checks, and
  persistent Docker database volume.

## Technology

- Browser HTML, CSS, JavaScript modules, Web Speech API and SpeechSynthesis API.
- Node.js 22 HTTP API and PostgreSQL `pg` client.
- PostgreSQL 16 with PostGIS; the original schema remains the foundation.
- Docker Compose for a one-command local demonstration.

## Start with Docker

Install and start Docker Desktop/Engine, then run in the repository root:

```powershell
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). On first start, Compose
initializes the database, schema, facilities, and clearly labelled demonstration
records. The app health endpoint is [http://localhost:3000/api/health](http://localhost:3000/api/health).
The database is mapped to host port `5433` by default to avoid conflicting with a
local PostgreSQL service already using `5432`.

No `.env` file or AI provider key is needed. To change the demo administrator
password or ports, copy `.env.example` to `.env` and update it before startup.
The default demo admin password is `school360-demo-admin`; it is public and is
**not suitable for a real deployment**.

Stop with `Ctrl+C`. `docker compose down` stops containers but preserves the
database volume. `docker compose down -v` deletes the local demo database volume.

## Run locally without Docker

You need Node.js 20+ and a PostgreSQL/PostGIS database. For a **new, disposable
database**, apply `V1__init.sql`, `V1__reference_data.sql`,
`V2__voice_reports.sql`, then optionally `V2__demo_data.sql`, in that order.
Do not apply the initial migration to a database that already contains these
tables; use only the forward migration there and inspect the target first. Do not
add demo records to a database containing real operational data.

```powershell
$env:DATABASE_URL = 'postgres://postgres@localhost:5432/school360'
$env:ADMIN_PASSWORD = 'choose-a-local-demo-password'
npm --prefix backend install
npm --prefix backend start
```

Open `http://localhost:3000`. The sample connection assumes local PostgreSQL
authentication accepts the `postgres` role; supply your own password through a
local environment variable if required, never a committed file. If using the
existing local database described in
[`docs/database-setup.md`](docs/database-setup.md), preserve its credentials and
inspect schema state before applying migrations. Do not put database passwords in
source control.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database-backed health check |
| GET | `/api/schools?q=&district=&type=` | Search schools |
| GET | `/api/schools/:id` | School and infrastructure records |
| POST | `/api/reports` | Create a report; returns its database ID |
| GET | `/api/reports?schoolId=&category=&status=` | Filter reports |
| GET | `/api/reports/:id` | Retrieve report status |
| GET | `/api/admin/dashboard` | Live summary and recent reports |
| PATCH | `/api/admin/reports/:id/status` | Admin status update |

Status changes require `x-admin-password` to match `ADMIN_PASSWORD`.

## Data limitations and verification

The V2 Docker initializer adds one **DEMO DATA** Kanpur school with a synthetic,
demo-only UDISE placeholder, no coordinates, and infrastructure
conditions marked `UNKNOWN`. It is not a real school. The facility reference
catalog is taxonomy only; it does not assert a school's condition. No real-world
school infrastructure facts or coordinates are fabricated. Real deployments
should import an authoritative school directory and dated, attributable inspections.

Issue verification is `UNVERIFIED` until a real verification workflow is completed.
The demo has no real authentication, identity verification, notification delivery,
or public-service integration. Admin password checking is for a local prototype,
not a production security boundary.

## Browser microphone and speech

Allow microphone access when the browser prompts. Recognition support depends on
the browser and may require a secure context; `localhost` is generally treated as
secure. The app enters `listening` only after the browser reports recognition has
started. If Hindi recognition is explicitly reported unsupported, the next attempt
uses English (India); permission denial, missing devices, unsupported recognition,
or speech service errors are displayed, and text input remains usable. Hindi speech
output depends on the browser/operating system having a Hindi voice; the written
response is always shown.

## Optional integrations

No external AI, speech, maps, or geocoding service is configured. Intent handling
is local and deterministic. No API credentials are required. The optional key
placeholder in `.env.example` is not used by the app.

## Tests

```powershell
npm --prefix backend test
node --check backend/src/server.js
node --check backend/src/school-service.js
docker compose config
```

For the full database-backed workflow, start Docker and run Compose; then exercise
school search, report submission, `/api/reports/:id`, dashboard counts, and admin
status updates. The build plan records environment-dependent test limitations.

## Demo credentials

- Admin: password `school360-demo-admin` (local prototype only).
- Citizen reports are anonymous unless a person voluntarily enters their name or
  contact details; the prototype does not implement citizen accounts.

## Finding a report ID

A report ID is generated only after a report is successfully submitted. The
assistant displays it in the chat and in a highlighted card with a **Track status**
button. The ID is also saved under **My reports** in the same browser. If no report
has been submitted yet, there is no report ID to look up.

## Publish to GitHub

This project is published at
[angel25bcs10712-stack/School360](https://github.com/angel25bcs10712-stack/School360).
After cloning it, push future changes from the project directory:

```powershell
git add .
git commit -m "Describe your change"
git push
```

Review `.env`, local data, and Git status before publishing. Do not publish real
database credentials, citizen reports, or personal information.
