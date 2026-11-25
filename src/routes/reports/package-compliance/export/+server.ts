import type { RequestHandler } from './$types';
import { getInstalledMatrix } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { buildCompliance, COMPLIANCE_CSV_COLUMNS, complianceRecords } from '#lib/utils/package-compliance.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV of package compliance: one row per LPAR. */
export const GET: RequestHandler = async ({ url }) => {
	const report = buildCompliance(await getInstalledMatrix(readScope(url)));
	return csvDownload('package-compliance', toCsv(COMPLIANCE_CSV_COLUMNS, complianceRecords(report)));
};
