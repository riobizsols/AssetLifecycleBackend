const utilityModel = require('../models/utilityModel');

const orgFrom = (req) =>
  req.user?.org_id || req.user?.tenant_org_id || req.query.orgId || req.body?.org_id || null;

const userFrom = (req) => req.user?.user_id || req.user?.id || null;

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, err, code = 400) => {
  console.error('[Utility]', err.message);
  return res.status(code).json({ success: false, error: err.message || 'Request failed' });
};

exports.getLookups = async (req, res) => {
  try {
    ok(res, await utilityModel.listLookups());
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.listHeaders = async (req, res) => {
  try {
    ok(res, await utilityModel.listHeaders(orgFrom(req)));
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.getHeader = async (req, res) => {
  try {
    const row = await utilityModel.getHeaderWithDetails(req.params.utilId, orgFrom(req));
    if (!row) return fail(res, new Error('Utility not found'), 404);
    ok(res, row);
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.createHeader = async (req, res) => {
  try {
    const org_id = orgFrom(req);
    ok(res, await utilityModel.createHeader({ ...req.body, org_id }));
  } catch (err) {
    fail(res, err);
  }
};

exports.updateHeader = async (req, res) => {
  try {
    ok(res, await utilityModel.updateHeader(req.params.utilId, { ...req.body, org_id: orgFrom(req) }));
  } catch (err) {
    fail(res, err);
  }
};

exports.deleteHeader = async (req, res) => {
  try {
    ok(res, await utilityModel.deleteHeader(req.params.utilId, orgFrom(req)));
  } catch (err) {
    fail(res, err);
  }
};

exports.listDetails = async (req, res) => {
  try {
    ok(res, await utilityModel.listDetails(orgFrom(req)));
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.createDetail = async (req, res) => {
  try {
    ok(res, await utilityModel.createDetail({ ...req.body, org_id: req.body.org_id || orgFrom(req) }));
  } catch (err) {
    fail(res, err);
  }
};

exports.updateDetail = async (req, res) => {
  try {
    ok(res, await utilityModel.updateDetail(req.params.utildId, req.body));
  } catch (err) {
    fail(res, err);
  }
};

exports.deleteDetail = async (req, res) => {
  try {
    ok(res, await utilityModel.deleteDetail(req.params.utildId));
  } catch (err) {
    fail(res, err);
  }
};

exports.listAssetTypes = async (req, res) => {
  try {
    ok(res, await utilityModel.listAssetTypes());
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.listMappings = async (req, res) => {
  try {
    ok(res, await utilityModel.listMappings(orgFrom(req)));
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.createMapping = async (req, res) => {
  try {
    ok(
      res,
      await utilityModel.createMapping({
        ...req.body,
        created_by: userFrom(req),
      }),
    );
  } catch (err) {
    fail(res, err);
  }
};

exports.deleteMapping = async (req, res) => {
  try {
    ok(res, await utilityModel.deleteMapping(req.params.atumId));
  } catch (err) {
    fail(res, err);
  }
};

exports.listConsumptions = async (req, res) => {
  try {
    ok(
      res,
      await utilityModel.listConsumptions({
        orgId: orgFrom(req),
        utildId: req.query.utild_id,
        limit: req.query.limit,
      }),
    );
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.previewConsumption = async (req, res) => {
  try {
    ok(res, await utilityModel.previewConsumption(req.body));
  } catch (err) {
    fail(res, err);
  }
};

exports.createConsumption = async (req, res) => {
  try {
    ok(res, await utilityModel.createConsumption(req.body, userFrom(req)));
  } catch (err) {
    fail(res, err);
  }
};

exports.listMyAssignedUtilityAssets = async (req, res) => {
  try {
    const orgId = orgFrom(req);
    const employeeIntId = req.user?.emp_int_id;
    const deptId = req.user?.dept_id || null;
    if (!orgId || !employeeIntId) {
      return fail(res, new Error('User is not linked to an employee or organization'), 400);
    }
    ok(
      res,
      await utilityModel.listMyAssignedUtilityAssets({
        orgId,
        employeeIntId,
        deptId,
      }),
    );
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.listMyAssetConsumptions = async (req, res) => {
  try {
    const orgId = orgFrom(req);
    const employeeIntId = req.user?.emp_int_id;
    const deptId = req.user?.dept_id || null;
    const assetId = req.params.assetId;
    if (!orgId || !employeeIntId) {
      return fail(res, new Error('User is not linked to an employee or organization'), 400);
    }
    const allowed = await utilityModel.isAssetAssignedToEmployee(
      assetId,
      employeeIntId,
      orgId,
      deptId,
    );
    if (!allowed) {
      return fail(res, new Error('You can only view readings for assets assigned to you'), 403);
    }
    ok(
      res,
      await utilityModel.listAssetConsumptions({
        orgId,
        assetId,
        utildId: req.query.utild_id,
        limit: req.query.limit,
      }),
    );
  } catch (err) {
    fail(res, err, 500);
  }
};

exports.createAssetConsumption = async (req, res) => {
  try {
    const orgId = orgFrom(req);
    const employeeIntId = req.user?.emp_int_id;
    const deptId = req.user?.dept_id || null;
    if (!orgId || !employeeIntId) {
      return fail(res, new Error('User is not linked to an employee or organization'), 400);
    }
    const row = await utilityModel.createAssetConsumption(req.body, {
      userId: userFrom(req),
      orgId,
      employeeIntId,
      deptId,
    });
    ok(res, row);
  } catch (err) {
    fail(res, err, err.statusCode || 400);
  }
};
