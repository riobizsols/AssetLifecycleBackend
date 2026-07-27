const { getDbFromContext } = require('./dbContext');

const getDb = () => getDbFromContext();

/** Status codes used by scrap workflow but not always seeded in older DBs */
const REQUIRED_EXTRA_CODES = [
  ['UA', 'User Approved'],
  ['UR', 'User Rejected'],
];

let codeToIdCache = null;
let idToCodeCache = null;

async function ensureRequiredStatusCodes(db = getDb()) {
  for (const [code, text] of REQUIRED_EXTRA_CODES) {
    await db.query(
      `
        INSERT INTO "tblStatusCodes" (id, status_code, text)
        SELECT next_id, $1::varchar, $2::varchar
        FROM (
          SELECT COALESCE(MAX(id), 0) + 1 AS next_id
          FROM "tblStatusCodes"
        ) ids
        WHERE NOT EXISTS (
          SELECT 1 FROM "tblStatusCodes" WHERE status_code = $1::varchar
        )
      `,
      [code, text]
    );
  }
}

async function loadStatusCodeMaps(db = getDb()) {
  await ensureRequiredStatusCodes(db);
  const result = await db.query(
    `SELECT id, status_code FROM "tblStatusCodes"`
  );
  codeToIdCache = {};
  idToCodeCache = {};
  for (const row of result.rows) {
    const id = Number(row.id);
    const code = String(row.status_code);
    codeToIdCache[code] = id;
    idToCodeCache[id] = code;
  }
  return { codeToId: codeToIdCache, idToCode: idToCodeCache };
}

async function getStatusMaps(db = getDb()) {
  if (!codeToIdCache || !idToCodeCache) {
    return loadStatusCodeMaps(db);
  }
  return { codeToId: codeToIdCache, idToCode: idToCodeCache };
}

async function getStatusId(statusCode, db = getDb()) {
  const { codeToId } = await getStatusMaps(db);
  const id = codeToId[statusCode];
  if (id == null) {
    throw new Error(`Unknown workflow status code: ${statusCode}`);
  }
  return id;
}

async function getStatusCode(statusId, db = getDb()) {
  const { idToCode } = await getStatusMaps(db);
  const code = idToCode[Number(statusId)];
  return code || String(statusId);
}

async function getStatusIds(codes, db = getDb()) {
  const { codeToId } = await getStatusMaps(db);
  const result = {};
  for (const code of codes) {
    const id = codeToId[code];
    if (id == null) {
      throw new Error(`Unknown workflow status code: ${code}`);
    }
    result[code] = id;
  }
  return result;
}

function clearStatusCodeCache() {
  codeToIdCache = null;
  idToCodeCache = null;
}

/** SQL fragment: compare status column (varchar-stored numeric id) to a status_code literal */
function statusEqualsSql(columnRef, statusCode) {
  return `NULLIF(${columnRef}::text, '')::bigint = (SELECT id FROM "tblStatusCodes" WHERE status_code = '${statusCode}' LIMIT 1)`;
}

/** SQL fragment: status IN (codes...) */
function statusInSql(columnRef, codes) {
  const list = codes.map((c) => `'${c}'`).join(',');
  return `NULLIF(${columnRef}::text, '')::bigint IN (SELECT id FROM "tblStatusCodes" WHERE status_code IN (${list}))`;
}

module.exports = {
  ensureRequiredStatusCodes,
  getStatusMaps,
  getStatusId,
  getStatusIds,
  getStatusCode,
  clearStatusCodeCache,
  statusEqualsSql,
  statusInSql,
};
