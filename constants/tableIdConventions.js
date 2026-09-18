/**
 * Canonical table ID conventions for EAM.
 *
 * Rule:
 * - Primary ID column is the table's business key (usually first logical column).
 * - Column name is the table abbreviation + "_id"
 *   e.g. tblAssetMaintSch → ams_id
 * - Values are PREFIX + zero-padded digits (default 3+)
 *   e.g. AMS001
 *
 * Semantic / coded PKs (tblApps.app_id = LOGIN, etc.) set enforceFormat=false.
 */
const { DEFAULT_ID_SEQUENCES } = require('./setupDefaults');

/** General ID shape accepted for enforced tables (allows tenant serials like BNA000001). */
const GENERAL_ID_REGEX = /^[A-Za-z][A-Za-z0-9_]*[0-9]{3,}$/;
const GENERAL_ID_SQL = '^[A-Za-z][A-Za-z0-9_]*[0-9]{3,}$';

/**
 * Canonical registry: physical table → id column + preferred generator prefix.
 * Preferred prefix is used for NEW ids; existing tenant serials may differ but must still match GENERAL_ID_REGEX.
 */
const TABLE_ID_CONVENTIONS = [
  { table: 'tblOrgs', column: 'org_id', tableKey: 'org', prefix: 'ORG', pad: 3 },
  { table: 'tblUsers', column: 'user_id', tableKey: 'user', prefix: 'USR', pad: 3 },
  { table: 'tblEmployees', column: 'employee_id', tableKey: 'employee', prefix: 'EMP', pad: 3 },
  { table: 'tblEmployees', column: 'emp_int_id', tableKey: 'emp_int_id', prefix: 'EMP_INT_', pad: 4 },
  { table: 'tblBranches', column: 'branch_id', tableKey: 'branch', prefix: 'BR', pad: 3 },
  { table: 'tblDepartments', column: 'dept_id', tableKey: 'department', prefix: 'DPT', pad: 3 },
  { table: 'tblJobRoles', column: 'job_role_id', tableKey: 'jobrole', prefix: 'JR', pad: 3 },
  { table: 'tblJobRoleNav', column: 'job_role_nav_id', tableKey: 'jobrolenav', prefix: 'JRN', pad: 3 },
  { table: 'tblUserJobRoles', column: 'user_job_role_id', tableKey: 'userjobrole', prefix: 'UJR', pad: 3 },
  { table: 'tblAssets', column: 'asset_id', tableKey: 'asset', prefix: 'ASS', pad: 3 },
  { table: 'tblAssetTypes', column: 'asset_type_id', tableKey: 'asset_type', prefix: 'AT', pad: 3 },
  { table: 'tblDeptAssetTypes', column: 'dept_asset_type_id', tableKey: 'dept_asset', prefix: 'DPTASS', pad: 3 },
  { table: 'tblVendors', column: 'vendor_id', tableKey: 'vendor', prefix: 'V', pad: 3 },
  { table: 'tblVendorProdService', column: 'ven_prod_serv_id', tableKey: 'vendor_prod_serv', prefix: 'VPS', pad: 3 },
  { table: 'tblProdServs', column: 'prod_serv_id', tableKey: 'prod_serv', prefix: 'PS', pad: 3 },
  { table: 'tblAssetMaintSch', column: 'ams_id', tableKey: 'ams', prefix: 'AMS', pad: 3 },
  { table: 'tblAssetMaintSch_BR_Hist', column: 'amsbr_id', tableKey: 'amsbr', prefix: 'AMSBR', pad: 3 },
  { table: 'tblAAT_Insp_Sch', column: 'ais_id', tableKey: 'ais', prefix: 'AIS_', pad: 3 },
  { table: 'tblAATInspCheckList', column: 'aatic_id', tableKey: 'aat_insp_checklist', prefix: 'AATIC', pad: 3 },
  { table: 'tblAssetGroup_H', column: 'assetgroup_h_id', tableKey: 'asset_group_h', prefix: 'AGH', pad: 3 },
  { table: 'tblAssetGroup_D', column: 'assetgroup_d_id', tableKey: 'asset_group_d', prefix: 'AGD', pad: 3 },
  { table: 'tblAssetDocs', column: 'a_d_id', tableKey: 'asset_doc', prefix: 'AD', pad: 3 },
  { table: 'tblAssetPropListValues', column: 'aplv_id', tableKey: 'aplv', prefix: 'APLV', pad: 3 },
  { table: 'tblProps', column: 'prop_id', tableKey: 'prop', prefix: 'PROP', pad: 3 },
  { table: 'tblATMaintFreq', column: 'at_main_freq_id', tableKey: 'atmf', prefix: 'ATMF', pad: 3 },
  { table: 'tblATMaintCheckList', column: 'at_main_checklist_id', tableKey: 'atmcl', prefix: 'ATMCL', pad: 3 },
  { table: 'tblATBRReasonCodes', column: 'atbrrc_id', tableKey: 'atbrrc', prefix: 'ATBRRC', pad: 3 },
  { table: 'tblAssetBRDet', column: 'abr_id', tableKey: 'asset_br_det', prefix: 'ABR', pad: 3 },
  { table: 'tblAssetScrapDet', column: 'asd_id', tableKey: 'asset_scrap_det', prefix: 'ASD', pad: 3 },
  { table: 'tblEmpTechCert', column: 'etc_id', tableKey: 'etc', prefix: 'ETC', pad: 3 },
  { table: 'tblSPCategory', column: 'spc_id', tableKey: 'sp_category', prefix: 'SPC', pad: 3 },
  { table: 'tblSPBrand', column: 'spb_id', tableKey: 'sp_brand', prefix: 'SPB', pad: 3 },
  { table: 'tblSPBMod', column: 'spbm_id', tableKey: 'sp_model', prefix: 'SPBM', pad: 3 },
  { table: 'tblSPLotDet', column: 'spld_id', tableKey: 'sp_lot_det', prefix: 'SPLD', pad: 3 },
  { table: 'tblSPIndDet', column: 'spid_id', tableKey: 'sp_ind_det', prefix: 'SPID', pad: 3 },
  { table: 'tblSPCatATMap', column: 'spcatm_id', tableKey: 'sp_cat_at_map', prefix: 'SPCATM', pad: 3 },
  { table: 'tblVSPMap', column: 'vspm_id', tableKey: 'vsp_map', prefix: 'VSPM', pad: 3 },
  { table: 'tblSpareHistory', column: 'sph_id', tableKey: 'spare_history', prefix: 'SPH', pad: 3 },
  { table: 'tblSpareIssue', column: 'si_id', tableKey: 'spare_issue', prefix: 'SI', pad: 3 },
  { table: 'tblSpareStore', column: 'ss_id', tableKey: 'spare_store', prefix: 'SS', pad: 3 },
  { table: 'tblVendorRenewal', column: 'vr_id', tableKey: 'vendor_renewal', prefix: 'VR', pad: 3 },
  { table: 'tblVendorSLAs', column: 'vsla_id', tableKey: 'vendor_sla', prefix: 'VSLA', pad: 3 },
  { table: 'tblJobHistory', column: 'jh_id', tableKey: 'job_history', prefix: 'JH_', pad: 4 },
  { table: 'tblMaintStatus', column: 'maint_status_id', tableKey: 'maint_status', prefix: 'MS', pad: 3 },
  { table: 'tblMaintTypes', column: 'maint_type_id', tableKey: 'maint_type', prefix: 'MT', pad: 3 },
  { table: 'tblUom', column: 'uom_id', tableKey: 'uom', prefix: 'UOM', pad: 3 },
  { table: 'tblAuditType', column: 'audtp_id', tableKey: 'audit_type', prefix: 'AUDTP', pad: 3 },
  { table: 'tblAuditATMapping', column: 'audatm_id', tableKey: 'audit_at_mapping', prefix: 'AUDATM', pad: 3 },
  // Semantic IDs — do not enforce PREFIX### shape
  { table: 'tblApps', column: 'app_id', tableKey: 'app', prefix: null, enforceFormat: false },
  { table: 'tblEvents', column: 'event_id', tableKey: 'event', prefix: 'Eve', enforceFormat: false },
];

