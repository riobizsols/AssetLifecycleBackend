/**
 * Treat PostgreSQL `timestamp without time zone` as UTC wall-clock.
 *
 * Our DBs run with TimeZone=UTC and CURRENT_TIMESTAMP stores UTC digits.
 * Node on IST otherwise parses those digits as local time, shifting audit
 * (and other) timestamps back by ~5.5 hours in the API/UI.
 */
const { types } = require('pg');

const TIMESTAMP_OID = 1114; // timestamp without time zone

types.setTypeParser(TIMESTAMP_OID, (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().replace(' ', 'T');
  if (/[zZ]$/.test(normalized) || /[+-]\d{2}(:?\d{2})?$/.test(normalized)) {
    return new Date(normalized);
  }
  return new Date(`${normalized}Z`);
});

module.exports = {};
