# School360 Entity-Relationship Diagram

```mermaid
erDiagram
    districts {
        BIGSERIAL id PK
        VARCHAR name
        VARCHAR state_name
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    blocks {
        BIGSERIAL id PK
        BIGINT district_id FK
        VARCHAR name
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    schools {
        BIGSERIAL id PK
        BIGINT block_id FK
        VARCHAR udise_code UK
        VARCHAR name
        TEXT address
        GEOGRAPHY location
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    users {
        BIGSERIAL id PK
        BIGINT school_id FK
        VARCHAR full_name
        VARCHAR email UK
        TEXT password_hash
        VARCHAR role
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    facilities {
        BIGSERIAL id PK
        VARCHAR name UK
        TEXT description
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    school_facilities {
        BIGSERIAL id PK
        BIGINT school_id FK
        BIGINT facility_id FK
        VARCHAR condition_status
        TEXT notes
        TIMESTAMPTZ last_inspected_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    issues {
        BIGSERIAL id PK
        BIGINT school_id FK
        BIGINT reported_by_user_id FK
        BIGINT assigned_to_user_id FK
        VARCHAR title
        TEXT description
        VARCHAR status
        VARCHAR priority
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ resolved_at
    }

    issue_images {
        BIGSERIAL id PK
        BIGINT issue_id FK
        TEXT storage_key UK
        TEXT caption
        VARCHAR content_type
        TIMESTAMPTZ created_at
    }

    issue_status_history {
        BIGSERIAL id PK
        BIGINT issue_id FK
        BIGINT changed_by_user_id FK
        VARCHAR status
        TEXT comment
        TIMESTAMPTZ created_at
    }

    verifications {
        BIGSERIAL id PK
        BIGINT issue_id FK
        BIGINT verified_by_user_id FK
        VARCHAR result
        TEXT comments
        TIMESTAMPTZ created_at
    }

    districts ||--o{ blocks : contains
    blocks ||--o{ schools : contains
    schools ||--o{ users : has_staff
    schools ||--o{ school_facilities : tracks
    facilities ||--o{ school_facilities : categorizes
    schools ||--o{ issues : has
    users ||--o{ issues : reports
    users o|--o{ issues : assigned_to
    issues ||--o{ issue_images : includes
    issues ||--o{ issue_status_history : records
    users o|--o{ issue_status_history : changes
    issues ||--o{ verifications : receives
    users ||--o{ verifications : verifies
```

`school_facilities` is the join entity between a school and a facility catalog entry. A
school's tracked facility condition is distinct from an `issues` report; an issue does
not need a facility record to exist.
