/**
 * Utility consumption calculation helpers.
 *
 * Meter types (UTCTP001): store dial Reading; Quantity consumed is derived.
 * Quantity types (UTCTP002): Reading is null; user enters Quantity consumed.
 *
 * Meter rollover (999 or 9999):
 *   If current >= previous → consumed = current - previous
 *   If current <  previous → meter wrapped; consumed = (meterMax - previous) + current
 *
 * Examples (meterMax = 999):
 *   prev=900, curr=250 → (999-900)+250 = 349
 *   prev=600, curr=100 → (999-600)+100 = 499  (from Excel Electricity sample)
 *   prev=950, curr=250 → (999-950)+250 = 299
 *
 * Examples (meterMax = 9999):
 *   prev=9800, curr=30 → (9999-9800)+30 = 229
 *
 * How to choose 999 vs 9999: stored on tblUtility_D.meter_max for that utility detail.
 */

const METER_MAX_VALUES = Object.freeze([999, 9999]);

const CONSUMPTION_TYPE = Object.freeze({
  METER: 'UTCTP001',
  QUANTITY: 'UTCTP002',
});

const IST_TZ = 'Asia/Kolkata';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ALREADY_RECORDED =
  'A reading already exists for this date. Delete it and re-enter if you need to change it.';

function todayIstDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

function toIsoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim().slice(0, 10);
  return ISO_DATE_RE.test(s) ? s : null;
}

function assertConsumptionDateNotFuture(value) {
  const date = toIsoDate(value);
  if (!date) {
    throw new Error('consumption_date is required and must be YYYY-MM-DD');
  }
  const today = todayIstDate();
  if (date > today) {
    throw new Error(`Consumption date cannot be in the future (latest allowed is ${today})`);
  }
  return date;
}

function isMeterMax(value) {
  const n = Number(value);
  return METER_MAX_VALUES.includes(n);
}

/**
 * @param {object} args
 * @param {number|null|undefined} args.previousReading - last stored meter reading (null if first)
 * @param {number} args.currentReading - dial reading being recorded
 * @param {number} args.meterMax - 999 or 9999
 * @param {'baseline'|'from_zero'} [args.firstReadingMode='baseline']
 *   baseline → first reading has no consumed qty (null)
 *   from_zero → treat previous as 0 so consumed = currentReading
 * @returns {{ quantityConsumed: number|null, rolledOver: boolean, meterMax: number }}
 */
function calculateMeterConsumption({
  previousReading,
  currentReading,
  meterMax,
  firstReadingMode = 'baseline',
}) {
  const curr = Number(currentReading);
  const max = Number(meterMax);

  if (!Number.isFinite(curr) || curr < 0) {
    throw new Error('currentReading must be a non-negative number');
  }
  if (!isMeterMax(max)) {
    throw new Error('meterMax must be 999 or 9999');
  }
  if (curr > max) {
    throw new Error(`currentReading ${curr} exceeds meterMax ${max}`);
  }

  if (previousReading == null || previousReading === '') {
    if (firstReadingMode === 'from_zero') {
      return { quantityConsumed: curr, rolledOver: false, meterMax: max };
    }
    return { quantityConsumed: null, rolledOver: false, meterMax: max };
  }

  const prev = Number(previousReading);
  if (!Number.isFinite(prev) || prev < 0) {
    throw new Error('previousReading must be a non-negative number');
  }
  if (prev > max) {
    throw new Error(`previousReading ${prev} exceeds meterMax ${max}`);
  }

  if (curr >= prev) {
    return {
      quantityConsumed: curr - prev,
      rolledOver: false,
      meterMax: max,
    };
  }

  // Dial wrapped past meterMax back toward 0
  return {
    quantityConsumed: max - prev + curr,
    rolledOver: true,
    meterMax: max,
  };
}

/**
 * Build a consumption row payload from utility detail + inputs.
 * @param {object} detail - tblUtility_D row (needs utctp_id, meter_max)
 * @param {object} input
 * @param {number|null} [input.reading]
 * @param {number|null} [input.quantityConsumed] - required for quantity type
 * @param {number|null} [input.previousReading] - last meter reading for this utild_id
 * @param {Date|string} input.consumptionDate
 */
function buildConsumptionRecord(detail, input) {
  const typeId = String(detail.utctp_id || detail.consumption_type_id || '').toUpperCase();

  if (typeId === CONSUMPTION_TYPE.QUANTITY) {
    const qty = Number(input.quantityConsumed);
    if (!Number.isFinite(qty) || qty < 0) {
      throw new Error('quantityConsumed is required for quantity-type utilities');
    }
    return {
      utild_id: detail.utild_id,
      reading: null,
      quantity_consumed: qty,
      consumption_date: input.consumptionDate,
      rolled_over: false,
    };
  }

  if (typeId === CONSUMPTION_TYPE.METER) {
    const meterMax = Number(detail.meter_max);
    const calc = calculateMeterConsumption({
      previousReading: input.previousReading,
      currentReading: input.reading,
      meterMax,
      firstReadingMode: input.firstReadingMode || 'baseline',
    });
    return {
      utild_id: detail.utild_id,
      reading: Number(input.reading),
      quantity_consumed: calc.quantityConsumed,
      consumption_date: input.consumptionDate,
      rolled_over: calc.rolledOver,
      meter_max: calc.meterMax,
    };
  }

  throw new Error(`Unknown consumption type: ${typeId}`);
}

module.exports = {
  METER_MAX_VALUES,
  CONSUMPTION_TYPE,
  DATE_ALREADY_RECORDED,
  isMeterMax,
  calculateMeterConsumption,
  buildConsumptionRecord,
  todayIstDate,
  toIsoDate,
  assertConsumptionDateNotFuture,
};
