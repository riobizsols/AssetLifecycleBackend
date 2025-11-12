const db = require("../config/db");
const { generateCustomId } = require("../utils/idGenerator");

const ASSET_TYPE_REGEX = /^AT[0-9]+$/i;

const normalizeAssetTypeId = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return ASSET_TYPE_REGEX.test(trimmed) ? trimmed : null;
};

const getUsageEligibleAssetTypeIds = async (orgId) => {
  const query = `
    SELECT key, value
    FROM "tblOrgSettings"
    WHERE org_id = $1
      AND (
        key ~* '^AT[0-9]+$'
        OR value ~* '^AT[0-9]+$'
        OR key = 'at_id_usage_based'
      )
  `;

  const result = await db.query(query, [orgId]);
  const assetTypeIds = new Set();

  result.rows.forEach(({ key, value }) => {
    const normalizedKey = normalizeAssetTypeId(key);
    const normalizedValue = normalizeAssetTypeId(value);

    if (normalizedKey) {
      assetTypeIds.add(normalizedKey);
    }

    if (normalizedValue) {
      assetTypeIds.add(normalizedValue);
    }

    if (key === "at_id_usage_based" && normalizedValue) {
      assetTypeIds.add(normalizedValue);
    }
  });

  return Array.from(assetTypeIds);
};

const getAssignedAssetsForUser = async (employeeIntId, orgId, assetTypeIds, deptId = null) => {
  if (!assetTypeIds || assetTypeIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT ON (a.asset_id)
      a.asset_id,
      a.asset_type_id,
      a.text AS asset_name,
      a.serial_number,
      a.description,
      aa.asset_assign_id,
      aa.action_on AS assigned_on,
      aa.dept_id AS assigned_dept_id,
      CASE 
        WHEN aa.employee_int_id = $1 THEN 'USER'
        WHEN $4::text IS NOT NULL AND aa.dept_id = $4::text THEN 'DEPARTMENT'
        ELSE 'UNKNOWN'
      END AS assignment_scope
    FROM "tblAssetAssignments" aa
    INNER JOIN "tblAssets" a ON aa.asset_id = a.asset_id
    WHERE aa.action = 'A'
      AND aa.latest_assignment_flag = true
      AND a.org_id = $2
      AND a.asset_type_id = ANY($3::text[])
      AND a.current_status != 'SCRAPPED'
      AND (
        aa.employee_int_id = $1
        OR ($4::text IS NOT NULL AND aa.dept_id = $4::text)
      )
    ORDER BY a.asset_id, assignment_scope
  `;

  const result = await db.query(query, [employeeIntId, orgId, assetTypeIds, deptId]);
  return result.rows;
};

const isAssetAccessibleByUser = async (assetId, employeeIntId, orgId, deptId = null) => {
  const query = `
    SELECT 1
    FROM "tblAssetAssignments" aa
    INNER JOIN "tblAssets" a ON aa.asset_id = a.asset_id
    WHERE aa.asset_id = $1
      AND aa.action = 'A'
      AND aa.latest_assignment_flag = true
      AND a.org_id = $3
      AND a.current_status != 'SCRAPPED'
      AND (
        aa.employee_int_id = $2
        OR ($4::text IS NOT NULL AND aa.dept_id = $4::text)
      )
    LIMIT 1
  `;

  const result = await db.query(query, [assetId, employeeIntId, orgId, deptId]);
  return result.rows.length > 0;
};

const createUsageRecord = async ({ asset_id, usage_counter, created_by }) => {
  const aug_id = await generateCustomId("asset_usage");

  const query = `
    INSERT INTO "tblAssetUsageReg" (aug_id, asset_id, usage_counter, created_by, created_on)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING aug_id, asset_id, usage_counter, created_by, created_on
  `;

  const result = await db.query(query, [aug_id, asset_id, usage_counter, created_by]);
  return result.rows[0];
};

const getUsageHistoryByAsset = async (assetId) => {
  const query = `
    SELECT 
      aur.aug_id,
      aur.asset_id,
      aur.usage_counter,
      aur.created_by,
      aur.created_on,
      u.full_name AS created_by_name
    FROM "tblAssetUsageReg" aur
    LEFT JOIN "tblUsers" u ON aur.created_by = u.user_id
    WHERE aur.asset_id = $1
    ORDER BY aur.created_on DESC
  `;

  const result = await db.query(query, [assetId]);
  return result.rows;
};

module.exports = {
  getUsageEligibleAssetTypeIds,
  getAssignedAssetsForUser,
  isAssetAccessibleByUser,
  createUsageRecord,
  getUsageHistoryByAsset,
};

