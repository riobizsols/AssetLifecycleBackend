/**
 * Ensure WhatsApp notification columns/tables exist on a tenant database.
 * Safe to call from tenant align and from live API requests (idempotent).
 */

const inflightByPool = new WeakMap();
const readyByPool = new WeakMap();

const WHATSAPP_SCHEMA_SQL = [
  `ALTER TABLE "tblUsers"
     ADD COLUMN IF NOT EXISTS whatsapp_phone character varying(20)`,
  `ALTER TABLE "tblUsers"
     ADD COLUMN IF NOT EXISTS whatsapp_opted_in boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "tblUsers"
     ADD COLUMN IF NOT EXISTS whatsapp_opted_on timestamp with time zone`,
  `CREATE INDEX IF NOT EXISTS idx_tblUsers_whatsapp_phone
     ON "tblUsers" (whatsapp_phone)
     WHERE whatsapp_phone IS NOT NULL`,
  `ALTER TABLE "tblNotificationPreferences"
     ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS "tblWhatsAppMessages" (
     message_id character varying(50) PRIMARY KEY,
     user_id character varying(50),
     org_id character varying(10),
     direction character varying(10) NOT NULL,
     phone character varying(20) NOT NULL,
     notification_type character varying(80),
     title character varying(255),
     body text,
     payload jsonb,
     wamid character varying(128),
     template_name character varying(128),
     status character varying(30) NOT NULL DEFAULT 'queued',
     error_message text,
     created_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tblWhatsAppMessages_user_id
     ON "tblWhatsAppMessages" (user_id, created_on DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tblWhatsAppMessages_wamid
     ON "tblWhatsAppMessages" (wamid)`,
  `CREATE INDEX IF NOT EXISTS idx_tblWhatsAppMessages_phone
     ON "tblWhatsAppMessages" (phone)`,
  `CREATE TABLE IF NOT EXISTS "tblWhatsAppEvents" (
     event_id character varying(50) PRIMARY KEY,
     wamid character varying(128) NOT NULL,
     event_type character varying(40) NOT NULL,
     phone character varying(20),
     payload jsonb,
     processed boolean NOT NULL DEFAULT false,
     created_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE (wamid, event_type)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tblWhatsAppEvents_wamid
     ON "tblWhatsAppEvents" (wamid)`,
  `CREATE TABLE IF NOT EXISTS "tblWhatsAppApprovals" (
     token character varying(40) PRIMARY KEY,
     user_id character varying(50) NOT NULL,
     org_id character varying(10) NOT NULL,
     kind character varying(30) NOT NULL,
     notification_type character varying(80),
     wfamsh_id character varying(50),
     wfamsd_id character varying(50),
     wfaiish_id character varying(50),
     wfaiisd_id character varying(50),
     asset_id character varying(50),
     asset_name character varying(255),
     status character varying(20) NOT NULL DEFAULT 'pending',
     result_message text,
     expires_on timestamp with time zone NOT NULL,
     created_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
     acted_on timestamp with time zone
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tblWhatsAppApprovals_user_status
     ON "tblWhatsAppApprovals" (user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_tblWhatsAppApprovals_expires
     ON "tblWhatsAppApprovals" (expires_on)`,
];

function isBenignSchemaRace(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return (
    err.code === '23505' ||
    err.code === '42P07' ||
    err.code === '42710' ||
    /already exists/i.test(msg) ||
    /duplicate key/i.test(msg)
  );
}

async function ensureWhatsAppSchema(dbPool) {
  if (!dbPool || typeof dbPool.query !== 'function') {
    throw new Error('ensureWhatsAppSchema requires a database pool');
  }
  if (readyByPool.get(dbPool)) return { created: false };

  const inflight = inflightByPool.get(dbPool);
  if (inflight) return inflight;

  const work = (async () => {
    try {
      for (const sql of WHATSAPP_SCHEMA_SQL) {
        await dbPool.query(sql);
      }
      readyByPool.set(dbPool, true);
      return { created: true };
    } catch (err) {
      if (isBenignSchemaRace(err)) {
        readyByPool.set(dbPool, true);
        return { created: false };
      }
      throw err;
    } finally {
      inflightByPool.delete(dbPool);
    }
  })();

  inflightByPool.set(dbPool, work);
  return work;
}

module.exports = {
  ensureWhatsAppSchema,
  WHATSAPP_SCHEMA_SQL,
};
