const { getDbFromContext } = require("../utils/dbContext");
const { generateCustomId } = require("../utils/idGenerator");

const columnCache = new Map();

const getDb = () => getDbFromContext();

const getTableColumns = async (tableName) => {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  const columnMap = result.rows.reduce((acc, row) => {
    acc[row.column_name.toLowerCase()] = row.column_name;
    return acc;
  }, {});

  columnCache.set(tableName, columnMap);
  return columnMap;
};

const pickColumn = (columnMap, candidates) => {
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (columnMap[key]) {
      return columnMap[key];
    }
  }
  return null;
};

const getEmpTechCertColumns = async () => {
  const columnMap = await getTableColumns("tblEmpTechCert");

  return {
    id: pickColumn(columnMap, ["etc_id"]),
    empIntId: pickColumn(columnMap, ["emp_int_id", "emp_intid", "employee_int_id"]),
    tcId: pickColumn(columnMap, ["tc_id"]),
    certificateDate: pickColumn(columnMap, ["certificate_date", "cert_date"]),
    certificateExpiry: pickColumn(columnMap, ["certificate_expiry", "cert_expiry", "expiry_date"]),
    filePath: pickColumn(columnMap, ["file_path"]),
    status: pickColumn(columnMap, ["status"]),
    createdBy: pickColumn(columnMap, ["created_by", "createdby"]),
    createdOn: pickColumn(columnMap, ["created_on", "createdon"]),
    org: pickColumn(columnMap, ["org_id", "orgid"])
  };
};

const getTechCertColumns = async () => {
  const columnMap = await getTableColumns("tblTechCert");

  return {
    id: pickColumn(columnMap, ["tc_id"]),
    name: pickColumn(columnMap, ["certificate_name", "cert_name", "certificaten_name"]),
    number: pickColumn(columnMap, ["certificate_no", "cert_number", "cert_no"])
  };
};

const getEmployeeColumns = async () => {
  const columnMap = await getTableColumns("tblEmployees");

  return {
    empIntId: pickColumn(columnMap, ["emp_int_id", "emp_intid", "employee_int_id"]),
    name: pickColumn(columnMap, ["name", "full_name"])
  };
};

