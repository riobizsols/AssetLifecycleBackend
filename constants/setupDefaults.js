const DEFAULT_ASSET_TYPES = [
  {
    id: "AT001",
    name: "Laptop",
    assignmentType: "user",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Personal computing devices assigned to employees."
  },
  {
    id: "AT002",
    name: "Software",
    assignmentType: "user",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: false,
    serialFormat: 1,
    depreciationType: "ND",
    description: "Licensed software subscriptions."
  },
  {
    id: "AT003",
    name: "Furniture",
    assignmentType: "department",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: false,
    serialFormat: 1,
    depreciationType: "SL",
    description: "Office tables, chairs and storage units."
  },
  {
    id: "AT004",
    name: "Generator",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Diesel / electric power generators."
  },
  {
    id: "AT005",
    name: "Mobile Phone",
    assignmentType: "user",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT003",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Corporate mobile phones."
  },
  {
    id: "AT006",
    name: "LCD Monitor",
    assignmentType: "user",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Desktop monitors and display units."
  },
  {
    id: "AT007",
    name: "Projector",
    assignmentType: "department",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Conference room projectors."
  },
  {
    id: "AT008",
    name: "Lift",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Elevators and lifts."
  },
  {
    id: "AT009",
    name: "Lockers",
    assignmentType: "department",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: false,
    serialFormat: 1,
    depreciationType: "SL",
    description: "Employee lockers and storage cabinets."
  },
  {
    id: "AT010",
    name: "Vehicle - Car",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Organizational passenger cars."
  },
  {
    id: "AT011",
    name: "Vehicle - Truck",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT003",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Heavy vehicles for logistics."
  },
  {
    id: "AT012",
    name: "Vehicle - Bus",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT003",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Employee transport buses."
  },
  {
    id: "AT013",
    name: "UPS",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Uninterruptible power supply systems."
  },
  {
    id: "AT014",
    name: "Air Conditioner",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Air conditioning units."
  },
  {
    id: "AT015",
    name: "Fan",
    assignmentType: "department",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: false,
    serialFormat: 1,
    depreciationType: "SL",
    description: "Industrial or ceiling fans."
  },
  {
    id: "AT016",
    name: "Table",
    assignmentType: "department",
    inspectionRequired: false,
    groupRequired: false,
    maintRequired: false,
    serialFormat: 1,
    depreciationType: "SL",
    description: "Workstations and tables."
  },
  {
    id: "AT017",
    name: "CCTV",
    assignmentType: "department",
    inspectionRequired: true,
    groupRequired: false,
    maintRequired: true,
    maintTypeId: "MT002",
    serialFormat: 1,
    depreciationType: "SL",
    description: "Security surveillance equipment."
  }
];

