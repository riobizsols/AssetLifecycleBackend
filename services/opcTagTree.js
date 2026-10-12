/**
 * In-memory index of the tag list uploaded by the OPC collector, organised as a
 * folder tree so the UI can browse one level at a time even with lakhs of tags.
 *
 * A tag's folder is its browse path from the server (e.g. "Simulation Items/Random")
 * when the collector sends one, otherwise the dotted prefix of its item ID
 * (e.g. "CNC_MACHINE_01" for "CNC_MACHINE_01.RUN_HOURS").
 */

const SEP = '/';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const naturalCompare = collator.compare;

const splitItemId = (itemId) => {
  const idx = itemId.lastIndexOf('.');
  if (idx <= 0) return { folder: '', name: itemId };
  return { folder: itemId.slice(0, idx).split('.').join(SEP), name: itemId.slice(idx + 1) };
};

const newFolder = (name, path) => ({ name, path, folders: new Map(), leaves: [], tagCount: 0 });

const buildTree = (tags) => {
  const root = newFolder('', '');
  const folders = new Map([['', root]]);

  const ensureFolder = (path) => {
    if (folders.has(path)) return folders.get(path);
    const idx = path.lastIndexOf(SEP);
    const parentPath = idx < 0 ? '' : path.slice(0, idx);
    const name = idx < 0 ? path : path.slice(idx + 1);
    const parent = ensureFolder(parentPath);
    const folder = newFolder(name, path);
    parent.folders.set(name, path);
    folders.set(path, folder);
    return folder;
  };

  for (const tag of tags) {
    const derived = splitItemId(tag.item_id);
    const folderPath = (tag.browse_path || derived.folder || '')
      .split(SEP)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(SEP);
    const folder = ensureFolder(folderPath);
    folder.leaves.push({ item_id: tag.item_id, name: derived.name, data_type: tag.data_type });

    let p = folderPath;
    for (;;) {
      folders.get(p).tagCount += 1;
      if (!p) break;
      const idx = p.lastIndexOf(SEP);
      p = idx < 0 ? '' : p.slice(0, idx);
    }
  }

  for (const folder of folders.values()) {
    folder.leaves.sort((a, b) => naturalCompare(a.name, b.name));
  }
  return folders;
};

const sortedFolders = (folder, folders) =>
  [...folder.folders.values()]
    .map((p) => folders.get(p))
    .sort((a, b) => naturalCompare(a.name, b.name))
    .map((f) => ({
      name: f.name,
      path: f.path,
      folder_count: f.folders.size,
      leaf_count: f.leaves.length,
      tag_count: f.tagCount,
    }));

exports.SEP = SEP;
exports.buildTree = buildTree;

exports.browse = (folders, path, { offset = 0, limit = 200 } = {}) => {
  const folder = folders?.get(path || '');
  if (!folder) return null;
  return {
    path: folder.path,
    tag_count: folder.tagCount,
    folders: sortedFolders(folder, folders),
    leaves: {
      total: folder.leaves.length,
      offset,
      items: folder.leaves.slice(offset, offset + limit),
    },
  };
};

exports.search = (tags, query, limit = 200) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { total: 0, items: [] };
  const items = [];
  let total = 0;
  for (const tag of tags) {
    if (!tag.item_id.toLowerCase().includes(q)) continue;
    total += 1;
    if (items.length < limit) {
      items.push({ item_id: tag.item_id, name: splitItemId(tag.item_id).name, data_type: tag.data_type });
    }
  }
  items.sort((a, b) => naturalCompare(a.item_id, b.item_id));
  return { total, items };
};
