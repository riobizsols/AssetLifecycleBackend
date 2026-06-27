/**
 * Normalize asset type names for comparison (trim, collapse whitespace, lowercase).
 */
const normalizeAssetTypeName = (name) =>
  String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const levenshteinDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

/**
 * Returns true when two names are the same or likely a typo/duplicate.
 */
const areAssetTypeNamesSimilar = (nameA, nameB) => {
  const a = normalizeAssetTypeName(nameA);
  const b = normalizeAssetTypeName(nameB);

  if (!a || !b) return false;
  if (a === b) return true;

  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);

  if (maxLen < 4) {
    return a === b;
  }

  const distance = levenshteinDistance(a, b);
  const similarity = 1 - distance / maxLen;

  // Catch typos (e.g. "fruniture" vs "furniture") and minor spelling differences.
  if (distance <= 2) return true;
  if (similarity >= 0.85) return true;

  // Avoid flagging unrelated short names that only share a prefix.
  if (minLen >= 4 && (a.startsWith(b) || b.startsWith(a)) && maxLen - minLen <= 2) {
    return true;
  }

  return false;
};

/**
 * Find an existing record whose name conflicts with the proposed name.
 * @returns {string|null} existing display name, or null if no conflict
 */
const findConflictingEntityName = (
  proposedName,
  existingRecords = [],
  { getName, getId, excludeId = null } = {}
) => {
  const trimmed = String(proposedName || "").trim();
  if (!trimmed || typeof getName !== "function") return null;

  for (const row of existingRecords) {
    if (excludeId && getId && getId(row) === excludeId) {
      continue;
    }
    const existingName = getName(row);
    if (!existingName || !String(existingName).trim()) {
      continue;
    }
    if (areAssetTypeNamesSimilar(trimmed, existingName)) {
      return String(existingName).trim();
    }
  }

  return null;
};

/**
 * Find an existing asset type name that conflicts with the proposed name.
 */
const findConflictingAssetTypeName = (
  proposedName,
  existingAssetTypes = [],
  excludeAssetTypeId = null
) =>
  findConflictingEntityName(proposedName, existingAssetTypes, {
    getName: (row) => row.text,
    getId: (row) => row.asset_type_id,
    excludeId: excludeAssetTypeId,
  });

/**
 * Find an existing asset name (description) that conflicts with the proposed name.
 */
const findConflictingAssetName = (
  proposedName,
  existingAssets = [],
  excludeAssetId = null
) =>
  findConflictingEntityName(proposedName, existingAssets, {
    getName: (row) => row.description,
    getId: (row) => row.asset_id,
    excludeId: excludeAssetId,
  });

module.exports = {
  normalizeAssetTypeName,
  areAssetTypeNamesSimilar,
  findConflictingEntityName,
  findConflictingAssetTypeName,
  findConflictingAssetName,
};
