INSERT INTO facilities (name, description)
VALUES
    ('Drinking Water', 'Availability and condition of drinking water facilities.'),
    ('Toilets', 'Availability and condition of school toilet facilities.'),
    ('Electricity', 'Availability and condition of electrical supply and fittings.'),
    ('Classrooms', 'Availability and condition of classrooms.'),
    ('Furniture', 'Availability and condition of classroom furniture.'),
    ('Playground', 'Availability and condition of playground space and equipment.'),
    ('Boundary Wall', 'Availability and condition of the school boundary wall.'),
    ('Library', 'Availability and condition of library facilities.'),
    ('Internet Connectivity', 'Availability and condition of internet connectivity.'),
    ('Handwashing Facilities', 'Availability and condition of handwashing facilities.')
ON CONFLICT (name) DO NOTHING;