const DEFAULT_PROD_SERVICES = [
  {
    id: "PS001",
    assetTypeId: "AT001",
    brand: "Dell",
    model: "Latitude 7440",
    psType: "Product",
    status: "active",
    description: "High-end business ultrabook."
  },
  {
    id: "PS002",
    assetTypeId: "AT001",
    brand: "HP",
    model: "EliteBook 845",
    psType: "Product",
    status: "active",
    description: "Enterprise-class laptop."
  },
  {
    id: "PS003",
    assetTypeId: "AT001",
    brand: "Lenovo",
    model: "ThinkPad X1 Carbon",
    psType: "Product",
    status: "active",
    description: "Flagship ultra portable."
  },
  {
    id: "PS004",
    assetTypeId: "AT001",
    brand: "Dell",
    model: "ProSupport Plus",
    psType: "Service",
    status: "active",
    description: "Laptop AMC support."
  },
  {
    id: "PS005",
    assetTypeId: "AT002",
    brand: "Microsoft",
    model: "365 E3",
    psType: "Service",
    status: "active",
    description: "Productivity suite subscription."
  },
  {
    id: "PS006",
    assetTypeId: "AT002",
    brand: "Adobe",
    model: "Creative Cloud",
    psType: "Service",
    status: "active",
    description: "Creative suite licenses."
  },
  {
    id: "PS007",
    assetTypeId: "AT004",
    brand: "Kirloskar",
    model: "Green 10kVA",
    psType: "Product",
    status: "active",
    description: "Diesel generator."
  },
  {
    id: "PS008",
    assetTypeId: "AT005",
    brand: "Apple",
    model: "iPhone 15",
    psType: "Product",
    status: "active",
    description: "Executive smartphone."
  },
  {
    id: "PS009",
    assetTypeId: "AT005",
    brand: "Samsung",
    model: "Galaxy S24",
    psType: "Product",
    status: "active",
    description: "Corporate Android device."
  },
  {
    id: "PS010",
    assetTypeId: "AT006",
    brand: "Dell",
    model: "UltraSharp 27",
    psType: "Product",
    status: "active",
    description: "Professional monitor."
  },
  {
    id: "PS011",
    assetTypeId: "AT007",
    brand: "Epson",
    model: "EB-S41",
    psType: "Product",
    status: "active",
    description: "Meeting room projector."
  },
  {
    id: "PS012",
    assetTypeId: "AT008",
    brand: "Otis",
    model: "Gen2",
    psType: "Service",
    status: "active",
    description: "Lift AMC package."
  },
  {
    id: "PS013",
    assetTypeId: "AT010",
    brand: "Toyota",
    model: "Innova Hycross",
    psType: "Product",
    status: "active",
    description: "Corporate fleet car."
  },
  {
    id: "PS014",
    assetTypeId: "AT011",
    brand: "Tata",
    model: "407",
    psType: "Product",
    status: "active",
    description: "Logistics truck."
  },
  {
    id: "PS015",
    assetTypeId: "AT012",
    brand: "Ashok Leyland",
    model: "Viking",
    psType: "Product",
    status: "active",
    description: "Employee transport bus."
  },
  {
    id: "PS016",
    assetTypeId: "AT013",
    brand: "APC",
    model: "Smart-UPS 5kVA",
    psType: "Product",
    status: "active",
    description: "Data center UPS."
  },
  {
    id: "PS017",
    assetTypeId: "AT014",
    brand: "Daikin",
    model: "VRV S",
    psType: "Product",
    status: "active",
    description: "HVAC unit."
  },
  {
    id: "PS018",
    assetTypeId: "AT015",
    brand: "Havells",
    model: "Stealth Air",
    psType: "Product",
    status: "active",
    description: "Ceiling fan."
  },
  {
    id: "PS019",
    assetTypeId: "AT016",
    brand: "Urban Ladder",
    model: "Nova Desk",
    psType: "Product",
    status: "active",
    description: "Workstation table."
  },
  {
    id: "PS020",
    assetTypeId: "AT017",
    brand: "Hikvision",
    model: "DS-2CD2143",
    psType: "Product",
    status: "active",
    description: "Fixed dome camera."
  }
];

const DEFAULT_ORG_SETTINGS = [
  { key: "CURRENCY", value: "INR", description: "Default currency code." },
  { key: "TIMEZONE", value: "IST", description: "Default time zone." },
  { key: "LANGUAGE", value: "EN", description: "Primary language." },
  { key: "DATEFMT", value: "DD-MM-YYYY", description: "Preferred date format." },
  { key: "FY_START", value: "APR", description: "Fiscal year start month." },
  { key: "AUDITLOG", value: "ENABLED", description: "Audit log toggle." },
  { key: "dep_auto_calc", value: "1", description: "Depreciation auto calculation enabled." },
  { key: "asset_inv_doc_size", value: "10", description: "Asset inventory document size limit." },
  { key: "default_doc_size", value: "15", description: "Default document size limit." },
  { key: "dep_calc_freq", value: "Monthly", description: "Depreciation calculation frequency." },
  { key: "printer_asset_type", value: "Printer", description: "Printer asset type identifier." }
];

