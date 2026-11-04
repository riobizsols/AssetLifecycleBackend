/**
 * Normalize numbers for WhatsApp Cloud API (digits only, with country code).
 */
function defaultCountryCode() {
  return String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
}

function normalizeWhatsAppPhone(raw, countryCode = defaultCountryCode()) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if (digits.length === 10 && countryCode) {
    digits = countryCode + digits;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function maskWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return digits ? '***' : '';
  return `${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

module.exports = {
  defaultCountryCode,
  normalizeWhatsAppPhone,
  maskWhatsAppPhone,
};
