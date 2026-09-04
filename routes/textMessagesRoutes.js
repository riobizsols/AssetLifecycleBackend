const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { attachTenantDb } = require("../middlewares/attachTenantDb");
const {
  getDefaults,
  getTranslationsByLang,
  upsertTranslations,
  getMessageById,
} = require("../controllers/textMessagesController");

// GET /api/text-messages/default
router.get("/default", protect, getDefaults);

// GET /api/text-messages/translations/:langCode
router.get("/translations/:langCode", protect, getTranslationsByLang);

// PUT /api/text-messages/translations/:langCode
router.put("/translations/:langCode", protect, upsertTranslations);

// GET /api/text-messages/:tmdId
// Public for auto-generated toast ids (TMD_*); needs tenant DB from subdomain.
router.get("/:tmdId", (req, res, next) => {
  const tmdId = String(req.params.tmdId || "");
  if (tmdId.startsWith("TMD_")) {
    return attachTenantDb(req, res, () => getMessageById(req, res, next));
  }
  return protect(req, res, () => getMessageById(req, res, next));
});

module.exports = router;
