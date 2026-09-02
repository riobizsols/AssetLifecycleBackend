/**
 * Parse timestamps from PostgreSQL for display.
 * - timestamptz values arrive with offset/Z and parse correctly.
 * - timestamp without time zone values are stored as UTC wall clock; treat as UTC.
 * - changed_on may be a timestamp[] — use the latest entry.
 */
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
  const normalizedValue = normalizeChangedOn(value);
  if (normalizedValue == null || normalizedValue === '') return null;
  if (normalizedValue instanceof Date) {
    return Number.isNaN(normalizedValue.getTime()) ? null : normalizedValue;
  }

  const s = String(normalizedValue).trim();
  if (!s) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(`${normalized}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateLocal(value) {
  const d = parseDbTimestamp(value);
  return d ? d.toLocaleDateString() : '';
}

function formatTimeLocal(value) {
  const d = parseDbTimestamp(value);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

module.exports = {
  normalizeChangedOn,
  parseDbTimestamp,
  formatDateLocal,
  formatTimeLocal,
};
