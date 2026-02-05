const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');
const crypto = require('crypto');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const VALID_HEADER_STATUSES = ['IN', 'IP', 'CO', 'CA'];
const VALID_DETAIL_STATUSES = ['IN', 'AP', 'UA', 'UR'];

async function getUserIdByEmpIntId(empIntId) {
  const r = await getDb().query(
    `SELECT user_id FROM "tblUsers" WHERE emp_int_id = $1 AND int_status = 1`,
    [empIntId]
  );
  return r.rows[0]?.user_id || null;
}

async function getUserRoleIds(userId) {
  const r = await getDb().query(
    `SELECT job_role_id FROM "tblUserJobRoles" WHERE user_id = $1`,
    [userId]
  );
  return r.rows.map((x) => x.job_role_id);
}

async function getBranchCodeByBranchId(branchId) {
  if (!branchId) return null;
  const r = await getDb().query(`SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`, [branchId]);
  return r.rows[0]?.branch_code || null;
}

async function getAssetById(assetId, orgId) {
  const r = await getDb().query(
    `SELECT asset_id, asset_type_id, group_id, org_id, branch_id, current_status FROM "tblAssets" WHERE asset_id = $1 AND org_id = $2`,
    [assetId, orgId]
  );
  return r.rows[0] || null;
}

async function getEmpIntIdByUserId(userId) {
  if (!userId) return null;
  const r = await getDb().query(`SELECT emp_int_id FROM "tblUsers" WHERE user_id = $1 AND int_status = 1`, [userId]);
  return r.rows[0]?.emp_int_id || null;
}

/**
 * Generate an internal group ID for individual asset scraps.
 * This ID is NOT a real group in tblAssetGroup_H, it's just used for workflow tracking.
 */
