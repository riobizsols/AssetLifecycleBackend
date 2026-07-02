const SYSTEM_ADMIN_JOB_ROLE_ID = 'JR001';

function collectUserJobRoleIds(user) {
  const ids = (user?.roles || [])
    .map((role) => role?.job_role_id || role)
    .filter(Boolean);

  if (user?.job_role_id && !ids.includes(user.job_role_id)) {
    ids.push(user.job_role_id);
  }

  return ids;
}

function userHasSystemAdminRole(user) {
  return collectUserJobRoleIds(user).includes(SYSTEM_ADMIN_JOB_ROLE_ID);
}

function applyFullAccessToNavigationTree(items) {
  if (!Array.isArray(items)) return items;

  return items.map((item) => ({
    ...item,
    access_level: 'A',
    children: item.children?.length
      ? applyFullAccessToNavigationTree(item.children)
      : item.children,
  }));
}

module.exports = {
  SYSTEM_ADMIN_JOB_ROLE_ID,
  collectUserJobRoleIds,
  userHasSystemAdminRole,
  applyFullAccessToNavigationTree,
};
