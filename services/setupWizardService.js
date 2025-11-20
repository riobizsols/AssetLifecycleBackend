const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { sendSetupCompletionEmail } = require("./emailService");
const { FRONTEND_URL } = require("../config/environment");
const {
  DEFAULT_ASSET_TYPES,
  DEFAULT_PROD_SERVICES,
  DEFAULT_ORG_SETTINGS,
  DEFAULT_EVENTS,
  DEFAULT_APPS,
  DEFAULT_AUDIT_EVENTS,
  DEFAULT_MAINT_TYPES,
  DEFAULT_MAINT_STATUS,
  DEFAULT_ID_SEQUENCES,
  DEFAULT_JOB_ROLES,
  DEFAULT_JOB_ROLE_NAV,
} = require("../constants/setupDefaults");

const DUMP_FILE_PATH = path.join(
  __dirname,
  "..",
  "backups",
  "postgresql",
  "assetLifecycle_2025-11-10_18-20-10_readable.sql"
);

let cachedSchemaSql = null;

const CORE_TABLE_DDL = [
  `
    CREATE TABLE IF NOT EXISTS "tblOrgs" (
      org_id character varying(10) PRIMARY KEY,
      text character varying(50),
      valid_from date,
      valid_to date,
      int_status integer,
      org_code character varying(50) NOT NULL DEFAULT '',
      org_city character varying(100) NOT NULL DEFAULT '',
      gst_number character varying(30),
      cin_number character varying(30)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblOrgSettings" (
      os_id character varying(20) PRIMARY KEY,
      org_id character varying(20) NOT NULL,
      key character varying(50) NOT NULL,
      value character varying(100) NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblIDSequences" (
      table_key character varying(50) PRIMARY KEY,
      prefix character varying(10),
      last_number integer DEFAULT 0 NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblApps" (
      app_id character varying(50) PRIMARY KEY,
      text character varying(50) NOT NULL,
      int_status boolean NOT NULL DEFAULT true,
      org_id character varying(20) NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblEvents" (
      event_id character varying(20) PRIMARY KEY,
      text character varying(50) NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblMaintStatus" (
      maint_status_id character varying(20) PRIMARY KEY,
      org_id character varying(20) NOT NULL,
      text character varying(50) NOT NULL,
      int_status integer NOT NULL DEFAULT 1
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblMaintTypes" (
      maint_type_id character varying(20) PRIMARY KEY,
      org_id character varying(20) NOT NULL,
      text character varying(50) NOT NULL,
      int_status integer NOT NULL DEFAULT 1
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblJobRoles" (
      org_id character varying(10) NOT NULL,
      job_role_id character varying(20) PRIMARY KEY,
      text character varying(50),
      job_function character varying(50),
      int_status integer DEFAULT 1
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblJobRoleNav" (
      job_role_nav_id character varying(20) PRIMARY KEY,
      org_id character varying(20) NOT NULL,
      int_status integer NOT NULL DEFAULT 1,
      job_role_id character varying(20) NOT NULL,
      parent_id character varying(20),
      app_id character varying(50) NOT NULL,
      label character varying(50) NOT NULL,
      sub_menu character varying(20),
      sequence integer NOT NULL DEFAULT 10,
      access_level character varying(10),
      is_group boolean DEFAULT false,
      mob_desk character(1) DEFAULT 'D'
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblAssetTypes" (
      org_id character varying(10) NOT NULL,
      asset_type_id character varying(10) PRIMARY KEY,
      int_status integer NOT NULL DEFAULT 1,
      assignment_type character varying(10) NOT NULL,
      inspection_required boolean NOT NULL DEFAULT false,
      group_required boolean NOT NULL DEFAULT false,
      created_by character varying(10),
      created_on date,
      changed_by character varying(10),
      changed_on date,
      text character varying(50) NOT NULL,
      is_child boolean,
      parent_asset_type_id character varying(20),
      maint_required boolean NOT NULL DEFAULT false,
      maint_type_id character varying(20),
      maint_lead_type character varying(20),
      serial_num_format integer,
      last_gen_seq_no bigint,
      depreciation_type character varying(2)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblProdServs" (
      prod_serv_id character varying PRIMARY KEY,
      org_id character varying NOT NULL,
      asset_type_id character varying NOT NULL,
      brand character varying,
      model character varying,
      status character varying NOT NULL,
      ps_type character varying NOT NULL,
      description character varying
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblBranches" (
      branch_id character varying(10) PRIMARY KEY,
      org_id character varying(10) NOT NULL,
      int_status integer DEFAULT 1,
      text character varying(100) NOT NULL,
      city character varying(50) NOT NULL,
      branch_code character varying(10) NOT NULL,
      created_by character varying(50),
      created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by character varying(50),
      changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblDepartments" (
      org_id character varying(10) NOT NULL,
      dept_id character varying(10) PRIMARY KEY,
      int_status integer,
      text character varying(50),
      parent_id character varying(10),
      created_on date,
      changed_on date,
      changed_by character varying(10),
      created_by character varying(10),
      branch_id character varying(50)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblEmployees" (
      emp_int_id character varying(20) PRIMARY KEY,
      employee_id character varying(20) NOT NULL,
      name character varying(100) NOT NULL,
      first_name character varying(50),
      last_name character varying(50),
      middle_name character varying(50),
      full_name character varying(100),
      email_id character varying(50) NOT NULL,
      dept_id character varying(20) NOT NULL,
      phone_number character varying(20) NOT NULL,
      employee_type character varying(20) NOT NULL,
      joining_date timestamp without time zone NOT NULL,
      releiving_date timestamp without time zone,
      language_code character varying(2) NOT NULL DEFAULT 'en',
      int_status integer NOT NULL DEFAULT 1,
      created_by character varying(20),
      created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by character varying(20),
      changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      org_id character varying(20),
      branch_id character varying(10)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblUsers" (
      org_id character varying(10) NOT NULL,
      user_id character varying(20) PRIMARY KEY,
      full_name character varying(50),
      email character varying(50),
      phone character varying(20),
      job_role_id character varying(20),
      password text,
      created_by character varying(20),
      created_on date DEFAULT CURRENT_DATE,
      changed_by character varying(20),
      changed_on date DEFAULT CURRENT_DATE,
      reset_token text,
      reset_token_expiry timestamp without time zone,
      last_accessed date DEFAULT CURRENT_DATE,
      time_zone character varying(10) DEFAULT 'IST',
      date_format character varying(20) DEFAULT 'YYYY-MM-DD',
      language_code character varying(10) DEFAULT 'EN',
      int_status integer DEFAULT 1,
      dept_id text,
      emp_int_id character varying(20),
      branch_id character varying(10)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblUserJobRoles" (
      user_job_role_id character varying(20) PRIMARY KEY,
      user_id character varying(20) NOT NULL,
      job_role_id character varying(20) NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS "tblAuditLogConfig" (
      alc_id character varying(20) PRIMARY KEY,
      app_id character varying(20) NOT NULL,
      event_id character varying(20) NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      reporting_required boolean NOT NULL DEFAULT false,
      reporting_email character varying(50),
      description character varying(50),
      org_id character varying(20) NOT NULL
    );
  `
];

