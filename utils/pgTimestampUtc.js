/**
 * Treat PostgreSQL `timestamp without time zone` as IST wall-clock.
 *
 * Going forward: DB session TimeZone=Asia/Kolkata and CURRENT_TIMESTAMP stores
 * IST digits. Parse naive values with +05:30 so API/UI Date objects are correct.
 *
 * Module name kept for existing require() sites (server.js, tenantService.js).
 */
const { types } = require('pg');
const { parseIstTimestamp, IST_OFFSET } = require('./istTime');

const TIMESTAMP_OID = 1114; // timestamp without time zone
const TIMESTAMP_ARRAY_OID = 1115;

types.setTypeParser(TIMESTAMP_OID, (value) => parseIstTimestamp(value));

types.setTypeParser(TIMESTAMP_ARRAY_OID, (value) => {
  if (value == null) return null;
  const body = String(value).trim();
  if (!body || body === '{}') return [];
  const inner = body.slice(1, -1);
  if (!inner) return [];
  return inner.split(',').map((part) => {
    const clean = part.replace(/^"+|"+$/g, '').trim();
    if (!clean || clean.toUpperCase() === 'NULL') return null;
    return parseIstTimestamp(clean);
  });
});

module.exports = { IST_OFFSET };
