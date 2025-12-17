const db = require("../config/db");

async function addJobRoleIdSequence() {
    const client = await db.connect();
    
    try {
        console.log("🔧 Adding job_role to tblIDSequences...");
        
        // Check if entry already exists
        const checkResult = await client.query(
            'SELECT * FROM "tblIDSequences" WHERE table_key = $1',
            ['job_role']
        );
        
        if (checkResult.rows.length > 0) {
            console.log("✅ job_role already exists in tblIDSequences");
            console.log("   Current data:", checkResult.rows[0]);
            return;
        }
        
        // Insert new entry
        const insertResult = await client.query(
            'INSERT INTO "tblIDSequences" (table_key, prefix, last_number) VALUES ($1, $2, $3) RETURNING *',
            ['job_role', 'JR', 0]
        );
        
        console.log("✅ Successfully added job_role to tblIDSequences");
        console.log("   Data:", insertResult.rows[0]);
        console.log("   🎉 Job Role IDs will now auto-generate as JR001, JR002, etc.");
        
    } catch (error) {
        console.error("❌ Error adding job_role to tblIDSequences:", error);
        throw error;
    } finally {
        client.release();
        await db.end();
    }
}

// Run the migration
addJobRoleIdSequence()
    .then(() => {
        console.log("✅ Migration completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    });

