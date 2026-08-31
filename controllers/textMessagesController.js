const textMessagesModel = require("../models/textMessagesModel");
const operationalCache = require("../utils/operationalCache");

async function getDefaults(req, res) {
  try {
    const { data: rows } = await operationalCache.cachedList(
      req,
      'text-messages',
      'default',
      () => textMessagesModel.listDefaults(),
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching default text messages:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch default text messages" });
  }
}

async function getTranslationsByLang(req, res) {
  try {
    const { langCode } = req.params;
    if (!langCode) {
      return res.status(400).json({ success: false, message: "langCode is required" });
    }
    const { data: rows } = await operationalCache.cachedList(
      req,
      'text-messages',
      `translations:${String(langCode).trim().toLowerCase()}`,
      () => textMessagesModel.listOtherLangs(langCode),
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching text message translations:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch translations" });
  }
}

async function upsertTranslations(req, res) {
  try {
    const { langCode } = req.params;
    const { translations } = req.body || {};

    if (!langCode) {
      return res.status(400).json({ success: false, message: "langCode is required" });
    }
    if (!Array.isArray(translations)) {
      return res.status(400).json({ success: false, message: "translations must be an array" });
    }

    const results = [];
    for (const row of translations) {
      const tmd_id = row?.tmd_id;
      const text = row?.text ?? "";
      if (!tmd_id) continue;
      const saved = await textMessagesModel.upsertTranslation({
        tmd_id,
        lang_code: langCode,
        text,
      });
      results.push(saved);
    }

    operationalCache.invalidateOrgCaches(req.user?.org_id).catch(() => {});

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error upserting translations:", error);
    return res.status(500).json({ success: false, message: "Failed to save translations" });
  }
}

async function getMessageById(req, res) {
  try {
    const { tmdId } = req.params;
    if (!tmdId) {
      return res.status(400).json({ success: false, message: "tmdId is required" });
    }

    const requestedLang = String(req.query.lang || req.user?.language_code || "en")
      .trim()
      .toLowerCase();
    const messageRow = await textMessagesModel.getMessageByIdWithLanguageFallback(tmdId, requestedLang);

    if (!messageRow) {
      // Missing rows are common for newly added toast strings; return a soft
      // fallback instead of 404 so ML toast lookup does not spam API errors.
      const softText =
        String(tmdId || "")
          .replace(/^TMD_/i, "")
          .replace(/_[0-9A-F]{8}$/i, "")
          .replace(/_/g, " ")
          .trim() || "Message not found";
      return res.json({
        success: true,
        data: {
          tmd_id: tmdId,
          text: softText.charAt(0).toUpperCase() + softText.slice(1).toLowerCase(),
          lang_code: "en",
          requested_lang_code: requestedLang,
          missing: true,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        tmd_id: messageRow.tmd_id,
        text: messageRow.text,
        lang_code: messageRow.resolved_lang_code,
        requested_lang_code: requestedLang,
      },
    });
  } catch (error) {
    console.error("Error fetching text message by tmd_id:", error);
    return res.status(404).json({
      success: false,
      message: "Text message not found",
      data: {
        tmd_id: req.params.tmdId,
        text: "Failed to fetch data. Please try again.",
        lang_code: "en",
      },
    });
  }
}

module.exports = {
  getDefaults,
  getTranslationsByLang,
  upsertTranslations,
  getMessageById,
};

