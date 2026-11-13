/**
 * IST (Asia/Kolkata) helpers for storing timestamp-without-time-zone as IST wall-clock.
 * Going forward: DB session TimeZone=Asia/Kolkata and naive timestamps mean IST digits.
 */

const IST_TZ = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';

/** SQL fragment: current timestamp as IST wall-clock (no tz) */
function nowIstSql() {
  return `(NOW() AT TIME ZONE '${IST_TZ}')`;
}

/**
 * Format a Date (or now) as IST wall-clock string for JS param binds.
 * @returns {string} YYYY-MM-DD HH:mm:ss
 */
function formatIstTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date for formatIstTimestamp');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  // en-CA + hour12:false can yield "24" for midnight in some engines
  if (hour === '24') hour = '00';
  const minute = get('minute');
  const second = get('second');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/** Alias used by FCM history writes */
function getISTTimestamp(date = new Date()) {
  return formatIstTimestamp(date);
}

/** Today's calendar date in IST as YYYY-MM-DD */
function todayIstDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

/**
 * Calendar date (YYYY-MM-DD) in IST for API/date-input use.
 * Avoids UTC day-shift from Date.toISOString().slice(0, 10).
 */
function toIstDateString(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toLocaleDateString('en-CA', { timeZone: IST_TZ });
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = parseIstTimestamp(s);
  if (!d) return s.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

/**
 * Parse a naive DB timestamp string as IST wall-clock into a Date.
 * Values that already include Z or an offset are parsed as-is.
 */
function parseIstTimestamp(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/\.\d+$/, '');
  const d = new Date(`${normalized}${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ensure each pooled client uses Asia/Kolkata so CURRENT_TIMESTAMP / NOW()
 * write IST wall-clock digits into timestamp-without-time-zone columns.
 */
function attachIstSessionTimezone(pool, label = 'DB POOL') {
  if (!pool || pool.__almIstTimezoneAttached) {
    return pool;
  }
  pool.__almIstTimezoneAttached = true;
  pool.on('connect', (client) => {
    client.query(`SET TIME ZONE '${IST_TZ}'`).catch((err) => {
      console.error(`❌ [${label}] Failed to SET TIME ZONE ${IST_TZ}:`, err?.message || err);
    });
  });
  return pool;
}

module.exports = {
  IST_TZ,
  IST_OFFSET,
  nowIstSql,
  formatIstTimestamp,
  getISTTimestamp,
  todayIstDate,
  toIstDateString,
  parseIstTimestamp,
  attachIstSessionTimezone,
};
