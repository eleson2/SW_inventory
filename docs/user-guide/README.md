# Software Inventory Management System - User Guide

Welcome to the Software Inventory Management System! This guide will help you understand and use all features of the application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Vendors](#managing-vendors)
4. [Managing Customers](#managing-customers)
5. [Managing Software](#managing-software)
6. [Managing Packages](#managing-packages)
7. [Managing LPARs](#managing-lpars)
8. [Deploying Packages](#deploying-packages)
9. [Rollback Operations](#rollback-operations)
10. [Activity Log](#activity-log)
11. [Reports](#reports)
12. [Tips & Best Practices](#tips--best-practices)

## Getting Started

### Accessing the System

1. Open your web browser (Chrome, Firefox, or Safari recommended)
2. Navigate to the application URL provided by your administrator
3. The system will load and display the dashboard

### Navigation

The main navigation menu is located at the top of every page:

- **Dashboard**: Overview and quick links
- **Vendors**: Software manufacturers
- **Customers**: Organizations using your services
- **Software**: Software product catalog
- **Packages**: Coordinated software releases
- **LPARs**: Customer environments
- **Activity**: Audit log of all changes
- **Reports**: Various reports and analytics

### User Interface Elements

**Search Bar**: Quickly find items by typing keywords

**Filters**: Narrow down results using dropdown filters

**Sort**: Click column headers to sort data

**Pagination**: Navigate through large lists (20 items per page)

**Action Buttons**: Blue buttons for primary actions (e.g., "Add Vendor")

## Dashboard Overview

The dashboard provides:
- Quick statistics (total vendors, software, customers, LPARs)
- Recent activity feed
- Quick links to common tasks
- System status indicators

## Managing Vendors

Vendors are software manufacturers like IBM, Broadcom, or BMC.

### Viewing Vendors

1. Click **Vendors** in the main navigation
2. You'll see a list of all vendors with:
   - Vendor code
   - Vendor name
   - Contact email
   - Status (Active/Inactive)

### Adding a New Vendor

1. Click **Add Vendor** button
2. Fill in the form:
   - **Vendor Name**: Full company name (e.g., "International Business Machines")
   - **Vendor Code**: Short code (e.g., "IBM") - must be UPPERCASE
   - **Website**: Optional company website (include https://)
   - **Contact Email**: Optional primary contact email
   - **Active**: Check to mark vendor as active
3. Click **Save** to create the vendor
4. Click **Cancel** to discard changes

**Clone Feature**: If you need to create a similar vendor, toggle "Clone from existing" and select a vendor to copy values from.

### Editing a Vendor

1. Click on any vendor in the list
2. Click **Edit** button on the detail page
3. Modify the fields as needed
4. Click **Save** to update
5. Click **Cancel** to discard changes

### Searching and Filtering

- **Search**: Type in the search box to find vendors by name or code
- **Status Filter**: Filter by Active or Inactive vendors
- **Column Filters**: Click the filter icon under each column to filter specific columns

## Managing Customers

Customers are organizations that own LPARs where software runs.

### Viewing Customers

1. Click **Customers** in the main navigation
2. You'll see a list showing:
   - Customer code
   - Customer name
   - Description
   - Status
   - Creation date

### Adding a New Customer

1. Click **Add Customer** button
2. Fill in the form:
   - **Customer Name**: Organization name
   - **Customer Code**: Short code (must be UPPERCASE)
   - **Description**: Optional notes about the customer
   - **Active**: Check to mark customer as active
3. Click **Save**

### Editing a Customer

1. Click on a customer in the list
2. Click **Edit** on the detail page
3. Make your changes
4. Click **Save**

### Viewing Customer's LPARs

From a customer detail page, you can see all LPARs owned by that customer. Click on any LPAR to view its details.

## Managing Software

Software products are individual applications (e.g., CICS, DB2, Endevor).

### Viewing Software

1. Click **Software** in the main navigation
2. You'll see:
   - Software name
   - Vendor
   - Current version
   - Status

### Adding New Software

1. Click **Add Software** button
2. Fill in the basic information:
   - **Software Name**: Product name
   - **Vendor**: Select the manufacturer
   - **Description**: Optional product description
   - **Active**: Mark as active
3. Add version information:
   - **Version**: Version number (e.g., "V5R6M0" or "2.4.0")
   - **PTF Level**: Program Temporary Fix level (e.g., "PTF12345")
   - **Release Date**: When this version was released
   - **End of Support**: When support ends (optional)
   - **Release Notes**: Optional notes about the version
   - **Is Current**: Check if this is the recommended version
4. Click **Save**

### Managing Software Versions

Each software product can have multiple versions tracked over time.

**Adding a Version**:
1. Edit the software
2. Scroll to "Version Management" section
3. Click **Add Version**
4. Fill in version details
5. Click **Save**

**Setting Current Version**:
- Only ONE version can be marked as "current"
- Check "Is Current" on the version you want to designate as current
- This is the version that will be recommended for new installations

**Viewing Version History**:
- All versions are displayed in chronological order
- Current version is highlighted
- You can see release dates and PTF levels for each version

### Searching Software

- Search by software name or vendor name
- Filter by vendor (dropdown)
- Filter by status (Active/Inactive)
- Use column filters for more precise searches

## Managing Packages

Packages are coordinated releases containing multiple software products that have been tested together.

### Understanding Packages

A package is like a "software bundle" that includes:
- Multiple software products
- Specific versions of each product
- Installation order

**Example**: "Q1 2025 Package" might include:
- CICS V5.6
- DB2 V12.1
- Endevor V18.1

### Viewing Packages

1. Click **Packages** in the main navigation
2. You'll see:
   - Package code
   - Package name
   - Version
   - Software count
   - Release date
   - Status

### Creating a Package

1. Click **Create Package** button
2. Fill in package information:
   - **Package Name**: Descriptive name (e.g., "Q1 2025 Release")
   - **Package Code**: Short code (e.g., "PKG-2025-Q1")
   - **Version**: Package version (e.g., "2025.1.0")
   - **Release Date**: When this package is/was released
   - **Description**: Optional notes
   - **Active**: Mark as active
3. Add software items:
   - Click **Add Item**
   - **Software**: Select the software product
   - **Version**: Select the specific version
   - **Order**: Installation sequence (1, 2, 3...)
4. Click **Save**

### Editing a Package

1. Click on a package
2. Click **Edit**
3. Modify package details or items
4. Click **Save**

**Adding/Removing Items**:
- Click **Add Item** to include more software
- Click the trash icon next to an item to remove it
- Reorder items by changing the order number

### Deploying a Package

See [Deploying Packages](#deploying-packages) section below.

## Managing LPARs

LPARs (Logical Partitions) are customer environments where software runs.

### Viewing LPARs

1. Click **LPARs** in the main navigation
2. You'll see:
   - LPAR code
   - LPAR name
   - Customer
   - Current package
   - Software count
   - Status

### Adding a New LPAR

1. Click **Add LPAR** button
2. Fill in the form:
   - **LPAR Name**: Environment name
   - **LPAR Code**: Short code (UPPERCASE)
   - **Customer**: Select the owning customer
   - **Current Package**: Optional - assign a package
   - **Description**: Optional notes
   - **Active**: Mark as active
3. Click **Save**

### Editing an LPAR

1. Click on an LPAR
2. Click **Edit**
3. Update LPAR details or installed software:
   - **Basic Info**: Name, code, customer, package
   - **Software Installations**: What's installed and which version
4. Click **Save**

### Managing Installed Software

From the LPAR edit page, you can:

**Add Software**:
1. Click **Add Software**
2. Select the software product
3. Select the version to install
4. Set installation date
5. Click **Save**

**Update Software**:
1. Change the version in the dropdown
2. Click **Save**

**Remove Software**:
1. Click the trash icon next to the software
2. Confirm removal

### Viewing Package Compliance

On an LPAR detail page, you can see:
- **Assigned Package**: What package should be installed
- **Actual Installation**: What's currently installed
- **Compliance Status**: Whether LPAR matches the package
- **Discrepancies**: What's different (if any)

## Deploying Packages

Package deployment assigns a package to one or more LPARs.

### Starting a Deployment

1. Navigate to the package you want to deploy
2. Click **Deploy Package** button
3. You'll see the deployment wizard:

### Step 1: Review Package Contents

- Review what software is included
- Check versions and PTF levels

### Step 2: Select Target LPARs

- View all available LPARs
- Select one or more LPARs for deployment
- See current package for each LPAR
- Filter by customer if needed

### Step 3: Review Impact

The system shows what will change:
- **Additions**: Software being added
- **Updates**: Software being upgraded
- **Downgrades**: Software being downgraded (if any)
- **No Change**: Software already at correct version
- **Missing**: Software not yet installed

### Step 4: Confirm and Deploy

1. Review all changes carefully
2. Add deployment notes (optional but recommended)
3. Click **Confirm Deployment**
4. System will update LPAR assignments
5. Installations are tracked with timestamps

### Monitoring Deployment Status

After deployment:
- Check LPAR compliance status
- View activity log for deployment record
- Verify software versions on target LPARs

## Rollback Operations

If software causes problems after deployment, you can roll it back to the previous version.

### When to Rollback

Rollback when:
- New version causes system issues
- Performance problems occur
- Compatibility issues arise
- Emergency situation requires quick reversion

### Performing a Rollback

1. Navigate to the LPAR with the problem
2. Click **Edit**
3. Find the problematic software in the list
4. Click **Rollback** button next to it
5. In the rollback dialog:
   - **Previous Version**: System shows what it will revert to
   - **Reason**: Enter why you're rolling back (required)
   - **Notes**: Optional additional details
6. Click **Confirm Rollback**

### After Rollback

The system will:
- Revert to the previous version
- Mark the software as "rolled back"
- Record the timestamp
- Log the reason in the audit trail
- Update compliance status

### Rollback History

View rollback history:
- On LPAR detail page (shows all rollbacks for that LPAR)
- On software detail page (shows rollbacks across all LPARs)
- In activity log (searchable)

## Activity Log

The activity log tracks ALL changes in the system.

### Viewing Activity Log

1. Click **Activity** in the main navigation
2. You'll see:
   - When the change occurred
   - What entity was changed (vendor, customer, software, etc.)
   - What action was taken (create, update, delete, rollback)
   - Who made the change (when authentication is enabled)
   - Before/after values

### Filtering Activity

- **Date Range**: Filter by time period
- **Entity Type**: Show only changes to specific entities
- **Action Type**: Filter by create, update, delete, or rollback
- **Search**: Find specific changes

### Understanding Change Details

Each activity entry shows:
- **Entity**: What was changed
- **Action**: What happened
- **Changes**: What values changed (old → new)
- **Timestamp**: Exact time of change

## Reports

The system provides various reports for analysis.

### Software by Customer Report

Shows what software each customer has installed:
1. Click **Reports** → **Software by Customer**
2. You'll see a breakdown by:
   - Customer name
   - Software products
   - Versions installed
   - Number of LPARs

Use this to:
- Verify all customers have necessary software
- Plan upgrades
- Track software distribution

### Compliance Report

Shows which LPARs are compliant with assigned packages:
- Green: Fully compliant
- Yellow: Minor discrepancies
- Red: Major discrepancies or missing software

### Version Adoption Report

Shows adoption rates for software versions:
- How many LPARs use each version
- Percentage of total installations
- Identify outdated installations

### Rollback History Report

Shows all rollbacks across the system:
- When they occurred
- Why they were performed
- Impact on system

## Tips & Best Practices

### General Usage

1. **Use Descriptive Names**: Make codes and names clear and meaningful
2. **Add Descriptions**: Include notes to help future users understand context
3. **Regular Updates**: Keep software versions current in the system
4. **Document Changes**: Use the notes field when making important changes

### Package Management

1. **Test Packages**: Test on a non-production LPAR first
2. **Coordinate Releases**: Bundle related updates together
3. **Version Carefully**: Use semantic versioning (Major.Minor.Patch)
4. **Document Dependencies**: Be clear about software dependencies and installation order

### LPAR Management

1. **Keep Updated**: Regularly update software on LPARs
2. **Monitor Compliance**: Check compliance status frequently
3. **Document Issues**: Record problems in rollback reasons
4. **Plan Upgrades**: Schedule updates during maintenance windows

### Rollback Strategy

1. **Document First**: Always explain why you're rolling back
2. **Act Quickly**: Don't delay if there's a problem
3. **Test After**: Verify system stability after rollback
4. **Plan Forward**: Determine why the new version failed

### Search & Filter

1. **Use Column Filters**: More precise than general search
2. **Combine Filters**: Use multiple filters together
3. **Bookmark Searches**: Save commonly used filter combinations
4. **Clear Filters**: Use "Clear all filters" to start fresh

### Data Entry

1. **UPPERCASE Codes**: System enforces this automatically
2. **Consistent Format**: Use same patterns (e.g., "PKG-2025-Q1")
3. **Check Duplicates**: System prevents duplicate codes
4. **Active Flag**: Deactivate instead of deleting

## Getting Help

### Common Questions

**Q: Why can't I delete a vendor?**
A: The system uses "soft deletes" - mark as inactive instead of deleting.

**Q: How do I undo a change?**
A: Check the activity log for the old value, then edit the record to restore it.

**Q: What's the difference between package version and software version?**
A: Package version is the bundle version. Software version is the individual product version.

**Q: Can I deploy to multiple LPARs at once?**
A: Yes! Select multiple LPARs in the deployment wizard.

**Q: What happens if I rollback software?**
A: Only that specific software reverts. Other software in the package is unchanged.

### Support

For technical issues or questions:
1. Check the activity log for recent changes
2. Contact your system administrator
3. Reference this user guide
4. Check the developer documentation for technical details

### Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Submit forms
- **Esc**: Close dialogs
- **Ctrl+F** (or Cmd+F): Browser search within page
- **Click header**: Sort table by that column

## Glossary

**LPAR**: Logical Partition - A customer environment where software runs

**PTF**: Program Temporary Fix - IBM's term for patches/fixes

**Package**: A coordinated bundle of software products tested together

**Compliance**: Whether an LPAR has the software versions it should have

**Rollback**: Reverting software to a previous version

**Active/Inactive**: Status flag - inactive items are hidden by default

**Soft Delete**: Marking as inactive instead of permanently deleting

**Audit Log**: Complete history of all system changes

**Master-Detail**: Parent-child relationship (e.g., package contains items)

---

**Last Updated**: [Current Date]
**Version**: 1.0
**System**: Software Inventory Management System
