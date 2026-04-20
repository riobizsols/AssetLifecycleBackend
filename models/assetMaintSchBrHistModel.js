const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

async function insertBrHist({ ams_id, status, created_by, notes = null }, client = null) {
  if (!ams_id) throw new Error('ams_id is required');
  if (!status) throw new Error('status is required');
  if (!created_by) throw new Error('created_by is required');

  const amsbr_id = await generateCustomId('amsbr', 3);
  const q = `
    INSERT INTO "tblAssetMaintSch_BR_Hist" (
      amsbr_id, ams_id, status, created_on, created_by, notes
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
    RETURNING *
  `;

  const runner = client || getDb();
  return runner.query(q, [amsbr_id, ams_id, status, created_by, notes]);
}

async function getReopenedBreakdownsMoreThanOnce({
  org_id,
  asset_id = null,
  asset_type_id = null,
  user_id = null,
  dept_id = null,
} = {}) {
  if (!org_id) throw new Error('org_id is required');

  // Count RO events per ams_id; return only those reopened more than once.
  // Filters:
  // - asset_id / asset_type_id: via tblAssetMaintSch -> tblAssets
  // - user_id: via history created_by (who did the reopen/status change)
  // - dept_id: via tblUsers.dept_id for the created_by user
  const params = [org_id];
  let idx = params.length;

  let q = `
    WITH ro_counts AS (
      SELECT h.ams_id, COUNT(*)::int AS ro_count
      FROM "tblAssetMaintSch_BR_Hist" h
      INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
      WHERE h.status = 'RO' AND ams.org_id = $1
      GROUP BY h.ams_id
      HAVING COUNT(*) > 1
    )
    SELECT
      rc.ams_id,
      rc.ro_count,
      ams.asset_id,
      a.serial_number,
      a.text AS asset_name,
      a.asset_type_id,
      at.text AS asset_type_name,
      MAX(h.created_on) AS last_reopened_on
    FROM ro_counts rc
    INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = rc.ams_id
    INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    INNER JOIN "tblAssetMaintSch_BR_Hist" h ON h.ams_id = rc.ams_id AND h.status = 'RO'
    LEFT JOIN "tblUsers" u ON u.user_id = h.created_by
    WHERE ams.org_id = $1
  `;

  if (asset_id) {
    q += ` AND ams.asset_id = $${++idx}`;
    params.push(asset_id);
  }
  if (asset_type_id) {
    q += ` AND a.asset_type_id = $${++idx}`;
    params.push(asset_type_id);
  }
  if (user_id) {
    q += ` AND h.created_by = $${++idx}`;
    params.push(user_id);
  }
  if (dept_id) {
    q += ` AND u.dept_id = $${++idx}`;
    params.push(dept_id);
  }

  q += `
    GROUP BY rc.ams_id, rc.ro_count, ams.asset_id, a.serial_number, a.text, a.asset_type_id, at.text
    ORDER BY last_reopened_on DESC, rc.ams_id DESC
  `;

  const dbPool = getDb();
  const r = await dbPool.query(q, params);
  return r.rows;
}

// Reopened breakdowns report driven from tblAssetMaintSch_BR_Hist (history),
// not from current tblAssetMaintSch.status.
async function getReopenedBreakdownsFromHistory({
  org_id,
  asset_id = null,
  asset_type_id = null,
  user_id = null,
  dept_id = null,
  reopen_count_min = null,
  last_reopened_on_from = null,
  last_reopened_on_to = null,
} = {}) {
  if (!org_id) throw new Error('org_id is required');

  // Drive the report from history rows where status='RO'.
  // Join assets/types for display and allow filtering by:
  // - asset_id / asset_type_id via tblAssetMaintSch -> tblAssets
  // - user_id / dept_id via history.created_by (who reopened)
  const params = [org_id];
  let idx = 1;

  let q = `
    WITH ro_stats AS (
      SELECT
        h.ams_id,
        COUNT(*)::int AS ro_count,
        MAX(h.created_on) AS last_reopened_on
      FROM "tblAssetMaintSch_BR_Hist" h
      INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
      WHERE ams.org_id = $1 AND h.status = 'RO'
      GROUP BY h.ams_id
    )
    SELECT
      ams.ams_id,
      ams.asset_id,
      a.serial_number,
      COALESCE(NULLIF(a.description, ''), a.text) AS asset_name,
      a.asset_type_id,
      at.text AS asset_type_name,
      rs.ro_count::int AS ro_count,
      rs.last_reopened_on AS last_reopened_on
    FROM "tblAssetMaintSch" ams
    INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    INNER JOIN ro_stats rs ON rs.ams_id = ams.ams_id
    WHERE ams.org_id = $1
  `;

  if (asset_id) {
    q += ` AND ams.asset_id = $${++idx}`;
    params.push(asset_id);
  }
  if (asset_type_id) {
    q += ` AND a.asset_type_id = $${++idx}`;
    params.push(asset_type_id);
  }
  if (user_id) {
    q += ` AND EXISTS (
      SELECT 1 FROM "tblAssetMaintSch_BR_Hist" h
      WHERE h.ams_id = ams.ams_id AND h.status = 'RO' AND h.created_by = $${++idx}
    )`;
    params.push(user_id);
  }
  if (dept_id) {
    q += ` AND EXISTS (
      SELECT 1
      FROM "tblAssetMaintSch_BR_Hist" h
      JOIN "tblUsers" u ON u.user_id = h.created_by
      WHERE h.ams_id = ams.ams_id AND h.status = 'RO' AND u.dept_id = $${++idx}
    )`;
    params.push(dept_id);
  }

  if (reopen_count_min !== null && reopen_count_min !== undefined && String(reopen_count_min).trim() !== '') {
    q += ` AND rs.ro_count >= $${++idx}`;
    params.push(Number(reopen_count_min));
  }
  if (last_reopened_on_from) {
    q += ` AND rs.last_reopened_on >= $${++idx}::timestamp`;
    params.push(last_reopened_on_from);
  }
  if (last_reopened_on_to) {
    q += ` AND rs.last_reopened_on <= $${++idx}::timestamp`;
    params.push(last_reopened_on_to);
  }

  q += ` ORDER BY rs.last_reopened_on DESC NULLS LAST, ams.ams_id DESC`;

  const dbPool = getDb();
  const r = await dbPool.query(q, params);
  return r.rows;
}