class EmployeeTechCertModel {
  static async getEmployeeCertificates(empIntId, orgId) {
    const empColumns = await getEmpTechCertColumns();
    const certColumns = await getTechCertColumns();
    const employeeColumns = await getEmployeeColumns();

    if (!empColumns.empIntId || !empColumns.tcId || !empColumns.status) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    if (!certColumns.id || !certColumns.name) {
      throw new Error("tblTechCert does not contain required columns");
    }

    const params = [empIntId];
    const orgClause = empColumns.org ? `AND etc.${empColumns.org} = $2` : "";
    if (empColumns.org) {
      params.push(orgId);
    }

    const query = `
      SELECT
        ${empColumns.id ? `etc.${empColumns.id} AS etc_id,` : ""}
        etc.${empColumns.empIntId} AS emp_int_id,
        etc.${empColumns.tcId} AS tc_id,
        ${empColumns.certificateDate ? `etc.${empColumns.certificateDate} AS certificate_date,` : ""}
        ${empColumns.certificateExpiry ? `etc.${empColumns.certificateExpiry} AS certificate_expiry,` : ""}
        ${empColumns.filePath ? `etc.${empColumns.filePath} AS file_path,` : ""}
        etc.${empColumns.status} AS status,
        ${empColumns.createdBy ? `etc.${empColumns.createdBy} AS created_by,` : ""}
        ${empColumns.createdOn ? `etc.${empColumns.createdOn} AS created_on,` : ""}
        ${employeeColumns.name ? `emp.${employeeColumns.name} AS employee_name,` : ""}
        cert.${certColumns.name} AS cert_name,
        ${certColumns.number ? `cert.${certColumns.number} AS cert_number` : "NULL AS cert_number"}
      FROM "tblEmpTechCert" etc
      ${employeeColumns.empIntId ? `LEFT JOIN "tblEmployees" emp ON etc.${empColumns.empIntId} = emp.${employeeColumns.empIntId}` : ""}
      LEFT JOIN "tblTechCert" cert
        ON etc.${empColumns.tcId} = cert.${certColumns.id}
      WHERE etc.${empColumns.empIntId} = $1
      ${orgClause}
      ORDER BY ${empColumns.createdOn ? `etc.${empColumns.createdOn} DESC` : "etc." + empColumns.tcId + " DESC"}
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows;
  }

  static async getAllEmployeeCertificates(orgId, status) {
    const empColumns = await getEmpTechCertColumns();
    const certColumns = await getTechCertColumns();
    const employeeColumns = await getEmployeeColumns();

    if (!empColumns.empIntId || !empColumns.tcId || !empColumns.status) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    if (!certColumns.id || !certColumns.name) {
      throw new Error("tblTechCert does not contain required columns");
    }

    const params = [];
    const where = [];

    if (empColumns.org) {
      params.push(orgId);
      where.push(`etc.${empColumns.org} = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`etc.${empColumns.status} = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        ${empColumns.id ? `etc.${empColumns.id} AS etc_id,` : ""}
        etc.${empColumns.empIntId} AS emp_int_id,
        etc.${empColumns.tcId} AS tc_id,
        ${empColumns.certificateDate ? `etc.${empColumns.certificateDate} AS certificate_date,` : ""}
        ${empColumns.certificateExpiry ? `etc.${empColumns.certificateExpiry} AS certificate_expiry,` : ""}
        ${empColumns.filePath ? `etc.${empColumns.filePath} AS file_path,` : ""}
        etc.${empColumns.status} AS status,
        ${empColumns.createdBy ? `etc.${empColumns.createdBy} AS created_by,` : ""}
        ${empColumns.createdOn ? `etc.${empColumns.createdOn} AS created_on,` : ""}
        ${employeeColumns.name ? `emp.${employeeColumns.name} AS employee_name,` : ""}
        cert.${certColumns.name} AS cert_name,
        ${certColumns.number ? `cert.${certColumns.number} AS cert_number` : "NULL AS cert_number"}
      FROM "tblEmpTechCert" etc
      ${employeeColumns.empIntId ? `LEFT JOIN "tblEmployees" emp ON etc.${empColumns.empIntId} = emp.${employeeColumns.empIntId}` : ""}
      LEFT JOIN "tblTechCert" cert
        ON etc.${empColumns.tcId} = cert.${certColumns.id}
      ${whereClause}
      ORDER BY ${empColumns.createdOn ? `etc.${empColumns.createdOn} DESC` : "etc." + empColumns.tcId + " DESC"}
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows;
  }

  static async createEmployeeCertificate({
    empIntId,
    tcId,
    certificateDate,
    certificateExpiry,
    filePath,
    status,
    createdBy,
    orgId
  }) {
    const columns = await getEmpTechCertColumns();

    if (!columns.empIntId || !columns.tcId || !columns.status) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    const insertColumns = [];
    const values = [];
    const valueTokens = [];

    if (columns.id) {
      const empTechCertId = await generateCustomId("etc", 3);
      insertColumns.push(columns.id);
      values.push(empTechCertId);
      valueTokens.push(`$${values.length}`);
    }

    insertColumns.push(columns.empIntId);
    values.push(empIntId);
    valueTokens.push(`$${values.length}`);

    insertColumns.push(columns.tcId);
    values.push(tcId);
    valueTokens.push(`$${values.length}`);

    if (columns.certificateDate) {
      insertColumns.push(columns.certificateDate);
      values.push(certificateDate || null);
      valueTokens.push(`$${values.length}`);
    }

    if (columns.certificateExpiry) {
      insertColumns.push(columns.certificateExpiry);
      values.push(certificateExpiry || null);
      valueTokens.push(`$${values.length}`);
    }

    if (columns.filePath) {
      insertColumns.push(columns.filePath);
      values.push(filePath || null);
      valueTokens.push(`$${values.length}`);
    }

    insertColumns.push(columns.status);
    values.push(status);
    valueTokens.push(`$${values.length}`);

    if (columns.createdBy) {
      insertColumns.push(columns.createdBy);
      values.push(createdBy);
      valueTokens.push(`$${values.length}`);
    }

    if (columns.org) {
      insertColumns.push(columns.org);
      values.push(orgId);
      valueTokens.push(`$${values.length}`);
    }

    if (columns.createdOn) {
      insertColumns.push(columns.createdOn);
      valueTokens.push("NOW()");
    }

    const query = `
      INSERT INTO "tblEmpTechCert" (${insertColumns.join(", ")})
      VALUES (${valueTokens.join(", ")})
      RETURNING ${columns.id ? `${columns.id} AS etc_id,` : ""}
                ${columns.empIntId} AS emp_int_id,
                ${columns.tcId} AS tc_id,
                ${columns.certificateDate ? `${columns.certificateDate} AS certificate_date,` : ""}
                ${columns.certificateExpiry ? `${columns.certificateExpiry} AS certificate_expiry,` : ""}
                ${columns.filePath ? `${columns.filePath} AS file_path,` : ""}
                ${columns.status} AS status,
                ${columns.createdBy ? `${columns.createdBy} AS created_by,` : ""}
                ${columns.createdOn ? `${columns.createdOn} AS created_on` : "NULL AS created_on"}
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, values);
    return result.rows[0];
  }

  static async updateEmployeeCertificateStatus({ id, status }) {
    const columns = await getEmpTechCertColumns();

    if (!columns.id || !columns.status) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    const query = `
      UPDATE "tblEmpTechCert"
      SET ${columns.status} = $1
      WHERE ${columns.id} = $2
      RETURNING ${columns.id} AS etc_id,
                ${columns.status} AS status
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, [status, id]);
    return result.rows[0];
  }

  static async updateEmployeeCertificate({ id, tcId, certificateDate, certificateExpiry }) {
    const columns = await getEmpTechCertColumns();

    if (!columns.id) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    const sets = [];
    const values = [];

    if (tcId && columns.tcId) {
      sets.push(`${columns.tcId} = $${values.length + 1}`);
      values.push(tcId);
    }

    if (columns.certificateDate) {
      sets.push(`${columns.certificateDate} = $${values.length + 1}`);
      values.push(certificateDate || null);
    }

    if (columns.certificateExpiry) {
      sets.push(`${columns.certificateExpiry} = $${values.length + 1}`);
      values.push(certificateExpiry || null);
    }

    if (sets.length === 0) {
      return null;
    }

    values.push(id);

    const query = `
      UPDATE "tblEmpTechCert"
      SET ${sets.join(", ")}
      WHERE ${columns.id} = $${values.length}
      RETURNING ${columns.id} AS etc_id,
                ${columns.tcId || "tc_id"} AS tc_id,
                ${columns.certificateDate ? `${columns.certificateDate} AS certificate_date,` : ""}
                ${columns.certificateExpiry ? `${columns.certificateExpiry} AS certificate_expiry,` : ""}
                ${columns.status ? `${columns.status} AS status` : "NULL AS status"}
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, values);
    return result.rows[0];
  }

  static async deleteEmployeeCertificate({ id }) {
    const columns = await getEmpTechCertColumns();

    if (!columns.id) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    const query = `
      DELETE FROM "tblEmpTechCert"
      WHERE ${columns.id} = $1
      RETURNING ${columns.id} AS etc_id
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, [id]);
    return result.rows[0];
  }

  static async getEmployeeCertificateById(id, orgId) {
    const empColumns = await getEmpTechCertColumns();
    const certColumns = await getTechCertColumns();
    const employeeColumns = await getEmployeeColumns();

    if (!empColumns.id) {
      throw new Error("tblEmpTechCert does not contain required columns");
    }

    const params = [id];
    const where = [`etc.${empColumns.id} = $1`];

    if (empColumns.org) {
      params.push(orgId);
      where.push(`etc.${empColumns.org} = $${params.length}`);
    }

    const query = `
      SELECT
        ${empColumns.id ? `etc.${empColumns.id} AS etc_id,` : ""}
        etc.${empColumns.empIntId} AS emp_int_id,
        etc.${empColumns.tcId} AS tc_id,
        ${empColumns.certificateDate ? `etc.${empColumns.certificateDate} AS certificate_date,` : ""}
        ${empColumns.certificateExpiry ? `etc.${empColumns.certificateExpiry} AS certificate_expiry,` : ""}
        ${empColumns.filePath ? `etc.${empColumns.filePath} AS file_path,` : ""}
        etc.${empColumns.status} AS status,
        ${empColumns.createdBy ? `etc.${empColumns.createdBy} AS created_by,` : ""}
        ${empColumns.createdOn ? `etc.${empColumns.createdOn} AS created_on,` : ""}
        ${employeeColumns.name ? `emp.${employeeColumns.name} AS employee_name,` : ""}
        ${certColumns.name ? `cert.${certColumns.name} AS cert_name,` : ""}
        ${certColumns.number ? `cert.${certColumns.number} AS cert_number` : "NULL AS cert_number"}
      FROM "tblEmpTechCert" etc
      ${employeeColumns.empIntId ? `LEFT JOIN "tblEmployees" emp ON etc.${empColumns.empIntId} = emp.${employeeColumns.empIntId}` : ""}
      ${certColumns.id ? `LEFT JOIN "tblTechCert" cert ON etc.${empColumns.tcId} = cert.${certColumns.id}` : ""}
      WHERE ${where.join(" AND ")}
      LIMIT 1
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows[0];
  }
}

module.exports = EmployeeTechCertModel;