const DEFAULT_EVENTS = [
  { id: "Eve001", name: "Logging In" },
  { id: "Eve002", name: "Logging Out" },
  { id: "Eve003", name: "Reset Password" },
  { id: "Eve004", name: "History" },
  { id: "Eve005", name: "Create" },
  { id: "Eve006", name: "Delete" },
  { id: "Eve007", name: "Download" },
  { id: "Eve008", name: "Update" },
  { id: "Eve009", name: "Add Document" },
  { id: "Eve010", name: "Save" },
  { id: "Eve011", name: "Cancel" },
  { id: "Eve012", name: "Assign" },
  { id: "Eve013", name: "Unassign" },
  { id: "Eve023", name: "Generate Report" },
  { id: "Eve024", name: "Export Report" }
];

const DEFAULT_APPS = [
  { id: "DASHBOARD", label: "Dashboard" },
  { id: "ASSETS", label: "Assets" },
  { id: "ASSETASSIGNMENT", label: "Asset Assignment" },
  { id: "DEPTASSIGNMENT", label: "Department Assignment" },
  { id: "EMPASSIGNMENT", label: "Employee Assignment" },
  { id: "MASTERDATA", label: "Master Data" },
  { id: "ORGANIZATIONS", label: "Organizations" },
  { id: "ASSETTYPES", label: "Asset Types" },
  { id: "DEPARTMENTS", label: "Departments" },
  { id: "DEPARTMENTSADMIN", label: "Departments Admin" },
  { id: "BRANCHES", label: "Branches" },
  { id: "VENDORS", label: "Vendors" },
  { id: "PRODSERV", label: "Products / Services" },
  { id: "USERS", label: "Users" },
  { id: "AUDITLOGS", label: "Audit Logs" },
  { id: "AUDITLOGCONFIG", label: "Audit Log Config" },
  { id: "ADMINSETTINGS", label: "Admin Settings" },
  { id: "BULKUPLOAD", label: "Bulk Upload" },
  { id: "REPORTS", label: "Reports" },
  { id: "MAINTENANCEAPPROVAL", label: "Maintenance Approval" },
  { id: "SUPERVISORAPPROVAL", label: "Supervisor Approval" }
];

const DEFAULT_AUDIT_EVENTS = [
  {
    id: "ALC001",
    appId: "ASSETS",
    eventId: "Eve005",
    description: "Asset created",
    reportingRequired: true
  },
  {
    id: "ALC002",
    appId: "ASSETS",
    eventId: "Eve008",
    description: "Asset updated",
    reportingRequired: true
  },
  {
    id: "ALC003",
    appId: "ASSETS",
    eventId: "Eve006",
    description: "Asset deleted",
    reportingRequired: true
  },
  {
    id: "ALC004",
    appId: "USERS",
    eventId: "Eve005",
    description: "User created",
    reportingRequired: true
  },
  {
    id: "ALC005",
    appId: "USERS",
    eventId: "Eve008",
    description: "User updated",
    reportingRequired: false
  },
  {
    id: "ALC006",
    appId: "AUDITLOGS",
    eventId: "Eve007",
    description: "Audit export / download",
    reportingRequired: true
  }
];

const DEFAULT_MAINT_TYPES = [
  { id: "MT001", name: "Subscription Renewal" },
  { id: "MT002", name: "Regular Maintenance" },
  { id: "MT003", name: "Others" },
  { id: "MT004", name: "Break Down" }
];

const DEFAULT_MAINT_STATUS = [
  { id: "MS001", name: "Pending" },
  { id: "MS002", name: "In-Progress" },
  { id: "MS003", name: "Cancelled" },
  { id: "MS004", name: "Aborted" },
  { id: "MS005", name: "Completed" }
];