async function getReopenedBreakdownsFilterOptionsFromHistory({ org_id } = {}) {
  if (!org_id) throw new Error('org_id is required');

  const dbPool = getDb();

  // Asset IDs and Asset Types that currently have RO history rows.
  const assetsRes = await dbPool.query(
    `
    SELECT DISTINCT
      ams.asset_id,
      a.serial_number,
      COALESCE(NULLIF(a.description, ''), a.text) AS asset_name
    FROM "tblAssetMaintSch_BR_Hist" h
    INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
    INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
    WHERE ams.org_id = $1 AND h.status = 'RO'
    ORDER BY ams.asset_id
    `,
    [org_id],
  );

  const assetTypesRes = await dbPool.query(
    `
    SELECT DISTINCT
      a.asset_type_id,
      at.text AS asset_type_name
    FROM "tblAssetMaintSch_BR_Hist" h
    INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
    INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    WHERE ams.org_id = $1 AND h.status = 'RO'
    ORDER BY a.asset_type_id
    `,
    [org_id],
  );

  // Users who currently have any of these RO assets assigned (latest assignment).
  const usersRes = await dbPool.query(
    `
    SELECT DISTINCT
      u.user_id,
      u.full_name,
      u.dept_id
    FROM "tblAssetMaintSch_BR_Hist" h
    INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
    INNER JOIN "tblAssetAssignments" aa
      ON aa.asset_id = ams.asset_id
     AND aa.action = 'A'
     AND aa.latest_assignment_flag = true
    INNER JOIN "tblEmployees" e ON e.emp_int_id = aa.employee_int_id
    INNER JOIN "tblUsers" u ON u.emp_int_id = e.emp_int_id
    WHERE ams.org_id = $1 AND h.status = 'RO'
      AND u.int_status = 1
    ORDER BY u.full_name
    `,
    [org_id],
  );

  const deptsRes = await dbPool.query(
    `
    SELECT DISTINCT
      d.dept_id,
      d.text AS department_name
    FROM "tblAssetMaintSch_BR_Hist" h
    INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
    INNER JOIN "tblAssetAssignments" aa
      ON aa.asset_id = ams.asset_id
     AND aa.action = 'A'
     AND aa.latest_assignment_flag = true
    INNER JOIN "tblEmployees" e ON e.emp_int_id = aa.employee_int_id
    INNER JOIN "tblUsers" u ON u.emp_int_id = e.emp_int_id
    LEFT JOIN "tblDepartments" d ON d.dept_id = u.dept_id
    WHERE ams.org_id = $1 AND h.status = 'RO'
      AND u.int_status = 1
      AND d.dept_id IS NOT NULL
    ORDER BY d.text
    `,
    [org_id],
  );

  return {
    asset_options: assetsRes.rows.map((r) => ({
      asset_id: r.asset_id,
      asset_description: r.asset_name,
      serial_number: r.serial_number,
    })),
    asset_type_options: assetTypesRes.rows.map((r) => ({
      asset_type_id: r.asset_type_id,
      asset_type_name: r.asset_type_name,
    })),
    user_options: usersRes.rows.map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      dept_id: r.dept_id,
    })),
    department_options: deptsRes.rows.map((r) => ({
      dept_id: r.dept_id,
      department_name: r.department_name,
    })),
  };
}

/**
 * All rows from tblAssetMaintSch_BR_Hist for an AMS schedule, scoped by org via tblAssetMaintSch.
 */
async function getBrHistRowsForAmsId({ org_id, ams_id } = {}) {
  if (!org_id) throw new Error('org_id is required');
  if (!ams_id) throw new Error('ams_id is required');

  const q = `
    SELECT
      h.amsbr_id,
      h.ams_id,
      h.status,
      h.created_on,
      h.created_by,
      h.notes,
      u.full_name AS created_by_name
    FROM "tblAssetMaintSch_BR_Hist" h
    INNER JOIN "tblAssetMaintSch" ams ON ams.ams_id = h.ams_id
    LEFT JOIN "tblUsers" u ON u.user_id = h.created_by
    WHERE h.ams_id = $1 AND ams.org_id = $2
    ORDER BY h.created_on ASC NULLS LAST, h.amsbr_id ASC
  `;

  const dbPool = getDb();
  const r = await dbPool.query(q, [ams_id, org_id]);
  return r.rows;
}

module.exports = {
  insertBrHist,
  getReopenedBreakdownsMoreThanOnce,
  getReopenedBreakdownsFromHistory,
  getReopenedBreakdownsFilterOptionsFromHistory,
  getBrHistRowsForAmsId,
};

