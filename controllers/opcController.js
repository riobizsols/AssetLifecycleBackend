const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const opcModel = require('../models/opcModel');
const cbmEvaluator = require('../services/cbmEvaluator');
const tagTree = require('../services/opcTagTree');
const { getEffectiveListContext } = require('../utils/acmAccess');

const orgFrom = (req) => getEffectiveListContext(req).orgId || req.user?.org_id || null;
const userFrom = (req) => req.user?.user_id || req.user?.id || null;

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, err, code = 400) => {
  console.error('[OPC]', err.message);
  return res.status(code).json({ success: false, error: err.message || 'Request failed' });
};

// Tag lists uploaded by the collector, kept per org + server until the next upload.
// Each list is also written to disk so a backend restart doesn't empty the tag browser.
// The directory must stay outside the backend folder or nodemon restarts on every upload.
const browsedTags = new Map();
const pendingUploads = new Map();
const browsedKey = (orgId, serverId) => `${orgId}:${serverId}`;
const MAX_BROWSED_TAGS = 1000000;
const TAG_CACHE_DIR = process.env.OPC_TAG_CACHE_DIR || path.join(os.tmpdir(), 'alm-opc-tags');
const tagCacheFile = (key) => path.join(TAG_CACHE_DIR, `${key.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);

const saveTagCache = async (key, entry) => {
  try {
    await fs.mkdir(TAG_CACHE_DIR, { recursive: true });
    const file = tagCacheFile(key);
    await fs.writeFile(`${file}.tmp`, JSON.stringify({ uploaded_at: entry.uploaded_at, tags: entry.tags }));
    await fs.rename(`${file}.tmp`, file);
  } catch (err) {
    console.error('[OPC] Could not save tag list:', err.message);
  }
};

const getBrowsedEntry = async (key) => {
  if (browsedTags.has(key)) return browsedTags.get(key);
  try {
    const saved = JSON.parse(await fs.readFile(tagCacheFile(key), 'utf8'));
    if (!browsedTags.has(key) && Array.isArray(saved.tags)) {
      browsedTags.set(key, {
        tags: saved.tags,
        folders: tagTree.buildTree(saved.tags),
        uploaded_at: saved.uploaded_at || null,
      });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[OPC] Could not load saved tag list:', err.message);
  }
  return browsedTags.get(key) || null;
};

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

const normalizeTag = (t) => {
  const itemId = String(t?.item_id || '').trim();
  if (!itemId) return null;
  const dataType = String(t?.data_type || '').trim().toUpperCase();
  const browsePath = String(t?.browse_path || '').trim();
  return {
    item_id: itemId,
    data_type: opcModel.DATA_TYPES.includes(dataType) ? dataType : null,
    browse_path: browsePath || null,
  };
};

/**
 * Body: { tags, batch?, last? }. Large lists arrive in batches: batch 0 starts a new
 * upload, later batches append, and `last: true` publishes it. Without `batch` the
 * request is a complete list on its own.
 */
exports.uploadBrowsedTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const server = await opcModel.getServer(serverId, ctx.org_id);
  if (!server) return fail(res, new Error('Server not found'), 404);

  const key = browsedKey(ctx.org_id, serverId);
  const batch = req.body?.batch;
  const chunked = Number.isInteger(batch);
  const last = !chunked || req.body?.last === true;

  if (!chunked || batch === 0) pendingUploads.set(key, { seen: new Set(), tags: [] });
  const pending = pendingUploads.get(key);
  if (!pending) return fail(res, new Error('Upload must start with batch 0'), 409);

  const incoming = Array.isArray(req.body?.tags) ? req.body.tags : [];
  for (const raw of incoming) {
    if (pending.tags.length >= MAX_BROWSED_TAGS) break;
    const tag = normalizeTag(raw);
    if (!tag || pending.seen.has(tag.item_id)) continue;
    pending.seen.add(tag.item_id);
    pending.tags.push(tag);
  }

  if (!last) return ok(res, { server_id: serverId, received: pending.tags.length, complete: false });

  pendingUploads.delete(key);
  const entry = {
    tags: pending.tags,
    folders: tagTree.buildTree(pending.tags),
    uploaded_at: new Date().toISOString(),
  };
  browsedTags.set(key, entry);
  saveTagCache(key, entry);
  await opcModel.touchServer(serverId, ctx.org_id);
  ok(res, { server_id: serverId, count: pending.tags.length, complete: true });
});

exports.listBrowsedTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const entry = await getBrowsedEntry(browsedKey(ctx.org_id, serverId));
  const mapped = await opcModel.listMappedPaths(serverId, ctx.org_id);
  const tags = (entry?.tags || [])
    .slice(0, 5000)
    .map((t) => ({ item_id: t.item_id, data_type: t.data_type, mapped: mapped.has(t.item_id) }))
    .sort((a, b) => a.item_id.localeCompare(b.item_id));
  ok(res, { uploaded_at: entry?.uploaded_at || null, total: entry?.tags.length || 0, tags });
}, 500);

const markMapped = async (serverId, orgId, items) => {
  const mapped = await opcModel.listMappedPaths(serverId, orgId);
  return items.map((t) => ({ ...t, mapped: mapped.has(t.item_id) }));
};

exports.browseTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const entry = await getBrowsedEntry(browsedKey(ctx.org_id, serverId));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(1000, Math.max(0, parseInt(req.query.limit ?? '200', 10) || 0));
  const base = { uploaded_at: entry?.uploaded_at || null, total_tags: entry?.tags.length || 0 };

  if (!entry) return ok(res, { ...base, path: '', tag_count: 0, folders: [], leaves: { total: 0, offset: 0, items: [] } });
  const level = tagTree.browse(entry.folders, String(req.query.path || ''), { offset, limit });
  if (!level) return fail(res, new Error('Folder not found'), 404);
  level.leaves.items = await markMapped(serverId, ctx.org_id, level.leaves.items);
  ok(res, { ...base, ...level });
}, 500);

exports.searchTags = withOrg(async (req, res, ctx) => {
  const { serverId } = req.params;
  const entry = await getBrowsedEntry(browsedKey(ctx.org_id, serverId));
  const result = tagTree.search(entry?.tags || [], req.query.q, 200);
  result.items = await markMapped(serverId, ctx.org_id, result.items);
  ok(res, result);
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

exports.updateCompTag = withOrg(async (req, res, ctx) => {
  ok(res, await opcModel.updateCompTag(req.params.ctId, { ...req.body, ...ctx }));
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
