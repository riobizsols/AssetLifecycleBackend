const db = require('./config/db');

async function runMigration() {
    try {
        console.log('🚀 Running workflow notification preferences migration...\n');

        // Insert default notification preferences for workflow_approval
        console.log('1. Adding workflow_approval preferences...');
        const workflowApprovalQuery = `
            INSERT INTO "tblNotificationPreferences" (
                preference_id, 
                user_id, 
                notification_type, 
                is_enabled, 
                email_enabled, 
                push_enabled,
                created_on,
                updated_on
            )
            SELECT 
                'PREF' || SUBSTRING(u.user_id FROM 1 FOR 16),
                u.user_id,
                'workflow_approval',
                true,
                true,
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM "tblUsers" u
            WHERE u.int_status = 1
              AND NOT EXISTS (
                SELECT 1 FROM "tblNotificationPreferences" np 
                WHERE np.user_id = u.user_id 
                  AND np.notification_type = 'workflow_approval'
              )
        `;
        const workflowResult = await db.query(workflowApprovalQuery);
        console.log(`✅ Added ${workflowResult.rowCount} workflow_approval preferences`);

        // Insert default notification preferences for breakdown_approval
        console.log('2. Adding breakdown_approval preferences...');
        const breakdownApprovalQuery = `
            INSERT INTO "tblNotificationPreferences" (
                preference_id, 
                user_id, 
                notification_type, 
                is_enabled, 
                email_enabled, 
                push_enabled,
                created_on,
                updated_on
            )
            SELECT 
                'PREF' || SUBSTRING(u.user_id FROM 1 FOR 16) || 'BD',
                u.user_id,
                'breakdown_approval',
                true,
                true,
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM "tblUsers" u
            WHERE u.int_status = 1
              AND NOT EXISTS (
                SELECT 1 FROM "tblNotificationPreferences" np 
                WHERE np.user_id = u.user_id 
                  AND np.notification_type = 'breakdown_approval'
              )
        `;
        const breakdownResult = await db.query(breakdownApprovalQuery);
        console.log(`✅ Added ${breakdownResult.rowCount} breakdown_approval preferences`);

        // Create indexes for better performance
        console.log('3. Creating performance indexes...');
        
        try {
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_type 
                ON "tblNotificationPreferences" (user_id, notification_type)
            `);
            console.log('✅ Created index on notification preferences');
        } catch (indexError) {
            console.log('⚠️ Index already exists or error:', indexError.message);
        }

        try {
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_active 
                ON "tblFCMTokens" (user_id, is_active)
            `);
            console.log('✅ Created index on FCM tokens');
        } catch (indexError) {
            console.log('⚠️ Index already exists or error:', indexError.message);
        }

        try {
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_notification_history_user_type 
                ON "tblNotificationHistory" (user_id, notification_type)
            `);
            console.log('✅ Created index on notification history');
        } catch (indexError) {
            console.log('⚠️ Index already exists or error:', indexError.message);
        }

        console.log('\n🎉 Migration completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`- Workflow approval preferences: ${workflowResult.rowCount} added`);
        console.log(`- Breakdown approval preferences: ${breakdownResult.rowCount} added`);
        console.log('- Performance indexes: Created/verified');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        // Close database connection
        await db.end();
    }
}

// Run the migration
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };
