require('dotenv').config();
const net = require('net');

const MINIO_HOST = process.env.MINIO_END_POINT;

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(3000);
    
    socket.on('connect', () => {
      console.log(`✅ Port ${port} is OPEN`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`⏱️  Port ${port} - Connection timeout`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (err) => {
      console.log(`❌ Port ${port} - ${err.message}`);
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║    MinIO Connection Test              ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`Testing: ${MINIO_HOST}\n`);
  
  await checkPort(MINIO_HOST, 9000);
  await checkPort(MINIO_HOST, 9001);
  
  console.log('\n📝 Summary:');
  console.log('─────────────────────────────────────────');
  console.log('If both ports are timing out or closed:');
  console.log('  1. MinIO may not be running');
  console.log('  2. Firewall is blocking the connection');
  console.log('  3. IP address may have changed\n');
  
  console.log('To fix, SSH into the server and run:');
  console.log(`  ssh root@${MINIO_HOST}`);
  console.log('  systemctl status minio');
  console.log('  docker ps | grep minio');
  console.log('  netstat -tlnp | grep 900');
}

main();