const sanitizeDump = (raw) => {
  const withoutCopy = raw.replace(/COPY[\s\S]+?\\\.\r?\n/gm, "");
  return withoutCopy.replace(/^\\.*$/gm, "");
};

const getSchemaSql = () => {
  if (!cachedSchemaSql) {
    const raw = fs.readFileSync(DUMP_FILE_PATH, "utf8");
    const sanitized = sanitizeDump(raw);
    // Prepend search_path setting to ensure all statements use public schema
    cachedSchemaSql = `SET search_path TO public;\n${sanitized}`;
  }
  return cachedSchemaSql;
};

const buildClientConfig = (dbConfig = {}) => {
  if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
    throw new Error("Database credentials are incomplete. Host, database, user and password are required.");
  }
  return {
    host: dbConfig.host,
    port: dbConfig.port || 5432,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
  };
};

const withClient = async (dbConfig, handler) => {
  const client = new Client(buildClientConfig(dbConfig));
  await client.connect();
  // Ensure public schema exists and is set as default
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS public');
  } catch (err) {
    // Schema might already exist, ignore
    if (err.code !== '42P06') throw err;
  }
  // Grant usage on schema to the user
  try {
    await client.query(`GRANT USAGE ON SCHEMA public TO "${dbConfig.user}"`);
    await client.query(`GRANT CREATE ON SCHEMA public TO "${dbConfig.user}"`);
  } catch (err) {
    // Permissions might already be set, continue
    console.warn('[SetupWizard] Could not grant schema permissions:', err.message);
  }
  // Set search_path multiple ways to ensure it sticks
  await client.query('SET search_path TO public');
  await client.query("SET session search_path TO 'public'");
  // Try to set database-level search_path (may require superuser, so wrap in try-catch)
  try {
    await client.query(`ALTER DATABASE "${dbConfig.database}" SET search_path TO public`);
  } catch (err) {
    // User might not have superuser privileges, continue anyway
    console.warn('[SetupWizard] Could not set database-level search_path:', err.message);
  }
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
};

