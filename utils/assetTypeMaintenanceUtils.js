/**
 * Helpers for maintenance decisions after removing maint_required / maint_type_id
 * from tblAssetTypes. Source of truth: tblATMaintFreq + tblWFATSeqs.
 */

async function hasMaintenanceFrequencies(db, assetTypeId, orgId) {
  const r = await db.query(
    `SELECT 1 FROM "tblATMaintFreq"
     WHERE asset_type_id = $1 AND org_id = $2
     LIMIT 1`,
    [assetTypeId, orgId]
  );
  return r.rows.length > 0;
}

async function hasWorkflowSequences(db, assetTypeId, orgId) {
  const r = await db.query(
    `SELECT 1 FROM "tblWFATSeqs"
     WHERE asset_type_id = $1 AND org_id = $2
     LIMIT 1`,
    [assetTypeId, orgId]
  );
  return r.rows.length > 0;
}

async function hasScrapWorkflowSequences(db, assetTypeId, orgId) {
  const r = await db.query(
    `SELECT 1 FROM "tblWFScrapSeq"
     WHERE asset_type_id = $1 AND org_id = $2
     LIMIT 1`,
    [assetTypeId, orgId]
  );
  return r.rows.length > 0;
}

module.exports = {
  hasMaintenanceFrequencies,
  hasWorkflowSequences,
  hasScrapWorkflowSequences,
};
