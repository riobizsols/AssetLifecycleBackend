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

async function getMessageByIdWithLanguageFallback(tmdId, langCode) {
  const db = getDbFromContext();
  const normalizedLang = String(langCode || "en").trim().toLowerCase();
  const isEnglish = normalizedLang === "en";

  const res = await db.query(
    `
      SELECT
        d.tmd_id,
        COALESCE(
          CASE
            WHEN $2 = TRUE THEN NULL
            ELSE NULLIF(TRIM(o.text), '')
          END,
          d.text
        ) AS text,
        CASE
          WHEN $2 = TRUE THEN 'en'
          WHEN o.text IS NOT NULL AND NULLIF(TRIM(o.text), '') IS NOT NULL THEN o.lang_code
          ELSE 'en'
        END AS resolved_lang_code
      FROM "tblTextMessagesDefault" d
      LEFT JOIN "tblTextMessagesOtherLangs" o
        ON o.tmd_id = d.tmd_id
       AND LOWER(o.lang_code) = $1
      WHERE d.tmd_id = $3
      LIMIT 1;
    `,
    [normalizedLang, isEnglish, tmdId],
  );

  return res.rows[0] || null;
}

module.exports = {
  listDefaults,
  listOtherLangs,
  upsertTranslation,
  getMessageByIdWithLanguageFallback,
};

