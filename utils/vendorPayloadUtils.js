const NOT_NULL_STRING_FIELDS = [
  'address_line1',
  'city',
  'state',
  'pincode',
  'contact_person_name',
  'contact_person_email',
  'contact_person_number',
];

const NULLABLE_STRING_FIELDS = ['address_line2', 'gst_number', 'cin_number'];

/**
 * Ensure tblVendors NOT NULL string columns are never written as null.
 */
function sanitizeVendorPayload(body = {}) {
  const out = { ...body };

  for (const field of NOT_NULL_STRING_FIELDS) {
    if (out[field] === null || out[field] === undefined) {
      out[field] = '';
    } else {
      out[field] = String(out[field]);
    }
  }

  for (const field of NULLABLE_STRING_FIELDS) {
    if (out[field] === '' || out[field] === undefined) {
      out[field] = null;
    }
  }

  if (out.int_status !== undefined && out.int_status !== null && out.int_status !== '') {
    const parsed = parseInt(out.int_status, 10);
    if (!Number.isNaN(parsed)) {
      out.int_status = parsed;
    }
  }

  if (out.contract_start_date === '') out.contract_start_date = null;
  if (out.contract_end_date === '') out.contract_end_date = null;

  return out;
}

module.exports = {
  NOT_NULL_STRING_FIELDS,
  NULLABLE_STRING_FIELDS,
  sanitizeVendorPayload,
};
