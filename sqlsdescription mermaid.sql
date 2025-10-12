erDiagram
    CUSTOMER ||--o{ LPAR : "owns"
    VENDOR ||--o{ SOFTWARE_PRODUCT : "supplies"
    PACKAGE ||--o{ PACKAGE_PRODUCT : "contains"
    SOFTWARE_PRODUCT ||--o{ PACKAGE_PRODUCT : "included in"
    LPAR ||--o{ LPAR_PACKAGE_HISTORY : "has history"
    PACKAGE ||--o{ LPAR_PACKAGE_HISTORY : "installed on"
    LPAR ||--o{ LPAR_SOFTWARE : "runs"
    SOFTWARE_PRODUCT ||--o{ LPAR_SOFTWARE : "installed as"

    CUSTOMER {
        int customer_id PK
        string customer_name
        string contact_info
        string status
    }

    VENDOR {
        int vendor_id PK
        string vendor_name
        string contact_info
    }

    SOFTWARE_PRODUCT {
        int product_id PK
        int vendor_id FK
        string product_name
        string vendor_designation
        string version
        string ptf_level
        string description
    }

    PACKAGE {
        int package_id PK
        string package_name
        string package_version
        date release_date
        string description
    }

    PACKAGE_PRODUCT {
        int package_product_id PK
        int package_id FK
        int product_id FK
        boolean is_mandatory
        string notes
    }

    LPAR {
        int lpar_id PK
        int customer_id FK
        string lpar_name
        string environment
        string status
    }

    LPAR_PACKAGE_HISTORY {
        int history_id PK
        int lpar_id FK
        int package_id FK
        date install_date
        date end_date
        boolean is_current
        string installed_by
        string notes
    }

    LPAR_SOFTWARE {
        int lpar_software_id PK
        int lpar_id FK
        int product_id FK
        date install_date
        date removed_date
        boolean is_active
        string deviation_reason
        string installed_by
    }