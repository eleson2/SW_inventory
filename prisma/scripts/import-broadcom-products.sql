-- Import Broadcom Mainframe Products
-- Each product includes at least 2 versions with realistic version numbers
-- Broadcom uses "SO" (Service Option) instead of PTF

DO $$
DECLARE
    v_broadcom_id uuid;
    v_software_id uuid;
    v_version_id uuid;
BEGIN
    -- Get Broadcom vendor ID
    SELECT id INTO v_broadcom_id FROM vendors WHERE code = 'BROADCOM';

    IF v_broadcom_id IS NULL THEN
        RAISE EXCEPTION 'Broadcom vendor not found. Please run test-data.sql first.';
    END IF;

    -- 1. CA Endevor SCM
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Endevor SCM', 'Software Change Management for mainframe development', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '18.0', 'SO12345', '2020-05-15', false),
        (v_software_id, '18.1', 'SO13456', '2022-03-20', false),
        (v_software_id, '19.0', 'SO14567', '2024-01-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 2. CA ACF2
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA ACF2', 'Access Control Facility security system for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '16.0', 'SO15123', '2021-02-10', false),
        (v_software_id, '16.1', 'SO16234', '2023-08-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 3. CA Top Secret
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Top Secret', 'Security management system for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '16.0', 'SO17123', '2021-03-25', false),
        (v_software_id, '16.1', 'SO18234', '2023-09-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 4. CA IDMS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA IDMS', 'Integrated Database Management System', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '19.0', 'SO19123', '2020-11-05', false),
        (v_software_id, '20.0', 'SO20234', '2023-05-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 5. CA Datacom
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Datacom', 'High-performance database management system', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '15.0', 'SO21123', '2021-06-20', false),
        (v_software_id, '15.1', 'SO22234', '2023-12-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 6. CA InterTest
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA InterTest', 'Interactive testing and debugging for CICS and batch', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '10.0', 'SO23123', '2020-09-15', false),
        (v_software_id, '10.1', 'SO24234', '2022-11-22', false),
        (v_software_id, '11.0', 'SO25345', '2024-03-18', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 7. CA Xpediter
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Xpediter', 'Interactive debugging for CICS, IMS, and batch COBOL', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', 'SO26123', '2021-04-10', false),
        (v_software_id, '14.1', 'SO27234', '2023-10-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 8. CA File Master Plus
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA File Master Plus', 'Data management and testing tool', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '11.0', 'SO28123', '2020-12-08', false),
        (v_software_id, '11.1', 'SO29234', '2023-06-14', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 9. CA SYSVIEW
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA SYSVIEW', 'Real-time performance monitoring and management', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '16.0', 'SO30123', '2021-07-20', false),
        (v_software_id, '17.0', 'SO31234', '2024-02-05', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 10. CA TLMS (Tape Library Management System)
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA TLMS', 'Tape and virtual tape management system', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', 'SO32123', '2020-10-12', false),
        (v_software_id, '14.5', 'SO33234', '2023-04-18', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 11. CA Disk Backup and Restore
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Disk Backup and Restore', 'High-speed disk backup solution', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', 'SO34123', '2021-01-15', false),
        (v_software_id, '14.1', 'SO35234', '2023-07-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 12. CA SOLVE:FTS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA SOLVE:FTS', 'Automated file transfer and network management', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '12.0', 'SO36123', '2020-08-10', false),
        (v_software_id, '12.1', 'SO37234', '2022-12-15', false),
        (v_software_id, '13.0', 'SO38345', '2024-05-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 13. CA Mainframe Chorus
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Mainframe Chorus', 'Software intelligence and analysis platform', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '6.0', 'SO39123', '2021-09-05', false),
        (v_software_id, '6.1', 'SO40234', '2023-11-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 14. CA Output Management
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Output Management', 'Report distribution and management system', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '12.0', 'SO41123', '2020-11-18', false),
        (v_software_id, '12.1', 'SO42234', '2023-05-22', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 15. CA Workload Automation CA 7
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Workload Automation CA 7', 'Enterprise job scheduling and workload automation', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '12.0', 'SO43123', '2021-03-12', false),
        (v_software_id, '12.1', 'SO44234', '2023-09-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 16. CA Dataquery
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Dataquery', 'Ad-hoc query and reporting tool', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '15.0', 'SO45123', '2020-12-22', false),
        (v_software_id, '15.1', 'SO46234', '2023-06-28', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 17. CA Detector
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Detector', 'CICS performance monitoring and management', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '11.0', 'SO47123', '2021-05-08', false),
        (v_software_id, '11.1', 'SO48234', '2023-11-12', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 18. CA View
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA View', 'Report archive and distribution system', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', 'SO49123', '2020-10-30', false),
        (v_software_id, '14.1', 'SO50234', '2023-04-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 19. CA EXAMINE
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA EXAMINE', 'Dump analysis and problem determination tool', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '7.0', 'SO51123', '2021-06-15', false),
        (v_software_id, '7.1', 'SO52234', '2023-12-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 20. CA NetMaster
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA NetMaster', 'Network and systems management automation', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '12.2', 'SO53123', '2021-02-20', false),
        (v_software_id, '12.3', 'SO54234', '2023-08-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 21. CA PDSMAN
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA PDSMAN', 'PDS management and optimization tool', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '7.7', 'SO55123', '2020-09-10', false),
        (v_software_id, '7.8', 'SO56234', '2022-11-15', false),
        (v_software_id, '8.0', 'SO57345', '2024-03-22', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 22. CA Chorus Software Manager
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_broadcom_id, 'CA Chorus Software Manager', 'Software lifecycle management platform', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '5.0', 'SO58123', '2021-10-08', false),
        (v_software_id, '5.1', 'SO59234', '2024-01-12', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    RAISE NOTICE 'Successfully imported 22 Broadcom products with multiple versions';
END $$;
