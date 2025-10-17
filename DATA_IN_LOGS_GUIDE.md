# Data in Logs - Complete Guide

## 📊 What Data is Now Included

The event logging system now captures **actual data being sent and received** at every step, not just status messages.

---

## 🔐 LOGIN Module - Data Captured

### Step 1: User Found in Database

**Request Data:**
```json
{
  "email": "akash@company.com",
  "query": "SELECT * FROM tblUsers WHERE email = $1"
}
```

**Response Data:**
```json
{
  "userFound": true,
  "userId": "USR001",
  "fullName": "Akash Jaiswal",
  "orgId": "ORG001",
  "jobRoleId": "JR001"
}
```

### Step 2: Password Matched

**Request Data:**
```json
{
  "email": "akash@company.com",
  "userId": "USR001",
  "operation": "bcrypt.compare"
}
```

**Response Data:**
```json
{
  "passwordMatch": true,
  "authenticationSuccess": true,
  "nextStep": "Generate JWT token"
}
```

### Step 3: Token Generated

**Request Data:**
```json
{
  "email": "akash@company.com",
  "userId": "USR001",
  "tokenPayload": {
    "org_id": "ORG001",
    "user_id": "USR001",
    "email": "akash@company.com",
    "job_role_id": "JR001",
    "emp_int_id": "EMP001",
    "expiresIn": "7d"
  }
}
```

**Response Data:**
```json
{
  "tokenGenerated": true,
  "tokenType": "JWT",
  "expiryDuration": "7 days"
}
```

### Step 4: Login Successful

**Request Data:**
```json
{
  "email": "akash@company.com"
}
```

**Response Data:**
```json
{
  "success": true,
  "userId": "USR001",
  "userName": "Akash Jaiswal",
  "orgId": "ORG001",
  "branchId": "BR001",
  "branchName": "Mumbai Branch",
  "roles": ["Admin", "Supervisor"],
  "tokenProvided": true
}
```

---

## 📦 ASSETS Module - Data Captured

### Step 1: API Called

**Request Data:**
```json
{
  "method": "POST",
  "url": "/api/assets/add",
  "asset_name": "Dell Latitude 7420",
  "asset_type_id": "AT001",
  "branch_id": "BR001",
  "purchase_vendor_id": "VEN001",
  "service_vendor_id": "VEN002",
  "purchased_cost": 75000,
  "purchased_on": "2025-10-01",
  "current_status": "Active",
  "warranty_period": 36
}
```

**Response Data:**
```json
{
  "status": "Request received, starting processing"
}
```

### Step 2: Validating Vendor

**Request Data:**
```json
{
  "vendor_id": "VEN001",
  "vendor_type": "purchase",
  "query": "checkVendorExists"
}
```

**Response Data:**
```json
{
  "vendorValid": true,
  "vendorExists": true,
  "vendorName": "Dell India Pvt Ltd"
}
```

### Step 3: Inserting Asset to Database

**Request Data:**
```json
{
  "asset_id": "AST12345",
  "asset_name": "Dell Latitude 7420",
  "asset_type_id": "AT001",
  "branch_id": "BR001",
  "purchase_vendor_id": "VEN001",
  "service_vendor_id": "VEN002",
  "purchased_cost": 75000,
  "purchased_on": "2025-10-01",
  "current_status": "Active",
  "warranty_period": 36,
  "query": "INSERT INTO tblAssets"
}
```

**Response Data:**
```json
{
  "status": "executing INSERT query"
}
```

### Step 4: Asset Inserted Successfully

**Request Data:**
```json
{
  "asset_id": "AST12345",
  "asset_name": "Dell Latitude 7420"
}
```

**Response Data:**
```json
{
  "inserted": true,
  "asset_id": "AST12345",
  "serial_number": "DL74200123",
  "current_status": "Active",
  "created_on": "2025-10-16T14:49:46.264Z"
}
```

### Step 5: Inserting Asset Properties

