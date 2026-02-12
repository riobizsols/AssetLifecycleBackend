require('dotenv').config();
const http = require('http');
const https = require('https');

const MINIO_HOST = process.env.MINIO_END_POINT;
const MINIO_PORT = process.env.MINIO_PORT;
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;

// Check if a port is accessible
function checkPort(host, port, useSSL = false) {
  return new Promise((resolve) => {
    const protocol = useSSL ? https : http;
    const url = `${useSSL ? 'https' : 'http'}://${host}:${port}/minio/health/live`;
    
    console.log(`\n🔍 Checking ${url}...`);
    
    const req = protocol.get(url, { timeout: 5000 }, (res) => {
      console.log(`✅ Port ${port} is responding`);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers:`, res.headers);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data) console.log(`   Response:`, data);
        resolve({ accessible: true, status: res.statusCode, port });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Port ${port} is not accessible`);
      console.log(`   Error: ${err.message}`);
      resolve({ accessible: false, error: err.message, port });
    });

    req.on('timeout', () => {
      console.log(`⏱️  Port ${port} timed out`);
      req.destroy();
      resolve({ accessible: false, error: 'Timeout', port });
    });
  });
}

// Try to connect to MinIO using the SDK
async function checkMinioWithSDK() {
  console.log('\n🔍 Trying to connect with MinIO SDK...');
  try {
    const Minio = require('minio');
    
    const minioClient = new Minio.Client({
      endPoint: MINIO_HOST,
      port: parseInt(MINIO_PORT),
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });

    // Try to list buckets
    const buckets = await minioClient.listBuckets();
    console.log('✅ MinIO SDK connection successful!');
    console.log(`   Found ${buckets.length} bucket(s):`);
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (created: ${bucket.creationDate})`);
    });
    return true;
  } catch (error) {
    console.log('❌ MinIO SDK connection failed');
    console.log(`   Error: ${error.message}`);
    if (error.code) console.log(`   Code: ${error.code}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('           MinIO Connection Diagnostics');
  console.log('═══════════════════════════════════════════════════');
  console.log('\n📋 Configuration from .env:');
  console.log(`   Host: ${MINIO_HOST}`);
  console.log(`   Port: ${MINIO_PORT}`);
  console.log(`   SSL: ${MINIO_USE_SSL}`);
  console.log(`   Access Key: ${MINIO_ACCESS_KEY}`);
  console.log(`   Secret Key: ${MINIO_SECRET_KEY ? '***' + MINIO_SECRET_KEY.slice(-4) : 'Not set'}`);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('           Checking MinIO Ports');
  console.log('═══════════════════════════════════════════════════');

  // Check common MinIO ports
  const portsToCheck = [
    { port: 9000, desc: 'MinIO API (default)' },
    { port: 9001, desc: 'MinIO Console (default)' },
    { port: parseInt(MINIO_PORT), desc: 'MinIO API (from .env)' },
  ];

  const uniquePorts = [...new Set(portsToCheck.map(p => p.port))];
  
  for (const portNum of uniquePorts) {
    const portInfo = portsToCheck.find(p => p.port === portNum);
    console.log(`\n--- ${portInfo.desc} (Port ${portNum}) ---`);
    await checkPort(MINIO_HOST, portNum, MINIO_USE_SSL);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('           Testing MinIO SDK Connection');
  console.log('═══════════════════════════════════════════════════');

  await checkMinioWithSDK();

  console.log('\n═══════════════════════════════════════════════════');
  console.log('           Recommendations');
  console.log('═══════════════════════════════════════════════════');
  console.log('\nIf MinIO is not accessible:');
  console.log('1. Check if MinIO service is running on the server');
  console.log('   SSH command: ssh user@' + MINIO_HOST);
  console.log('   Check status: systemctl status minio');
  console.log('   Or: docker ps | grep minio');
  console.log('\n2. Check firewall rules');
  console.log('   Ensure ports 9000 and 9001 are open');
  console.log('\n3. Verify MinIO configuration on the server');
  console.log('   Config file: /etc/default/minio or docker-compose.yml');
  console.log('\n4. Check MinIO logs for errors');
  console.log('   Logs: journalctl -u minio -f');
  console.log('   Docker: docker logs <minio-container>');
}

main().catch(console.error);
