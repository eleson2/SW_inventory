-- Import BMC Mainframe Products
-- Each product includes at least 2 versions with realistic version numbers
-- BMC uses standard versioning (no PTF/SO levels for most products)

DO $$
DECLARE
    v_bmc_id uuid;
    v_software_id uuid;
    v_version_id uuid;
BEGIN
    -- First, ensure BMC vendor exists
    SELECT id INTO v_bmc_id FROM vendors WHERE code = 'BMC';

    IF v_bmc_id IS NULL THEN
        -- Create BMC vendor if it doesn't exist
        INSERT INTO vendors (name, code, website, active)
        VALUES ('BMC Software', 'BMC', 'https://www.bmc.com', true)
        RETURNING id INTO v_bmc_id;
        RAISE NOTICE 'Created BMC vendor';
    END IF;

    -- 1. BMC Control-M
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Control-M', 'Enterprise workload automation platform', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '9.0.20', NULL, '2021-03-10', false),
        (v_software_id, '9.0.21', NULL, '2023-07-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 2. BMC MainView for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'MainView for z/OS', 'Comprehensive monitoring and management for mainframe', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '12.0', NULL, '2020-11-20', false),
        (v_software_id, '12.1', NULL, '2022-09-25', false),
        (v_software_id, '13.0', NULL, '2024-02-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 3. BMC AMI DevX Code Coverage
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI DevX Code Coverage', 'COBOL code coverage and quality analysis', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '20.0', NULL, '2021-05-15', false),
        (v_software_id, '21.0', NULL, '2023-10-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 4. BMC AMI Ops Monitor for CICS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Ops Monitor for CICS', 'Real-time CICS transaction monitoring', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', NULL, '2020-12-08', false),
        (v_software_id, '14.5', NULL, '2023-06-12', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 5. BMC AMI Ops Monitor for Db2
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Ops Monitor for Db2', 'Database performance monitoring for DB2', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', NULL, '2021-01-20', false),
        (v_software_id, '14.5', NULL, '2023-07-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 6. BMC AMI Ops Monitor for IMS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Ops Monitor for IMS', 'IMS transaction and database monitoring', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '14.0', NULL, '2021-02-15', false),
        (v_software_id, '14.5', NULL, '2023-08-18', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 7. BMC AMI Data Analyzer
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Data Analyzer', 'Data quality and testing tool', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '13.0', NULL, '2020-10-05', false),
        (v_software_id, '13.5', NULL, '2022-12-10', false),
        (v_software_id, '14.0', NULL, '2024-04-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 8. BMC AMI Backup and Recovery
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Backup and Recovery', 'Automated backup and recovery solution', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '8.0', NULL, '2021-04-12', false),
        (v_software_id, '8.5', NULL, '2023-09-22', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 9. BMC AMI Command Center for Security
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Command Center for Security', 'Security compliance and audit management', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '12.0', NULL, '2020-09-18', false),
        (v_software_id, '12.5', NULL, '2023-03-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 10. BMC AMI Recovery for Db2
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Recovery for Db2', 'High-speed DB2 recovery solution', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '11.0', NULL, '2021-06-08', false),
        (v_software_id, '11.5', NULL, '2023-11-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 11. BMC AMI Utilities for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Utilities for z/OS', 'High-performance data management utilities', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '6.0', NULL, '2020-11-12', false),
        (v_software_id, '6.5', NULL, '2023-05-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 12. BMC AMI Change Analyzer for Db2
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Change Analyzer for Db2', 'Database change impact analysis', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '10.0', NULL, '2021-03-22', false),
        (v_software_id, '10.5', NULL, '2023-08-28', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 13. BMC AMI Cost Optimizer
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Cost Optimizer', 'Mainframe cost analysis and optimization', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '9.0', NULL, '2020-12-15', false),
        (v_software_id, '9.5', NULL, '2023-06-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 14. BMC AMI Security for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'AMI Security for z/OS', 'Security management and compliance', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '7.0', NULL, '2021-07-10', false),
        (v_software_id, '7.5', NULL, '2024-01-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 15. BMC Compuware Abend-AID
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware Abend-AID', 'Automated abend analysis and problem resolution', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '20.0', NULL, '2021-02-18', false),
        (v_software_id, '20.5', NULL, '2023-09-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 16. BMC Compuware File-AID
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware File-AID', 'Data file editing and management', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '17.0', NULL, '2020-10-22', false),
        (v_software_id, '17.5', NULL, '2023-04-28', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 17. BMC Compuware Strobe
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware Strobe', 'Application performance analysis and optimization', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '9.0', NULL, '2021-05-12', false),
        (v_software_id, '9.5', NULL, '2023-10-18', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 18. BMC Compuware Xpediter/TSO
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware Xpediter/TSO', 'Interactive batch COBOL debugger', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '15.0', NULL, '2020-11-30', false),
        (v_software_id, '15.5', NULL, '2023-05-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 19. BMC Compuware Xpediter/CICS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware Xpediter/CICS', 'Interactive CICS COBOL debugger', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '15.0', NULL, '2021-01-25', false),
        (v_software_id, '15.5', NULL, '2023-06-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 20. BMC Compuware ISPW
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware ISPW', 'Source code management and DevOps platform', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '20.0', NULL, '2021-04-20', false),
        (v_software_id, '20.5', NULL, '2023-11-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 21. BMC Compuware ThruPut Manager
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware ThruPut Manager', 'Workload and capacity management', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '7.0', NULL, '2020-09-15', false),
        (v_software_id, '7.5', NULL, '2022-11-20', false),
        (v_software_id, '8.0', NULL, '2024-03-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 22. BMC Compuware Topaz Workbench
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_bmc_id, 'Compuware Topaz Workbench', 'Modern IDE for mainframe development', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, '20.0', NULL, '2021-06-15', false),
        (v_software_id, '20.5', NULL, '2024-01-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    RAISE NOTICE 'Successfully imported 22 BMC products with multiple versions';
END $$;
