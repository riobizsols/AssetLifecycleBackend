const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const getAllMappings = async (orgId) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `SELECT 
            m.at_id, 
            at.text as asset_type_name,
            m.asset_id, 
            a.text as asset_name,
            COUNT(m.insp_check_id) as total_questions
         FROM "tblAATInspCheckList" m
         LEFT JOIN "tblAssetTypes" at ON m.at_id = at.asset_type_id AND m.org_id = at.org_id
         LEFT JOIN "tblAssets" a ON m.asset_id = a.asset_id AND m.org_id = a.org_id
         WHERE m.org_id = $1
         GROUP BY m.at_id, at.text, m.asset_id, a.text
         ORDER BY at.text, a.text`,
        [orgId]
    );
    return result.rows;
};

const getMappedChecklistsByAssetTypeAndAsset = async (assetTypeId, assetId, orgId) => {
    const dbPool = getDb();
    
    let query = `
        SELECT 
            m.aatic_id,
            m.at_id,
            m.asset_id,
            m.insp_check_id,
            m.expected_value,
            m.min_range,
            m.max_range,
            m.trigger_maintenance,
            m.org_id,
            m.created_by,
            m.created_on,
            m.changed_by,
            m.changed_on,
            c.response_type,
            (
              SELECT d.irtd_id
              FROM "tblInspResTypeDet" d
              WHERE d.name = c.response_type
              ORDER BY d.irtd_id ASC
              LIMIT 1
            ) as irtd_id,
            c.inspection_text as question_text
        FROM "tblAATInspCheckList" m
        LEFT JOIN "tblInspCheckList" c ON m.insp_check_id = c.insp_check_id AND m.org_id = c.org_id
        WHERE m.at_id = $1 AND m.org_id = $2
    `;
    let params = [assetTypeId, orgId];
    
    if (assetId) {
        query += ` AND m.asset_id = $3`;
        params.push(assetId);
    } else {
        query += ` AND (m.asset_id IS NULL OR m.asset_id = '')`;
    }
    
    const result = await dbPool.query(query, params);
    return result.rows;
};

/**
 * Persist mapping rows without wipe-deleting aatic_ids that still have
 * inspection frequencies / workflow schedules attached.
 * tblAAT_Insp_Freq ON DELETE CASCADE from checklist, but tblWFAATInspSch_H.aatif_id
 * has no ON DELETE SET NULL — a full DELETE of mappings fails when schedules exist.
 */
