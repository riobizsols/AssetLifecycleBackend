const consumablesModel = require('../models/consumablesModel');
const consumablesReportModel = require('../models/consumablesReportModel');
const { branchIdFromReq } = require('../utils/reqUserBranch');

const orgFrom = (req) =>
  req.user?.org_id || req.user?.tenant_org_id || req.query.orgId || req.body?.org_id || null;

const userFrom = (req) => req.user?.user_id || req.user?.id || null;

const scopeFrom = (req) => ({ orgId: orgFrom(req), branchId: branchIdFromReq(req) });

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, err, code = 400) => {
  console.error('[Consumables]', err.message);
  const status = err.code === '23505' ? 409 : code;
  const message =
    err.code === '23505' ? 'A consumable with this name already exists for the branch' : err.message;
  return res.status(status).json({ success: false, error: message || 'Request failed' });
};

const handle = (fn, errorCode = 400) => async (req, res) => {
  try {
    ok(res, await fn(req));
  } catch (err) {
    fail(res, err, errorCode);
  }
};

const writePayload = (req) => ({
  ...req.body,
  org_id: orgFrom(req),
  user_id: userFrom(req),
});

exports.getLookups = handle((req) => consumablesModel.listLookups(orgFrom(req)), 500);

exports.listConsumables = handle((req) => consumablesModel.listConsumables(scopeFrom(req)), 500);
/** A branch-level ACM selection pins the branch; at org level the client picks one. */
const consumableBranch = (req) =>
  req.user?.acmSelection?.branchId || req.body?.branch_id || null;

exports.createConsumable = handle((req) =>
  consumablesModel.createConsumable({
    ...writePayload(req),
    branch_id: consumableBranch(req),
  }),
);
exports.updateConsumable = handle((req) =>
  consumablesModel.updateConsumable(req.params.consumId, {
    ...writePayload(req),
    branch_id: consumableBranch(req),
  }),
);
exports.deleteConsumable = handle((req) =>
  consumablesModel.deleteConsumable(req.params.consumId, orgFrom(req)),
);

exports.listInventory = handle(
  (req) => consumablesModel.listInventory({ ...scopeFrom(req), consumId: req.query.consumId }),
  500,
);
exports.createInventory = handle((req) => consumablesModel.createInventory(writePayload(req)));
exports.updateInventory = handle((req) =>
  consumablesModel.updateInventory(req.params.cinvenId, writePayload(req)),
);
exports.getInventoryHistory = handle(
  (req) => consumablesModel.getInventoryHistory(req.params.cinvenId, orgFrom(req)),
  404,
);
exports.deleteInventory = handle((req) =>
  consumablesModel.deleteInventory(req.params.cinvenId, orgFrom(req)),
);

exports.listUsage = handle(
  (req) => consumablesModel.listUsage({ ...scopeFrom(req), cinvenId: req.query.cinvenId }),
  500,
);
exports.createUsage = handle((req) => consumablesModel.createUsage(writePayload(req)));
exports.updateUsage = handle((req) =>
  consumablesModel.updateUsage(req.params.cusageId, writePayload(req)),
);
exports.deleteUsage = handle((req) =>
  consumablesModel.deleteUsage(req.params.cusageId, { org_id: orgFrom(req), user_id: userFrom(req) }),
);

exports.listStockAlerts = handle((req) => consumablesModel.listStockAlerts(scopeFrom(req)), 500);

/** Reports span every branch in the org unless ACM pins a branch. */
const reportScope = (req) => ({
  orgId: orgFrom(req),
  branchId: req.user?.acmSelection?.branchId || null,
});

exports.getReportOptions = handle(
  (req) => consumablesReportModel.getReportOptions(reportScope(req)),
  500,
);
exports.getReport = handle(
  (req) => consumablesReportModel.getReport(req.query, reportScope(req)),
  500,
);
