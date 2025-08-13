const express = require("express");
const cors = require("cors");
const { PORT, CORS_ORIGINS } = require("./config/environment");
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
const assetGroupRoutes = require("./routes/assetGroupRoutes");
const groupAssetRoutes = require("./routes/groupAssetRoutes");
const vendorProdServiceRoutes = require("./routes/vendorProdServiceRoutes");
const orgRoutes = require("./routes/orgRoutes");
const propertiesRoutes = require("./routes/propertiesRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const maintTypeRoutes = require("./routes/maintTypeRoutes");
const maintenanceScheduleRoutes = require("./routes/maintenanceScheduleRoutes");
const serialNumberRoutes = require("./routes/serialNumberRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const approvalDetailRoutes = require("./routes/approvalDetailRoutes");
const checklistRoutes = require("./routes/checklistRoutes");
const cronRoutes = require("./routes/cronRoutes");
const navigationRoutes = require("./routes/navigationRoutes");
const assetScrapRoutes = require("./routes/assetScrapRoutes");
const scrapAssetsByTypeRoutes = require("./routes/scrapAssetsByTypeRoutes");
const scrapSalesRoutes = require("./routes/scrapSalesRoutes");
const CronService = require("./services/cronService");


const app = express();
app.use(express.json());

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);
app.use(express.json());

// PORT is now imported from environment config

app.use("/api/auth", authRoutes);
app.use("/api/maint-types", maintTypeRoutes); // Public maintenance types API
app.use("/api/maintenance-schedules", maintenanceScheduleRoutes);
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
app.use("/api/asset-groups", assetGroupRoutes);
app.use("/api/group-assets", groupAssetRoutes);
app.use("/api/orgs", orgRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/vendor-prod-services", vendorProdServiceRoutes);
app.use("/api/serial-numbers", serialNumberRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/approval-detail", approvalDetailRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/scrap-assets", assetScrapRoutes);
app.use("/api/scrap-assets-by-type", scrapAssetsByTypeRoutes);
app.use("/api/scrap-sales", scrapSalesRoutes);

app.get("/", (req, res) => {
  res.send("Server is running!");
});




app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  
  // Initialize cron jobs after server starts
  const cronService = new CronService();
  cronService.initCronJobs();
});
