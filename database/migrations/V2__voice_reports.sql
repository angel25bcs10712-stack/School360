ALTER TABLE schools
    ADD COLUMN school_type VARCHAR(30) NOT NULL DEFAULT 'Government';

ALTER TABLE school_facilities
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    ADD CONSTRAINT ck_school_facilities_verification_status
        CHECK (verification_status IN ('VERIFIED', 'UNVERIFIED', 'UNKNOWN'));

ALTER TABLE issues
    ADD COLUMN issue_category VARCHAR(20) NOT NULL DEFAULT 'OTHER',
    ADD COLUMN reporter_name VARCHAR(255),
    ADD COLUMN reporter_contact VARCHAR(255),
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE issues
    DROP CONSTRAINT ck_issues_status,
    ADD CONSTRAINT ck_issues_status CHECK (
        status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED',
                   'REOPENED', 'CLOSED', 'REJECTED')
    ),
    ADD CONSTRAINT ck_issues_category CHECK (
        issue_category IN ('WATER', 'TOILETS', 'ELECTRICITY', 'CLASSROOM',
                           'FURNITURE', 'CLEANLINESS', 'OTHER')
    ),
    ADD CONSTRAINT ck_issues_verification_status CHECK (
        verification_status IN ('VERIFIED', 'UNVERIFIED', 'UNKNOWN')
    );

ALTER TABLE issue_status_history
    DROP CONSTRAINT ck_issue_status_history_status,
    ADD CONSTRAINT ck_issue_status_history_status CHECK (
        status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED',
                   'REOPENED', 'CLOSED', 'REJECTED')
    );

CREATE INDEX idx_issues_category_created_at
    ON issues (issue_category, created_at DESC);

INSERT INTO users (school_id, full_name, email, password_hash, role, is_active)
VALUES (
    NULL,
    'School360 Voice report intake',
    'citizen-reports@school360.local',
    'DISABLED_ACCOUNT_NO_LOGIN',
    'OFFICIAL',
    FALSE
)
ON CONFLICT (email) DO NOTHING;
