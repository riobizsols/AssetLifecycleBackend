const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const jobRoleRoutes = require("./routes/jobRoleRoutes");
const userRoutes = require("./routes/userRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const branchRoutes = require("./routes/branchRoutes");
const deptAdminRoutes = require("./routes/deptAdminRoutes");
const assetTypeRoutes = require("./routes/assetTypeRoutes");
const vendorsRoutes = require("./routes/vendorsRoutes");
const prodServRoutes = require("./routes/prodServRoutes");
const asset_typeRoutes = require("./routes/asset_typeRoute");
const assetRoutes = require("./routes/assetRoutes");
const orgRoutes = require('./routes/orgRoutes');

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

const PORT = process.env.PORT || 5001;

app.use("/api/auth", authRoutes);
app.use("/api", jobRoleRoutes, departmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/admin", deptAdminRoutes);
app.use("/api/dept-assets", assetTypeRoutes);
app.use("/api/ids", require("./routes/idRoutes"));
app.use("/api/", vendorsRoutes);
app.use("/api/", prodServRoutes);
app.use("/api/", asset_typeRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/orgs", orgRoutes);

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
