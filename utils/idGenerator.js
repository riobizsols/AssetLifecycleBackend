const db = require("../config/db");
const { getDbFromContext } = require('./dbContext');
const { DEFAULT_ID_SEQUENCES } = require('../constants/setupDefaults');

// Helper to get database (tenant or default)
const getDb = () => getDbFromContext();

const defaultPrefixesFromSetup = Object.fromEntries(
    DEFAULT_ID_SEQUENCES.map((entry) => [entry.tableKey, entry.prefix])
);

/** Runtime tableKey aliases → canonical tblIDSequences.table_key */
const SEQUENCE_KEY_ALIASES = {
    job_role_nav: 'jobrolenav',
    job_role: 'jobrole',
};

function resolveSequenceKey(tableKey) {
    return SEQUENCE_KEY_ALIASES[tableKey] || tableKey;
}

const defaultPrefixes = {
    ...defaultPrefixesFromSetup,
    'vendor_sla_rec': 'VSLAR',
    'atmf': 'ATMF',
    'wfs': 'WFS',
    'wfas': 'WFAS',
    'wfjr': 'WFJR',
    'amsbr': 'AMSBR',
    'prop': 'PROP',
    'atbrrc': 'ATBRRC',
    'atmcl': 'ATMCL',
    'aat_insp_checklist': 'AATIC',
    'job_role_nav': 'JRN',
    'job_role': 'JR',
    // Scrap workflow tables
    'wfscrapseq': 'WFSCQ',
    'wfscrap_h': 'WFSCH',
    'wfscrap_d': 'WFSCD',
    'asset_scrap': 'ASCP',
    // Existing scrap details table (legacy, used by reports/UI)
    'asset_scrap_det': 'ASD',
    'etc': 'ETC',
    // Spare parts
    'sp_category': 'SPC',
    'sp_lot_det': 'SPLD',
    'sp_ind_det': 'SPID',
    'sp_cat_at_map': 'SPCATM',
    'vsp_map': 'VSPM',
    'spare_history': 'SPH',
    'spare_issue': 'SI',
    'sp_issue': 'SPI',
    'spare_store': 'SS',
    'sp_store': 'SS',
    'sp_brand': 'SPB',
    'sp_model': 'SPBM',
    // Workflow / maintenance / inspection / scrap sales
    'ams': 'ams',
    'asset_maint_sch': 'ams',
    'wfamsh': 'WFAMSH_',
    'wfamsd': 'WFAMSD_',
    'wfamhis': 'WFAMHIS_',
    'wfaiish': 'WFAIISH_',
    'wfaiisd': 'WFAIISD_',
    'wfaiishis': 'WFAIHIS_',
    'ais': 'AIS_',
    'vendor_renewal': 'VR',
    'scrap_sales_h': 'SSH',
    'scrap_sales_d': 'SSD',
    'job_history': 'JH_',
    'tblAssetBRDet': 'ABR',
    'asset_br_det': 'ABR',
};

/**
 * Align jobrolenav.last_number with the highest JRN### in tblJobRoleNav.
 * Call after tenant setup seeds admin navigation with fixed IDs.
 */
async function syncJobRoleNavIdSequence(dbPool) {
    const { rows } = await dbPool.query(`
        SELECT COALESCE(MAX(
            CAST(SUBSTRING(job_role_nav_id FROM 'JRN([0-9]+)') AS INTEGER)
        ), 0)::int AS max_n
        FROM "tblJobRoleNav"
        WHERE job_role_nav_id ~ '^JRN[0-9]+$'
    `);
    const maxN = rows[0]?.max_n || 0;
    if (maxN <= 0) {
        return 0;
    }

    await dbPool.query(
        `
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
            VALUES ('jobrolenav', 'JRN', $1)
            ON CONFLICT (table_key) DO UPDATE
            SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
        `,
        [maxN],
    );

    // Merge legacy duplicate sequence row used by older idGenerator calls
    const legacy = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        ['job_role_nav'],
    );
    if (legacy.rows.length > 0) {
        const { prefix, last_number } = legacy.rows[0];
        await dbPool.query(
            `
                INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
                VALUES ('jobrolenav', $1, $2)
                ON CONFLICT (table_key) DO UPDATE
                SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
            `,
            [prefix, last_number],
        );
        await dbPool.query('DELETE FROM "tblIDSequences" WHERE table_key = $1', ['job_role_nav']);
    }

    return maxN;
}

