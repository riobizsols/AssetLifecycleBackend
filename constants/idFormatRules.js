/**
 * Canonical ID format rules — derived from tableIdConventions + DEFAULT_ID_SEQUENCES.
 */
const { DEFAULT_ID_SEQUENCES } = require('./setupDefaults');
const {
  TABLE_ID_CONVENTIONS,
  GENERAL_ID_REGEX,
  buildIdFormatRules,
  patternForPreferredPrefix,
} = require('./tableIdConventions');

function patternForPrefix(prefix, minDigits = 3) {
  return patternForPreferredPrefix(prefix, minDigits);
}

/** Runtime ID checks used by audits and tenant validation. */
const ID_FORMAT_RULES = buildIdFormatRules();

/** Map tableKey → { table, column, prefix } for sequence sync. */
const SEQUENCE_TABLE_MAP = Object.fromEntries(
  TABLE_ID_CONVENTIONS.filter((r) => r.tableKey && r.prefix).map((r) => [
    r.tableKey,
    {
      table: r.table,
      column: r.column,
      prefix: r.prefix,
      pattern: patternForPreferredPrefix(r.prefix, r.pad || 3),
      pad: r.pad || 3,
    },
  ])
);

// Keep DEFAULT_ID_SEQUENCES entries that might not be in TABLE_ID_CONVENTIONS yet
for (const entry of DEFAULT_ID_SEQUENCES) {
  if (SEQUENCE_TABLE_MAP[entry.tableKey]) {
    SEQUENCE_TABLE_MAP[entry.tableKey].prefix = entry.prefix;
  }
}

/**
 * Known legacy bad IDs → correct values per idGenerator conventions.
 * FK columns listed are updated before the primary row.
 */
const LEGACY_ID_REMAPS = [
  {
    label: 'branch BRANCH001 → BR001',
    primaryTable: 'tblBranches',
    primaryColumn: 'branch_id',
    from: 'BRANCH001',
    to: 'BR001',
    primaryExtra: { branch_code: 'HO' },
    fkUpdates: [{ table: 'tblBR_DEPT', column: 'branch_id' }],
  },
];

module.exports = {
  ID_FORMAT_RULES,
  SEQUENCE_TABLE_MAP,
  LEGACY_ID_REMAPS,
  patternForPrefix,
  GENERAL_ID_REGEX,
};
