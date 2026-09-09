const { getDbFromContext } = require('./dbContext');
const { ensureClientMutationSchema } = require('./ensureClientMutationSchema');

/**
 * Resolve optional idempotency key from header and/or body.
 * Header wins when both are present.
 */
function getIdempotencyKey(req) {
  const headerKey =
    req.get?.('Idempotency-Key') ||
    req.headers?.['idempotency-key'] ||
    req.headers?.['Idempotency-Key'];
  const bodyKey = req.body?.client_mutation_id;
  const key = headerKey || bodyKey;
  if (key == null) return null;
  const trimmed = String(key).trim();
  return trimmed.length > 0 ? trimmed.slice(0, 128) : null;
}

function resolveOrgId(req) {
  return (
    req.user?.org_id ||
    req.body?.org_id ||
    req.body?.orgId ||
    req.query?.orgId ||
    'ORG001'
  );
}

function resolveEndpoint(req) {
  const base = (req.baseUrl || '') + (req.path || req.url || '');
  return `${req.method} ${base}`.slice(0, 255);
}

async function findClientMutation(orgId, key) {
  const db = getDbFromContext();
  await ensureClientMutationSchema(db);
  const result = await db.query(
    `SELECT org_id, key, endpoint, status_code, response_json, created_on
     FROM "tblClientMutation"
     WHERE org_id = $1 AND key = $2
     LIMIT 1`,
    [orgId, key]
  );
  return result.rows[0] || null;
}

/**
 * Persist a successful mutation response. Ignores unique conflicts (concurrent first write).
 */
async function saveClientMutation({ orgId, key, endpoint, statusCode, responseBody }) {
  const db = getDbFromContext();
  await ensureClientMutationSchema(db);
  try {
    await db.query(
      `INSERT INTO "tblClientMutation" (org_id, key, endpoint, status_code, response_json, created_on)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (org_id, key) DO NOTHING`,
      [orgId, key, endpoint, statusCode, JSON.stringify(responseBody ?? null)]
    );
  } catch (err) {
    console.error('[clientMutation] Failed to persist mutation:', err.message);
  }
}

/**
 * Wrap a route handler so optional Idempotency-Key / client_mutation_id
 * replays the first successful response for the same org+key.
 * Error responses are not stored (client may retry with the same key).
 */
function withIdempotency(handler) {
  return async function idempotentHandler(req, res) {
    const key = getIdempotencyKey(req);
    if (!key) {
      return handler(req, res);
    }

    const orgId = resolveOrgId(req);
    const endpoint = resolveEndpoint(req);

    try {
      const existing = await findClientMutation(orgId, key);
      if (existing) {
        const body =
          typeof existing.response_json === 'string'
            ? JSON.parse(existing.response_json)
            : existing.response_json;
        return res.status(existing.status_code || 200).json(body);
      }
    } catch (err) {
      console.error('[clientMutation] Lookup failed, proceeding without replay:', err.message);
    }

    let statusCode = 200;
    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);
    let persisted = false;

    res.status = (code) => {
      statusCode = Number(code) || 200;
      return originalStatus(code);
    };

    res.json = (body) => {
      if (!persisted && statusCode >= 200 && statusCode < 300) {
        persisted = true;
        return Promise.resolve(
          saveClientMutation({
            orgId,
            key,
            endpoint,
            statusCode,
            responseBody: body,
          })
        )
          .catch((err) => {
            console.error('[clientMutation] Persist after success failed:', err.message);
          })
          .then(() => originalJson(body));
      }
      return originalJson(body);
    };

    return handler(req, res);
  };
}

module.exports = {
  getIdempotencyKey,
  findClientMutation,
  saveClientMutation,
  withIdempotency,
  ensureClientMutationSchema,
};
