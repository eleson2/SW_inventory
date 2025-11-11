-- Import IBM Mainframe Products
-- Each product includes at least 2 versions with realistic version numbers and PTF levels

DO $$
DECLARE
    v_ibm_id uuid;
    v_software_id uuid;
    v_version_id uuid;
BEGIN
    -- Get IBM vendor ID
    SELECT id INTO v_ibm_id FROM vendors WHERE code = 'IBM';

    IF v_ibm_id IS NULL THEN
        RAISE EXCEPTION 'IBM vendor not found. Please run test-data.sql first.';
    END IF;

    -- 1. CICS Transaction Server
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'CICS Transaction Server', 'Customer Information Control System - Transaction processing system', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V5R5M0', 'PTF UI72345', '2021-03-15', false),
        (v_software_id, 'V5R6M0', 'PTF UI73456', '2022-09-20', false),
        (v_software_id, 'V6R0M0', 'PTF UI74567', '2023-11-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 2. IMS Database Manager
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'IMS Database Manager', 'Information Management System - Hierarchical database and transaction manager', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V15R1M0', 'PTF UI80123', '2020-06-10', false),
        (v_software_id, 'V15R2M0', 'PTF UI81234', '2022-03-25', false),
        (v_software_id, 'V15R3M0', 'PTF UI82345', '2024-01-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 3. DB2 for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'DB2 for z/OS', 'Relational database management system for mainframe', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V12R1M0', 'PTF UI90123', '2020-10-05', false),
        (v_software_id, 'V13R1M0', 'PTF UI91234', '2022-08-15', false),
        (v_software_id, 'V13R2M0', 'PTF UI92345', '2024-02-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 4. MQ for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'MQ for z/OS', 'Message queueing middleware for reliable application integration', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V9R2M0', 'PTF UI50123', '2021-04-12', false),
        (v_software_id, 'V9R3M0', 'PTF UI51234', '2023-06-18', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 5. WebSphere Application Server for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'WebSphere Application Server for z/OS', 'Java application server for enterprise applications', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V9R0M0', 'PTF UI60123', '2020-11-08', false),
        (v_software_id, 'V9R1M0', 'PTF UI61234', '2023-03-22', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 6. z/OS Operating System
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'z/OS', 'IBM mainframe operating system', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI00123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI01234', '2022-09-30', false),
        (v_software_id, 'V3R1M0', 'PTF UI02345', '2024-09-27', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 7. RACF (Resource Access Control Facility)
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'RACF', 'Security management product for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI10123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI11234', '2022-09-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 8. JES2 (Job Entry Subsystem)
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'JES2', 'Job entry subsystem for z/OS batch processing', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI20123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI21234', '2022-09-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 9. DFSMS (Data Facility Storage Management Subsystem)
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'DFSMS', 'Storage management subsystem for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI30123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI31234', '2022-09-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 10. SMP/E (System Modification Program/Extended)
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'SMP/E', 'Tool for installing and maintaining z/OS software', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V3R6M0', 'PTF UI40123', '2019-10-15', false),
        (v_software_id, 'V3R7M0', 'PTF UI41234', '2021-12-20', false),
        (v_software_id, 'V3R8M0', 'PTF UI42345', '2023-11-10', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 11. IBM Connect:Direct
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'Connect:Direct', 'Secure point-to-point file transfer solution', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V6R1M0', 'PTF UI43123', '2021-05-20', false),
        (v_software_id, 'V6R2M0', 'PTF UI44234', '2023-08-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 12. IBM Tivoli NetView
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'Tivoli NetView', 'Network management and automation for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V6R2M0', 'PTF UI45123', '2020-07-10', false),
        (v_software_id, 'V6R3M0', 'PTF UI46234', '2022-11-22', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 13. IBM Tivoli Workload Scheduler
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'Tivoli Workload Scheduler', 'Enterprise workload automation for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V9R4M0', 'PTF UI47123', '2021-02-15', false),
        (v_software_id, 'V9R5M0', 'PTF UI48234', '2023-05-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 14. IBM COBOL for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'COBOL for z/OS', 'COBOL compiler and runtime for mainframe applications', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V6R3M0', 'PTF UI49123', '2020-12-01', false),
        (v_software_id, 'V6R4M0', 'PTF UI50234', '2023-10-15', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 15. IBM PL/I for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'PL/I for z/OS', 'PL/I compiler and runtime for mainframe applications', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V5R3M0', 'PTF UI51123', '2021-01-20', false),
        (v_software_id, 'V5R4M0', 'PTF UI52234', '2023-07-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 16. IBM Fault Analyzer
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'Fault Analyzer', 'Interactive problem analysis tool for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V15R1M0', 'PTF UI53123', '2021-06-10', false),
        (v_software_id, 'V15R2M0', 'PTF UI54234', '2023-12-05', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 17. IBM File Manager
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'File Manager', 'Data file and database editor for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V14R1M0', 'PTF UI55123', '2021-03-15', false),
        (v_software_id, 'V14R2M0', 'PTF UI56234', '2023-09-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 18. IBM Debugger for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'Debugger for z/OS', 'Interactive debugging tool for mainframe applications', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V14R1M0', 'PTF UI57123', '2021-04-20', false),
        (v_software_id, 'V14R2M0', 'PTF UI58234', '2023-10-25', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 19. IBM z/OS Management Facility
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'z/OS Management Facility', 'Browser-based management interface for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI59123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI60234', '2022-09-30', false),
        (v_software_id, 'V3R1M0', 'PTF UI61345', '2024-09-27', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 20. IBM OMEGAMON
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'OMEGAMON', 'Real-time performance monitoring for z/OS environments', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V5R6M0', 'PTF UI62123', '2021-08-15', false),
        (v_software_id, 'V5R7M0', 'PTF UI63234', '2023-11-20', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 21. IBM z/OS Communications Server
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'z/OS Communications Server', 'TCP/IP and SNA networking for z/OS', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI64123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI65234', '2022-09-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    -- 22. IBM REXX for z/OS
    INSERT INTO software (vendor_id, name, description, active)
    VALUES (v_ibm_id, 'REXX for z/OS', 'Scripting language interpreter for z/OS automation', true)
    RETURNING id INTO v_software_id;

    INSERT INTO software_versions (software_id, version, ptf_level, release_date, is_current)
    VALUES
        (v_software_id, 'V2R4M0', 'PTF UI66123', '2020-09-25', false),
        (v_software_id, 'V2R5M0', 'PTF UI67234', '2022-09-30', true)
    RETURNING id INTO v_version_id;
    UPDATE software SET current_version_id = v_version_id WHERE id = v_software_id;

    RAISE NOTICE 'Successfully imported 22 IBM products with multiple versions';
END $$;
