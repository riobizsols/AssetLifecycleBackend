const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

router.get("/get-users", userController.getAllUsers);
router.delete("/delete-users", userController.deleteUsers);
router.put("/update-users/:user_id", userController.updateUser);

module.exports = router;
    