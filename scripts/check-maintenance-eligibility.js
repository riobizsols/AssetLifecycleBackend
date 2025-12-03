/**
 * Diagnostic Script: Check Maintenance Eligibility
 * 
 * This script checks which assets are eligible for maintenance creation
 * and explains what purchase dates would trigger maintenance.
 * 
 * Usage: node scripts/check-maintenance-eligibility.js
 */

require('dotenv').config();
const { Pool } = require('pg');

// Parse DATABASE_URL
function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

// Calculate planned schedule date
function calculatePlannedScheduleDate(purchasedDate, frequency, uom) {
    const date = new Date(purchasedDate);
    
    switch (uom.toLowerCase()) {
        case 'days':
            date.setDate(date.getDate() + frequency);
            break;
        case 'weeks':
            date.setDate(date.getDate() + (frequency * 7));
            break;
        case 'months':
            date.setMonth(date.getMonth() + frequency);
            break;
        case 'years':
            date.setFullYear(date.getFullYear() + frequency);
            break;
        default:
            date.setDate(date.getDate() + frequency);
    }
    
    return date;
}

async function checkMaintenanceEligibility() {
    const config = parseDatabaseUrl(process.env.DATABASE_URL);
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 CHECKING MAINTENANCE ELIGIBILITY');
        console.log('═══════════════════════════════════════════════════════════\n');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log(`📅 Today's Date: ${today.toISOString().split('T')[0]}\n`);

        // Get asset types that require maintenance
        const assetTypesResult = await pool.query(`
            SELECT asset_type_id, text, maint_required, org_id
            FROM "tblAssetTypes"
            WHERE maint_required = true AND int_status = 1
            ORDER BY asset_type_id
        `);
        const assetTypes = assetTypesResult.rows;
        console.log(`Found ${assetTypes.length} asset types requiring maintenance\n`);

        if (assetTypes.length === 0) {
            console.log('❌ No asset types found that require maintenance!');
            return;
        }

        for (const assetType of assetTypes) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Asset Type: ${assetType.asset_type_id} - ${assetType.text}`);
            console.log(`${'='.repeat(60)}\n`);

            // Get maintenance frequencies
            const freqResult = await pool.query(`
                SELECT at_main_freq_id, frequency, uom, maint_type_id
                FROM "tblATMaintFreq"
                WHERE asset_type_id = $1
                ORDER BY at_main_freq_id
            `, [assetType.asset_type_id]);
            const frequencies = freqResult.rows;

            if (frequencies.length === 0) {
                console.log(`⚠️  No maintenance frequencies configured for this asset type\n`);
                continue;
            }

            console.log(`Maintenance Frequencies:`);
            frequencies.forEach(freq => {
                console.log(`  - ${freq.frequency} ${freq.uom} (${freq.maint_type_id})`);
            });
            console.log('');

            // Get assets for this asset type
            const assetsResult = await pool.query(`
                SELECT 
                    a.asset_id,
                    a.text as asset_name,
                    a.purchased_on,
                    a.org_id,
                    a.branch_id,
                    a.group_id,
                    a.service_vendor_id
                FROM "tblAssets" a
                WHERE a.asset_type_id = $1
                ORDER BY a.purchased_on DESC
            `, [assetType.asset_type_id]);
            const assets = assetsResult.rows;

            console.log(`Found ${assets.length} assets for this asset type\n`);

            if (assets.length === 0) {
                console.log(`⚠️  No assets found for this asset type\n`);
                continue;
            }

            // Check each asset
            for (const asset of assets) {
                console.log(`\n  Asset: ${asset.asset_id} - ${asset.asset_name || 'N/A'}`);
                console.log(`  Purchase Date: ${asset.purchased_on || 'NOT SET'}`);

                if (!asset.purchased_on) {
                    console.log(`  ❌ SKIPPED: No purchase date set`);
                    continue;
                }

                const purchaseDate = new Date(asset.purchased_on);
                purchaseDate.setHours(0, 0, 0, 0);

                // Check for in-progress maintenance
                const inProgressCheck = await pool.query(`
                    SELECT COUNT(*) as count
                    FROM "tblWFAssetMaintSch_H"
                    WHERE asset_id = $1 AND status IN ('IN', 'IP')
                `, [asset.asset_id]);
                const hasInProgress = inProgressCheck.rows[0].count > 0;

                if (hasInProgress) {
                    console.log(`  ⚠️  SKIPPED: Has in-progress maintenance`);
                    continue;
                }

                // Get latest completed maintenance date
                const completedCheck = await pool.query(`
                    SELECT MAX(act_sch_date) as latest_date
                    FROM "tblWFAssetMaintSch_H"
                    WHERE asset_id = $1 AND status IN ('CO', 'CA')
                `, [asset.asset_id]);
                const latestMaintenanceDate = completedCheck.rows[0]?.latest_date;

                let dateToConsider = purchaseDate;
                if (latestMaintenanceDate) {
                    const latestDate = new Date(latestMaintenanceDate);
                    latestDate.setHours(0, 0, 0, 0);
                    dateToConsider = new Date(Math.max(purchaseDate.getTime(), latestDate.getTime()));
                    console.log(`  Latest Maintenance: ${latestMaintenanceDate}`);
                    console.log(`  Date to Consider: ${dateToConsider.toISOString().split('T')[0]} (using latest of purchase/maintenance)`);
                } else {
                    console.log(`  Date to Consider: ${dateToConsider.toISOString().split('T')[0]} (purchase date)`);
                }

                // Check each frequency
                let eligibleForAny = false;
                for (const freq of frequencies) {
                    const plannedDate = calculatePlannedScheduleDate(dateToConsider, freq.frequency, freq.uom);
                    const tenDaysBefore = new Date(plannedDate);
                    tenDaysBefore.setDate(tenDaysBefore.getDate() - 10);

                    const isEligible = today >= tenDaysBefore;

                    console.log(`\n    Frequency: ${freq.frequency} ${freq.uom}`);
                    console.log(`      Planned Date: ${plannedDate.toISOString().split('T')[0]}`);
                    console.log(`      10 Days Before: ${tenDaysBefore.toISOString().split('T')[0]}`);
                    console.log(`      Today: ${today.toISOString().split('T')[0]}`);
                    console.log(`      Status: ${isEligible ? '✅ ELIGIBLE' : '⏳ NOT YET DUE'}`);

                    if (isEligible) {
                        eligibleForAny = true;
                        console.log(`      ✅ Maintenance will be created for this frequency!`);
                    } else {
                        const daysUntilEligible = Math.ceil((tenDaysBefore - today) / (1000 * 60 * 60 * 24));
                        console.log(`      ⏳ Will be eligible in ${daysUntilEligible} days`);
                        
                        // Calculate what purchase date would make it eligible today
                        const targetPlannedDate = new Date(today);
                        targetPlannedDate.setDate(targetPlannedDate.getDate() + 10); // Add 10 days
                        
                        // Work backwards to find required purchase date
                        let requiredPurchaseDate = new Date(targetPlannedDate);
                        switch (freq.uom.toLowerCase()) {
                            case 'days':
                                requiredPurchaseDate.setDate(requiredPurchaseDate.getDate() - freq.frequency);
                                break;
                            case 'weeks':
                                requiredPurchaseDate.setDate(requiredPurchaseDate.getDate() - (freq.frequency * 7));
                                break;
                            case 'months':
                                requiredPurchaseDate.setMonth(requiredPurchaseDate.getMonth() - freq.frequency);
                                break;
                            case 'years':
                                requiredPurchaseDate.setFullYear(requiredPurchaseDate.getFullYear() - freq.frequency);
                                break;
                        }
                        console.log(`      💡 To be eligible TODAY, purchase date should be: ${requiredPurchaseDate.toISOString().split('T')[0]} or earlier`);
                    }
                }

                if (!eligibleForAny) {
                    console.log(`\n  ⚠️  This asset is NOT eligible for maintenance creation yet`);
                }
            }
        }

        console.log('\n\n═══════════════════════════════════════════════════════════');
        console.log('📊 SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('Maintenance is created when:');
        console.log('  Current Date >= (Purchase Date + Frequency - 10 days)');
        console.log('\nExample:');
        console.log('  - Purchase Date: 2024-01-01');
        console.log('  - Frequency: 6 months');
        console.log('  - Planned Date: 2024-07-01');
        console.log('  - 10 Days Before: 2024-06-21');
        console.log('  - Maintenance created if today >= 2024-06-21\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

checkMaintenanceEligibility();


