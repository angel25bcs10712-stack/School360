INSERT INTO districts (name, state_name)
VALUES ('Kanpur Nagar', 'Uttar Pradesh')
ON CONFLICT (name, state_name) DO NOTHING;

INSERT INTO blocks (district_id, name)
SELECT id, 'DEMO DATA — Sample Block'
FROM districts
WHERE name = 'Kanpur Nagar' AND state_name = 'Uttar Pradesh'
ON CONFLICT (district_id, name) DO NOTHING;

INSERT INTO schools (block_id, udise_code, name, address, school_type)
SELECT b.id, '99999999999',
       'DEMO DATA — Sample Government Primary School',
       'Demonstration record only; not a real school or address.',
       'Government Primary'
FROM blocks b
JOIN districts d ON d.id = b.district_id
WHERE b.name = 'DEMO DATA — Sample Block'
  AND d.name = 'Kanpur Nagar'
  AND d.state_name = 'Uttar Pradesh'
ON CONFLICT (udise_code) DO NOTHING;

INSERT INTO school_facilities (school_id, facility_id, condition_status, verification_status, notes)
SELECT s.id, f.id, 'UNKNOWN', 'UNKNOWN',
       'DEMO DATA: facility condition has not been verified.'
FROM schools s
CROSS JOIN facilities f
WHERE s.udise_code = '99999999999'
  AND f.is_active
ON CONFLICT (school_id, facility_id) DO NOTHING;
