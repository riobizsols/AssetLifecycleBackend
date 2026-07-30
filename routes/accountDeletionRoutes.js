const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/accountDeletionController');

const router = express.Router();

// Strict limits for destructive public endpoints (Apple 5.1.1(v) account deletion)
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.ACCOUNT_DELETION_LOOKUP_MAX_PER_15MIN || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many lookup attempts. Please wait and try again.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.ACCOUNT_DELETION_OTP_MAX_PER_15MIN || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please wait and try again.' },
});

const executeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.ACCOUNT_DELETION_EXECUTE_MAX_PER_HOUR || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many deletion attempts. Please wait and try again.' },
});

router.get('/confirmation-phrase', controller.getConfirmationPhrase);
router.post('/status', lookupLimiter, controller.getStatus);
router.post('/lookup', lookupLimiter, controller.lookup);
router.post('/confirm-statement', lookupLimiter, controller.confirmStatement);
router.post('/acknowledge-warning', lookupLimiter, controller.acknowledgeWarning);
router.post('/send-otp', otpLimiter, controller.sendOtp);
router.post('/verify-otp', otpLimiter, controller.verifyOtp);
router.post('/execute', executeLimiter, controller.execute);

module.exports = router;
