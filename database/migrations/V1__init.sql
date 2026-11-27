CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE districts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    state_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_districts_name_state UNIQUE (name, state_name)
);

CREATE TABLE blocks (
    id BIGSERIAL PRIMARY KEY,
    district_id BIGINT NOT NULL REFERENCES districts (id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_blocks_district_name UNIQUE (district_id, name)
);

CREATE TABLE schools (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks (id) ON DELETE RESTRICT,
    udise_code VARCHAR(11) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_schools_udise_code UNIQUE (udise_code),
    CONSTRAINT ck_schools_udise_code_format CHECK (udise_code ~ '^[0-9]{11}$'),
    CONSTRAINT ck_schools_location_coordinates CHECK (
        location IS NULL
        OR (
            ST_X(location::geometry) BETWEEN -180 AND 180
            AND ST_Y(location::geometry) BETWEEN -90 AND 90
        )
    )
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT REFERENCES schools (id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_users_role CHECK (role IN ('ADMIN', 'OFFICIAL', 'SCHOOL_STAFF', 'VERIFIER'))
);

CREATE TABLE facilities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE school_facilities (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools (id) ON DELETE RESTRICT,
    facility_id BIGINT NOT NULL REFERENCES facilities (id) ON DELETE RESTRICT,
    condition_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    notes TEXT,
    last_inspected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_school_facilities_school_facility UNIQUE (school_id, facility_id),
    CONSTRAINT ck_school_facilities_condition CHECK (
        condition_status IN ('GOOD', 'NEEDS_REPAIR', 'DAMAGED', 'UNKNOWN')
    )
);

CREATE TABLE issues (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools (id) ON DELETE RESTRICT,
    reported_by_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    assigned_to_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT ck_issues_status CHECK (
        status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED')
    ),
    CONSTRAINT ck_issues_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE TABLE issue_images (
    id BIGSERIAL PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES issues (id) ON DELETE RESTRICT,
    storage_key TEXT NOT NULL UNIQUE,
    caption TEXT,
    content_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE issue_status_history (
    id BIGSERIAL PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES issues (id) ON DELETE RESTRICT,
    changed_by_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_issue_status_history_status CHECK (
        status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED')
    )
);

CREATE TABLE verifications (
    id BIGSERIAL PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES issues (id) ON DELETE RESTRICT,
    verified_by_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    result VARCHAR(10) NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_verifications_result CHECK (result IN ('APPROVED', 'REJECTED'))
);

CREATE INDEX idx_blocks_district_id ON blocks (district_id);
CREATE INDEX idx_schools_block_id ON schools (block_id);
CREATE INDEX idx_schools_location ON schools USING GIST (location);
CREATE INDEX idx_users_school_id ON users (school_id);
CREATE INDEX idx_school_facilities_school_id ON school_facilities (school_id);
CREATE INDEX idx_school_facilities_facility_id ON school_facilities (facility_id);
CREATE INDEX idx_issues_school_id ON issues (school_id);
CREATE INDEX idx_issues_reported_by_user_id ON issues (reported_by_user_id);
CREATE INDEX idx_issues_assigned_to_user_id ON issues (assigned_to_user_id);
CREATE INDEX idx_issues_status_priority ON issues (status, priority);
CREATE INDEX idx_issue_images_issue_id ON issue_images (issue_id);
CREATE INDEX idx_issue_status_history_issue_created_at
    ON issue_status_history (issue_id, created_at DESC);
CREATE INDEX idx_issue_status_history_changed_by_user_id
    ON issue_status_history (changed_by_user_id);
CREATE INDEX idx_verifications_issue_created_at
    ON verifications (issue_id, created_at DESC);
CREATE INDEX idx_verifications_verified_by_user_id
    ON verifications (verified_by_user_id);

CREATE FUNCTION prevent_issue_status_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'issue_status_history records are append-only';
END;
$$;

CREATE TRIGGER trg_issue_status_history_append_only
BEFORE UPDATE OR DELETE ON issue_status_history
FOR EACH ROW
EXECUTE FUNCTION prevent_issue_status_history_mutation();
