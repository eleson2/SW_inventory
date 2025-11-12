# Getting Started with Software Inventory Management System

This quick start guide will help you get up and running with the system in just a few minutes.

## Your First Login

1. **Open your web browser** (Chrome, Firefox, or Safari)
2. **Navigate to** the URL provided by your administrator
3. **You'll see the Dashboard** - this is your home page

## Understanding the Interface

### Main Navigation Bar

Located at the top of every page:

```
[Dashboard] [Vendors] [Customers] [Software] [Packages] [LPARs] [Activity] [Reports]
```

- **Dashboard**: Your home page with overview and statistics
- **Vendors**: Software manufacturers (IBM, Broadcom, etc.)
- **Customers**: Organizations that use your services
- **Software**: Software product catalog
- **Packages**: Coordinated software releases
- **LPARs**: Customer environments where software runs
- **Activity**: Complete history of all changes
- **Reports**: Various reports and analytics

### Common UI Elements

**🔍 Search Box**
- Type keywords to find items quickly
- Works across most pages
- Searches names, codes, and descriptions

**🔽 Filter Dropdowns**
- Located next to search box
- Filter by status, vendor, customer, etc.
- Can combine multiple filters

**⚙️ Action Buttons**
- Blue buttons for primary actions (e.g., "Add Vendor")
- Gray buttons for secondary actions (e.g., "Cancel")
- Red buttons for delete/remove actions

**📄 Data Tables**
- Click column headers to sort
- Click filter icon under headers for column-specific filtering
- Click any row to view details

**📑 Pagination**
- Shows 20 items per page
- Use arrows to navigate pages
- Shows current page and total pages

## Common Tasks - Quick Guide

### Task 1: Add a Vendor

**Why**: Before adding software, you need to define who makes it.

**Steps**:
1. Click **Vendors** in navigation
2. Click **Add Vendor** button
3. Fill in:
   - Name: "International Business Machines"
   - Code: "IBM" (system converts to uppercase)
   - Website: "https://www.ibm.com" (optional)
   - Email: "contact@ibm.com" (optional)
4. Check **Active** checkbox
5. Click **Save**

**Result**: New vendor appears in the list.

### Task 2: Add Software

**Why**: Track software products that can be installed.

**Steps**:
1. Click **Software** in navigation
2. Click **Add Software** button
3. Fill in:
   - Name: "Customer Information Control System"
   - Vendor: Select "IBM" from dropdown
   - Description: Optional details
4. Add first version:
   - Version: "V5.6"
   - PTF Level: "PTF12345"
   - Release Date: Select date
   - Check **Is Current** (this is the recommended version)
5. Click **Save**

**Result**: New software appears in catalog.

### Task 3: Add a Customer

**Why**: Track who owns the LPARs where software runs.

**Steps**:
1. Click **Customers** in navigation
2. Click **Add Customer** button
3. Fill in:
   - Name: "Acme Corporation"
   - Code: "ACME"
   - Description: "Manufacturing customer"
4. Check **Active** checkbox
5. Click **Save**

**Result**: New customer appears in the list.

### Task 4: Add an LPAR

**Why**: Define the environments where software is installed.

**Steps**:
1. Click **LPARs** in navigation
2. Click **Add LPAR** button
3. Fill in:
   - Name: "Production LPAR"
   - Code: "PROD-01"
   - Customer: Select "Acme Corporation"
   - Package: Leave empty for now
   - Description: "Main production environment"
4. Check **Active** checkbox
5. Click **Save**

**Result**: New LPAR appears in the list.

### Task 5: Create a Package

**Why**: Bundle software products for coordinated deployment.

**Steps**:
1. Click **Packages** in navigation
2. Click **Create Package** button
3. Fill in:
   - Name: "Q1 2025 Release"
   - Code: "PKG-2025-Q1"
   - Version: "2025.1.0"
   - Release Date: Select date
4. Add software items:
   - Click **Add Item**
   - Software: Select "CICS"
   - Version: Select "V5.6"
   - Order: "1" (installation order)
5. Add more items as needed
6. Click **Save**

**Result**: New package is created.

### Task 6: Deploy a Package

**Why**: Assign a package to an LPAR so it knows what should be installed.

**Steps**:
1. Navigate to the package (e.g., "Q1 2025 Release")
2. Click **Deploy Package** button
3. Review package contents
4. Select target LPAR(s) - check "Production LPAR"
5. Review what will change (additions, updates, etc.)
6. Add deployment notes (optional)
7. Click **Confirm Deployment**

**Result**: LPAR is assigned to the package.

## Common Workflows

### Workflow: Complete Software Lifecycle

```
1. Add Vendor (IBM)
   ↓
2. Add Software (CICS)
   ↓
3. Add Software Version (V5.6)
   ↓
4. Create Package (Q1 2025 Release)
   ↓
5. Add Software to Package
   ↓
6. Add Customer (Acme Corp)
   ↓
7. Add LPAR (Production)
   ↓
8. Deploy Package to LPAR
   ↓
9. Monitor compliance
```

### Workflow: Handling a Problem After Deployment

```
1. Software deployed to LPAR
   ↓
2. Problem discovered
   ↓
3. Navigate to LPAR → Edit
   ↓
4. Click Rollback on problematic software
   ↓
5. Enter reason for rollback
   ↓
6. Confirm rollback
   ↓
7. Software reverts to previous version
   ↓
8. Check activity log for record
```

### Workflow: Regular Monitoring

```
Daily/Weekly:
1. Check Dashboard for overview
   ↓
2. Review Activity Log for recent changes
   ↓
3. Check LPAR compliance status
   ↓
4. Address any non-compliant LPARs

Monthly:
1. Review software versions
   ↓
2. Plan package updates
   ↓
3. Check rollback history
   ↓
4. Generate reports for management
```

