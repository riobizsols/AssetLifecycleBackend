/**
 * Condition-based monitoring: evaluate live OPC readings against tblCbm rules and,
 * when a rule's condition becomes true, create a CBM maintenance or an inspection
 * directly (no approval workflow) for the asset that owns the component.
 */
const { getDbFromContext } = require('../utils/dbContext');
const opcModel = require('../models/opcModel');
const maintenanceModel = require('../models/maintenanceScheduleModel');
const inspectionModel = require('../models/inspectionScheduleModel');
const operationalCache = require('../utils/operationalCache');

const getDb = () => getDbFromContext();

const CBM_MAINT_TYPE_TEXT = 'CBM Maintenance';
const CREATED_BY = 'CBM';

const toBoolean = (raw) => {
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', '-1', 'on', 'yes'].includes(s)) return true;
  if (['false', '0', 'off', 'no'].includes(s)) return false;
  return null;
};

const conditionMet = (rule, raw) => {
  const family = opcModel.operatorFamily(rule.data_type);
  if (family === 'BOOLEAN') {
    const b = toBoolean(raw);
    if (b === null) return null;
    return rule.operator === 'IS_TRUE' ? b : !b;
  }
  if (family === 'NUMERIC') {
    const v = Number(raw);
    const a = Number(rule.value1);
    const b = Number(rule.value2);
    if (!Number.isFinite(v)) return null;
    switch (rule.operator) {
      case '>': return v > a;
      case '>=': return v >= a;
      case '<': return v < a;
      case '<=': return v <= a;
      case '=': return v === a;
      case '!=': return v !== a;
      case 'BETWEEN': return v >= a && v <= b;
      case 'OUTSIDE': return v < a || v > b;
      default: return null;
    }
  }
  const s = String(raw);
  const target = String(rule.value1 ?? '');
  switch (rule.operator) {
    case 'EQUALS': return s.toLowerCase() === target.toLowerCase();
    case 'NOT_EQUALS': return s.toLowerCase() !== target.toLowerCase();
    case 'CONTAINS': return s.toLowerCase().includes(target.toLowerCase());
    default: return null;
  }
};