**Request Data:**
```json
{
  "asset_id": "AST12345",
  "property_count": 3,
  "properties": {
    "PROP001": "16GB",
    "PROP002": "512GB SSD",
    "PROP003": "Intel i7"
  },
  "query": "INSERT INTO tblAssetPropValues"
}
```

**Response Data:**
```json
{
  "status": "Inserting property values to database"
}
```

---

## 📋 Sample Log Files

### events_LOGIN_2025-10-16.csv

```csv
Timestamp,Log Level,Event Type,Module,Message,Request Data,Response Data,Duration (ms),User ID

2025-10-16T14:49:46.073Z,INFO,DB_QUERY,AUTH,"INFO: User found in database","{""email"":""akash@company.com"",""query"":""SELECT * FROM tblUsers WHERE email = $1""}","{""userFound"":true,""userId"":""USR001"",""fullName"":""Akash Jaiswal"",""orgId"":""ORG001"",""jobRoleId"":""JR001""}",N/A,USR001

2025-10-16T14:49:46.110Z,INFO,AUTH,AUTH,"INFO: Password matched successfully","{""email"":""akash@company.com"",""userId"":""USR001"",""operation"":""bcrypt.compare""}","{""passwordMatch"":true,""authenticationSuccess"":true,""nextStep"":""Generate JWT token""}",N/A,USR001

2025-10-16T14:49:46.147Z,INFO,AUTH,AUTH,"INFO: JWT token generated successfully","{""email"":""akash@company.com"",""userId"":""USR001"",""tokenPayload"":{""org_id"":""ORG001"",""user_id"":""USR001"",""email"":""akash@company.com"",""expiresIn"":""7d""}}","{""tokenGenerated"":true,""tokenType"":""JWT"",""expiryDuration"":""7 days""}",N/A,USR001

2025-10-16T14:49:46.185Z,INFO,LOGIN,AUTH,"INFO: User successfully logged in...","{""email"":""akash@company.com""}","{""success"":true,""userId"":""USR001"",""userName"":""Akash Jaiswal"",""orgId"":""ORG001"",""branchId"":""BR001"",""branchName"":""Mumbai Branch"",""roles"":[""Admin"",""Supervisor""],""tokenProvided"":true}",350,USR001
```

### events_ASSETS_2025-10-16.csv

```csv
Timestamp,Log Level,Event Type,Module,Message,Request Data,Response Data,Duration (ms),User ID

2025-10-16T14:49:46.222Z,INFO,API_CALL,AssetController,"INFO: POST /api/assets/add - Asset creation API called","{""method"":""POST"",""url"":""/api/assets/add"",""asset_name"":""Dell Latitude 7420"",""asset_type_id"":""AT001"",""branch_id"":""BR001"",""purchase_vendor_id"":""VEN001"",""service_vendor_id"":""VEN002"",""purchased_cost"":75000,""purchased_on"":""2025-10-01"",""current_status"":""Active""}","{""status"":""Request received, starting processing""}",N/A,USR002

2025-10-16T14:49:46.259Z,INFO,DB_QUERY,AssetController,"INFO: Inserting asset to database","{""asset_id"":""AST12345"",""asset_name"":""Dell Latitude 7420"",""asset_type_id"":""AT001"",""branch_id"":""BR001"",""purchase_vendor_id"":""VEN001"",""service_vendor_id"":""VEN002"",""purchased_cost"":75000,""current_status"":""Active"",""query"":""INSERT INTO tblAssets""}","{""status"":""executing INSERT query""}",N/A,USR002

2025-10-16T14:49:46.299Z,INFO,DB_QUERY,AssetController,"INFO: Asset inserted to database successfully","{""asset_id"":""AST12345"",""asset_name"":""Dell Latitude 7420""}","{""inserted"":true,""asset_id"":""AST12345"",""serial_number"":""DL74200123"",""current_status"":""Active"",""created_on"":""2025-10-16T14:49:46.264Z""}",N/A,USR002

2025-10-16T14:49:46.336Z,INFO,DB_QUERY,AssetController,"INFO: Inserting 3 asset properties","{""asset_id"":""AST12345"",""property_count"":3,""properties"":{""PROP001"":""16GB"",""PROP002"":""512GB SSD"",""PROP003"":""Intel i7""},""query"":""INSERT INTO tblAssetPropValues""}","{""status"":""Inserting property values to database""}",N/A,USR002
```

