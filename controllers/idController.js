// controllers/idController.js
const { peekNextId } = require("../utils/idGenerator");

exports.getNextDeptId = async (req, res) => {
    try {
        const nextId = await peekNextId("DPT", '"tblDepartments"', "dept_id", 3);
        res.json({ nextDeptId: nextId });
    } catch (err) {
        console.error("Failed to peek next dept_id", err);
        res.status(500).json({ error: "Failed to fetch next department ID" });
    }
};