## Key Concepts Explained Simply

### What is a Vendor?
Think of it as the manufacturer. Just like cars are made by Ford, Toyota, etc., software is made by IBM, Broadcom, etc.

### What is Software?
An individual product, like "CICS" or "DB2". Each software product can have multiple versions.

### What is a Version?
A specific release of software. For example:
- CICS V5.6
- CICS V5.5
- CICS V5.4

The **current version** is the one you recommend for new installations.

### What is PTF?
"Program Temporary Fix" - IBM's term for patches or updates to a version. Other vendors might call these "Service Packs" or "Patches".

### What is a Package?
A bundle of software that's been tested together. Instead of deploying software one-by-one, you package them together as a "release".

**Example**: "Q1 2025 Package" might contain:
- CICS V5.6 with PTF12345
- DB2 V12.1 with PTF67890
- Endevor V18.1

### What is an LPAR?
"Logical Partition" - Think of it as a customer's environment or server where software runs. One customer might have multiple LPARs (Production, Test, Development).

### What is Compliance?
Checking if an LPAR has the correct software versions installed according to its assigned package.

**Example**:
- Package says: CICS V5.6
- LPAR has: CICS V5.6 ✅ Compliant
- LPAR has: CICS V5.5 ❌ Not compliant

### What is a Rollback?
Reverting software to the previous version if the new version causes problems.

**Example**:
- LPAR had: CICS V5.5
- Upgraded to: CICS V5.6
- Problem found!
- Rollback to: CICS V5.5 ← Previous version restored

## Tips for New Users

### 1. Start with Reference Data
Add vendors and software first before creating packages or LPARs. You can't assign software that doesn't exist yet!

**Order**:
1. Vendors
2. Software (with versions)
3. Customers
4. Packages
5. LPARs
6. Deploy

### 2. Use Descriptive Codes
Codes should be short but meaningful:
- Good: "IBM", "ACME", "PKG-2025-Q1"
- Bad: "V1", "ABC", "TEST"

### 3. Mark Items as Active
When you're done entering data, make sure items are marked **Active**. Inactive items are hidden from most views.

### 4. Use the Clone Feature
When adding similar items (e.g., multiple LPARs for one customer), use the "Clone from existing" toggle to copy values.

### 5. Add Descriptions
Future you (or your colleagues) will appreciate notes! Use the description fields.

### 6. Check the Activity Log
If something unexpected happens, check the Activity log to see what changed and when.

### 7. Don't Be Afraid to Explore
The system won't let you break things:
- Can't delete items that are in use
- Can't create duplicates
- Can roll back mistakes
- Everything is logged

### 8. Use Filters to Find Things
With lots of data, filters are your friend:
- Status filter: Hide inactive items
- Column filters: Search specific columns
- Combined filters: Use multiple filters together

## Common Mistakes to Avoid

❌ **Don't skip vendors** - Add the vendor before adding their software

❌ **Don't forget to mark "Is Current"** - One version should be marked as current

❌ **Don't delete** - Mark as inactive instead (preserves history)

❌ **Don't forget to document rollbacks** - Always explain why in the reason field

❌ **Don't deploy untested packages** - Test on a non-production LPAR first

✅ **Do use consistent naming** - Makes searching easier

✅ **Do add descriptions** - Helps everyone understand context

✅ **Do check compliance regularly** - Catch issues early

✅ **Do use the activity log** - Review changes and track issues

## What to Do If...

### ...I can't find an item?
1. Check the status filter (might be showing only Active items)
2. Try the search box
3. Use column filters for more precise searches
4. Check if item was marked inactive

### ...I made a mistake?
1. Edit the item and fix it
2. Or check Activity log for old value
3. Or ask administrator to help revert

### ...The system is slow?
1. Check your internet connection
2. Try refreshing the page
3. Clear filters to reduce data load
4. Contact administrator if persistent

### ...I need to undo a deployment?
You can't "undo" a deployment, but you can:
1. Rollback individual software items on the LPAR
2. Or assign a different package to the LPAR

### ...I want to see what changed?
Check the **Activity** log:
1. Click Activity in navigation
2. Filter by date, entity type, or action
3. View before/after values

## Next Steps

Now that you understand the basics:

1. **Practice**: Try adding test data (vendors, software, etc.)
2. **Explore**: Click around and see how things connect
3. **Read More**: Check the [Full User Guide](./README.md) for detailed information
4. **Ask Questions**: Don't hesitate to ask your administrator or colleagues

## Quick Reference Card

### Essential Actions

| Task | Navigation | Button |
|------|-----------|--------|
| Add Vendor | Vendors | Add Vendor |
| Add Software | Software | Add Software |
| Add Customer | Customers | Add Customer |
| Add LPAR | LPARs | Add LPAR |
| Create Package | Packages | Create Package |
| Deploy Package | Package detail page | Deploy Package |
| Rollback Software | LPAR edit page | Rollback (next to software) |
| View History | Activity | (auto-shown) |

### Keyboard Shortcuts

- **Tab**: Move between form fields
- **Enter**: Submit form
- **Esc**: Close dialogs
- **Click header**: Sort table

### Status Indicators

- 🟢 **Active**: Item is in use
- ⚫ **Inactive**: Item is hidden by default
- ✅ **Compliant**: LPAR matches package
- ⚠️ **Non-compliant**: LPAR doesn't match package
- 🔄 **Rolled back**: Software was reverted

---

**Welcome to the Software Inventory Management System!**

Need help? Check the [Full User Guide](./README.md) or contact your administrator.
