#!/bin/bash

echo "Testing all forms..."
echo ""

echo "=== NEW FORMS ==="
for route in "software/new" "vendors/new" "customers/new" "lpars/new" "packages/new"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5175/$route")
  echo "$route: $status"
done

echo ""
echo "=== EDIT FORMS ==="

# Get one ID for each entity type
software_id=$(curl -s "http://localhost:5175/software" | grep -o "/software/[a-f0-9-]*/edit" | head -1 | cut -d'/' -f3)
vendor_id=$(curl -s "http://localhost:5175/vendors" | grep -o "/vendors/[a-f0-9-]*/edit" | head -1 | cut -d'/' -f3)
customer_id=$(curl -s "http://localhost:5175/customers" | grep -o "/customers/[a-f0-9-]*/edit" | head -1 | cut -d'/' -f3)
lpar_id=$(curl -s "http://localhost:5175/lpars" | grep -o "/lpars/[a-f0-9-]*/edit" | head -1 | cut -d'/' -f3)
package_id=$(curl -s "http://localhost:5175/packages" | grep -o "/packages/[a-f0-9-]*/edit" | head -1 | cut -d'/' -f3)

[ -n "$software_id" ] && echo "software/$software_id/edit: $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5175/software/$software_id/edit")"
[ -n "$vendor_id" ] && echo "vendors/$vendor_id/edit: $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5175/vendors/$vendor_id/edit")"
[ -n "$customer_id" ] && echo "customers/$customer_id/edit: $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5175/customers/$customer_id/edit")"
[ -n "$lpar_id" ] && echo "lpars/$lpar_id/edit: $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5175/lpars/$lpar_id/edit")"
[ -n "$package_id" ] && echo "packages/$package_id/edit: $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5175/packages/$package_id/edit")"

echo ""
echo "Testing complete!"
