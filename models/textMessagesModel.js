const { getDbFromContext } = require("../utils/dbContext");

async function listDefaults() {
  const db = getDbFromContext();
  const res = await db.query(
    `
      SELECT tmd_id, text
      FROM "tblTextMessagesDefault"
      ORDER BY tmd_id;
    `,
  );
  return res.rows;
}

async function listOtherLangs(langCode) {
  const db = getDbFromContext();
  const res = await db.query(
    `
      SELECT tmol_id, tmd_id, text, lang_code
      FROM "tblTextMessagesOtherLangs"
      WHERE lang_code = $1
      ORDER BY tmd_id;
    `,
    [langCode],
  );
  return res.rows;
}

async function upsertTranslation({ tmd_id, lang_code, text }) {
  const db = getDbFromContext();
  const tmolId = `TMOL_${lang_code}_${tmd_id}`;

  const res = await db.query(
    `
      INSERT INTO "tblTextMessagesOtherLangs" (tmol_id, tmd_id, text, lang_code)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tmd_id, lang_code)
      DO UPDATE SET text = EXCLUDED.text
      RETURNING tmol_id, tmd_id, text, lang_code;
    `,
    [tmolId, tmd_id, text, lang_code],
  );
  return res.rows[0];
}

module.exports = {
  listDefaults,
  listOtherLangs,
  upsertTranslation,
};

