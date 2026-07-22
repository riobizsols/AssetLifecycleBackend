/**
 * Canonical ID format rules — derived from DEFAULT_ID_SEQUENCES and idGenerator.
 * These are what the application generates at runtime, not legacy audit guesses.
 */
const { DEFAULT_ID_SEQUENCES } = require('./setupDefaults');

/** Build a regex that matches prefix + numeric suffix (default 3+ digits). */
function patternForPrefix(prefix, minDigits = 3) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\d{${minDigits},}$`);
}

/** Runtime ID checks used by audits and tenant validation. */
const ID_FORMAT_RULES = [
  { table: 'tblOrgs', column: 'org_id', tableKey: 'org', pattern: /^ORG\d{3}$/, example: 'ORG001' },
  { table: 'tblUsers', column: 'user_id', tableKey: 'user', pattern: /^USR\d{3,}$/, example: 'USR001' },
  { table: 'tblJobRoles', column: 'job_role_id', tableKey: 'jobrole', pattern: /^JR\d{3,}$/, example: 'JR001' },
  { table: 'tblJobs', column: 'job_id', pattern: /^JOB\d{3}$/, example: 'JOB001' },
  { table: 'tblJobHistory', column: 'jh_id', pattern: /^JH_\d{4}$/, example: 'JH_0001' },
  { table: 'tblBranches', column: 'branch_id', tableKey: 'branch', pattern: /^BR\d{3}$/, example: 'BR001' },
  { table: 'tblDepartments', column: 'dept_id', tableKey: 'department', pattern: /^DPT\d{3}$/, example: 'DPT001' },
  { table: 'tblEmployees', column: 'employee_id', tableKey: 'employee', pattern: /^EMP\d{3,}$/, example: 'EMP001' },
  { table: 'tblEmployees', column: 'emp_int_id', tableKey: 'emp_int_id', pattern: /^EMP_INT_\d{4,}$/, example: 'EMP_INT_0001' },
  { table: 'tblAssets', column: 'asset_id', tableKey: 'asset', pattern: /^ASS\d{3,}$/, example: 'ASS001' },
  { table: 'tblVendors', column: 'vendor_id', tableKey: 'vendor', pattern: /^V\d{3,}$/, example: 'V001' },
  { table: 'tblJobRoleNav', column: 'job_role_nav_id', tableKey: 'jobrolenav', pattern: /^JRN\d{3,}$/, example: 'JRN001' },
];

/** Map tableKey → { table, column, prefix } for sequence sync. */
const SEQUENCE_TABLE_MAP = Object.fromEntries(
  DEFAULT_ID_SEQUENCES.map((entry) => {
    const tableMap = {
      asset_type: { table: 'tblAssetTypes', column: 'asset_type_id' },
      department: { table: 'tblDepartments', column: 'dept_id' },
      branch: { table: 'tblBranches', column: 'branch_id' },
      user: { table: 'tblUsers', column: 'user_id' },
      employee: { table: 'tblEmployees', column: 'employee_id' },
      emp_int_id: { table: 'tblEmployees', column: 'emp_int_id' },
      prod_serv: { table: 'tblProdServs', column: 'prod_serv_id' },
      jobrole: { table: 'tblJobRoles', column: 'job_role_id' },
      jobrolenav: { table: 'tblJobRoleNav', column: 'job_role_nav_id' },
      userjobrole: { table: 'tblUserJobRoles', column: 'user_job_role_id' },
      dept_asset: { table: 'tblDeptAssetTypes', column: 'dept_asset_type_id' },
      asset: { table: 'tblAssets', column: 'asset_id' },
      asset_group_h: { table: 'tblAssetGroup_H', column: 'assetgroup_h_id' },
      asset_group_d: { table: 'tblAssetGroup_D', column: 'assetgroup_d_id' },
      asset_doc: { table: 'tblAssetDocs', column: 'a_d_id' },
      vendor: { table: 'tblVendors', column: 'vendor_id' },
      vendor_prod_serv: { table: 'tblVendorProdService', column: 'ven_prod_serv_id' },
      org: { table: 'tblOrgs', column: 'org_id' },
      aplv: { table: 'tblAssetPropListValues', column: 'aplv_id' },
    };
    const mapping = tableMap[entry.tableKey];
    return mapping
      ? [entry.tableKey, { ...mapping, prefix: entry.prefix, pattern: patternForPrefix(entry.prefix) }]
      : [entry.tableKey, null];
  }).filter(([, v]) => v)
);

/**
 * Known legacy bad IDs → correct values per idGenerator conventions.
 * FK columns listed are updated before the primary row.
 */
const LEGACY_ID_REMAPS = [
  {
    label: 'branch BRANCH001 → BR001',
    primaryTable: 'tblBranches',
    primaryColumn: 'branch_id',
    from: 'BRANCH001',
    to: 'BR001',
    primaryExtra: { branch_code: 'HO' },
    fkUpdates: [{ table: 'tblDepartments', column: 'branch_id' }],
  },
];

module.exports = {
  ID_FORMAT_RULES,
  SEQUENCE_TABLE_MAP,
  LEGACY_ID_REMAPS,
  patternForPrefix,
};
