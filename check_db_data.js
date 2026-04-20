const pool = require('./config/db');

async function checkData() {
    try {
        console.log('--- Checking tblATInspCert table ---');
        const inspCertRes = await pool.query('SELECT org_id, atic_id, asset_type_id, tc_id FROM "tblATInspCert" LIMIT 10');
        if (inspCertRes.rows.length === 0) {
            console.log('tblATInspCert is EMPTY.');
        } else {
            console.log(`Found ${inspCertRes.rows.length} rows in tblATInspCert (showing up to 10):`);
            console.table(inspCertRes.rows);
        }

        console.log('\n--- Checking tblTechCert table ---');
        const techCertRes = await pool.query('SELECT tc_id, certificate_name FROM "tblTechCert" WHERE tc_id = ANY($1)', [['TCERT002']]);
        if (techCertRes.rows.length === 0) {
            console.log('TCERT002 NOT FOUND in tblTechCert.');
        } else {
            console.log(`Found ${techCertRes.rows.length} rows in tblTechCert:`);
            console.table(techCertRes.rows);
        }

        console.log('\n--- Checking tblUsers table ---');
        const usersRes = await pool.query('SELECT DISTINCT org_id FROM "tblUsers" LIMIT 20');
        if (usersRes.rows.length === 0) {
            console.log('tblUsers is EMPTY.');
        } else {
            console.log(`Distinct org_id values in tblUsers (showing up to 20):`);
            console.table(usersRes.rows);
        }

    } catch (err) {
        console.error('Error during database check:', err.message);
        if (err.message.includes('does not exist')) {
            console.log('One of the tables might not exist or the name is case-sensitive.');
        }
    } finally {
        await pool.end();
    }
}

checkData();
