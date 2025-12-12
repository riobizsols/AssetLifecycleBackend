const db = require("../config/db");

async function addJobRoleNavIdSequence() {
    const client = await db.connect();
    
    try {
        console.log("🔧 Adding job_role_nav to tblIDSequences...");
        
        // Check if entry already exists
        const checkResult = await client.query(
            'SELECT * FROM "tblIDSequences" WHERE table_key = $1',
            ['job_role_nav']
        );
        
        if (checkResult.rows.length > 0) {
            console.log("✅ job_role_nav already exists in tblIDSequences");
            console.log("   Current data:", checkResult.rows[0]);
            return;
        }
        
        // Insert new entry
        const insertResult = await client.query(
            'INSERT INTO "tblIDSequences" (table_key, prefix, last_number) VALUES ($1, $2, $3) RETURNING *',
            ['job_role_nav', 'JRN', 0]
        );
        
        console.log("✅ Successfully added job_role_nav to tblIDSequences");
        console.log("   Data:", insertResult.rows[0]);
        console.log("   🎉 Navigation IDs will now auto-generate as JRN001, JRN002, etc.");
        
    } catch (error) {
        console.error("❌ Error adding job_role_nav to tblIDSequences:", error);
        throw error;
    } finally {
        client.release();
        await db.end();
    }
}

// Run the migration
addJobRoleNavIdSequence()
    .then(() => {
        console.log("✅ Migration completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    });