const normalizeOrg = (org = {}) => ({
  name: (org.name || "Primary Organization").trim(),
  code: (org.code || "ORG001").trim().toUpperCase(),
  city: (org.city || "Head Office").trim(),
  address: (org.address || "").trim(),
  gstNumber: (org.gstNumber || "").trim().toUpperCase(),
  cinNumber: (org.cinNumber || "").trim().toUpperCase(),
  logo: org.logo || null,
  branches: Array.isArray(org.branches) ? org.branches : [],
  auditEmail: (org.auditEmail || "").trim(),
});

const normalizeAdminUser = (admin = {}) => ({
  fullName: (admin.fullName || "System Administrator").trim(),
  email: (admin.email || "").trim(),
  phone: (admin.phone || "").trim(),
  username: (admin.username || "USR001").trim().toUpperCase(),
  password: admin.password || "",
  confirmPassword: admin.confirmPassword || "",
  employeeCode: (admin.employeeCode || "EMP001").trim().toUpperCase(),
  employeeTempId: admin.employeeTempId || null,
  departmentTempId: admin.departmentTempId || null,
  branchTempId: admin.branchTempId || null,
});

const defaultBranches = (orgCity) => [
  {
    tempId: "branch-default",
    name: "Head Office",
    code: "HO",
    city: orgCity || "Head Office",
    departments: [
      { tempId: "dept-ops", name: "Operations", code: "OPS" },
      { tempId: "dept-it", name: "IT", code: "IT" },
      { tempId: "dept-fin", name: "Finance", code: "FIN" },
    ],
  },
];

const upsertOrganization = async (client, orgId, org, logs) => {
  // Truncate values to fit column constraints
  const gstNumber = org.gstNumber ? org.gstNumber.slice(0, 30) : null;
  const cinNumber = org.cinNumber ? org.cinNumber.slice(0, 30) : null;
  
  await client.query(
    `
      INSERT INTO "tblOrgs" (org_id, text, valid_from, valid_to, int_status, org_code, org_city, gst_number, cin_number)
      VALUES ($1, $2, CURRENT_DATE, NULL, 1, $3, $4, $5, $6)
      ON CONFLICT (org_id) DO UPDATE
      SET text = EXCLUDED.text,
          org_code = EXCLUDED.org_code,
          org_city = EXCLUDED.org_city,
          gst_number = EXCLUDED.gst_number,
          cin_number = EXCLUDED.cin_number,
          int_status = 1
    `,
    [orgId, org.name.slice(0, 50), org.code.slice(0, 50), org.city.slice(0, 100), gstNumber, cinNumber]
  );
  logs.push({ message: `Organization ${orgId} configured`, scope: "org" });
};

const seedIdSequences = async (client) => {
  for (const entry of DEFAULT_ID_SEQUENCES) {
    await client.query(
      `
        INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
        VALUES ($1, $2, $3)
        ON CONFLICT (table_key) DO UPDATE
        SET prefix = EXCLUDED.prefix,
            last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
      `,
      [entry.tableKey, entry.prefix, entry.lastNumber]
    );
  }
};

