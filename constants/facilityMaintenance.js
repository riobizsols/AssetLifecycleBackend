/**
 * Facility / campus infrastructure asset types used by Add Asset
 * and the Maintenance Status Report.
 *
 * Lifts and Generators already exist in DEFAULT_ASSET_TYPES (AT008 / AT004).
 * The rest are added as AT018–AT023.
 */
const FACILITY_ASSET_TYPES = [
  {
    name: 'Electrical',
    aliases: ['electrical'],
    description:
      'Electrical panels, switchgear, transformers, lighting and power distribution.',
  },
  {
    name: 'Plumbing',
    aliases: ['plumbing'],
    description: 'Water supply, drainage, pumps and plumbing fixtures.',
  },
  {
    name: 'HVAC',
    aliases: ['hvac', 'air conditioner', 'air conditioning'],
    description:
      'Heating, ventilation, air handling units, chillers and campus climate systems.',
  },
  {
    name: 'Civil',
    aliases: ['civil'],
    description: 'Buildings, structures, roads, drainage works and civil fabric.',
  },
  {
    name: 'Lifts',
    aliases: ['lift', 'lifts', 'elevator'],
    description: 'Elevators and lifts.',
    existingPreferredNames: ['Lift', 'Lifts'],
  },
  {
    name: 'Generators',
    aliases: ['generator', 'generators', 'dg set', 'diesel generator'],
    description: 'Diesel / electric power generators.',
    existingPreferredNames: ['Generator', 'Generators'],
  },
  {
    name: 'Fire Systems',
    aliases: ['fire'],
    description:
      'Fire alarms, extinguishers, hydrants, sprinklers and life-safety systems.',
  },
  {
    name: 'Campus Infrastructure',
    aliases: ['campus infra', 'campus infrastructure'],
    description:
      'Common physical facilities and systems that support the entire campus rather than a specific piece of equipment.',
  },
];

/** Postgres regex on tblAssetTypes.text for facility buckets. */
const FACILITY_TYPE_NAME_REGEX =
  '(electrical|plumbing|hvac|air.?cond|civil|lifts?|elevators?|generators?|dg\\s*set|fire|campus\\s*infra)';

function isFacilityAssetTypeName(text) {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return false;
  return new RegExp(FACILITY_TYPE_NAME_REGEX, 'i').test(value);
}

module.exports = {
  FACILITY_ASSET_TYPES,
  FACILITY_TYPE_NAME_REGEX,
  isFacilityAssetTypeName,
};
