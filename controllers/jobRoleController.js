const {
    getJobRolesByOrg,
    createJobRole,
} = require("../models/jobRoleModel");

const fetchJobRoles = async (req, res) => {
    try {
        const { ext_id, org_id } = req.user;
        const roles = await getJobRolesByOrg(ext_id, org_id);
        res.json({ roles });
    } catch (error) {
        console.error("Error fetching job roles:", error);
        res.status(500).json({ message: "Failed to fetch job roles" });
    }
};

const addJobRole = async (req, res) => {
    try {
        const { ext_id, org_id } = req.user;
        const { job_role_id, text, job_function } = req.body;

        if (!job_role_id || !text) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const newRole = await createJobRole({
            ext_id,
            org_id,
            job_role_id,
            text,
            job_function,
        });

        res.status(201).json({ message: "Job role created", role: newRole });
    } catch (error) {
        console.error("Error creating job role:", error);
        res.status(500).json({ message: "Failed to create job role" });
    }
};

module.exports = {
    fetchJobRoles,
    addJobRole,
};