const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  getDefaults,
  getTranslationsByLang,
  upsertTranslations,
} = require("../controllers/textMessagesController");

router.use(protect);

// GET /api/text-messages/default
router.get("/default", getDefaults);

// GET /api/text-messages/translations/:langCode
router.get("/translations/:langCode", getTranslationsByLang);

// PUT /api/text-messages/translations/:langCode
router.put("/translations/:langCode", upsertTranslations);

module.exports = router;

