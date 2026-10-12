const opcModel = require('../models/opcModel');
const cbmEvaluator = require('../services/cbmEvaluator');
const { getEffectiveListContext } = require('../utils/acmAccess');

const orgFrom = (req) => getEffectiveListContext(req).orgId || req.user?.org_id || null;
const userFrom = (req) => req.user?.user_id || req.user?.id || null;

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, err, code = 400) => {
  console.error('[OPC]', err.message);
  return res.status(code).json({ success: false, error: err.message || 'Request failed' });
};

// Tag lists uploaded by the collector, kept per org + server until the next upload.
const browsedTags = new Map();
const browsedKey = (orgId, serverId) => `${orgId}:${serverId}`;
const MAX_BROWSED_TAGS = 5000;

const withOrg = (handler, errorCode = 400) => async (req, res) => {
  const orgId = orgFrom(req);
  if (!orgId) return fail(res, new Error('Organization context missing'), 400);
  try {
    await handler(req, res, { org_id: orgId, user_id: userFrom(req) });
  } catch (err) {
    fail(res, err, errorCode);
  }
};

exports.getLookups = (req, res) =>
  ok(res, {
    data_types: opcModel.DATA_TYPES,
    tag_types: opcModel.TAG_TYPES,
    operators: opcModel.OPERATORS,
    action_types: opcModel.ACTION_TYPES,
  });

exports.listAssets = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listAssetsForComponents(ctx.org_id));
}, 500);

exports.listComponents = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listComponents(ctx.org_id));
}, 500);

exports.listAssetsWithComponents = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listAssetsWithComponents(ctx.org_id));
}, 500);

exports.createComponent = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.createComponent({ ...req.body, ...ctx }));
});

exports.updateComponent = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.updateComponent(req.params.compId, { ...req.body, ...ctx }));
});

exports.deleteComponent = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.deleteComponent(req.params.compId, ctx));
});

exports.listServers = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listServers(ctx.org_id));
}, 500);

exports.uploadBrowsedTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const server = await opcModel.getServer(serverId, ctx.org_id);
  if (!server) return fail(res, new Error('Server not found'), 404);

  const incoming = Array.isArray(req.body?.tags) ? req.body.tags : [];
  const seen = new Set();
  const tags = [];
  for (const t of incoming) {
    const itemId = String(t?.item_id || '').trim();
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    const dataType = String(t?.data_type || '').trim().toUpperCase();
    tags.push({ item_id: itemId, data_type: opcModel.DATA_TYPES.includes(dataType) ? dataType : null });
    if (tags.length >= MAX_BROWSED_TAGS) break;
  }

  browsedTags.set(browsedKey(ctx.org_id, serverId), { tags, uploaded_at: new Date().toISOString() });
  await opcModel.touchServer(serverId, ctx.org_id);
  ok(res, { server_id: serverId, count: tags.length });
});

exports.listBrowsedTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const entry = browsedTags.get(browsedKey(ctx.org_id, serverId));
  const mapped = await opcModel.listMappedPaths(serverId, ctx.org_id);
  const tags = (entry?.tags || [])
    .map((t) => ({ ...t, mapped: mapped.has(t.item_id) }))
    .sort((a, b) => a.item_id.localeCompare(b.item_id));
  ok(res, { uploaded_at: entry?.uploaded_at || null, tags });
}, 500);

exports.listTags = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listTags(ctx.org_id));
}, 500);

exports.listCompTags = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listCompTags(ctx.org_id));
}, 500);

exports.createCompTag = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.createCompTag({ ...req.body, ...ctx }));
});

exports.deleteCompTag = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.deleteCompTag(req.params.ctId, ctx));
});

exports.listCbmRules = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.listCbmRules(ctx.org_id));
}, 500);

exports.createCbmRule = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.createCbmRule({ ...req.body, ...ctx }));
});

exports.updateCbmRule = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.updateCbmRule(req.params.cbmId, { ...req.body, ...ctx }));
});

exports.deleteCbmRule = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.deleteCbmRule(req.params.cbmId, ctx));
});

exports.listCbmTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const server = await opcModel.getServer(serverId, ctx.org_id);
  if (!server) return fail(res, new Error('Server not found'), 404);
  ok(res, { server_id: serverId, tags: await opcModel.listCbmTagPaths(serverId, ctx.org_id) });
}, 500);

exports.postReadings = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const server = await opcModel.getServer(serverId, ctx.org_id);
  if (!server) return fail(res, new Error('Server not found'), 404);

  const readings = Array.isArray(req.body?.readings) ? req.body.readings : [];
  const results = await cbmEvaluator.evaluateReadings(serverId, ctx.org_id, readings);
  await opcModel.touchServer(serverId, ctx.org_id);
  ok(res, { server_id: serverId, evaluated: results.length, results });
}, 500);
