/**
 * Parse timestamps from PostgreSQL for display.
 * - timestamptz values arrive with offset/Z and parse correctly.
 * - timestamp without time zone values are stored as IST wall clock going forward.
 * - changed_on may be a timestamp[] — use the latest entry.
 */
const { parseIstTimestamp } = require('./istTime');

function normalizeChangedOn(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    const items = value.filter((v) => v != null && v !== '');
    if (!items.length) return null;
    return items[items.length - 1];
  }
  return value;
}

function parseDbTimestamp(value) {
  return parseIstTimestamp(normalizeChangedOn(value));
}

function formatDateLocal(value) {
  const d = parseDbTimestamp(value);
  return d ? d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
}

function formatTimeLocal(value) {
  const d = parseDbTimestamp(value);
  return d
    ? d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
}

module.exports = {
  normalizeChangedOn,
  parseDbTimestamp,
  formatDateLocal,
  formatTimeLocal,
};
