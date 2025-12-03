/**
 * Check AT001 (ECG Machine) Maintenance Eligibility
 */

require('dotenv').config();
const { Pool } = require('pg');

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid DATABASE_URL');
  return { user: match[1], password: match[2], host: match[3], port: match[4], database: match[5] };
}

function calculatePlannedScheduleDate(purchasedDate, frequency, uom) {
    const date = new Date(purchasedDate);
    switch (uom.toLowerCase()) {
        case 'days': date.setDate(date.getDate() + frequency); break;
        case 'weeks': date.setDate(date.getDate() + (frequency * 7)); break;
        case 'months': date.setMonth(date.getMonth() + frequency); break;
        case 'years': date.setFullYear(date.getFullYear() + frequency); break;
        default: date.setDate(date.getDate() + frequency);
    }
    return date;
}

async function checkAT001() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 CHECKING AT001 (ECG Machine)');
        console.log('═══════════════════════════════════════════════════════════\n');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log(`📅 Today: ${today.toISOString().split('T')[0]}\n`);

        // Get frequency
        const freqResult = await pool.query(`
            SELECT frequency, uom FROM "tblATMaintFreq" WHERE asset_type_id = 'AT001'
        `);
        const frequency = freqResult.rows[0];
        if (!frequency) {
            console.log('❌ No frequency configured for AT001');
            return;
        }
        console.log(`Frequency: ${frequency.frequency} ${frequency.uom}\n`);

        // Get assets
        const assetsResult = await pool.query(`
            SELECT asset_id, text, purchased_on, org_id
            FROM "tblAssets"
            WHERE asset_type_id = 'AT001'
            ORDER BY asset_id
        `);
        console.log(`Found ${assetsResult.rows.length} assets:\n`);

        for (const asset of assetsResult.rows) {
            console.log(`Asset: ${asset.asset_id} - ${asset.text || 'N/A'}`);
            console.log(`  Purchase Date: ${asset.purchased_on || 'NOT SET'}`);

            // Check in-progress maintenance
            const inProgress = await pool.query(`
                SELECT wfamsh_id, pl_sch_date, status, created_on
                FROM "tblWFAssetMaintSch_H"
                WHERE asset_id = $1 AND status IN ('IN', 'IP')
                ORDER BY created_on DESC
            `, [asset.asset_id]);

            if (inProgress.rows.length > 0) {
                console.log(`  ⚠️  Has ${inProgress.rows.length} in-progress maintenance:`);
                inProgress.rows.forEach(m => {
                    console.log(`     - ${m.wfamsh_id}: Status=${m.status}, Planned=${m.pl_sch_date}, Created=${m.created_on}`);
                });
                console.log(`  ❌ SKIPPED: Cannot create new maintenance while in-progress exists\n`);
                continue;
            }

            if (!asset.purchased_on) {
                console.log(`  ❌ SKIPPED: No purchase date\n`);
                continue;
            }

            const purchaseDate = new Date(asset.purchased_on);
            purchaseDate.setHours(0, 0, 0, 0);

            // Check latest completed maintenance
            const completed = await pool.query(`
                SELECT MAX(act_sch_date) as latest_date
                FROM "tblWFAssetMaintSch_H"
                WHERE asset_id = $1 AND status IN ('CO', 'CA')
            `, [asset.asset_id]);
            const latestMaintenance = completed.rows[0]?.latest_date;

            let dateToConsider = purchaseDate;
            if (latestMaintenance) {
                const latestDate = new Date(latestMaintenance);
                latestDate.setHours(0, 0, 0, 0);
                dateToConsider = new Date(Math.max(purchaseDate.getTime(), latestDate.getTime()));
                console.log(`  Latest Maintenance: ${latestMaintenance}`);
            }
            console.log(`  Date to Consider: ${dateToConsider.toISOString().split('T')[0]}`);

            // Calculate eligibility
            const plannedDate = calculatePlannedScheduleDate(dateToConsider, frequency.frequency, frequency.uom);
            const tenDaysBefore = new Date(plannedDate);
            tenDaysBefore.setDate(tenDaysBefore.getDate() - 10);

            const isEligible = today >= tenDaysBefore;

            console.log(`  Planned Date: ${plannedDate.toISOString().split('T')[0]}`);
            console.log(`  10 Days Before: ${tenDaysBefore.toISOString().split('T')[0]}`);
            console.log(`  Status: ${isEligible ? '✅ ELIGIBLE' : '⏳ NOT YET DUE'}`);

            if (!isEligible) {
                const daysUntil = Math.ceil((tenDaysBefore - today) / (1000 * 60 * 60 * 24));
                console.log(`  ⏳ Will be eligible in ${daysUntil} days`);

                // Calculate required purchase date for today
                const targetPlanned = new Date(today);
                targetPlanned.setDate(targetPlanned.getDate() + 10);
                let requiredDate = new Date(targetPlanned);
                if (frequency.uom.toLowerCase() === 'days') {
                    requiredDate.setDate(requiredDate.getDate() - frequency.frequency);
                } else if (frequency.uom.toLowerCase() === 'months') {
                    requiredDate.setMonth(requiredDate.getMonth() - frequency.frequency);
                }
                console.log(`  💡 To be eligible TODAY, purchase date should be: ${requiredDate.toISOString().split('T')[0]} or earlier`);
            } else {
                console.log(`  ✅ Maintenance WILL BE CREATED for this asset!`);
            }
            console.log('');
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 SUMMARY FOR AT001');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`Frequency: ${frequency.frequency} ${frequency.uom}`);
        console.log(`Maintenance created when: Today >= (Purchase Date + ${frequency.frequency} ${frequency.uom} - 10 days)`);
        
        // Calculate example
        const exampleDate = new Date(today);
        if (frequency.uom.toLowerCase() === 'days') {
            exampleDate.setDate(exampleDate.getDate() - frequency.frequency + 10);
        } else if (frequency.uom.toLowerCase() === 'months') {
            exampleDate.setMonth(exampleDate.getMonth() - frequency.frequency);
            exampleDate.setDate(exampleDate.getDate() + 10);
        }
        console.log(`\nTo create maintenance TODAY, purchase date should be: ${exampleDate.toISOString().split('T')[0]} or earlier\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

checkAT001();


