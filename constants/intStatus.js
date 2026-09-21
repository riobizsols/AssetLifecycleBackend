/**
 * Shared int_status convention for EAM.
 * 0 = inactive, 1 = active
 * Vendors may also use: 3 = CRApproved, 4 = Blocked
 * tblApps uses boolean true/false instead of 0/1.
 */
const INT_STATUS = Object.freeze({
  INACTIVE: 0,
  ACTIVE: 1,
  CR_APPROVED: 3,
  BLOCKED: 4,
});

function isActiveIntStatus(value) {
  return value === INT_STATUS.ACTIVE || value === true || value === '1' || value === 'Active';
}

function toIntStatus(value, { allowVendorExtras = false } = {}) {
  if (value === INT_STATUS.ACTIVE || value === 1 || value === '1' || value === true || value === 'Active' || value === 'active') {
    return INT_STATUS.ACTIVE;
  }
  if (allowVendorExtras) {
    if (value === INT_STATUS.CR_APPROVED || value === 3 || value === '3' || value === 'CRApproved') {
      return INT_STATUS.CR_APPROVED;
    }
    if (value === INT_STATUS.BLOCKED || value === 4 || value === '4' || value === 'Blocked') {
      return INT_STATUS.BLOCKED;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return INT_STATUS.INACTIVE;
}

module.exports = {
  INT_STATUS,
  isActiveIntStatus,
  toIntStatus,
};
