const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/get-users", userController.getAllUsers);
router.delete("/delete-users", userController.deleteUsers);
router.put("/update-users/:user_id", userController.updateUser);

module.exports = router;