async function migrateLegacySequenceKey(dbPool, tableKey, sequenceKey) {
    if (sequenceKey === tableKey) return;

    const legacy = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [tableKey],
    );
    if (legacy.rows.length === 0) return;

    const { prefix, last_number } = legacy.rows[0];
    await dbPool.query(
        `
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (table_key) DO UPDATE
            SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
        `,
        [sequenceKey, prefix, last_number],
    );
    await dbPool.query('DELETE FROM "tblIDSequences" WHERE table_key = $1', [tableKey]);
}

async function generateCustomIdWithDb(dbPool, tableKey, padLength = 3) {
    const sequenceKey = resolveSequenceKey(tableKey);
    await migrateLegacySequenceKey(dbPool, tableKey, sequenceKey);

    const tableMap = {
        'asset_type': 'tblAssetTypes',
        'asset_type_prop': 'tblAssetTypeProps',
        'dept_asset': 'tblDeptAssetTypes',
        'department': 'tblDepartments',
        'user': 'tblUsers',
        'employee': 'tblEmployees',
        'emp_int_id': 'tblEmployees',
        'vendor': 'tblVendors',
        'asset': 'tblAssets',
        'psnq': 'tblPrintSerialNoQueue',
        'dept_admin': 'tblDeptAdmins',
        'branch': 'tblBranches',
        'vendor_prod_serv': 'tblVendorProdService',
        'prod_serv': 'tblProdServs',
        'asset_group_h': 'tblAssetGroup_H',
        'asset_group_d': 'tblAssetGroup_D',
        'asset_doc': 'tblAssetDocs',
        'asset_type_doc': 'tblATDocs',
        'asset_group_doc': 'tblAssetGroupDocs',
        'aplv': 'tblAssetPropListValues',
        'vendor_doc': 'tblVendorDocs',
        'asset_maint_doc': 'tblAssetMaintDocs',
        'atp': 'tblAssetTypeProps',
        'userjobrole': 'tblUserJobRoles',
        'asset_usage': 'tblAssetUsageReg',
        'vendor_sla': 'tblVendorSLAs',
        'vendor_sla_rec': 'tblvendorslarecs',
        'atmf': 'tblATMaintFreq',
        'wfs': 'tblWFSteps',
        'wfas': 'tblWFATSeqs',
        'wfjr': 'tblWFJobRole',
        'amsbr': 'tblAssetMaintSch_BR_Hist',
        'prop': 'tblProps',
        'atbrrc': 'tblATBRReasonCodes',
        'aat_insp_checklist': 'tblAATInspCheckList',
        'atmcl': 'tblATMaintCheckList',
        'IC': 'tblInspCheckList',
        'job_role_nav': 'tblJobRoleNav',
        'jobrolenav': 'tblJobRoleNav',
        'job_role': 'tblJobRoles',
        'wfscrapseq': 'tblWFScrapSeq',
        'wfscrap_h': 'tblWFScrap_H',
        'wfscrap_d': 'tblWFScrap_D',
        'asset_scrap': 'tblAssetScrap',
        'scrap_asset_hist': 'tblScrapAssetHist',
        'asset_scrap_det': 'tblAssetScrapDet',
        'etc': 'tblEmpTechCert',
        'sp_category': 'tblSPCategory',
        'sp_brand': 'tblSPBrand',
        'sp_model': 'tblSPBMod',
        'sp_lot_det': 'tblSPLotDet',
        'sp_ind_det': 'tblSPIndDet',
        'sp_cat_at_map': 'tblSPCatATMap',
        'vsp_map': 'tblVSPMap',
        'spare_history': 'tblSpareHistory',
        'spare_issue': 'tblSpareIssue',
        'sp_issue': 'tblSpareIssue',
        'spare_store': 'tblSpareStore',
        'sp_store': 'tblSpareStore',
        'ams': 'tblAssetMaintSch',
        'asset_maint_sch': 'tblAssetMaintSch',
        'wfamsh': 'tblWFAssetMaintSch_H',
        'wfamsd': 'tblWFAssetMaintSch_D',
        'wfamhis': 'tblWFAssetMaintHist',
        'wfaiish': 'tblWFAATInspSch_H',
        'wfaiisd': 'tblWFAATInspSch_D',
        'wfaiishis': 'tblWFAATInspHist',
        'ais': 'tblAAT_Insp_Sch',
        'vendor_renewal': 'tblVendorRenewal',
        'scrap_sales_h': 'tblScrapSales_H',
        'scrap_sales_d': 'tblScrapSales_D',
        'job_history': 'tblJobHistory',
        'asset_br_det': 'tblAssetBRDet',
        'tblAssetBRDet': 'tblAssetBRDet',
        'org': 'tblOrgs',
    };

    const columnMap = {
        'asset_type': 'asset_type_id',
        'asset_type_prop': 'asset_type_prop_id',
        'dept_asset': 'dept_asset_type_id',
        'department': 'dept_id',
        'user': 'user_id',
        'employee': 'employee_id',
        'emp_int_id': 'emp_int_id',
        'vendor': 'vendor_id',
        'asset': 'asset_id',
        'psnq': 'psnq_id',
        'dept_admin': 'dept_admin_id',
        'branch': 'branch_id',
        'vendor_prod_serv': 'ven_prod_serv_id',
        'prod_serv': 'prod_serv_id',
        'asset_group_h': 'assetgroup_h_id',
        'asset_group_d': 'assetgroup_d_id',
        'asset_doc': 'a_d_id',
        'asset_type_doc': 'atd_id',
        'asset_group_doc': 'agd_id',
        'aplv': 'aplv_id',
        'vendor_doc': 'vd_id',
        'asset_maint_doc': 'amd_id',
        'atp': 'asset_type_prop_id',
        'userjobrole': 'user_job_role_id',
        'asset_usage': 'aug_id',
        'vendor_sla': 'vsla_id',
        'vendor_sla_rec': 'vslar_id',
        'atmf': 'at_main_freq_id',
        'wfs': 'wf_steps_id',
        'wfas': 'wf_at_seqs_id',
        'wfjr': 'wf_job_role_id',
        'amsbr': 'amsbr_id',
        'prop': 'prop_id',
        'atbrrc': 'atbrrc_id',
        'aat_insp_checklist': 'aatic_id',
        'atmcl': 'at_main_checklist_id',
        'IC': 'insp_check_id',
        'job_role_nav': 'job_role_nav_id',
        'jobrolenav': 'job_role_nav_id',
        'job_role': 'job_role_id',
        'wfscrapseq': 'id',
        'wfscrap_h': 'id_d',
        'wfscrap_d': 'id',
        'asset_scrap': 'id',
        'scrap_asset_hist': 'scraphis_id',
        'asset_scrap_det': 'asd_id',
        'etc': 'etc_id',
        'sp_category': 'spc_id',
        'sp_brand': 'spb_id',
        'sp_model': 'spbm_id',
        'sp_lot_det': 'spld_id',
        'sp_ind_det': 'spid_id',
        'sp_cat_at_map': 'spcatm_id',
        'vsp_map': 'vspm_id',
        'spare_history': 'sph_id',
        'spare_issue': 'si_id',
        'sp_issue': 'si_id',
        'spare_store': 'ss_id',
        'sp_store': 'ss_id',
        'ams': 'ams_id',
        'asset_maint_sch': 'ams_id',
        'wfamsh': 'wfamsh_id',
        'wfamsd': 'wfamsd_id',
        'wfamhis': 'wfamhis_id',
        'wfaiish': 'wfaiish_id',
        'wfaiisd': 'wfaiisd_id',
        'wfaiishis': 'wfaiishis_id',
        'ais': 'ais_id',
        'vendor_renewal': 'vr_id',
        'scrap_sales_h': 'ssh_id',
        'scrap_sales_d': 'ssd_id',
        'job_history': 'jh_id',
        'asset_br_det': 'abr_id',
        'tblAssetBRDet': 'abr_id',
        'org': 'org_id',
    };

    const targetTable = tableMap[tableKey] || tableMap[sequenceKey];
    const columnName = columnMap[tableKey] || columnMap[sequenceKey];
    const configuredPrefix =
      defaultPrefixes[tableKey] || defaultPrefixes[sequenceKey] || sequenceKey.toUpperCase().substring(0, 5);

    // Ensure sequence row exists
    let result = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [sequenceKey]
    );
    if (result.rows.length === 0) {
        await dbPool.query(
            'INSERT INTO "tblIDSequences" (table_key, prefix, last_number) VALUES ($1, $2, $3)',
            [sequenceKey, configuredPrefix, 0]
        );
    } else if (!result.rows[0].prefix && configuredPrefix) {
        await dbPool.query(
            'UPDATE "tblIDSequences" SET prefix = $1 WHERE table_key = $2 AND (prefix IS NULL OR prefix = \'\')',
            [configuredPrefix, sequenceKey]
        );
    }

    // Atomically bump using GREATEST(sequence, global table max) so org-scoped
    // data never under-allocates against a global PK.
    let allocated;
    if (targetTable && columnName) {
        const prefixRes = await dbPool.query(
            'SELECT COALESCE(NULLIF(prefix, \'\'), $2) AS prefix FROM "tblIDSequences" WHERE table_key = $1',
            [sequenceKey, configuredPrefix]
        );
        const prefix = prefixRes.rows[0]?.prefix || configuredPrefix;
        const prefixLen = String(prefix).length;
        try {
            allocated = await dbPool.query(
                `
                  UPDATE "tblIDSequences" AS s
                  SET last_number = GREATEST(
                    s.last_number,
                    COALESCE((
                      SELECT MAX(CAST(SUBSTRING(t.${columnName} FROM $3) AS INTEGER))
                      FROM "${targetTable}" t
                      WHERE t.${columnName} ~ ('^' || $2 || '[0-9]+$')
                    ), 0)
                  ) + 1,
                  prefix = COALESCE(NULLIF(s.prefix, ''), $2)
                  WHERE s.table_key = $1
                  RETURNING s.prefix, s.last_number
                `,
                [sequenceKey, prefix, prefixLen + 1]
            );
        } catch (e) {
            // Table missing or bad regex — fall back to sequence-only bump
            if (e.code !== '42P01' && e.code !== '42703') throw e;
            allocated = null;
        }
    }

    if (!allocated || !allocated.rows.length) {
        allocated = await dbPool.query(
            `
              UPDATE "tblIDSequences"
              SET last_number = last_number + 1
              WHERE table_key = $1
              RETURNING prefix, last_number
            `,
            [sequenceKey]
        );
    }

    if (!allocated.rows.length) {
        throw new Error(`Failed to allocate ID for ${sequenceKey}`);
    }

    const { prefix, last_number } = allocated.rows[0];
    const usePrefix = prefix || configuredPrefix;
    const generatedId = `${usePrefix}${String(last_number).padStart(padLength, '0')}`;

    // Collision retry (global PK safety net)
    if (targetTable && columnName) {
        try {
            const existingCheck = await dbPool.query(
                `SELECT ${columnName} FROM "${targetTable}" WHERE ${columnName} = $1 LIMIT 1`,
                [generatedId]
            );
            if (existingCheck.rows.length > 0) {
                return await generateCustomIdWithDb(dbPool, tableKey, padLength);
            }
        } catch (e) {
            if (e.code !== '42P01') throw e;
        }
    }

    return generatedId;
}

exports.generateCustomId = async (tableKey, padLength = 3) => {
    return generateCustomIdWithDb(getDb(), tableKey, padLength);
};

exports.generateCustomIdForClient = async (client, tableKey, padLength = 3) => {
    return generateCustomIdWithDb(client, tableKey, padLength);
};

exports.syncJobRoleNavIdSequence = syncJobRoleNavIdSequence;


exports.peekNextId = async (prefix, table, column, padding = 3, sequenceKey = null) => {
    const dbPool = getDb();
    // Global table max (no org filter) — PKs are ID-only in tenant DBs
    const result = await dbPool.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(${column} FROM $2) AS INTEGER)), 0) AS max_num
         FROM ${table}
         WHERE ${column} ~ ('^' || $1 || '[0-9]+$')`,
        [prefix, prefix.length + 1]
    );
    let maxNum = Number(result.rows[0]?.max_num || 0);

    if (sequenceKey) {
        const seq = await dbPool.query(
            'SELECT last_number FROM "tblIDSequences" WHERE table_key = $1',
            [sequenceKey]
        );
        if (seq.rows.length) {
            maxNum = Math.max(maxNum, Number(seq.rows[0].last_number || 0));
        }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(padding, "0")}`;
};
  