---

## ✅ What Data is Captured

### REQUEST DATA (What was sent):
✅ Email, userId  
✅ Asset name, type, serial number  
✅ Vendor IDs (purchase, service)  
✅ Branch ID, purchased cost, date  
✅ Current status, warranty period  
✅ Properties with actual values  
✅ Database queries being executed  
✅ HTTP method (POST/GET/PUT/DELETE)  
✅ API endpoint URL  

### RESPONSE DATA (What was received):
✅ User details (name, org, branch, roles)  
✅ Token payload structure (not actual token)  
✅ Inserted asset data (ID, serial, status, timestamps)  
✅ Property values inserted  
✅ Authentication results  
✅ Validation results  
✅ Database operation results  
✅ Success/failure indicators  

---

## 🎯 Benefits

### For Debugging:
✅ See exactly what data was sent in the request  
✅ See exactly what data was returned  
✅ Track data transformations step-by-step  
✅ Identify which field caused validation failure  
✅ See the complete user profile returned  

### For Security:
✅ Passwords are NEVER logged  
✅ Actual JWT tokens are NOT logged (only payload structure)  
✅ Sensitive data can be masked if needed  

### For Analysis:
✅ Track purchased costs over time  
✅ See which vendors are used most  
✅ Monitor asset creation patterns  
✅ Analyze property usage  
✅ Performance tracking per operation  

---

## 📝 CSV Format

Each log entry has **9 columns** with detailed JSON data in columns 6 and 7:

```
Column 1: Timestamp
Column 2: Log Level
Column 3: Event Type
Column 4: Module
Column 5: Message
Column 6: Request Data ← DETAILED INPUT DATA
Column 7: Response Data ← DETAILED OUTPUT DATA
Column 8: Duration (ms)
Column 9: User ID
```

---

## 🔍 Viewing Data in Logs

### Using Excel/CSV Viewer:
1. Open `events_LOGIN_2025-10-16.csv` in Excel
2. Column F (Request Data) shows full JSON
3. Column G (Response Data) shows full JSON
4. Can filter, sort, and analyze easily

### Using PowerShell:
```powershell
# Read LOGIN logs
$logs = Import-Csv logs\events\events_LOGIN_2025-10-16.csv
$logs | Select-Object Timestamp, "Log Level", Message, "Request Data", "Response Data" | Format-Table -AutoSize
```

### Using Python for Analysis:
```python
import pandas as pd
import json

# Read CSV
df = pd.read_csv('logs/events/events_ASSETS_2025-10-16.csv')

# Parse JSON columns
df['request'] = df['Request Data'].apply(json.loads)
df['response'] = df['Response Data'].apply(json.loads)

# Analyze
print(df['request'].apply(lambda x: x.get('purchased_cost')).mean())
```

---

## 💡 Summary

**What Changed:**
- ❌ Before: Only status messages ("processing", "executing")
- ✅ After: **Full data** (user details, asset data, properties, etc.)

**Example:**

**Before:**
```json
Request: { "email": "user@test.com" }
Response: { "status": "processing" }
```

**After:**
```json
Request: { 
  "email": "akash@company.com", 
  "query": "SELECT * FROM tblUsers WHERE email = $1" 
}
Response: { 
  "userFound": true, 
  "userId": "USR001",
  "fullName": "Akash Jaiswal",
  "orgId": "ORG001",
  "jobRoleId": "JR001"
}
```

Now you can see **exactly what data** went in and came out at every step! 🎯

