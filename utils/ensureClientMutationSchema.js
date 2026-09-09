/**
 * Ensure tblClientMutation exists for idempotent offline mutation replay.
 * Safe to call on startup / per-request — uses CREATE IF NOT EXISTS.
 */
async function ensureClientMutationSchema(dbPool) {
  if (!dbPool?.query) return { created: false };

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS "tblClientMutation" (
      org_id        character varying(50) NOT NULL,
      key           character varying(128) NOT NULL,
      endpoint      character varying(255) NOT NULL,
      status_code   integer NOT NULL DEFAULT 200,
      response_json jsonb NOT NULL,
      created_on    timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, key)
    )
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblclientmutation_created_on
      ON "tblClientMutation" (created_on DESC)
  `);

  return { created: true };
}

module.exports = { ensureClientMutationSchema };
