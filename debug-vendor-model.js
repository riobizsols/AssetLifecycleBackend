const vendorsModel = require('./models/vendorsModel');

(async () => {
  try {
    const vendor = await vendorsModel.getVendorById('V002');
    console.log('Vendor result:', vendor ? 'FOUND' : 'NOT FOUND');
    console.dir(vendor, {depth: null});
  } catch (e) {
    console.error('Error calling model:', e.message);
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
