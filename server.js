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
const assetUsageRoutes = require("./routes/assetUsageRoutes");
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
const reportbreakdownRoutes = require("./routes/reportbreakdownRoutes");
const checklistRoutes = require("./routes/checklistRoutes");
const cronRoutes = require("./routes/cronRoutes");
const navigationRoutes = require("./routes/navigationRoutes");
const assetScrapRoutes = require("./routes/assetScrapRoutes");
const depreciationRoutes = require("./routes/depreciationRoutes");
const cronJobRoutes = require("./routes/cronJobRoutes");
const scrapAssetsByTypeRoutes = require("./routes/scrapAssetsByTypeRoutes");
const scrapSalesRoutes = require("./routes/scrapSalesRoutes");
const workOrderRoutes = require("./routes/workOrderRoutes");
const assetDocsRoutes = require("./routes/assetDocsRoutes");
const assetRegisterRoutes = require("./routes/assetRegisterRoutes");
const assetLifecycleRoutes = require("./routes/assetLifecycleRoutes");
const assetValuationRoutes = require("./routes/assetValuationRoutes");
const assetGroupDocsRoutes = require("./routes/assetGroupDocsRoutes");
const assetTypeDocsRoutes = require("./routes/assetTypeDocsRoutes");
const vendorDocsRoutes = require("./routes/vendorDocsRoutes");
const assetMaintDocsRoutes = require("./routes/assetMaintDocsRoutes");
const scrapSalesDocsRoutes = require("./routes/scrapSalesDocsRoutes");
const docTypeObjectRoutes = require("./routes/docTypeObjectRoutes");
const maintenanceHistoryRoutes = require("./routes/maintenanceHistoryRoutes");
const assetWorkflowHistoryRoutes = require("./routes/assetWorkflowHistoryRoutes");
const breakdownHistoryRoutes = require("./routes/breakdownHistoryRoutes");
const assetSerialPrintRoutes = require("./routes/assetSerialPrintRoutes");
const appEventsRoutes = require("./routes/appEventsRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const auditLogConfigRoutes = require("./routes/auditLogConfigRoutes");
const fcmRoutes = require("./routes/fcmRoutes");
const CronService = require("./services/cronService");
// const setupWizardRoutes = require("./routes/setupWizardRoutes");

const app = express();
const jsonParser = express.json({ limit: "10mb" });
const urlEncodedParser = express.urlencoded({ extended: true, limit: "10mb" });
app.use(jsonParser);
app.use(urlEncodedParser);

// Configure query parser to handle array parameters
const qs = require('qs');
app.set('query parser', (str) => {
  return qs.parse(str, { 
    arrayFormat: 'brackets',
    parseArrays: true 
  });
});

// Log every incoming API request and response
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log incoming request
  console.log(`[API REQUEST] [${timestamp}] ${req.method} ${req.originalUrl}`);
  
  // Store original res.json to intercept responses
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    console.log(`[API RESPONSE] [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    return originalJson.call(this, body);
  };
  
  // Handle response finish for status codes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (res.statusCode >= 400) {
      console.log(`[API ERROR] [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    }
  });
  
  next();
});

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);

// PORT is now imported from environment config

app.use("/api/auth", authRoutes);
// app.use("/api/setup", setupWizardRoutes);
app.use("/api/maint-types", maintTypeRoutes); // Public maintenance types API
app.use("/api/maintenance-schedules", maintenanceScheduleRoutes);
app.use("/api/job-roles", jobRoleRoutes);
app.use("/api/departments", departmentRoutes);
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
app.use("/api/asset-usage", assetUsageRoutes);
app.use("/api/asset-groups", assetGroupRoutes);
app.use("/api/group-assets", groupAssetRoutes);
app.use("/api/orgs", orgRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/vendor-prod-services", vendorProdServiceRoutes);
app.use("/api/serial-numbers", serialNumberRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/approval-detail", approvalDetailRoutes);
app.use("/api/workflow-escalation", require("./routes/workflowEscalationRoutes"));
app.use("/api/reportbreakdown", reportbreakdownRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/scrap-assets", assetScrapRoutes);
app.use("/api/depreciation", depreciationRoutes);
app.use("/api/cron-jobs", cronJobRoutes);
app.use("/api/scrap-assets-by-type", scrapAssetsByTypeRoutes);
app.use("/api/scrap-sales", scrapSalesRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api", assetDocsRoutes);
app.use("/api/asset-register", assetRegisterRoutes);
app.use("/api/asset-lifecycle", assetLifecycleRoutes);
app.use("/api/asset-valuation", assetValuationRoutes);
app.use("/api/asset-group-docs", assetGroupDocsRoutes);
app.use("/api/asset-type-docs", assetTypeDocsRoutes);
app.use("/api/vendor-docs", vendorDocsRoutes);
app.use("/api/asset-maint-docs", assetMaintDocsRoutes);
app.use("/api/scrap-sales-docs", scrapSalesDocsRoutes);
app.use("/api/doc-type-objects", docTypeObjectRoutes);
app.use("/api/maintenance-history", maintenanceHistoryRoutes);
app.use("/api/asset-workflow-history", assetWorkflowHistoryRoutes);
app.use("/api/breakdown-history", breakdownHistoryRoutes);
app.use("/api/asset-serial-print", assetSerialPrintRoutes);
app.use("/api/app-events", appEventsRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/audit-log-configs", auditLogConfigRoutes);
app.use("/api/fcm", fcmRoutes);

app.get("/", (req, res) => {
  res.send("Server is running!");
});




app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  
  // Initialize cron jobs after server starts
  const cronService = new CronService();
  cronService.initCronJobs();
});