const saveMapping = async (assetTypeId, assetId, overrideData, orgId, userId) => {
    const dbPool = getDb();
    const client = await dbPool.connect();
    const normalizedAssetId = assetId ? String(assetId).trim() : null;
    const rows = Array.isArray(overrideData) ? overrideData : [];

    try {
        await client.query('BEGIN');

        let existingQuery = `
            SELECT aatic_id, insp_check_id, asset_id
            FROM "tblAATInspCheckList"
            WHERE at_id = $1 AND org_id = $2
        `;
        const existingParams = [assetTypeId, orgId];
        if (normalizedAssetId) {
            existingQuery += ` AND asset_id = $3`;
            existingParams.push(normalizedAssetId);
        } else {
            existingQuery += ` AND (asset_id IS NULL OR asset_id = '')`;
        }

        const existing = await client.query(existingQuery, existingParams);
        const existingByCheck = new Map(
            existing.rows.map((r) => [String(r.insp_check_id), r])
        );

        const incoming = [];
        const incomingCheckIds = new Set();
        for (const item of rows) {
            const checkId = item.insp_check_id || item.Insp_check_id;
            if (!checkId) continue;
            const key = String(checkId);
            if (incomingCheckIds.has(key)) continue;
            incomingCheckIds.add(key);
            incoming.push({
                insp_check_id: key,
                expected_value: item.expected_value || item.Expected_Value || null,
                min_range:
                    item.min_range === '' || item.min_range === null || item.min_range === undefined
                        ? null
                        : item.min_range,
                max_range:
                    item.max_range === '' || item.max_range === null || item.max_range === undefined
                        ? null
                        : item.max_range,
                trigger_maintenance: !!item.trigger_maintenance,
            });
        }

        const toRemoveIds = existing.rows
            .filter((r) => !incomingCheckIds.has(String(r.insp_check_id)))
            .map((r) => r.aatic_id);

        if (toRemoveIds.length) {
            // Clear workflow schedule refs that block CASCADE delete of frequencies.
            await client.query(
                `
                UPDATE "tblWFAATInspSch_H"
                SET aatif_id = NULL,
                    changed_by = $2,
                    changed_on = NOW()
                WHERE aatif_id IN (
                    SELECT f.aatif_id
                    FROM "tblAAT_Insp_Freq" f
                    WHERE f.aatic_id = ANY($1::varchar[])
                )
                `,
                [toRemoveIds, userId || 'SYSTEM']
            );

            await client.query(
                `DELETE FROM "tblAATInspCheckList" WHERE aatic_id = ANY($1::varchar[])`,
                [toRemoveIds]
            );
        }

        for (const item of incoming) {
            const existingRow = existingByCheck.get(item.insp_check_id);
            if (existingRow) {
                await client.query(
                    `
                    UPDATE "tblAATInspCheckList"
                    SET expected_value = $1,
                        min_range = $2,
                        max_range = $3,
                        trigger_maintenance = $4,
                        asset_id = $5,
                        changed_by = $6,
                        changed_on = NOW()
                    WHERE aatic_id = $7
                    `,
                    [
                        item.expected_value,
                        item.min_range,
                        item.max_range,
                        item.trigger_maintenance,
                        normalizedAssetId,
                        userId || 'SYSTEM',
                        existingRow.aatic_id,
                    ]
                );
            } else {
                const aaticId = await generateCustomId('aat_insp_checklist');
                await client.query(
                    `
                    INSERT INTO "tblAATInspCheckList"
                      (aatic_id, org_id, at_id, asset_id, insp_check_id, expected_value,
                       min_range, max_range, trigger_maintenance, created_by, created_on)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                    `,
                    [
                        aaticId,
                        orgId,
                        assetTypeId,
                        normalizedAssetId,
                        item.insp_check_id,
                        item.expected_value,
                        item.min_range,
                        item.max_range,
                        item.trigger_maintenance,
                        userId || 'SYSTEM',
                    ]
                );
            }
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const deleteMappingGroup = async (assetTypeId, assetId, orgId) => {
    const dbPool = getDb();
    const client = await dbPool.connect();
    const normalizedAssetId = assetId ? String(assetId).trim() : null;

    try {
        await client.query('BEGIN');

        let selectQuery = `
            SELECT aatic_id FROM "tblAATInspCheckList"
            WHERE at_id = $1 AND org_id = $2
        `;
        const params = [assetTypeId, orgId];
        if (normalizedAssetId) {
            selectQuery += ` AND asset_id = $3`;
            params.push(normalizedAssetId);
        } else {
            selectQuery += ` AND (asset_id IS NULL OR asset_id = '')`;
        }

        const existing = await client.query(selectQuery, params);
        const ids = existing.rows.map((r) => r.aatic_id);
        if (!ids.length) {
            await client.query('COMMIT');
            return false;
        }

        await client.query(
            `
            UPDATE "tblWFAATInspSch_H"
            SET aatif_id = NULL, changed_on = NOW()
            WHERE aatif_id IN (
                SELECT f.aatif_id FROM "tblAAT_Insp_Freq" f WHERE f.aatic_id = ANY($1::varchar[])
            )
            `,
            [ids]
        );

        const result = await client.query(
            `DELETE FROM "tblAATInspCheckList" WHERE aatic_id = ANY($1::varchar[])`,
            [ids]
        );

        await client.query('COMMIT');
        return result.rowCount > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getAllMappings,
    getMappedChecklistsByAssetTypeAndAsset,
    saveMapping,
    deleteMappingGroup
};
