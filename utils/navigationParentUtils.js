/**
 * Resolve menu group parents after nav groups use app_id=null.
 * Falls back to legacy app_id lookup for databases not yet migrated.
 */

const GROUP_PARENT_SPECS = {
  MASTERDATA: { label: "Master Data", legacyAppId: "MASTERDATA" },
  ASSETASSIGNMENT: { label: "Asset Assignment", legacyAppId: "ASSETASSIGNMENT" },
};

async function findGroupParentNavId(client, jobRoleId, spec) {
  const { label, legacyAppId } =
    typeof spec === "string" ? GROUP_PARENT_SPECS[spec] || { label: spec } : spec;

  if (legacyAppId) {
    const legacy = await client.query(
      `
        SELECT job_role_nav_id
        FROM "tblJobRoleNav"
        WHERE job_role_id = $1
          AND int_status = 1
          AND is_group = true
          AND app_id = $2
        ORDER BY sequence
        LIMIT 1
      `,
      [jobRoleId, legacyAppId],
    );
    if (legacy.rows.length > 0) {
      return legacy.rows[0].job_role_nav_id;
    }
  }

  const byLabel = await client.query(
    `
      SELECT job_role_nav_id
      FROM "tblJobRoleNav"
      WHERE job_role_id = $1
        AND int_status = 1
        AND is_group = true
        AND LOWER(TRIM(label)) = LOWER(TRIM($2))
      ORDER BY sequence
      LIMIT 1
    `,
    [jobRoleId, label],
  );

  return byLabel.rows[0]?.job_role_nav_id || null;
}

async function findAllGroupParents(client, groupKey) {
  const spec = GROUP_PARENT_SPECS[groupKey] || { label: groupKey };
  const { label, legacyAppId } = spec;

  const result = await client.query(
    `
      SELECT DISTINCT job_role_id, org_id, job_role_nav_id
      FROM "tblJobRoleNav"
      WHERE int_status = 1
        AND is_group = true
        AND (
          LOWER(TRIM(label)) = LOWER(TRIM($1))
          OR ($2::text IS NOT NULL AND app_id = $2)
        )
      ORDER BY job_role_id
    `,
    [label, legacyAppId || null],
  );

  return result.rows;
}

module.exports = {
  GROUP_PARENT_SPECS,
  findGroupParentNavId,
  findAllGroupParents,
};