function generateInternalGroupId() {
  return `SCRAP_INDIVIDUAL_${crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
}

/**
 * Check if a group ID is an internal (virtual) group ID for individual assets
 */
function isInternalGroupId(groupId) {
  return groupId && (groupId.startsWith('SCRAP_INDIVIDUAL_') || groupId.startsWith('SCRAP_SALES_'));
}

async function getAssetGroupById(assetgroupId) {
  // If it's an internal group ID, return null header (not a real group)
  if (isInternalGroupId(assetgroupId)) {
    // For internal groups, we need to get the asset_id from somewhere
    // This will be handled by the caller passing asset_id separately
    return {
      header: null,
      assets: [],
      isInternal: true,
    };
  }

  const header = await getDb().query(
    `SELECT assetgroup_h_id, org_id, branch_code, text FROM "tblAssetGroup_H" WHERE assetgroup_h_id = $1`,
    [assetgroupId]
  );
  const details = await getDb().query(
    `
      SELECT d.asset_id, a.asset_type_id, a.current_status, a.serial_number, a.text as asset_name
      FROM "tblAssetGroup_D" d
      INNER JOIN "tblAssets" a ON d.asset_id = a.asset_id
      WHERE d.assetgroup_h_id = $1
      ORDER BY d.assetgroup_d_id ASC
    `,
    [assetgroupId]
  );

  return {
    header: header.rows[0] || null,
    assets: details.rows || [],
    isInternal: false,
  };
}

async function getScrapSequences(assetTypeId, orgId) {
  const r = await getDb().query(
    `
      SELECT id, asset_type_id, wf_steps_id, seq_no, org_id
      FROM "tblWFScrapSeq"
      WHERE asset_type_id = $1 AND org_id = $2
      ORDER BY seq_no ASC
    `,
    [assetTypeId, orgId]
  );
  return r.rows;
}

async function isScrapApprovalRequired(assetTypeId, orgId) {
  try {
    const r = await getDb().query(
      `SELECT maint_required FROM "tblAssetTypes" WHERE asset_type_id = $1 AND org_id = $2`,
      [assetTypeId, orgId]
    );
    // Default: require approval
    if (!r.rows.length) return true;
    
    const row = r.rows[0];
    // If maint_required is false, no approval needed (bypass workflow)
    if (row.maint_required === false || row.maint_required === 0 || row.maint_required === 'false' || row.maint_required === '0') {
      return false;
    }
    
    // Otherwise workflow is mandatory for all scrap operations
    return true;
  } catch (e) {
    // Defensive: default to requiring approval
    return true;
  }
}

async function seedScrapSequencesFromMaintenance(assetTypeId, orgId) {
  // Copy maintenance workflow sequences if scrap sequences are missing
  const wfRes = await getDb().query(
    `
      SELECT wf_steps_id, seqs_no
      FROM "tblWFATSeqs"
      WHERE asset_type_id = $1 AND org_id = $2
      ORDER BY seqs_no ASC
    `,
    [assetTypeId, orgId]
  );

  if (!wfRes.rows.length) {
    return { created: 0 };
  }

  let created = 0;
  for (const row of wfRes.rows) {
    const id = `WFSCQ_${crypto.randomUUID().slice(0, 12)}`;
    // eslint-disable-next-line no-await-in-loop
    await getDb().query(
      `
        INSERT INTO "tblWFScrapSeq" (id, asset_type_id, wf_steps_id, seq_no, org_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `,
      [id, assetTypeId, row.wf_steps_id, Number(row.seqs_no), orgId]
    );
    created += 1;
  }

  return { created };
}

async function getWorkflowJobRoles(wfStepsId) {
  const r = await getDb().query(
    `
      SELECT wf_job_role_id, wf_steps_id, job_role_id, dept_id, emp_int_id
      FROM "tblWFJobRole"
      WHERE wf_steps_id = $1
      ORDER BY wf_job_role_id ASC
    `,
    [wfStepsId]
  );
  return r.rows;
}

async function createScrapWorkflowHeader({
  assetgroup_id,
  wfscrapseq_id,
  created_by,
  is_scrap_sales = 'N',
}) {
  const id_d = await generateCustomId('wfscrap_h', 3);
  const r = await getDb().query(
    `
      INSERT INTO "tblWFScrap_H" (
        id_d, assetgroup_id, wfscrapseq_id,
        status, created_by, created_on, changed_by, changed_on,
        is_scrap_sales
      ) VALUES ($1, $2, $3, 'IN', $4, CURRENT_TIMESTAMP, NULL, NULL, $5)
      RETURNING *
    `,
    [id_d, assetgroup_id, wfscrapseq_id, created_by, is_scrap_sales]
  );
  return r.rows[0];
}

async function createScrapWorkflowDetails({
  wfscrap_h_id,
  sequences,
  created_by,
  initialNotes = null,
}) {
  if (!Array.isArray(sequences) || sequences.length === 0) {
    return { created: 0 };
  }

  const minSeq = Math.min(...sequences.map((s) => Number(s.seq_no)));
  let created = 0;

  for (const seq of sequences) {
    // eslint-disable-next-line no-await-in-loop
    const jobRoles = await getWorkflowJobRoles(seq.wf_steps_id);
    if (!jobRoles || jobRoles.length === 0) continue;

    // For current codebase, treat each job_role as a distinct approval row.
    // The approval logic will move to the next seq only when ALL AP rows at the current seq are UA/UR.
    for (const jr of jobRoles) {
      // eslint-disable-next-line no-await-in-loop
      const id = await generateCustomId('wfscrap_d', 3);
      const status = Number(seq.seq_no) === minSeq ? 'AP' : 'IN';
      const notes = status === 'AP' ? (initialNotes || null) : null;

      // eslint-disable-next-line no-await-in-loop
      await getDb().query(
        `
          INSERT INTO "tblWFScrap_D" (
            id, wfscrap_h_id, job_role_id, dept_id, seq,
            status, notes, created_by, created_on, changed_by, changed_on
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, NULL, NULL)
        `,
        [id, wfscrap_h_id, jr.job_role_id, jr.dept_id, Number(seq.seq_no), status, notes, created_by]
      );
      created += 1;
    }
  }

  return { created };
}

async function insertAssetScrapRows(client, { asset_group_id, asset_ids, scrap_gen_by, notes }) {
  let inserted = 0;
  for (const asset_id of asset_ids) {
    // eslint-disable-next-line no-await-in-loop
    const id = await generateCustomId('asset_scrap', 3);
    // eslint-disable-next-line no-await-in-loop
    await client.query(
      `
        INSERT INTO "tblAssetScrap" (id, asset_group_id, asset_id, scrap_gen_by, scrap_gen_at, notes)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
      `,
      [id, asset_group_id, asset_id, scrap_gen_by, notes || null]
    );
    inserted += 1;
  }
  return inserted;
}

// Insert into existing legacy scrap details table (used by Scrap Assets UI / reports)
async function insertAssetScrapDetRows(client, { asset_ids, org_id, scrapped_by, notes, location = null }) {
  let inserted = 0;
  for (const asset_id of asset_ids) {
    // eslint-disable-next-line no-await-in-loop
    const asd_id = await generateCustomId('asset_scrap_det', 4);
    // eslint-disable-next-line no-await-in-loop
    await client.query(
      `
        INSERT INTO "tblAssetScrapDet" (
          asd_id,
          asset_id,
          scrapped_date,
          scrapped_by,
          location,
          notes,
          org_id
        ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
      `,
      [asd_id, asset_id, scrapped_by, location, notes || null, org_id]
    );
    inserted += 1;
  }
  return inserted;
}

async function markAssetsScrapped(client, { asset_ids, changed_by, scraped_by = null, scrap_notes = null, scraped_on = null }) {
  if (!asset_ids || asset_ids.length === 0) return;

  // Mark assets as SCRAPPED
  await client.query(
    `
      UPDATE "tblAssets"
      SET current_status = 'SCRAPPED',
          changed_by = $1,
          changed_on = CURRENT_TIMESTAMP,
          scrap_notes = COALESCE($3, scrap_notes),
          scraped_by = COALESCE($4, scraped_by),
          scraped_on = COALESCE($5, CURRENT_TIMESTAMP)
      WHERE asset_id = ANY($2::varchar[])
    `,
    [changed_by, asset_ids, scrap_notes, scraped_by, scraped_on]
  );

  // Unassign any active assignments (same behavior as existing scrap module)
  await client.query(
    `
      UPDATE "tblAssetAssignments"
      SET action = 'C',
          latest_assignment_flag = false,
          action_on = CURRENT_TIMESTAMP,
          action_by = $1
      WHERE asset_id = ANY($2::varchar[])
        AND action = 'A'
        AND latest_assignment_flag = true
    `,
    [changed_by, asset_ids]
  );
}

async function cleanupGroupAfterScrap(client, { assetgroup_id, asset_ids, changed_by }) {
  // Skip cleanup for internal group IDs (they're not real groups)
  if (isInternalGroupId(assetgroup_id)) {
    return;
  }

  // IMPORTANT:
  // In PostgreSQL, ANY error inside a transaction aborts the whole transaction until ROLLBACK.
  // This function is "best-effort" and MUST NOT poison the outer transaction.
  // Use a SAVEPOINT so failures (FKs from docs, etc.) don't break approvals.
  try {
    await client.query('SAVEPOINT sp_cleanup_group_after_scrap');

    // Remove group links
    await client.query(`DELETE FROM "tblAssetGroup_D" WHERE assetgroup_h_id = $1`, [assetgroup_id]);

    // Clear group_id on assets that still point to this group
    await client.query(
      `UPDATE "tblAssets" SET group_id = NULL, changed_by = $1, changed_on = CURRENT_TIMESTAMP WHERE group_id = $2`,
      [changed_by, assetgroup_id]
    );

    // Attempt to delete the group header (may fail if docs exist; that's ok)
    await client.query(`DELETE FROM "tblAssetGroup_H" WHERE assetgroup_h_id = $1`, [assetgroup_id]);

    await client.query('RELEASE SAVEPOINT sp_cleanup_group_after_scrap');
  } catch (e) {
    try {
      await client.query('ROLLBACK TO SAVEPOINT sp_cleanup_group_after_scrap');
      await client.query('RELEASE SAVEPOINT sp_cleanup_group_after_scrap');
    } catch (_) {
      // ignore
    }
  }
}

async function getScrapMaintenanceApprovals(empIntId, orgId, userBranchCode, hasSuperAccess = false) {
  const userId = await getUserIdByEmpIntId(empIntId);
  if (!userId) return [];

  const roleIds = await getUserRoleIds(userId);
  // If the user is NOT a super-access user, approvals are primarily role-based.
  // Additionally, the request creator should be able to see their own pending requests.

  const params = [orgId];
  let idx = 2;

  let query = `
    SELECT DISTINCT
      wh.id_d AS wfscrap_h_id,
      wh.assetgroup_id,
      COALESCE(agh.text, 'Individual Asset') AS asset_group_name,
      agh.branch_code,
      wh.status AS header_status,
      wh.created_on,
      wh.changed_on,
      wh.is_scrap_sales,
      seq.asset_type_id,
      at.text AS asset_type_name,
      CASE
        WHEN wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' OR wh.assetgroup_id LIKE 'SCRAP_SALES_%' THEN (
          SELECT COUNT(*)::int
          FROM "tblAssetScrap" a
          WHERE a.asset_group_id = wh.assetgroup_id
        )
        ELSE (
          SELECT COUNT(*)::int
          FROM "tblAssetGroup_D" d
          WHERE d.assetgroup_h_id = wh.assetgroup_id
        )
      END AS asset_count,
      (
        SELECT MIN(d2.seq)
        FROM "tblWFScrap_D" d2
        WHERE d2.wfscrap_h_id = wh.id_d
          AND d2.status = 'AP'
      ) AS current_seq
    FROM "tblWFScrap_H" wh
    LEFT JOIN "tblAssetGroup_H" agh ON agh.assetgroup_h_id = wh.assetgroup_id
    INNER JOIN "tblWFScrapSeq" seq ON seq.id = wh.wfscrapseq_id
    INNER JOIN "tblAssetTypes" at ON at.asset_type_id = seq.asset_type_id
    INNER JOIN "tblWFScrap_D" wd ON wd.wfscrap_h_id = wh.id_d
    WHERE (
        ((wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' OR wh.assetgroup_id LIKE 'SCRAP_SALES_%') AND seq.org_id = $1)
        OR (agh.org_id = $1)
      )
      AND wh.status IN ('IN','IP')
      AND wd.status = 'AP'
  `;

  if (!hasSuperAccess && userBranchCode) {
    query += ` AND ((wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' OR wh.assetgroup_id LIKE 'SCRAP_SALES_%') OR agh.branch_code = $${idx})`;
    params.push(userBranchCode);
    idx += 1;
  }

  // Role filter (skip for super-access users)
  if (!hasSuperAccess) {
    // If the user has roles, show approvals assigned to those roles.
    // Always allow the creator to see their own pending requests.
    if (roleIds.length) {
      query += ` AND (wd.job_role_id = ANY($${idx}::varchar[]) OR wh.created_by = $${idx + 1})`;
      params.push(roleIds, userId);
      idx += 2;
    } else {
      query += ` AND wh.created_by = $${idx}`;
      params.push(userId);
      idx += 1;
    }
  }

  query += `
    ORDER BY wh.created_on DESC
  `;

  const r = await getDb().query(query, params);
  return r.rows;
}

async function getScrapApprovalDetailByHeaderId(wfscrap_h_id, orgId) {
  // First, get the header to check if it's an internal group ID
  const headerCheckQuery = `
    SELECT
      wh.id_d AS wfscrap_h_id,
      wh.assetgroup_id,
      wh.wfscrapseq_id,
      wh.status AS header_status,
      wh.created_by,
      wh.created_on,
      wh.changed_by,
      wh.changed_on,
      wh.is_scrap_sales,
      seq.asset_type_id,
      at.text AS asset_type_name
    FROM "tblWFScrap_H" wh
    INNER JOIN "tblWFScrapSeq" seq ON seq.id = wh.wfscrapseq_id
    INNER JOIN "tblAssetTypes" at ON at.asset_type_id = seq.asset_type_id
    WHERE wh.id_d = $1
  `;

  const headerCheckResult = await getDb().query(headerCheckQuery, [wfscrap_h_id]);
  if (!headerCheckResult.rows.length) return null;

  const headerRow = headerCheckResult.rows[0];
  const isInternal = isInternalGroupId(headerRow.assetgroup_id);
  const isScrapSales = headerRow.is_scrap_sales === 'Y';

  let headerResult;
  let assetsResult;

  if (isInternal) {
    if (isScrapSales) {
      // For scrap sales, fetch assets from tblAssetScrap
      assetsResult = await getDb().query(
        `
          SELECT DISTINCT
            a.asset_id,
            a.asset_type_id,
            a.serial_number,
            a.text AS asset_name,
            a.current_status
          FROM "tblAssetScrap" asset_scrap
          INNER JOIN "tblAssets" a ON a.asset_id = asset_scrap.asset_id
          WHERE asset_scrap.asset_group_id = $1
            AND a.org_id = $2
          ORDER BY a.asset_id ASC
        `,
        [headerRow.assetgroup_id, orgId]
      );

      headerResult = {
        rows: [{
          ...headerRow,
          asset_group_name: 'Scrap Sales',
          org_id: orgId,
          branch_code: null,
        }],
      };
    } else {
      // For individual asset scrap (SCRAP_INDIVIDUAL_*), fetch asset directly from tblAssets
      assetsResult = await getDb().query(
        `
          SELECT DISTINCT
            a.asset_id,
            a.asset_type_id,
            a.serial_number,
            a.text AS asset_name,
            a.current_status
          FROM "tblAssets" a
          INNER JOIN "tblWFScrap_H" wh2 ON wh2.assetgroup_id = $3
          WHERE a.asset_type_id = $1
            AND a.org_id = $2
            AND (a.group_id IS NULL OR a.group_id = $3)
            AND UPPER(COALESCE(a.current_status, '')) != 'SCRAPPED'
            AND wh2.id_d = $4
          ORDER BY a.asset_id ASC
          LIMIT 10
        `,
        [headerRow.asset_type_id, orgId, headerRow.assetgroup_id, wfscrap_h_id]
      );

      headerResult = {
        rows: [{
          ...headerRow,
          asset_group_name: 'Individual Asset',
          org_id: orgId,
          branch_code: null,
        }],
      };
    }
  } else {
    // Real group - use original query
    const headerQuery = `
      SELECT
        wh.id_d AS wfscrap_h_id,
        wh.assetgroup_id,
        wh.wfscrapseq_id,
        wh.status AS header_status,
        wh.created_by,
        wh.created_on,
        wh.changed_by,
        wh.changed_on,
        wh.is_scrap_sales,
        COALESCE(agh.text, 'Unknown Group') AS asset_group_name,
        COALESCE(agh.org_id, seq.org_id) AS org_id,
        agh.branch_code,
        seq.asset_type_id,
        at.text AS asset_type_name
      FROM "tblWFScrap_H" wh
      LEFT JOIN "tblAssetGroup_H" agh ON agh.assetgroup_h_id = wh.assetgroup_id
      INNER JOIN "tblWFScrapSeq" seq ON seq.id = wh.wfscrapseq_id
      INNER JOIN "tblAssetTypes" at ON at.asset_type_id = seq.asset_type_id
      WHERE wh.id_d = $1 AND (agh.org_id = $2 OR (agh.org_id IS NULL AND seq.org_id = $2))
    `;

    headerResult = await getDb().query(headerQuery, [wfscrap_h_id, orgId]);
    if (!headerResult.rows.length) return null;

    assetsResult = await getDb().query(
      `
        SELECT
          d.asset_id,
          a.asset_type_id,
          a.serial_number,
          a.text AS asset_name,
          a.current_status
        FROM "tblAssetGroup_D" d
        INNER JOIN "tblAssets" a ON a.asset_id = d.asset_id
        WHERE d.assetgroup_h_id = $1
        ORDER BY d.assetgroup_d_id ASC
      `,
      [headerResult.rows[0].assetgroup_id]
    );
  }

  const detailsResult = await getDb().query(
    `
      SELECT
        d.id,
        d.wfscrap_h_id,
        d.job_role_id,
        jr.text AS job_role_name,
        d.dept_id,
        dep.text AS department_name,
        d.seq,
        d.status,
        d.notes,
        d.created_by,
        d.created_on,
        d.changed_by,
        d.changed_on
      FROM "tblWFScrap_D" d
      LEFT JOIN "tblJobRoles" jr ON jr.job_role_id = d.job_role_id
      LEFT JOIN "tblDepartments" dep ON dep.dept_id = d.dept_id
      WHERE d.wfscrap_h_id = $1
      ORDER BY d.seq ASC, d.created_on ASC
    `,
    [wfscrap_h_id]
  );

  return {
    header: headerResult.rows[0],
    assets: assetsResult.rows,
    workflowSteps: detailsResult.rows,
  };
}

async function approveScrapWorkflow({ wfscrap_h_id, empIntId, note, orgId }) {
  const dbPool = getDb();
  const userId = await getUserIdByEmpIntId(empIntId);
  if (!userId) {
    return { success: false, message: 'User not found with the provided employee ID' };
  }

  const roleIds = await getUserRoleIds(userId);
  if (!roleIds.length) {
    return { success: false, message: 'User has no assigned roles' };
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Lock header row - handle both internal and real group IDs
    const headerRes = await client.query(
      `
        SELECT wh.id_d, wh.assetgroup_id, wh.status, wh.is_scrap_sales, seq.org_id
        FROM "tblWFScrap_H" wh
        INNER JOIN "tblWFScrapSeq" seq ON wh.wfscrapseq_id = seq.id
        WHERE wh.id_d = $1
        FOR UPDATE
      `,
      [wfscrap_h_id]
    );

    if (!headerRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Scrap workflow not found' };
    }

    const header = headerRes.rows[0];
    
    // For real groups, verify org_id
    if (!isInternalGroupId(header.assetgroup_id)) {
      const orgCheckRes = await client.query(
        `SELECT org_id FROM "tblAssetGroup_H" WHERE assetgroup_h_id = $1`,
        [header.assetgroup_id]
      );
      if (!orgCheckRes.rows.length || String(orgCheckRes.rows[0].org_id) !== String(orgId)) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Scrap workflow not found or access denied' };
      }
    }
    if (!VALID_HEADER_STATUSES.includes(header.status)) {
      // Not fatal, but keep consistent
      await client.query(`UPDATE "tblWFScrap_H" SET status = 'IN' WHERE id_d = $1`, [wfscrap_h_id]);
    }

    // Find an AP row for one of the user's roles
    const currentRes = await client.query(
      `
        SELECT id, seq, status, job_role_id
        FROM "tblWFScrap_D"
        WHERE wfscrap_h_id = $1
          AND status = 'AP'
          AND job_role_id = ANY($2::varchar[])
        ORDER BY seq ASC, created_on ASC
        LIMIT 1
        FOR UPDATE
      `,
      [wfscrap_h_id, roleIds]
    );

    if (!currentRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, message: 'No pending approval step found for your role' };
    }

    const current = currentRes.rows[0];

    await client.query(
      `
        UPDATE "tblWFScrap_D"
        SET status = 'UA',
            notes = $1,
            changed_by = $2,
            changed_on = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
      [note || null, userId.substring(0, 20), current.id]
    );

    // If any other AP rows exist at the same seq, we don't advance yet.
    const remainingAtSeq = await client.query(
      `
        SELECT COUNT(*)::int AS remaining
        FROM "tblWFScrap_D"
        WHERE wfscrap_h_id = $1
          AND seq = $2
          AND status = 'AP'
      `,
      [wfscrap_h_id, current.seq]
    );

    const remaining = remainingAtSeq.rows[0]?.remaining || 0;

    // Always mark header as in progress once an approval happens (unless already completed/cancelled)
    if (header.status !== 'CO' && header.status !== 'CA') {
      await client.query(
        `
          UPDATE "tblWFScrap_H"
          SET status = 'IP', changed_by = $1, changed_on = CURRENT_TIMESTAMP
          WHERE id_d = $2
        `,
        [userId.substring(0, 20), wfscrap_h_id]
      );
    }

    if (remaining > 0) {
      await client.query('COMMIT');
      return { success: true, message: 'Approved. Waiting for other approvals in the same step.' };
    }

    // Advance to next sequence (if any)
    const nextSeqRes = await client.query(
      `
        SELECT MIN(seq) AS next_seq
        FROM "tblWFScrap_D"
        WHERE wfscrap_h_id = $1
          AND seq > $2
          AND status = 'IN'
      `,
      [wfscrap_h_id, current.seq]
    );

    const nextSeq = nextSeqRes.rows[0]?.next_seq;
    if (nextSeq) {
      await client.query(
        `
          UPDATE "tblWFScrap_D"
          SET status = 'AP', changed_by = $1, changed_on = CURRENT_TIMESTAMP
          WHERE wfscrap_h_id = $2
            AND seq = $3
            AND status = 'IN'
        `,
        [userId.substring(0, 20), wfscrap_h_id, Number(nextSeq)]
      );

      await client.query('COMMIT');
      return { success: true, message: 'Approved and moved to next step.' };
    }

    // No next step: complete workflow and scrap assets
    let assetIds = [];
    let inserted = 0; // Track number of assets scrapped
    if (isInternalGroupId(header.assetgroup_id)) {
      // For internal group IDs, we need to find the asset differently
      // Query assets that match the workflow's asset_type_id and org_id, and are not in any real group
      const assetTypeRes = await client.query(
        `
          SELECT seq.asset_type_id
          FROM "tblWFScrapSeq" seq
          INNER JOIN "tblWFScrap_H" wh ON wh.wfscrapseq_id = seq.id
          WHERE wh.id_d = $1
        `,
        [wfscrap_h_id]
      );
      const assetTypeId = assetTypeRes.rows[0]?.asset_type_id;
      
      if (assetTypeId) {
        const assetsRes = await client.query(
          `
            SELECT a.asset_id
            FROM "tblAssets" a
            WHERE a.asset_type_id = $1
              AND a.org_id = $2
              AND (a.group_id IS NULL OR a.group_id = $3)
            ORDER BY a.asset_id ASC
            LIMIT 1
          `,
          [assetTypeId, orgId, header.assetgroup_id]
        );
        assetIds = assetsRes.rows.map((r) => r.asset_id);
      }
    } else {
      // Real group - query from tblAssetGroup_D
      const assetsRes = await client.query(
        `
          SELECT d.asset_id
          FROM "tblAssetGroup_D" d
          WHERE d.assetgroup_h_id = $1
          ORDER BY d.assetgroup_d_id ASC
        `,
        [header.assetgroup_id]
      );
      assetIds = assetsRes.rows.map((r) => r.asset_id);
    }

    await client.query(
      `
        UPDATE "tblWFScrap_H"
        SET status = 'CO', changed_by = $1, changed_on = CURRENT_TIMESTAMP
        WHERE id_d = $2
      `,
      [userId.substring(0, 20), wfscrap_h_id]
    );

    // If this is a scrap sales workflow, update tblScrapSales_H status to 'CO' (Completed)
    if (header.is_scrap_sales === 'Y') {
      console.log(`[Scrap Sales Approval] Workflow ${wfscrap_h_id} is a scrap sales workflow. Updating tblScrapSales_H status to CO.`);
      
      // Get asset IDs from tblAssetScrap for this workflow
      const assetScrapRes = await client.query(
        `SELECT DISTINCT asset_id FROM "tblAssetScrap" WHERE asset_group_id = $1`,
        [header.assetgroup_id]
      );
      const workflowAssetIds = assetScrapRes.rows.map(r => r.asset_id);
      
      console.log(`[Scrap Sales Approval] Found ${workflowAssetIds.length} assets in tblAssetScrap for group ${header.assetgroup_id}:`, workflowAssetIds);
      
      if (workflowAssetIds.length > 0) {
        // Find scrap sales header that has these assets in its details
        // Match by finding scrap sales with same assets via tblScrapSales_D -> tblAssetScrapDet
        // Also match by org_id to ensure we get the correct record
        // Use a more flexible matching: find the record with the most matching assets
        const scrapSalesQuery = `
          SELECT 
            ssh.ssh_id,
            COUNT(DISTINCT asd.asset_id) as matching_assets
          FROM "tblScrapSales_H" ssh
          INNER JOIN "tblScrapSales_D" ssd ON ssh.ssh_id = ssd.ssh_id
          INNER JOIN "tblAssetScrapDet" asd ON ssd.asd_id = asd.asd_id
          WHERE ssh.status = 'AP'
            AND ssh.org_id = $1
            AND asd.asset_id = ANY($2::varchar[])
          GROUP BY ssh.ssh_id
          ORDER BY matching_assets DESC, ssh.created_on DESC
          LIMIT 1
        `;
        const scrapSalesResult = await client.query(scrapSalesQuery, [header.org_id, workflowAssetIds]);
        
        console.log(`[Scrap Sales Approval] Found ${scrapSalesResult.rows.length} matching scrap sales record(s)`);
        
        if (scrapSalesResult.rows.length > 0) {
          const ssh_id = scrapSalesResult.rows[0].ssh_id;
          const matchingCount = scrapSalesResult.rows[0].matching_assets;
          console.log(`[Scrap Sales Approval] Found scrap sales record ssh_id: ${ssh_id} with ${matchingCount} matching assets (out of ${workflowAssetIds.length} total)`);
          
          // Only update if we have a reasonable match (at least 50% of assets match, or exact match)
          if (matchingCount >= Math.ceil(workflowAssetIds.length / 2) || matchingCount === workflowAssetIds.length) {
            console.log(`[Scrap Sales Approval] Updating tblScrapSales_H (ssh_id: ${ssh_id}) status from AP to CO`);
            
            const updateResult = await client.query(
              `UPDATE "tblScrapSales_H" 
               SET status = 'CO', changed_by = $1, changed_on = CURRENT_TIMESTAMP 
               WHERE ssh_id = $2
               RETURNING ssh_id, status`,
              [userId.substring(0, 20), ssh_id]
            );
            
            console.log(`[Scrap Sales Approval] Update result:`, updateResult.rows[0]);
          } else {
            console.warn(`[Scrap Sales Approval] Match quality too low (${matchingCount}/${workflowAssetIds.length}). Skipping update.`);
          }
        } else {
          console.warn(`[Scrap Sales Approval] No matching scrap sales record found with status AP for org_id ${header.org_id} and assets:`, workflowAssetIds);
        }
      } else {
        console.warn(`[Scrap Sales Approval] No assets found in tblAssetScrap for group ${header.assetgroup_id}`);
      }
      // For scrap sales, assets are already scrapped (in tblAssetScrapDet), so we don't need to mark them again
      inserted = workflowAssetIds.length;
      await client.query('COMMIT');
      return { success: true, message: 'Approved. Scrap sales workflow completed.', scrappedCount: inserted };
    } else {
      // For regular scrap assets, mark assets as scrapped
      inserted = await insertAssetScrapRows(client, {
        asset_group_id: header.assetgroup_id,
        asset_ids: assetIds,
        scrap_gen_by: empIntId,
        notes: note || null,
      });

      // Also write to the legacy scrap details table (same as existing Scrap Assets flow)
      await insertAssetScrapDetRows(client, {
        asset_ids: assetIds,
        org_id: orgId,
        scrapped_by: empIntId,
        notes: note || null,
        location: null,
      });

      // IMPORTANT: tblAssets.changed_by has FK to tblUsers.user_id.
      // Use resolved userId (not empIntId) to avoid FK violations.
      await markAssetsScrapped(client, {
        asset_ids: assetIds,
        changed_by: userId,
        scraped_by: empIntId,
        scrap_notes: note || null,
        scraped_on: null,
      });
      await cleanupGroupAfterScrap(client, { assetgroup_id: header.assetgroup_id, asset_ids: assetIds, changed_by: userId });
    }

    await client.query('COMMIT');
    return { success: true, message: 'Approved. Workflow completed and assets scrapped.', scrappedCount: inserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function rejectScrapWorkflow({ wfscrap_h_id, empIntId, reason, orgId }) {
  const dbPool = getDb();
  const userId = await getUserIdByEmpIntId(empIntId);
  if (!userId) {
    return { success: false, message: 'User not found with the provided employee ID' };
  }

  const roleIds = await getUserRoleIds(userId);
  if (!roleIds.length) {
    return { success: false, message: 'User has no assigned roles' };
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Handle both internal and real group IDs
    const headerRes = await getDb().query(
      `
        SELECT wh.id_d, wh.assetgroup_id
        FROM "tblWFScrap_H" wh
        WHERE wh.id_d = $1
        FOR UPDATE
      `,
      [wfscrap_h_id]
    );
    
    if (!headerRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Scrap workflow not found' };
    }

    const assetgroupId = headerRes.rows[0].assetgroup_id;
    
    // For real groups, verify org_id
    if (!isInternalGroupId(assetgroupId)) {
      const orgCheckRes = await getDb().query(
        `SELECT org_id FROM "tblAssetGroup_H" WHERE assetgroup_h_id = $1`,
        [assetgroupId]
      );
      if (!orgCheckRes.rows.length || String(orgCheckRes.rows[0].org_id) !== String(orgId)) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Scrap workflow not found or access denied' };
      }
    }

    if (!headerRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Scrap workflow not found' };
    }

    const currentRes = await client.query(
      `
        SELECT id, seq, status, job_role_id
        FROM "tblWFScrap_D"
        WHERE wfscrap_h_id = $1
          AND status = 'AP'
          AND job_role_id = ANY($2::varchar[])
        ORDER BY seq ASC, created_on ASC
        LIMIT 1
        FOR UPDATE
      `,
      [wfscrap_h_id, roleIds]
    );

    if (!currentRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, message: 'No pending approval step found for your role' };
    }

    const current = currentRes.rows[0];

    // Mark current as rejected
    await client.query(
      `
        UPDATE "tblWFScrap_D"
        SET status = 'UR',
            notes = $1,
            changed_by = $2,
            changed_on = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
      [reason || null, userId.substring(0, 20), current.id]
    );

    // Reset everything after current seq back to IN, and previous approvals back to AP
    await client.query(
      `
        UPDATE "tblWFScrap_D"
        SET status = 'IN', changed_by = $1, changed_on = CURRENT_TIMESTAMP
        WHERE wfscrap_h_id = $2 AND seq > $3
      `,
      [userId.substring(0, 20), wfscrap_h_id, current.seq]
    );

    await client.query(
      `
        UPDATE "tblWFScrap_D"
        SET status = 'AP', changed_by = $1, changed_on = CURRENT_TIMESTAMP
        WHERE wfscrap_h_id = $2 AND seq < $3 AND status = 'UA'
      `,
      [userId.substring(0, 20), wfscrap_h_id, current.seq]
    );

    await client.query(
      `
        UPDATE "tblWFScrap_H"
        SET status = 'IP', changed_by = $1, changed_on = CURRENT_TIMESTAMP
        WHERE id_d = $2
      `,
      [userId.substring(0, 20), wfscrap_h_id]
    );

    await client.query('COMMIT');
    return { success: true, message: 'Rejected. Workflow sent back for re-approval.' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createScrapRequest({
  orgId,
  userId,
  branchId,
  asset_id = null,
  assetgroup_id = null,
  is_scrap_sales = 'N',
  request_notes = null,
}) {
  const branch_code = await getBranchCodeByBranchId(branchId);

  // Resolve asset group + assets
  let groupId = assetgroup_id;
  let group = null;
  let isIndividualAsset = false;
  let individualAssetId = null;

  if (!groupId && asset_id) {
    // Individual asset scrap - use internal group ID (NOT a real group)
    const asset = await getAssetById(asset_id, orgId);
    if (!asset) {
      return { success: false, message: `Asset ${asset_id} not found` };
    }

    if (asset.group_id) {
      // Asset is part of a real group, use that group ID
      groupId = asset.group_id;
    } else {
      // Individual asset - use internal group ID (do NOT create real group)
      groupId = generateInternalGroupId();
      isIndividualAsset = true;
      individualAssetId = asset_id;
    }
  }

  if (!groupId) {
    return { success: false, message: 'asset_id or assetgroup_id is required' };
  }

  // Check if this is an internal group ID (for individual assets)
  if (isInternalGroupId(groupId)) {
    // For individual assets, create a virtual group structure
    if (!individualAssetId) {
      return { success: false, message: 'asset_id is required for individual asset scrap' };
    }
    const asset = await getAssetById(individualAssetId, orgId);
    if (!asset) {
      return { success: false, message: `Asset ${individualAssetId} not found` };
    }
    group = {
      header: null,
      assets: [{
        asset_id: asset.asset_id,
        asset_type_id: asset.asset_type_id,
        current_status: asset.current_status,
        serial_number: null,
        asset_name: null,
      }],
      isInternal: true,
    };
  } else {
    // Real group - fetch from database
    group = await getAssetGroupById(groupId);
    if (!group.header) {
      return { success: false, message: `Asset group ${groupId} not found` };
    }
    if (String(group.header.org_id) !== String(orgId)) {
      return { success: false, message: 'Asset group does not belong to your organization' };
    }
    if (!group.assets.length) {
      return { success: false, message: 'Asset group has no assets' };
    }
  }

  // Prevent scrapping assets that are already scrapped/decommissioned
  const alreadyScrapped = group.assets.filter((a) => String(a.current_status || '').toUpperCase() === 'SCRAPPED');
  if (alreadyScrapped.length > 0) {
    return {
      success: false,
      message: 'One or more assets in this group are already SCRAPPED',
      scrappedAssets: alreadyScrapped.map((a) => a.asset_id),
    };
  }

  const assetTypeIds = Array.from(new Set(group.assets.map((a) => a.asset_type_id).filter(Boolean)));
  if (assetTypeIds.length !== 1) {
    return {
      success: false,
      message: 'All assets in the group must have the same asset_type_id to start a scrap workflow',
      assetTypeIds,
    };
  }

  const assetTypeId = assetTypeIds[0];
  const approvalRequired = await isScrapApprovalRequired(assetTypeId, orgId);
  let sequences = approvalRequired ? await getScrapSequences(assetTypeId, orgId) : [];

  // If approval is NOT required, scrap directly regardless of existing workflows/config
  if (!approvalRequired) {
    const dbPool = getDb();
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');
      const assetIds = group.assets.map((a) => a.asset_id);
      const inserted = await insertAssetScrapRows(client, {
        asset_group_id: groupId,
        asset_ids: assetIds,
        scrap_gen_by: userId,
        notes: request_notes || null,
      });

      // Also write to the legacy scrap details table (same as existing Scrap Assets flow)
      const empIntIdForDet = await getEmpIntIdByUserId(userId);
      await insertAssetScrapDetRows(client, {
        asset_ids: assetIds,
        org_id: orgId,
        scrapped_by: empIntIdForDet || userId,
        notes: request_notes || null,
        location: null,
      });

      await markAssetsScrapped(client, {
        asset_ids: assetIds,
        changed_by: userId,
        scraped_by: empIntIdForDet || userId,
        scrap_notes: request_notes || null,
        scraped_on: null,
      });
      // Only cleanup real groups, not internal group IDs
      if (!isInternalGroupId(groupId)) {
        await cleanupGroupAfterScrap(client, { assetgroup_id: groupId, asset_ids: assetIds, changed_by: userId });
      }
      await client.query('COMMIT');
      return { success: true, workflowCreated: false, scrapped: true, scrappedCount: inserted, assetgroup_id: groupId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // If there's already an active scrap workflow for this group, return it instead of creating a duplicate
  const existingWorkflow = await getDb().query(
    `SELECT id_d FROM "tblWFScrap_H" WHERE assetgroup_id = $1 AND status IN ('IN','IP') ORDER BY created_on DESC LIMIT 1`,
    [groupId]
  );
  if (existingWorkflow.rows.length > 0) {
    return {
      success: true,
      workflowCreated: true,
      wfscrap_h_id: existingWorkflow.rows[0].id_d,
      detailsCreated: 0,
      assetgroup_id: groupId,
      message: 'An active scrap workflow already exists for this group',
    };
  }

  // If approval is required, we MUST have workflow sequence configured.
  // Do NOT fall back to direct scrapping, because that would bypass approval.
  if (approvalRequired && !sequences.length) {
    return {
      success: false,
      message: `Scrap approval is required but workflow sequence is not configured for asset type ${assetTypeId}. Please configure tblWFScrapSeq.`,
      asset_type_id: assetTypeId,
    };
  }

  const header = await createScrapWorkflowHeader({
    assetgroup_id: groupId,
    wfscrapseq_id: sequences[0].id,
    created_by: userId,
    is_scrap_sales,
  });

  const details = await createScrapWorkflowDetails({
    wfscrap_h_id: header.id_d,
    sequences,
    created_by: userId,
    initialNotes: request_notes || null,
  });

  return {
    success: true,
    workflowCreated: true,
    wfscrap_h_id: header.id_d,
    detailsCreated: details.created,
    assetgroup_id: groupId,
  };
}

module.exports = {
  VALID_HEADER_STATUSES,
  VALID_DETAIL_STATUSES,
  getBranchCodeByBranchId,
  getScrapSequences,
  getWorkflowJobRoles,
  createScrapRequest,
  /**
   * Split a group by moving selected assets into a new group and creating a scrap workflow for that new group.
   * Also enforces rule: if original group ends up with 1 asset, that asset becomes individual (group removed).
   */
  createScrapRequestFromGroupSelection: async ({
    orgId,
    userId,
    branchId,
    assetgroup_id,
    asset_ids,
    is_scrap_sales = 'N',
    request_notes = null,
  }) => {
    if (!assetgroup_id) {
      return { success: false, message: 'assetgroup_id is required' };
    }
    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return { success: false, message: 'asset_ids array is required' };
    }

    const dbPool = getDb();
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      // Load group header + assets
      const groupHeaderRes = await client.query(
        `SELECT assetgroup_h_id, org_id, branch_code, text FROM "tblAssetGroup_H" WHERE assetgroup_h_id = $1 FOR UPDATE`,
        [assetgroup_id]
      );
      if (!groupHeaderRes.rows.length) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Asset group not found' };
      }
      const groupHeader = groupHeaderRes.rows[0];
      if (String(groupHeader.org_id) !== String(orgId)) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Asset group does not belong to your organization' };
      }

      const groupAssetsRes = await client.query(
        `
          SELECT d.asset_id, a.asset_type_id, a.current_status
          FROM "tblAssetGroup_D" d
          INNER JOIN "tblAssets" a ON a.asset_id = d.asset_id
          WHERE d.assetgroup_h_id = $1
          FOR UPDATE
        `,
        [assetgroup_id]
      );
      const groupAssetIds = new Set(groupAssetsRes.rows.map((r) => r.asset_id));
      const invalid = asset_ids.filter((id) => !groupAssetIds.has(id));
      if (invalid.length) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Some asset_ids are not part of this group', invalidAssetIds: invalid };
      }

      const alreadyScrapped = groupAssetsRes.rows
        .filter((r) => asset_ids.includes(r.asset_id))
        .filter((r) => String(r.current_status || '').toUpperCase() === 'SCRAPPED');
      if (alreadyScrapped.length) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Some selected assets are already SCRAPPED', scrappedAssets: alreadyScrapped.map((r) => r.asset_id) };
      }

      const selectedAssetTypeIds = Array.from(
        new Set(groupAssetsRes.rows.filter((r) => asset_ids.includes(r.asset_id)).map((r) => r.asset_type_id).filter(Boolean))
      );
      if (selectedAssetTypeIds.length !== 1) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Selected assets must have the same asset_type_id', assetTypeIds: selectedAssetTypeIds };
      }

      const totalAssets = groupAssetIds.size;
      const selectedCount = asset_ids.length;
      const remainingCount = totalAssets - selectedCount;

      // Determine which group ID to use for scrap workflow
      let scrapGroupId = null;
      let isScrapIndividual = false;

      if (remainingCount === 0) {
        // All assets selected: Use original group ID, no group modifications needed
        scrapGroupId = assetgroup_id;
        // Group structure remains unchanged - all assets stay in the group
      } else if (selectedCount === 1 && remainingCount >= 2) {
        // Only 1 asset selected, 2+ remaining: Selected asset becomes individual (internal group ID)
        // Remaining assets stay in original group
        isScrapIndividual = true;
        scrapGroupId = generateInternalGroupId();
        
        // Remove selected asset from original group
        await client.query(
          `DELETE FROM "tblAssetGroup_D" WHERE assetgroup_h_id = $1 AND asset_id = $2`,
          [assetgroup_id, asset_ids[0]]
        );
        await client.query(
          `UPDATE "tblAssets" SET group_id = NULL, changed_by = $1, changed_on = CURRENT_TIMESTAMP WHERE asset_id = $2`,
          [userId, asset_ids[0]]
        );
        // Original group remains with remaining assets (2+)
      } else if (remainingCount === 1 && selectedCount >= 2) {
        // Most assets selected (only 1 remaining): Keep selected assets in original group
        // Remove only the 1 unselected asset from group and make it individual
        scrapGroupId = assetgroup_id; // Use original group ID for scrap workflow
        
        // Get all asset IDs in the group
        const allGroupAssetIds = Array.from(groupAssetIds);
        // Find the unselected asset (the one that's NOT in asset_ids)
        const unselectedAssetId = allGroupAssetIds.find(id => !asset_ids.includes(id));
        
        if (unselectedAssetId) {
          // Remove only the unselected asset from group and make it individual
          await client.query(
            `DELETE FROM "tblAssetGroup_D" WHERE assetgroup_h_id = $1 AND asset_id = $2`,
            [assetgroup_id, unselectedAssetId]
          );
          await client.query(
            `UPDATE "tblAssets" SET group_id = NULL, changed_by = $1, changed_on = CURRENT_TIMESTAMP WHERE asset_id = $2`,
            [userId, unselectedAssetId]
          );
          // Keep the original group with selected assets (don't delete it)
          // Selected assets remain in the group and will go through scrap workflow with this group_id
        }
      } else if (remainingCount >= 2 && selectedCount >= 2) {
        // Both selected and remaining have 2+ assets: Create new group for selected assets
        // Remaining assets stay in original group
        const newGroupId = await generateCustomId('asset_group_h', 3);
        const newGroupName = `${groupHeader.text || groupHeader.assetgroup_h_id} - Scrap`;

        await client.query(
          `
            INSERT INTO "tblAssetGroup_H" (
              assetgroup_h_id, org_id, branch_code, text, created_by, created_on, changed_by, changed_on
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)
          `,
          [newGroupId, orgId, groupHeader.branch_code || (await getBranchCodeByBranchId(branchId)) || null, newGroupName, userId]
        );

        // Remove selected assets from the original group
        await client.query(
          `DELETE FROM "tblAssetGroup_D" WHERE assetgroup_h_id = $1 AND asset_id = ANY($2::varchar[])`,
          [assetgroup_id, asset_ids]
        );

        // Add selected assets to the new group + update their group_id
        for (const assetId of asset_ids) {
          // eslint-disable-next-line no-await-in-loop
          const detailId = await generateCustomId('asset_group_d', 3);
          // eslint-disable-next-line no-await-in-loop
          await client.query(
            `INSERT INTO "tblAssetGroup_D" (assetgroup_d_id, assetgroup_h_id, asset_id) VALUES ($1, $2, $3)`,
            [detailId, newGroupId, assetId]
          );
        }

        await client.query(
          `UPDATE "tblAssets" SET group_id = $1, changed_by = $2, changed_on = CURRENT_TIMESTAMP WHERE asset_id = ANY($3::varchar[])`,
          [newGroupId, userId, asset_ids]
        );

        scrapGroupId = newGroupId;
        // Original group remains with remaining assets (2+)
      } else {
        // Edge case: all assets selected or invalid state
        await client.query('ROLLBACK');
        return { success: false, message: 'Invalid selection: all assets selected or invalid state' };
      }

      await client.query('COMMIT');

      // Now create scrap request
      if (isScrapIndividual) {
        // For individual asset, pass asset_id instead of assetgroup_id
        return await module.exports.createScrapRequest({
          orgId,
          userId,
          branchId,
          assetgroup_id: null,
          asset_id: asset_ids[0],
          is_scrap_sales,
          request_notes,
        });
      } else {
        // For grouped assets, use the group ID
        return await module.exports.createScrapRequest({
          orgId,
          userId,
          branchId,
          assetgroup_id: scrapGroupId,
          asset_id: null,
          is_scrap_sales,
          request_notes,
        });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  getScrapMaintenanceApprovals,
  getScrapApprovalDetailByHeaderId,
  approveScrapWorkflow,
  rejectScrapWorkflow,
};

