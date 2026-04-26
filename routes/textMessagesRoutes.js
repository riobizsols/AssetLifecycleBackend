const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  getDefaults,
  getTranslationsByLang,
  upsertTranslations,
  getMessageById,
} = require("../controllers/textMessagesController");

router.use(protect);

// GET /api/text-messages/default
router.get("/default", getDefaults);

// GET /api/text-messages/translations/:langCode
router.get("/translations/:langCode", getTranslationsByLang);

// PUT /api/text-messages/translations/:langCode
router.put("/translations/:langCode", upsertTranslations);

// GET /api/text-messages/:tmdId
// Resolves translated text based on logged-in user's language with English fallback
router.get("/:tmdId", getMessageById);

module.exports = router;

