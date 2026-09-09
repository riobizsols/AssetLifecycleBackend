const { getDbFromContext } = require('./dbContext');
const { SYSTEM_ADMIN_JOB_ROLE_ID, roleIdsIncludeSystemAdmin } = require('./systemAdmin');

async function getSystemAdminRoleName(db = getDbFromContext()) {
  const result = await db.query(
    `SELECT text FROM "tblJobRoles" WHERE job_role_id = $1 LIMIT 1`,
    [SYSTEM_ADMIN_JOB_ROLE_ID]
  );
  return result.rows[0]?.text || 'System Administrator';
}

async function getActorRoleIdsByUserId(userIds = [], db = getDbFromContext()) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return {};

  const result = await db.query(
    `
      SELECT user_id, array_agg(DISTINCT job_role_id) FILTER (WHERE job_role_id IS NOT NULL AND btrim(job_role_id) <> '') AS role_ids
      FROM (
        SELECT ujr.user_id, ujr.job_role_id
        FROM "tblUserJobRoles" ujr
        WHERE ujr.user_id = ANY($1::varchar[])
           OR LEFT(ujr.user_id, 20) = ANY($1::varchar[])
        UNION
        SELECT u.user_id, u.job_role_id
        FROM "tblUsers" u
        WHERE u.user_id = ANY($1::varchar[])
           OR LEFT(u.user_id, 20) = ANY($1::varchar[])
      ) roles
      GROUP BY user_id
    `,
    [uniqueIds]
  );

  const map = {};
  for (const row of result.rows) {
    const roles = row.role_ids || [];
    map[row.user_id] = roles;
    map[String(row.user_id).substring(0, 20)] = roles;
  }
  return map;
}

function getStepActorDisplayName(detail, actorRoleMap, adminRoleName) {
  const defaultName = detail.job_role_name || 'Unassigned Role';
  if (!detail.changed_by && !detail.approved_by) return defaultName;
  const actorId = detail.changed_by || detail.approved_by;
  const actorRoles = actorRoleMap[actorId] || [];
  const isAdminBypass =
    roleIdsIncludeSystemAdmin(actorRoles) &&
    detail.job_role_id !== SYSTEM_ADMIN_JOB_ROLE_ID &&
    !actorRoles.includes(detail.job_role_id);
  return isAdminBypass ? adminRoleName : defaultName;
}

async function enrichWorkflowActors(rows = [], db = getDbFromContext()) {
  if (!rows.length) return rows;
  const [adminRoleName, actorRoleMap] = await Promise.all([
    getSystemAdminRoleName(db),
    getActorRoleIdsByUserId(rows.map((row) => row.changed_by || row.approved_by), db),
  ]);
  return rows.map((row) => ({
    ...row,
    actor_display_name: getStepActorDisplayName(row, actorRoleMap, adminRoleName),
  }));
}

module.exports = {
  getSystemAdminRoleName,
  getActorRoleIdsByUserId,
  getStepActorDisplayName,
  enrichWorkflowActors,
};
