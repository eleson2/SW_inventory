-- Mainframe Software Inventory System
-- Database Schema (PostgreSQL syntax - adaptable to DB2/Oracle/SQL Server)

-- ============================================================================
-- MASTER DATA TABLES
-- ============================================================================

-- Customers (Tenants)
CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    contact_info VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_customer_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

CREATE INDEX idx_customer_name ON customer(customer_name);

-- Software Vendors
CREATE TABLE vendor (
    vendor_id SERIAL PRIMARY KEY,
    vendor_name VARCHAR(100) NOT NULL UNIQUE,
    contact_info VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SOFTWARE CATALOG
-- ============================================================================

-- Individual Software Products
CREATE TABLE software_product (
    product_id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    vendor_designation VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    ptf_level VARCHAR(50),
    description TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_vendor FOREIGN KEY (vendor_id) 
        REFERENCES vendor(vendor_id) ON DELETE RESTRICT,
    CONSTRAINT uq_vendor_designation UNIQUE (vendor_id, vendor_designation)
);

CREATE INDEX idx_product_vendor ON software_product(vendor_id);
CREATE INDEX idx_product_name ON software_product(product_name);
CREATE INDEX idx_product_version ON software_product(version, ptf_level);

-- Software Packages (Tested bundles)
CREATE TABLE package (
    package_id SERIAL PRIMARY KEY,
    package_name VARCHAR(100) NOT NULL,
    package_version VARCHAR(50) NOT NULL,
    release_date DATE NOT NULL,
    description TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_package_version UNIQUE (package_name, package_version)
);

CREATE INDEX idx_package_release ON package(release_date DESC);

-- Products included in each Package
CREATE TABLE package_product (
    package_product_id SERIAL PRIMARY KEY,
    package_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    is_mandatory BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pkgprod_package FOREIGN KEY (package_id) 
        REFERENCES package(package_id) ON DELETE CASCADE,
    CONSTRAINT fk_pkgprod_product FOREIGN KEY (product_id) 
        REFERENCES software_product(product_id) ON DELETE RESTRICT,
    CONSTRAINT uq_package_product UNIQUE (package_id, product_id)
);

CREATE INDEX idx_pkgprod_package ON package_product(package_id);
CREATE INDEX idx_pkgprod_product ON package_product(product_id);

-- ============================================================================
-- LPAR INVENTORY
-- ============================================================================

-- Logical Partitions
CREATE TABLE lpar (
    lpar_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    lpar_name VARCHAR(100) NOT NULL,
    environment VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lpar_customer FOREIGN KEY (customer_id) 
        REFERENCES customer(customer_id) ON DELETE RESTRICT,
    CONSTRAINT chk_lpar_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DECOMMISSIONED')),
    CONSTRAINT uq_lpar_name UNIQUE (lpar_name)
);

CREATE INDEX idx_lpar_customer ON lpar(customer_id);
CREATE INDEX idx_lpar_status ON lpar(status);

-- Package Installation History on LPARs
CREATE TABLE lpar_package_history (
    history_id SERIAL PRIMARY KEY,
    lpar_id INTEGER NOT NULL,
    package_id INTEGER NOT NULL,
    install_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT TRUE,
    installed_by VARCHAR(100),
    notes TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lparpkg_lpar FOREIGN KEY (lpar_id) 
        REFERENCES lpar(lpar_id) ON DELETE CASCADE,
    CONSTRAINT fk_lparpkg_package FOREIGN KEY (package_id) 
        REFERENCES package(package_id) ON DELETE RESTRICT,
    CONSTRAINT chk_date_order CHECK (end_date IS NULL OR end_date >= install_date)
);

CREATE INDEX idx_lparpkg_lpar ON lpar_package_history(lpar_id);
CREATE INDEX idx_lparpkg_current ON lpar_package_history(lpar_id, is_current);
CREATE INDEX idx_lparpkg_install_date ON lpar_package_history(install_date DESC);

-- Actual Software installed on LPARs
CREATE TABLE lpar_software (
    lpar_software_id SERIAL PRIMARY KEY,
    lpar_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    install_date DATE NOT NULL,
    removed_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    deviation_reason VARCHAR(255),
    installed_by VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lparsoft_lpar FOREIGN KEY (lpar_id) 
        REFERENCES lpar(lpar_id) ON DELETE CASCADE,
    CONSTRAINT fk_lparsoft_product FOREIGN KEY (product_id) 
        REFERENCES software_product(product_id) ON DELETE RESTRICT,
    CONSTRAINT chk_software_date_order CHECK (removed_date IS NULL OR removed_date >= install_date)
);

CREATE INDEX idx_lparsoft_lpar ON lpar_software(lpar_id);
CREATE INDEX idx_lparsoft_product ON lpar_software(product_id);
CREATE INDEX idx_lparsoft_active ON lpar_software(lpar_id, is_active);
CREATE INDEX idx_lparsoft_install_date ON lpar_software(install_date DESC);

-- ============================================================================
-- AUDIT TRAIL
-- ============================================================================

-- Optional: Change Tracking Table
CREATE TABLE audit_log (
    audit_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL,
    changed_by VARCHAR(100),
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB,
    new_values JSONB,
    CONSTRAINT chk_audit_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_date ON audit_log(change_date DESC);