const seedReferenceTables = async (client, orgId, logs) => {
  await seedIdSequences(client);

  for (const app of DEFAULT_APPS) {
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = EXCLUDED.int_status,
            org_id = EXCLUDED.org_id
      `,
      [app.id, app.label, orgId]
    );
  }

  for (const event of DEFAULT_EVENTS) {
    await client.query(
      `
        INSERT INTO "tblEvents" (event_id, text)
        VALUES ($1, $2)
        ON CONFLICT (event_id) DO UPDATE
        SET text = EXCLUDED.text
      `,
      [event.id, event.name]
    );
  }

  for (const status of DEFAULT_MAINT_STATUS) {
    await client.query(
      `
        INSERT INTO "tblMaintStatus" (maint_status_id, org_id, text, int_status)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (maint_status_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = 1,
            org_id = EXCLUDED.org_id
      `,
      [status.id, orgId, status.name]
    );
  }

  for (const type of DEFAULT_MAINT_TYPES) {
    await client.query(
      `
        INSERT INTO "tblMaintTypes" (maint_type_id, org_id, text, int_status)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (maint_type_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = 1,
            org_id = EXCLUDED.org_id
      `,
      [type.id, orgId, type.name]
    );
  }

  logs.push({ message: "Core reference tables prepared", scope: "reference" });
};

const seedOrgSettings = async (client, orgId, selectedKeys = [], editableSettings = {}, logs) => {
  const keys =
    Array.isArray(selectedKeys) && selectedKeys.length
      ? selectedKeys
      : DEFAULT_ORG_SETTINGS.map((setting) => setting.key);

  let counter = 1;
  for (const setting of DEFAULT_ORG_SETTINGS) {
    if (!keys.includes(setting.key)) continue;
    const osId = `OS_${String(counter).padStart(2, "0")}`;
    await client.query(
      `
        INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (os_id) DO UPDATE
        SET value = EXCLUDED.value,
            org_id = EXCLUDED.org_id,
            key = EXCLUDED.key
      `,
      [osId, orgId, setting.key, setting.value]
    );
    counter += 1;
  }

  // Add editable org settings (software_at_id and AT054)
  if (editableSettings.software_at_id) {
    const osId = `OS_${String(counter).padStart(2, "0")}`;
    await client.query(
      `
        INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (os_id) DO UPDATE
        SET value = EXCLUDED.value,
            org_id = EXCLUDED.org_id,
            key = EXCLUDED.key
      `,
      [osId, orgId, "software_at_id", editableSettings.software_at_id]
    );
    counter += 1;
  }

  if (editableSettings.AT054) {
    const osId = `OS_${String(counter).padStart(2, "0")}`;
    await client.query(
      `
        INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (os_id) DO UPDATE
        SET value = EXCLUDED.value,
            org_id = EXCLUDED.org_id,
            key = EXCLUDED.key
      `,
      [osId, orgId, "AT054", editableSettings.AT054]
    );
    counter += 1;
  }

  const totalSettings = keys.length + (editableSettings.software_at_id ? 1 : 0) + (editableSettings.AT054 ? 1 : 0);
  logs.push({ message: `${totalSettings} org settings applied`, scope: "org-settings" });
};

const seedJobRolesAndNavigation = async (client, orgId, logs) => {
  for (const role of DEFAULT_JOB_ROLES) {
    await client.query(
      `
        INSERT INTO "tblJobRoles" (org_id, job_role_id, text, job_function, int_status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (job_role_id) DO UPDATE
        SET text = EXCLUDED.text,
            job_function = EXCLUDED.job_function,
            int_status = EXCLUDED.int_status,
            org_id = EXCLUDED.org_id
      `,
      [orgId, role.id, role.name, role.jobFunction, role.intStatus]
    );
  }

  for (const item of DEFAULT_JOB_ROLE_NAV) {
    await client.query(
      `
        INSERT INTO "tblJobRoleNav"
          (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label, sub_menu, sequence, access_level, is_group, mob_desk)
        VALUES
          ($1, $2, 1, $3, $4, $5, $6, NULL, $7, $8, $9, 'D')
        ON CONFLICT (job_role_nav_id) DO UPDATE
        SET org_id = EXCLUDED.org_id,
            int_status = 1,
            job_role_id = EXCLUDED.job_role_id,
            parent_id = EXCLUDED.parent_id,
            app_id = EXCLUDED.app_id,
            label = EXCLUDED.label,
            sequence = EXCLUDED.sequence,
            access_level = EXCLUDED.access_level,
            is_group = EXCLUDED.is_group
      `,
      [
        item.id,
        orgId,
        item.jobRoleId,
        item.parentId,
        item.appId,
        item.label,
        item.sequence,
        item.accessLevel,
        item.isGroup,
      ]
    );
  }

  logs.push({ message: "System administrator role & navigation ready", scope: "roles" });
};

const seedAssetTypes = async (client, orgId, selectedIds = [], logs) => {
  const targetIds =
    Array.isArray(selectedIds) && selectedIds.length
      ? new Set(selectedIds)
      : new Set(DEFAULT_ASSET_TYPES.map((asset) => asset.id));

  const insertedIds = [];
  for (const asset of DEFAULT_ASSET_TYPES) {
    if (!targetIds.has(asset.id)) continue;
    await client.query(
      `
        INSERT INTO "tblAssetTypes"
          (org_id, asset_type_id, int_status, assignment_type, inspection_required, group_required,
           created_by, created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
           maint_required, maint_type_id, maint_lead_type, serial_num_format, last_gen_seq_no, depreciation_type)
        VALUES
          ($1, $2, 1, $3, $4, $5,
           'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, $6, $7, $8,
           $9, $10, NULL, $11, 0, $12)
        ON CONFLICT (asset_type_id) DO UPDATE
        SET text = EXCLUDED.text,
            assignment_type = EXCLUDED.assignment_type,
            inspection_required = EXCLUDED.inspection_required,
            group_required = EXCLUDED.group_required,
            maint_required = EXCLUDED.maint_required,
            maint_type_id = EXCLUDED.maint_type_id,
            serial_num_format = EXCLUDED.serial_num_format,
            depreciation_type = EXCLUDED.depreciation_type,
            org_id = EXCLUDED.org_id
      `,
      [
        orgId,
        asset.id,
        asset.assignmentType,
        asset.inspectionRequired,
        asset.groupRequired,
        asset.name,
        asset.isChild || false,
        asset.parentId || null,
        asset.maintRequired,
        asset.maintTypeId || null,
        asset.serialFormat || 1,
        asset.depreciationType || "SL",
      ]
    );
    insertedIds.push(asset.id);
  }
  logs.push({ message: `${insertedIds.length} asset types created`, scope: "master-data" });
  return insertedIds;
};

const seedProdServices = async (client, orgId, assetTypeIds, selectedIds = [], logs) => {
  const allowed = new Set(assetTypeIds);
  const targetIds =
    Array.isArray(selectedIds) && selectedIds.length
      ? new Set(selectedIds)
      : new Set(DEFAULT_PROD_SERVICES.map((item) => item.id));

  let count = 0;
  for (const item of DEFAULT_PROD_SERVICES) {
    if (!targetIds.has(item.id)) continue;
    if (!allowed.has(item.assetTypeId)) continue;
    await client.query(
      `
        INSERT INTO "tblProdServs"
          (prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (prod_serv_id) DO UPDATE
        SET brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            status = EXCLUDED.status,
            ps_type = EXCLUDED.ps_type,
            description = EXCLUDED.description,
            asset_type_id = EXCLUDED.asset_type_id,
            org_id = EXCLUDED.org_id
      `,
      [
        item.id,
        orgId,
        item.assetTypeId,
        item.brand || null,
        item.model || null,
        (item.status || "active").toLowerCase(),
        (item.psType || "product").toLowerCase(),
        item.description || null,
      ]
    );
    count += 1;
  }
  logs.push({ message: `${count} product/service records created`, scope: "master-data" });
  return count;
};

const seedAuditConfig = async (client, orgId, selectedIds = [], fallbackEmail, logs) => {
  const targetIds =
    Array.isArray(selectedIds) && selectedIds.length
      ? new Set(selectedIds)
      : new Set(DEFAULT_AUDIT_EVENTS.map((item) => item.id));

  let count = 0;
  for (const item of DEFAULT_AUDIT_EVENTS) {
    if (!targetIds.has(item.id)) continue;
    await client.query(
      `
        INSERT INTO "tblAuditLogConfig"
          (alc_id, app_id, event_id, enabled, reporting_required, reporting_email, description, org_id)
        VALUES
          ($1, $2, $3, true, $4, $5, $6, $7)
        ON CONFLICT (alc_id) DO UPDATE
        SET app_id = EXCLUDED.app_id,
            event_id = EXCLUDED.event_id,
            reporting_required = EXCLUDED.reporting_required,
            reporting_email = EXCLUDED.reporting_email,
            description = EXCLUDED.description,
            enabled = true,
            org_id = EXCLUDED.org_id
      `,
      [
        item.id,
        item.appId,
        item.eventId,
        item.reportingRequired,
        fallbackEmail || "audit@system.local",
        item.description,
        orgId,
      ]
    );
    count += 1;
  }
  logs.push({ message: `${count} audit log rules configured`, scope: "audit" });
  return count;
};

const seedBranchesAndDepartments = async (client, orgId, org, logs) => {
  const inputBranches =
    Array.isArray(org.branches) && org.branches.length
      ? org.branches
      : defaultBranches(org.city);

  const branchMappings = [];
  const deptMappings = [];

  let branchCounter = 1;
  let deptCounter = 1;

  for (const branch of inputBranches) {
    const branchId = `BR${String(branchCounter).padStart(3, "0")}`;
    const branchName = (branch.name || `Branch ${branchCounter}`).trim();
    const branchCode =
      (branch.code || branchName.replace(/[^A-Z0-9]/gi, "").slice(0, 6) || `BR${branchCounter}`)
        .toUpperCase()
        .slice(0, 10);
    const branchCity = (branch.city || org.city || "Head Office").trim();

    await client.query(
      `
        INSERT INTO "tblBranches"
          (branch_id, org_id, int_status, text, city, branch_code, created_by, created_on, changed_by, changed_on)
        VALUES
          ($1, $2, 1, $3, $4, $5, 'SETUP', CURRENT_TIMESTAMP, 'SETUP', CURRENT_TIMESTAMP)
        ON CONFLICT (branch_id) DO UPDATE
        SET text = EXCLUDED.text,
            city = EXCLUDED.city,
            branch_code = EXCLUDED.branch_code,
            org_id = EXCLUDED.org_id
      `,
      [branchId, orgId, branchName, branchCity, branchCode]
    );

    branchMappings.push({ tempId: branch.tempId || null, branchId });

    const departments =
      Array.isArray(branch.departments) && branch.departments.length
        ? branch.departments
        : [{ tempId: null, name: "General", code: "GEN" }];

    for (const dept of departments) {
      const deptId = `DPT${String(deptCounter).padStart(3, "0")}`;
      const deptName = (dept.name || `Dept ${deptCounter}`).trim();
      const deptCode = (dept.code || deptName.replace(/[^A-Z0-9]/gi, "").slice(0, 6) || deptId)
        .toUpperCase()
        .slice(0, 10);

      await client.query(
        `
          INSERT INTO "tblDepartments"
            (org_id, dept_id, int_status, text, parent_id, created_on, changed_on, changed_by, created_by, branch_id)
          VALUES
            ($1, $2, 1, $3, NULL, CURRENT_DATE, CURRENT_DATE, 'SETUP', 'SETUP', $4)
          ON CONFLICT (dept_id) DO UPDATE
          SET text = EXCLUDED.text,
              branch_id = EXCLUDED.branch_id,
              org_id = EXCLUDED.org_id
        `,
        [orgId, deptId, `${deptName} (${deptCode})`, branchId]
      );

      deptMappings.push({
        tempId: dept.tempId || null,
        deptId,
        branchTempId: branch.tempId || null,
        branchId,
      });

      deptCounter += 1;
    }

    branchCounter += 1;
  }

  logs.push({
    message: `${branchMappings.length} branches & ${deptMappings.length} departments created`,
    scope: "org-structure",
  });
  return { branchMappings, deptMappings };
};

const seedEmployeeAndUser = async (client, orgId, adminUser, mappings, logs) => {
  if (!adminUser.email) {
    throw new Error("Admin user email is required.");
  }
  if (adminUser.password !== adminUser.confirmPassword) {
    throw new Error("Admin user passwords do not match.");
  }

  const deptMapping =
    mappings.deptMappings.find((dept) => dept.tempId === adminUser.departmentTempId) ||
    mappings.deptMappings[0];
  if (!deptMapping) {
    throw new Error("Unable to link admin user to a department. Please configure at least one department.");
  }

  const deptId = deptMapping.deptId;
  const branchId = deptMapping.branchId || mappings.branchMappings[0]?.branchId;
  if (!branchId) {
    throw new Error("Unable to resolve branch for admin user. Please ensure at least one branch exists.");
  }

  const employeeId = adminUser.employeeCode || "EMP001";
  const empIntId = adminUser.employeeTempId || `EMP_INT_${employeeId.replace(/\D/g, "").padStart(4, "0")}`;
  const passwordHash = await bcrypt.hash(adminUser.password, 10);

  await client.query(
    `
      INSERT INTO "tblEmployees"
        (emp_int_id, employee_id, name, first_name, last_name, middle_name, full_name, email_id,
         dept_id, phone_number, employee_type, joining_date, releiving_date, language_code,
         int_status, created_by, created_on, changed_by, changed_on, org_id, branch_id)
      VALUES
        ($1, $2, $3, $4, $5, NULL, $6, $7,
         $8, $9, 'Full Time', CURRENT_TIMESTAMP, NULL, 'en',
         1, 'SETUP', CURRENT_TIMESTAMP, 'SETUP', CURRENT_TIMESTAMP, $10, $11)
      ON CONFLICT (emp_int_id) DO UPDATE
      SET name = EXCLUDED.name,
          email_id = EXCLUDED.email_id,
          dept_id = EXCLUDED.dept_id,
          phone_number = EXCLUDED.phone_number,
          org_id = EXCLUDED.org_id,
          branch_id = EXCLUDED.branch_id
    `,
    [
      empIntId,
      employeeId,
      adminUser.fullName,
      adminUser.fullName.split(" ")[0],
      adminUser.fullName.split(" ").slice(1).join(" ") || adminUser.fullName.split(" ")[0],
      adminUser.fullName,
      adminUser.email,
      deptId,
      adminUser.phone || "0000000000",
      orgId,
      branchId,
    ]
  );

  await client.query(
    `
      INSERT INTO "tblUsers"
        (org_id, user_id, full_name, email, phone, job_role_id, password,
         created_by, created_on, changed_by, changed_on, time_zone, dept_id,
         emp_int_id, branch_id, int_status)
      VALUES
        ($1, $2, $3, $4, $5, 'JR001', $6,
         'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, 'IST', $7,
         $8, $9, 1)
      ON CONFLICT (user_id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          password = EXCLUDED.password,
          dept_id = EXCLUDED.dept_id,
          emp_int_id = EXCLUDED.emp_int_id,
          branch_id = EXCLUDED.branch_id,
          org_id = EXCLUDED.org_id
    `,
    [
      orgId,
      adminUser.username,
      adminUser.fullName,
      adminUser.email,
      adminUser.phone || null,
      passwordHash,
      deptId,
      empIntId,
      branchId,
    ]
  );

  await client.query(
    `
      INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
      VALUES ($1, $2, 'JR001')
      ON CONFLICT (user_job_role_id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          job_role_id = EXCLUDED.job_role_id
    `,
    ["UJR001", adminUser.username]
  );

  logs.push({ message: `Master admin user ${adminUser.username} provisioned`, scope: "admin" });

  return {
    userId: adminUser.username,
    empIntId,
    deptId,
    branchId,
  };
};

const testConnection = async (dbConfig) => {
  return withClient(dbConfig, async (client) => {
    const versionResult = await client.query("SHOW server_version");
    const schemaResult = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'tblorgs'
        ) as exists;
      `
    );

    let organizationCount = 0;
    if (schemaResult.rows[0].exists) {
      const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM "tblOrgs"`);
      organizationCount = countResult.rows[0].count;
    }

    return {
      success: true,
      connected: true,
      serverVersion: versionResult.rows[0].server_version,
      hasSchema: schemaResult.rows[0].exists,
      hasOrganizations: organizationCount > 0,
      organizationCount,
    };
  });
};

const runSetup = async (payload = {}) => {
  const { db, organization: orgInput, adminUser: adminInput, selections = {}, options = {} } = payload;

  const org = normalizeOrg(orgInput);
  const adminUser = normalizeAdminUser(adminInput);

  if (!db) {
    throw new Error("Database configuration is required.");
  }

  if (!adminUser.password) {
    throw new Error("Admin user password is required.");
  }

  const logs = [];

  return withClient(db, async (client) => {
    // Ensure search_path is set before any operations
    await client.query("SET search_path TO public");
    await client.query("BEGIN");
    try {
      if (options.createSchema !== false) {
        // Ensure search_path before schema import
        await client.query("SET search_path TO public");
        const schemaSql = getSchemaSql();
        await client.query(schemaSql);
        logs.push({ message: "Database schema imported", scope: "schema" });
      } else {
        logs.push({ message: "Schema creation skipped per configuration", scope: "schema" });
      }

      // Ensure search_path before creating core tables
      await client.query("SET search_path TO public");
      for (const ddl of CORE_TABLE_DDL) {
        await client.query(ddl);
      }
      
      // Add gst_number and cin_number columns to tblOrgs if they don't exist
      try {
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'tblOrgs' AND column_name = 'gst_number'
            ) THEN
              ALTER TABLE "tblOrgs" ADD COLUMN gst_number character varying(30);
            END IF;
            
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'tblOrgs' AND column_name = 'cin_number'
            ) THEN
              ALTER TABLE "tblOrgs" ADD COLUMN cin_number character varying(30);
            END IF;
          END $$;
        `);
        logs.push({ message: "tblOrgs columns verified/updated", scope: "schema" });
      } catch (err) {
        console.warn("[SetupWizard] Could not alter tblOrgs table:", err.message);
        // Continue anyway - columns might already exist
      }
      
      logs.push({ message: "Core tables verified", scope: "schema" });

      const orgId = org.code.slice(0, 10);

      await upsertOrganization(client, orgId, org, logs);
      await seedReferenceTables(client, orgId, logs);
      await seedJobRolesAndNavigation(client, orgId, logs);

      let auditCount = 0;

      if (options.seedMasterData === false) {
        logs.push({ message: "Master data seeding skipped per configuration", scope: "master-data" });
      } else {
        await seedOrgSettings(client, orgId, selections.orgSettings, selections.editableOrgSettings || {}, logs);
        // Asset types and product/services seeding removed - not needed in setup
        auditCount = await seedAuditConfig(
          client,
          orgId,
          selections.auditEvents,
          org.auditEmail || adminUser.email,
          logs
        );
      }

      const structureMappings = await seedBranchesAndDepartments(client, orgId, org, logs);
      const adminResult = await seedEmployeeAndUser(client, orgId, adminUser, structureMappings, logs);

      await client.query("COMMIT");

      const setupResult = {
        success: true,
        orgId,
        summary: {
          auditRules: auditCount,
          branches: structureMappings.branchMappings.length,
          departments: structureMappings.deptMappings.length,
        },
        adminUser: adminResult.userId,
        logs,
      };

      // Send setup completion email (non-blocking - don't fail setup if email fails)
      try {
        if (adminUser.email) {
          const emailResult = await sendSetupCompletionEmail({
            adminEmail: adminUser.email,
            adminName: adminUser.fullName || adminUser.username,
            adminUsername: adminUser.username,
            adminPassword: adminUser.password, // Plain password for email
            organizationName: org.name || org.text || `Organization ${orgId}`,
            orgId,
            dbConfig: {
              host: db.host,
              port: db.port || 5432,
              database: db.database,
              user: db.user,
              password: db.password, // Include password for DATABASE_URL construction
            },
            summary: setupResult.summary,
            frontendUrl: FRONTEND_URL,
          });

          if (emailResult.success) {
            logs.push({ message: `Setup completion email sent to ${adminUser.email}`, scope: "email" });
          } else {
            logs.push({ message: `Failed to send setup completion email: ${emailResult.error}`, scope: "email", level: "warning" });
          }
        } else {
          logs.push({ message: "Admin email not provided, skipping setup completion email", scope: "email", level: "warning" });
        }
      } catch (emailError) {
        // Log but don't fail the setup
        console.error("[SetupWizard] Error sending setup completion email:", emailError);
        logs.push({ message: `Error sending setup completion email: ${emailError.message}`, scope: "email", level: "error" });
      }

      return setupResult;
    } catch (error) {
      await client.query("ROLLBACK");
      error.message = `Setup failed: ${error.message}`;
      throw error;
    }
  });
};

const getCatalog = () => ({
  assetTypes: DEFAULT_ASSET_TYPES,
  prodServices: DEFAULT_PROD_SERVICES,
  orgSettings: DEFAULT_ORG_SETTINGS,
  auditEvents: DEFAULT_AUDIT_EVENTS,
});

module.exports = {
  testConnection,
  runSetup,
  getCatalog,
};

