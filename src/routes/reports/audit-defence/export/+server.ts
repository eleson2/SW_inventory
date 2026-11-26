import type { RequestHandler } from './$types';
import { getAuditDefence } from '#lib/server/reports.ts';
import { readScope } from '#lib/server/report-scope.ts';
import { AUDIT_CSV_COLUMNS, auditRecords } from '#lib/utils/audit-defence.ts';
import { csvDownload, toCsv } from '#lib/utils/csv.ts';

/** CSV for a vendor audit: one row per install (with since dates), then removed earlier installs. */
export const GET: RequestHandler = async ({ url }) => {
	const scope = readScope(url);
	return csvDownload('audit-defence', toCsv(AUDIT_CSV_COLUMNS, auditRecords(await getAuditDefence(scope))), scope.asOf);
};