const getCbmMaintTypeId = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT maint_type_id FROM "tblMaintTypes"
      WHERE LOWER(TRIM(text)) = LOWER($1) AND COALESCE(int_status, 1) = 1
        AND (org_id = $2 OR org_id IS NULL)
      ORDER BY (org_id = $2) DESC NULLS LAST
      LIMIT 1`,
    [CBM_MAINT_TYPE_TEXT, orgId],
  );
  return rows[0]?.maint_type_id || null;
};

const findOpenCbmMaintenance = async (assetId, orgId, maintTypeId) => {
  const { rows } = await getDb().query(
    `SELECT ams_id AS ref FROM "tblAssetMaintSch"
      WHERE asset_id = $1 AND org_id = $2 AND maint_type_id = $3
        AND COALESCE(status, '') NOT IN ('CO', 'CA', 'CF')
     UNION ALL
     SELECT wfamsh_id AS ref FROM "tblWFAssetMaintSch_H"
      WHERE asset_id = $1 AND org_id = $2 AND maint_type_id = $3
        AND COALESCE(status, '') NOT IN ('CO', 'CA', 'CF')
     LIMIT 1`,
    [assetId, orgId, maintTypeId],
  );
  return rows[0]?.ref || null;
};

const createCbmMaintenance = async (rule, orgId, note) => {
  const maintTypeId = await getCbmMaintTypeId(orgId);
  if (!maintTypeId) return { status: 'error', message: `Maintenance type "${CBM_MAINT_TYPE_TEXT}" is not set up` };

  const open = await findOpenCbmMaintenance(rule.asset_id, orgId, maintTypeId);
  if (open) return { status: 'skipped', message: `CBM maintenance ${open} is already open`, ref: open };

  const assetRes = await getDb().query(
    `SELECT service_vendor_id, purchase_vendor_id FROM "tblAssets" WHERE asset_id = $1 AND org_id = $2`,
    [rule.asset_id, orgId],
  );
  const asset = assetRes.rows[0];
  if (!asset) return { status: 'error', message: `Asset ${rule.asset_id} not found` };
  // tblAssetMaintSch.vendor_id is NOT NULL
  const vendorId = asset.service_vendor_id || asset.purchase_vendor_id;
  if (!vendorId) return { status: 'error', message: `Asset ${rule.asset_id} has no service or purchase vendor` };

  const amsId = await maintenanceModel.getNextAMSId();
  await maintenanceModel.insertDirectMaintenanceSchedule({
    ams_id: amsId,
    asset_id: rule.asset_id,
    maint_type_id: maintTypeId,
    vendor_id: vendorId,
    at_main_freq_id: null,
    maintained_by: asset.service_vendor_id ? 'Vendor' : 'Inhouse',
    notes: note,
    status: 'IN',
    act_maint_st_date: new Date(),
    created_by: CREATED_BY,
    org_id: orgId,
    branch_code: null,
  });
  return { status: 'created', message: `CBM maintenance ${amsId} created`, ref: amsId };
};

const createCbmInspection = async (rule, orgId, note) => {
  const [wf, direct] = await Promise.all([
    inspectionModel.checkExistingWorkflowInspection(rule.asset_id, orgId),
    inspectionModel.checkExistingDirectInspection(rule.asset_id, orgId),
  ]);
  const open = wf.rows[0]?.wfaiish_id || direct.rows[0]?.ais_id;
  if (open) return { status: 'skipped', message: `Inspection ${open} is already open`, ref: open };

  const assetRes = await inspectionModel.getAssetByIdForInspection(rule.asset_id, orgId);
  const asset = assetRes.rows[0];
  if (!asset) return { status: 'error', message: `Asset ${rule.asset_id} is not active` };

  const freqRes = await inspectionModel.getInspectionFrequency(asset.asset_type_id, orgId);
  const frequency = freqRes.rows[0];
  if (!frequency) {
    return { status: 'error', message: `Asset type ${asset.asset_type_id} has no inspection checklist / frequency` };
  }

  const aisId = inspectionModel.generateUniqueId('AIS');
  await inspectionModel.createDirectInspectionSchedule({
    ais_id: aisId,
    aatif_id: frequency.aatif_id,
    asset_id: asset.asset_id,
    vendor_id: asset.vendor_id || null,
    emp_int_id: frequency.emp_int_id || null,
    act_insp_st_date: new Date(),
    status: 'PN',
    created_by: CREATED_BY,
    org_id: orgId,
    branch_code: asset.branch_code,
  });
  await getDb().query(`UPDATE "tblAAT_Insp_Sch" SET notes = $2 WHERE ais_id = $1`, [aisId, note]);
  return { status: 'created', message: `Inspection ${aisId} created`, ref: aisId };
};

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const lastPruneByOrg = new Map();

const pruneReadingLogHourly = async (orgId) => {
  const now = Date.now();
  if (now - (lastPruneByOrg.get(orgId) || 0) < PRUNE_INTERVAL_MS) return;
  lastPruneByOrg.set(orgId, now);
  const removed = await opcModel.pruneReadingLog(orgId);
  if (removed) console.log(`[CBM] Pruned ${removed} reading log rows older than ${opcModel.CBM_LOG_RETENTION_DAYS} days for ${orgId}`);
};

/**
 * readings: [{ tag_full_path, value, quality }] for one server.
 * Returns one result per evaluated rule.
 */
exports.evaluateReadings = async (serverId, orgId, readings) => {
  const byPath = new Map();
  for (const r of readings) {
    const path = String(r?.tag_full_path || '').trim();
    if (!path || r.value === undefined || r.value === null) continue;
    if (r.quality !== undefined && Number(r.quality) !== 192) continue;
    byPath.set(path, r.value);
  }

  const rules = await opcModel.listActiveRulesForPaths(serverId, orgId, [...byPath.keys()]);
  const results = [];

  for (const rule of rules) {
    const raw = byPath.get(rule.tag_full_path);
    const met = conditionMet(rule, raw);
    if (met === null) {
      results.push({ cbm_id: rule.cbm_id, status: 'error', message: `Cannot evaluate value "${raw}"` });
      continue;
    }

    if (!met || rule.is_met) {
      const status = met ? 'still_met' : 'not_met';
      await opcModel.saveRuleEvaluation(rule.cbm_id, { value: raw, isMet: met, outcome: status });
      results.push({ cbm_id: rule.cbm_id, status, value: raw });
      continue;
    }

    const unit = rule.unit ? ` ${rule.unit}` : '';
    const note = `${rule.cbm_id}: ${rule.tag_name} = ${raw}${unit} (${rule.operator} ${[rule.value1, rule.value2].filter((v) => v != null).join(' / ')})`.slice(0, 250);
    let outcome;
    try {
      outcome = rule.action_type === 'INSP'
        ? await createCbmInspection(rule, orgId, note)
        : await createCbmMaintenance(rule, orgId, note);
    } catch (err) {
      outcome = { status: 'error', message: err.message };
    }

    // Only latch the condition once something was created or is already open, so errors retry.
    const latched = outcome.status !== 'error';
    await opcModel.saveRuleEvaluation(rule.cbm_id, {
      value: raw,
      isMet: latched,
      conditionMet: true,
      outcome: outcome.status,
      triggerRef: outcome.status === 'created' ? outcome.ref : null,
    });
    if (outcome.status === 'created') {
      // Inspection / maintenance lists are cached per org
      operationalCache.invalidateOrgCaches(orgId).catch(() => {});
    }
    if (outcome.status === 'error') console.error(`[CBM] ${rule.cbm_id}: ${outcome.message}`);
    results.push({ cbm_id: rule.cbm_id, value: raw, ...outcome });
  }

  if (rules.length) await pruneReadingLogHourly(orgId);
  return results;
};
