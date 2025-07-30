const express = require("express");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/authRoutes");
const jobRoleRoutes = require("./routes/jobRoleRoutes");
const userRoutes = require("./routes/userRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const branchRoutes = require("./routes/branchRoutes");
const deptAdminRoutes = require("./routes/deptAdminRoutes");
const deptAssetTypeRoutes = require("./routes/deptAssetTypeRoutes");
const vendorsRoutes = require("./routes/vendorsRoutes");
const prodServRoutes = require("./routes/prodServRoutes");
const asset_typeRoutes = require("./routes/asset_typeRoute");
const assetRoutes = require("./routes/assetRoutes");
const assetAssignmentRoutes = require("./routes/assetAssignmentRoute");
const vendorProdServiceRoutes = require("./routes/vendorProdServiceRoutes");
const orgRoutes = require("./routes/orgRoutes");
const propertiesRoutes = require("./routes/propertiesRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const serialNumberRoutes = require("./routes/serialNumberRoutes");

// Import maintenance schedule service
const { initializeMaintenanceScheduleCron } = require("./services/maintenanceScheduleService");

const app = express();
app.use(express.json());

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

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
app.use("/api/dept-assets", deptAssetTypeRoutes);
app.use("/api/ids", require("./routes/idRoutes"));
app.use("/api/", vendorsRoutes);
app.use("/api/", prodServRoutes);
app.use("/api/asset-types", asset_typeRoutes); // Fixed the route registration
app.use("/api/assets", assetRoutes);
app.use("/api/asset-assignments", assetAssignmentRoutes);
app.use("/api/orgs", orgRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/vendor-prod-services", vendorProdServiceRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/serial-numbers", serialNumberRoutes);

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  
  // Initialize maintenance schedule cron job
  initializeMaintenanceScheduleCron();
});
