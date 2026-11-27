# School360 Database Design

## Scope and technology

The initial schema targets PostgreSQL and is delivered as the Flyway versioned
migration `V1__init.sql`. It enables PostGIS and stores an optional school point as
`GEOGRAPHY(POINT, 4326)` so geographic distance and containment queries can be added
without changing the coordinate model. The PostGIS extension must be installed on the
database server, and the migration role must be allowed to create the extension.

All primary keys use `BIGSERIAL`. Timestamps use `TIMESTAMPTZ` with database defaults.
Foreign keys use restrictive deletion behavior to retain operational and audit
records; deactivate reference entries and users instead of deleting records in use.

## Entities

| Entity | Purpose |
| --- | --- |
| `districts` | Administrative districts, identified by district name and state. |
| `blocks` | Administrative blocks belonging to a district; names are unique within a district. |
| `schools` | Schools within blocks, identified by unique 11-digit UDISE code; optional PostGIS point location. |
| `users` | Platform accounts with a password hash, role, and optional associated school. |
| `facilities` | Reusable catalog of facility types, independent of issue reports. |
| `school_facilities` | Join/observation records tracking a facility's condition at a school. A school/facility pair is unique. |
| `issues` | Reported school problems, with current status, priority, reporter, and optional assignee. |
| `issue_images` | Image metadata and unique storage key for images associated with an issue; image bytes live in object storage. |
| `issue_status_history` | Append-only status events for an issue, including the optional actor and comment. |
| `verifications` | Verification decisions on issues, associated with the verifying user. |

## Relationships

- One district has many blocks; each block belongs to one district.
- One block has many schools; each school belongs to one block.
- Schools and facility catalog entries have a many-to-many relationship through `school_facilities`.
- One school has many issues; each issue has one reporting user and may have one assigned user.
- One issue has many image records, status history records, and verification records.
- One user may report many issues, change many status records, and create many verifications.
- A user may optionally be associated with a school, allowing district-level and platform-wide accounts.

See [er-diagram.md](../diagrams/er-diagram.md) for the corresponding Mermaid ER diagram.

## Business rules and constraints

- A school's UDISE code is required, unique, and constrained to 11 digits. No school
  or UDISE records are seeded.
- Passwords are stored only in `password_hash`; callers must use a suitable password
  hashing algorithm and must never persist plaintext passwords.
- User roles are limited to `ADMIN`, `OFFICIAL`, `SCHOOL_STAFF`, and `VERIFIER`.
- Issue statuses are limited to `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`,
  `REOPENED`, and `CLOSED`. Prior states are stored as status-history rows. A database
  trigger rejects updates and deletes to that history, while issue creation and status
  changes must write the current issue and its history event in the same transaction.
- Issue priorities are limited to `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`.
- Facility condition is limited to `GOOD`, `NEEDS_REPAIR`, `DAMAGED`, and `UNKNOWN`.
- Verification results are limited to `APPROVED` and `REJECTED`.
- School coordinates are optional. PostGIS geography uses SRID 4326 and the schema
  checks longitude and latitude ranges. The GiST index supports spatial queries.
- Facility condition records and issue reports are deliberately separate concepts.
  Recording a damaged facility does not create an issue automatically.
- Foreign keys, unique constraints, and check constraints enforce referential
  integrity, identifiers, and enumerated values. Indexes cover foreign-key lookups,
  issue filtering, history timelines, verification lookups, and spatial search.

## Reference data

`database/seed/V1__reference_data.sql` inserts the initial facility catalog only.
It is safe to rerun because facility names are unique and conflicts are ignored. It
does not add districts, blocks, schools, users, or fabricated UDISE codes.

## Future scalability

- Use the school geography column and GiST index for nearby-school and boundary
  queries; add district/block boundary geometries only when authoritative boundary
  data and query requirements are available.
- Keep image binaries in object storage and store opaque storage keys and metadata in
  PostgreSQL.
- Add workload-driven indexes and review query plans as reporting volume grows;
  consider partitioning high-volume history tables only after measuring growth.
- Apply status changes through a transactional service operation that updates
  `issues.status` and appends the corresponding history row together. Keep the event
  table append-only and use role permissions and audit procedures in deployment.
- Use Flyway for ordered schema changes and maintain backward-compatible migrations
  as application services are introduced.
