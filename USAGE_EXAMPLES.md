# Usage Examples

This document provides examples of how to use the key features of the SW Inventory system.

## Version Parsing

### Parse Vendor Designations

```typescript
import { parseVendorDesignation } from '$utils/version-parser';

// Parse different vendor formats
const v1 = parseVendorDesignation('V2R4M0-PTF12345');
// Result: { version: 'V2R4M0', ptfLevel: 'PTF12345' }

const v2 = parseVendorDesignation('2.4.0 (PTF 12345)');
// Result: { version: '2.4.0', ptfLevel: 'PTF 12345' }

const v3 = parseVendorDesignation('14.5');
// Result: { version: '14.5', ptfLevel: undefined }
```

### Compare Versions

```typescript
import { compareSoftwareVersions } from '$utils/version-parser';

const version1 = { version: 'V2R4M0', ptfLevel: 'PTF12345' };
const version2 = { version: 'V2R5M0', ptfLevel: 'PTF12346' };

const result = compareSoftwareVersions(version1, version2);
// Result: -1 (version1 is older than version2)
```

### Check Version Compatibility

```typescript
import { isVersionCompatible } from '$utils/version-parser';

const installed = { version: 'V2R5M0', ptfLevel: 'PTF12346' };
const required = { version: 'V2R4M0', ptfLevel: 'PTF12345' };

// Lenient mode: installed >= required
const compatible = isVersionCompatible(installed, required);
// Result: true

// Strict mode: exact match
const exactMatch = isVersionCompatible(installed, required, true);
// Result: false
```

## Package Management

### Get Customer Package Subset

```typescript
import { getCustomerPackageSubset } from '$lib/services/package-service';

const fullPackage = {
  id: '1',
  name: 'Mainframe Suite Q1 2024',
  items: [
    { softwareId: 'sw1', version: { version: '1.0' }, required: true, order: 1 },
    { softwareId: 'sw2', version: { version: '2.0' }, required: true, order: 2 },
    { softwareId: 'sw3', version: { version: '3.0' }, required: false, order: 3 },
  ],
  // ... other fields
};

// Customer only needs sw1 and sw2
const customerRequirements = ['sw1', 'sw2'];
const subset = getCustomerPackageSubset(fullPackage, customerRequirements);
// Result: Array with only sw1 and sw2 items
```

### Validate LPAR Package Compliance

```typescript
import { validateLparPackageCompliance } from '$lib/services/package-service';

const lpar = {
  id: '1',
  name: 'Production LPAR',
  currentPackageId: '1',
  softwareInstalled: [
    {
      softwareId: 'sw1',
      version: { version: 'V2R4M0', ptfLevel: 'PTF12345' },
      installedDate: new Date(),
      rolledBack: false
    }
  ],
  // ... other fields
};

const targetPackage = {
  id: '1',
  items: [
    {
      softwareId: 'sw1',
      version: { version: 'V2R4M0', ptfLevel: 'PTF12345' },
      required: true,
      order: 1
    },
    {
      softwareId: 'sw2',
      version: { version: 'V2R5M0' },
      required: true,
      order: 2
    }
  ],
  // ... other fields
};

const validation = validateLparPackageCompliance(lpar, targetPackage);
// Result: {
//   compliant: false,
//   missingSoftware: [sw2 item],
//   outdatedSoftware: []
// }
```

### Generate Deployment Plan

```typescript
import { generateDeploymentPlan } from '$lib/services/package-service';

const deploymentPlan = generateDeploymentPlan(
  lpar,
  targetPackage,
  ['sw1', 'sw2', 'sw3']
);

// Result: {
//   toInstall: [list of PackageItems to install],
//   toUpgrade: [list of items needing upgrade with current versions],
//   toRemove: [list of LparSoftware to remove],
//   noChange: [list of LparSoftware that match package]
// }

console.log(`Need to install: ${deploymentPlan.toInstall.length} items`);
console.log(`Need to upgrade: ${deploymentPlan.toUpgrade.length} items`);
console.log(`Need to remove: ${deploymentPlan.toRemove.length} items`);
```

### Calculate Compatibility Score

```typescript
import { calculateCompatibilityScore } from '$lib/services/package-service';

const score = calculateCompatibilityScore(lpar, targetPackage);
// Result: 0-100 percentage score indicating compatibility
console.log(`LPAR is ${score}% compatible with the target package`);
```

### Rollback Software

```typescript
import { rollbackSoftware } from '$lib/services/package-service';

const rolledBack = rollbackSoftware(lpar, 'sw1');

if (rolledBack) {
  console.log(`Rolled back to version: ${rolledBack.version.version}`);
  // Update LPAR in database with new rollback state
} else {
  console.log('Cannot rollback: no previous version available');
}
```

