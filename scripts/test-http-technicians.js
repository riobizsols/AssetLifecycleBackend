const axios = require('axios');

(async () => {
  try {
    const url = 'http://localhost:5000/api/inspection-approval/technicians/AT002';
    console.log('Requesting', url);
    const res = await axios.get(url, { timeout: 5000 });
    console.log('Status:', res.status);
    console.dir(res.data, { depth: null });
  } catch (err) {
    if (err.response) {
      console.error('Response error status:', err.response.status);
      console.error(err.response.data);
    } else {
      console.error('Request failed:', err.message);
    }
    process.exit(2);
  }
})();
