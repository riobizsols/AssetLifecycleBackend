const textMessagesModel = require("../models/textMessagesModel");

async function getDefaults(req, res) {
  try {
    const rows = await textMessagesModel.listDefaults();
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
    const rows = await textMessagesModel.listOtherLangs(langCode);
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

    const userLang = req.user?.language_code || "en";
    const messageRow = await textMessagesModel.getMessageByIdWithLanguageFallback(tmdId, userLang);

    if (!messageRow) {
      return res.status(404).json({ success: false, message: "Text message not found" });
    }

    return res.json({
      success: true,
      data: {
        tmd_id: messageRow.tmd_id,
        text: messageRow.text,
        lang_code: messageRow.resolved_lang_code,
        requested_lang_code: String(userLang || "en").toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Error fetching text message by tmd_id:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch text message" });
  }
}

module.exports = {
  getDefaults,
  getTranslationsByLang,
  upsertTranslations,
  getMessageById,
};

