/**
 * Service to synchronize primary and foreign key relationships
 * from GENERIC_URL (source) to target database
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Build DATABASE_URL from dbConfig object
 */
function buildDatabaseUrl(dbConfig) {
  const { host, port, database, user, password } = dbConfig;
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port || 5432}/${database}`;
}

/**
 * Synchronize database keys from GENERIC_URL to target database
 * @param {Object} dbConfig - Target database configuration {host, port, database, user, password}
 * @returns {Promise<Object>} - Result object with success, logs, and summary
 */
async function syncDatabaseKeys(dbConfig) {
  return new Promise((resolve, reject) => {
    // Validate GENERIC_URL exists
    if (!process.env.GENERIC_URL) {
      return reject(new Error('GENERIC_URL is not set in environment variables. Please configure it in .env file.'));
    }

    // Build target DATABASE_URL from dbConfig
    const targetDatabaseUrl = buildDatabaseUrl(dbConfig);
    
    // Path to sync script
    const scriptPath = path.join(__dirname, '..', 'scripts', 'db creation script', 'sync-database-keys.js');
    
    // Set up environment variables for the script
    const env = {
      ...process.env,
      GENERIC_URL: process.env.GENERIC_URL,
      DATABASE_URL: targetDatabaseUrl,
    };
    
    const logs = [];
    let stdout = '';
    let stderr = '';
    
    // Spawn the sync script with --apply flag
    const child = spawn('node', [scriptPath, '--apply'], {
      env,
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Parse log lines
      const lines = output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logs.push({ 
          message: line.trim(), 
          level: line.includes('ERROR') || line.includes('❌') ? 'error' : 
                 line.includes('WARN') || line.includes('⚠️') ? 'warning' : 
                 line.includes('SUCCESS') || line.includes('✅') ? 'success' : 'info'
        });
      });
      console.log('[SyncKeys]', output);
    });
    
    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logs.push({ message: error.trim(), level: 'error' });
      console.error('[SyncKeys]', error);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        // Parse summary from output
        const summary = {
          message: 'Database keys synchronized successfully',
          logsCount: logs.length,
        };
        
        // Try to extract statistics from output
        const pkMatch = stdout.match(/Primary Keys Applied Successfully: (\d+)/);
        const fkMatch = stdout.match(/Foreign Keys Applied Successfully: (\d+)/);
        if (pkMatch) summary.primaryKeysApplied = parseInt(pkMatch[1]);
        if (fkMatch) summary.foreignKeysApplied = parseInt(fkMatch[1]);
        
        resolve({
          success: true,
          message: 'Database keys synchronized successfully',
          logs,
          summary,
        });
      } else {
        const errorMsg = stderr || `Sync script exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Failed to spawn sync script: ${error.message}`));
    });
  });
}

module.exports = {
  syncDatabaseKeys,
  buildDatabaseUrl,
};