const byTableColumn = new Map(
  TABLE_ID_CONVENTIONS.map((r) => [`${r.table}::${r.column}`, r])
);
const byTableKey = new Map(
  TABLE_ID_CONVENTIONS.filter((r) => r.tableKey).map((r) => [r.tableKey, r])
);

function patternForPreferredPrefix(prefix, pad = 3) {
  if (!prefix) return GENERAL_ID_REGEX;
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\d{${pad},}$`, 'i');
}

/**
 * Validate an ID value for a tableKey / table+column.
 * @returns {{ ok: boolean, error?: string, example?: string }}
 */
function validateEntityId(value, { tableKey, table, column, preferCanonical = false } = {}) {
  if (value == null || String(value).trim() === '') {
    return { ok: false, error: 'ID is required' };
  }
  const id = String(value).trim();
  let rule =
    (tableKey && byTableKey.get(tableKey)) ||
    (table && column && byTableColumn.get(`${table}::${column}`)) ||
    null;

  if (rule && rule.enforceFormat === false) {
    return { ok: true };
  }

  if (!GENERAL_ID_REGEX.test(id)) {
    return {
      ok: false,
      error: `ID '${id}' must look like PREFIX001 (letters/underscore + at least 3 digits)`,
      example: rule?.prefix ? `${rule.prefix}${String(1).padStart(rule.pad || 3, '0')}` : 'AMS001',
    };
  }

  if (preferCanonical && rule?.prefix) {
    const preferred = patternForPreferredPrefix(rule.prefix, rule.pad || 3);
    if (!preferred.test(id)) {
      return {
        ok: false,
        error: `ID '${id}' should use prefix ${rule.prefix} (e.g. ${rule.prefix}${String(1).padStart(rule.pad || 3, '0')})`,
        example: `${rule.prefix}${String(1).padStart(rule.pad || 3, '0')}`,
      };
    }
  }

  return { ok: true, rule };
}

/** Build ID_FORMAT_RULES-compatible list for audits. */
function buildIdFormatRules() {
  return TABLE_ID_CONVENTIONS.filter((r) => r.enforceFormat !== false && r.prefix).map((r) => ({
    table: r.table,
    column: r.column,
    tableKey: r.tableKey,
    pattern: patternForPreferredPrefix(r.prefix, r.pad || 3),
    // Audit accepts general format OR preferred (tenant serials); preferred shown as example
    auditPattern: GENERAL_ID_REGEX,
    example: `${r.prefix}${String(1).padStart(r.pad || 3, '0')}`,
    prefix: r.prefix,
    pad: r.pad || 3,
  }));
}

/** Ensure DEFAULT_ID_SEQUENCES includes every convention with a prefix. */
function missingSequenceEntries() {
  const existing = new Set(DEFAULT_ID_SEQUENCES.map((e) => e.tableKey));
  return TABLE_ID_CONVENTIONS.filter(
    (r) => r.tableKey && r.prefix && !existing.has(r.tableKey)
  ).map((r) => ({ tableKey: r.tableKey, prefix: r.prefix, lastNumber: 0 }));
}

module.exports = {
  GENERAL_ID_REGEX,
  GENERAL_ID_SQL,
  TABLE_ID_CONVENTIONS,
  validateEntityId,
  buildIdFormatRules,
  patternForPreferredPrefix,
  missingSequenceEntries,
  byTableKey,
  byTableColumn,
};