const DEFAULT_ID_SEQUENCES = [
  { tableKey: "asset_type", prefix: "AT", lastNumber: 0 },
  { tableKey: "department", prefix: "DPT", lastNumber: 0 },
  { tableKey: "branch", prefix: "BR", lastNumber: 0 },
  { tableKey: "user", prefix: "USR", lastNumber: 0 },
  { tableKey: "employee", prefix: "EMP", lastNumber: 0 },
  { tableKey: "emp_int_id", prefix: "EMP_INT_", lastNumber: 0 },
  { tableKey: "prod_serv", prefix: "PS", lastNumber: 0 },
  { tableKey: "jobrole", prefix: "JR", lastNumber: 0 },
  { tableKey: "jobrolenav", prefix: "JRN", lastNumber: 0 },
  { tableKey: "userjobrole", prefix: "UJR", lastNumber: 0 },
  { tableKey: "dept_asset", prefix: "DPTASS", lastNumber: 0 },
  { tableKey: "asset", prefix: "ASS", lastNumber: 0 },
  { tableKey: "asset_group_h", prefix: "AGH", lastNumber: 0 },
  { tableKey: "asset_group_d", prefix: "AGD", lastNumber: 0 },
  { tableKey: "asset_doc", prefix: "AD", lastNumber: 0 },
  { tableKey: "vendor", prefix: "V", lastNumber: 0 },
  { tableKey: "vendor_prod_serv", prefix: "VPS", lastNumber: 0 },
  { tableKey: "org", prefix: "ORG", lastNumber: 0 },
  { tableKey: "aplv", prefix: "APLV", lastNumber: 0 }
];

const DEFAULT_JOB_ROLES = [
  {
    id: "JR001",
    name: "System Administrator",
    jobFunction: "Full system access",
    intStatus: 1
  }
];

const DEFAULT_JOB_ROLE_NAV = [
  {
    id: "JRN001",
    jobRoleId: "JR001",
    parentId: null,
    appId: "DASHBOARD",
    label: "Dashboard",
    sequence: 1,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN002",
    jobRoleId: "JR001",
    parentId: null,
    appId: "ASSETS",
    label: "Assets",
    sequence: 2,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN003",
    jobRoleId: "JR001",
    parentId: null,
    appId: "ASSETASSIGNMENT",
    label: "Asset Assignment",
    sequence: 3,
    accessLevel: "A",
    isGroup: true
  },
  {
    id: "JRN004",
    jobRoleId: "JR001",
    parentId: "JRN003",
    appId: "DEPTASSIGNMENT",
    label: "Department Assignment",
    sequence: 1,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN005",
    jobRoleId: "JR001",
    parentId: "JRN003",
    appId: "EMPASSIGNMENT",
    label: "Employee Assignment",
    sequence: 2,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN006",
    jobRoleId: "JR001",
    parentId: null,
    appId: "MAINTENANCEAPPROVAL",
    label: "Maintenance Approval",
    sequence: 4,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN007",
    jobRoleId: "JR001",
    parentId: null,
    appId: "MASTERDATA",
    label: "Master Data",
    sequence: 5,
    accessLevel: "A",
    isGroup: true
  },
  {
    id: "JRN008",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "ORGANIZATIONS",
    label: "Organizations",
    sequence: 1,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN009",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "ASSETTYPES",
    label: "Asset Types",
    sequence: 2,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN010",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "DEPARTMENTS",
    label: "Departments",
    sequence: 3,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN011",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "DEPARTMENTSADMIN",
    label: "Department Admin",
    sequence: 4,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN012",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "BRANCHES",
    label: "Branches",
    sequence: 5,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN013",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "VENDORS",
    label: "Vendors",
    sequence: 6,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN014",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "PRODSERV",
    label: "Products / Services",
    sequence: 7,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN015",
    jobRoleId: "JR001",
    parentId: "JRN007",
    appId: "USERS",
    label: "Users",
    sequence: 8,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN016",
    jobRoleId: "JR001",
    parentId: null,
    appId: "AUDITLOGS",
    label: "Audit Logs",
    sequence: 6,
    accessLevel: "A",
    isGroup: false
  },
  {
    id: "JRN017",
    jobRoleId: "JR001",
    parentId: null,
    appId: "ADMINSETTINGS",
    label: "Admin Settings",
    sequence: 7,
    accessLevel: "A",
    isGroup: false
  }
];

module.exports = {
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
  DEFAULT_JOB_ROLE_NAV
};