## Form Validation

### Validate Customer Input

```typescript
import { customerSchema } from '$schemas';

const formData = {
  name: 'Acme Corp',
  code: 'ACME-001',
  description: 'Test customer',
  active: true
};

try {
  const validated = customerSchema.parse(formData);
  // validated is type-safe and cleaned
  console.log('Valid customer data:', validated);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log('Validation errors:', error.flatten().fieldErrors);
  }
}
```

### Server-Side Form Handling

```typescript
// In +page.server.ts
import { customerSchema } from '$schemas';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    try {
      const validated = customerSchema.parse(data);

      // TODO: Save to database
      // await db.customer.create({ data: validated });

      throw redirect(303, '/customers');
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail(400, {
          errors: error.flatten().fieldErrors,
          message: 'Validation failed'
        });
      }
      throw error;
    }
  }
};
```

## DataTable Component

### Basic Usage

```svelte
<script lang="ts">
  import DataTable from '$components/common/DataTable.svelte';
  import type { Customer } from '$types';

  let customers: Customer[] = [/* ... */];

  const columns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'active',
      label: 'Status',
      render: (customer: Customer) => {
        return StatusBadge({ active: customer.active });
      }
    }
  ];

  function handleRowClick(customer: Customer) {
    goto(`/customers/${customer.id}`);
  }

  function handleSort(field: string) {
    // Implement sorting logic
  }
</script>

<DataTable
  data={customers}
  {columns}
  onRowClick={handleRowClick}
  onSort={handleSort}
/>
```

## Component Composition

### Creating a Consistent Form

```svelte
<script lang="ts">
  import FormField from '$components/common/FormField.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';

  let formData = $state({
    name: '',
    code: '',
    email: ''
  });
</script>

<Card class="p-6">
  <form method="POST" class="space-y-6">
    <FormField
      label="Name"
      id="name"
      name="name"
      bind:value={formData.name}
      required
      placeholder="Enter name"
    />

    <FormField
      label="Code"
      id="code"
      name="code"
      bind:value={formData.code}
      required
      helperText="Uppercase alphanumeric"
    />

    <FormField
      label="Email"
      id="email"
      name="email"
      type="email"
      bind:value={formData.email}
    />

    <Button type="submit">Submit</Button>
  </form>
</Card>
```

## Date Formatting

```typescript
import { formatDate, formatDateTime, formatRelativeTime } from '$utils/date-format';

const date = new Date('2024-01-15T10:30:00');

console.log(formatDate(date));
// Output: "Jan 15, 2024"

console.log(formatDateTime(date));
// Output: "Jan 15, 2024, 10:30 AM"

console.log(formatRelativeTime(date));
// Output: "5 days ago" (depends on current date)
```

## Typical Workflow: Adding a New LPAR

1. **Create LPAR with Basic Info**
```typescript
const newLpar = {
  name: 'Production LPAR 2',
  code: 'PROD-LPAR-2',
  customerId: 'customer-uuid',
  description: 'Secondary production LPAR',
  active: true
};
```

2. **Assign Package to LPAR**
```typescript
lpar.currentPackageId = 'package-uuid';
```

3. **Generate Customer-Specific Deployment Plan**
```typescript
const customerSoftwareNeeds = ['sw1', 'sw2', 'sw3'];
const plan = generateDeploymentPlan(
  lpar,
  targetPackage,
  customerSoftwareNeeds
);
```

4. **Install Software Based on Plan**
```typescript
for (const item of plan.toInstall) {
  lpar.softwareInstalled.push({
    softwareId: item.softwareId,
    version: item.version,
    installedDate: new Date(),
    rolledBack: false
  });
}
```

5. **Validate Compliance**
```typescript
const validation = validateLparPackageCompliance(lpar, targetPackage);
if (validation.compliant) {
  console.log('LPAR is fully compliant with package');
} else {
  console.log('Missing:', validation.missingSoftware);
  console.log('Outdated:', validation.outdatedSoftware);
}
```

6. **Monitor Compatibility**
```typescript
const score = calculateCompatibilityScore(lpar, targetPackage);
if (score < 80) {
  console.warn('LPAR compatibility is below threshold');
}
```

## Error Handling Pattern

```typescript
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  const lpar = await db.lpar.findUnique({
    where: { id: params.id }
  });

  if (!lpar) {
    throw error(404, 'LPAR not found');
  }

  return { lpar };
};
```
