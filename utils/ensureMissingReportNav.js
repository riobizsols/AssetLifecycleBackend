const { generateCustomIdForClient, syncJobRoleNavIdSequence } = require('./idGenerator');

/** Later-added Reports screens that existing tenants often never received. */
const MISSING_REPORT_NAV_ITEMS = [
  { app_id: 'AUDITREPORT', label: 'Audit Reports' },
];

/** Any of these on a role means that role already has the Reports menu. */
const EXISTING_REPORT_APP_IDS = [
  'ASSETLIFECYCLEREPORT',
  'ASSETREPORT',
  'QAAUDITREPORT',
  'SLAREPORT',
  'MAINTENANCEHISTORY',
  'ASSETVALUATION',
  'ASSETWORKFLOWHISTORY',
  'BREAKDOWNHISTORY',
  'USAGEBASEDASSETREPORT',
  'REOPENEDBREAKDOWNS',
  'CONSOLIDATEDASSETREPORT',
];

async function ensureApps(client, orgId) {
  for (const item of MISSING_REPORT_NAV_ITEMS) {
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = true
      `,
      [item.app_id, item.label, orgId],
    );
  }
}

/**
 * Add Audit Reports to every job role that already has other report screens.
 * Uses the same parent as those screens so flattened or grouped menus both work.
 * Safe to call on login / navigation load.
 */
async function ensureMissingReportNav(client, orgId, logLabel = 'ReportNav') {
  if (!client?.query || !orgId) {
    return { inserted: 0, skipped: true };
  }

  await client.query('SET search_path TO public');
  await ensureApps(client, orgId);

  const missingIds = MISSING_REPORT_NAV_ITEMS.map((item) => item.app_id);
  const gaps = await client.query(
    `
      WITH report_parents AS (
        SELECT DISTINCT ON (n.job_role_id, COALESCE(n.mob_desk, 'D'))
          n.job_role_id,
          n.parent_id,
          COALESCE(n.mob_desk, 'D') AS mob_desk
        FROM "tblJobRoleNav" n
        WHERE COALESCE(n.int_status, 1) = 1
          AND n.app_id = ANY($1::text[])
        ORDER BY
          n.job_role_id,
          COALESCE(n.mob_desk, 'D'),
          CASE WHEN n.app_id = 'QAAUDITREPORT' THEN 0 ELSE 1 END,
          n.sequence NULLS LAST
      )
      SELECT
        p.job_role_id,
        p.parent_id,
        p.mob_desk,
        missing.app_id
      FROM report_parents p
      CROSS JOIN UNNEST($2::text[]) AS missing(app_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM "tblJobRoleNav" n
        WHERE n.job_role_id = p.job_role_id
          AND n.app_id = missing.app_id
          AND COALESCE(n.mob_desk, 'D') = p.mob_desk
          AND COALESCE(n.int_status, 1) = 1
      )
    `,
    [EXISTING_REPORT_APP_IDS, missingIds],
  );

  if (!gaps.rows.length) {
    return { inserted: 0, skipped: false };
  }

  const labelByAppId = Object.fromEntries(
    MISSING_REPORT_NAV_ITEMS.map((item) => [item.app_id, item.label]),
  );

  let inserted = 0;
  for (const gap of gaps.rows) {
    const maxSeq = await client.query(
      `
        SELECT COALESCE(MAX(sequence), 0)::int AS s
        FROM "tblJobRoleNav"
        WHERE job_role_id = $1
          AND COALESCE(parent_id, '') = COALESCE($2, '')
          AND COALESCE(mob_desk, 'D') = $3
      `,
      [gap.job_role_id, gap.parent_id, gap.mob_desk],
    );

    const jrnId = await generateCustomIdForClient(client, 'job_role_nav', 3);
    try {
      await client.query(
        `
          INSERT INTO "tblJobRoleNav"
            (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
             access_level, is_group, org_id, int_status, mob_desk)
          VALUES ($1, $2, $3, $4, $5, $6, 'A', false, $7, 1, $8)
        `,
        [
          jrnId,
          gap.job_role_id,
          gap.parent_id || null,
          gap.app_id,
          labelByAppId[gap.app_id] || gap.app_id,
          (maxSeq.rows[0]?.s || 0) + 1,
          orgId,
          gap.mob_desk || 'D',
        ],
      );
      inserted += 1;
    } catch (err) {
      console.warn(
        `[${logLabel}] Could not insert ${gap.app_id} for ${gap.job_role_id}: ${err.message}`,
      );
    }
  }

  if (inserted > 0) {
    try {
      await syncJobRoleNavIdSequence(client);
    } catch (_) {
      /* sequence table may be missing on some tenants */
    }
    console.log(`[${logLabel}] Inserted ${inserted} missing report nav item(s) for ${orgId}`);
  }

  return { inserted, skipped: false };
}

module.exports = {
  MISSING_REPORT_NAV_ITEMS,
  EXISTING_REPORT_APP_IDS,
  ensureMissingReportNav,
};
