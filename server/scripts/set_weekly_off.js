const getTenantDB = require('../utils/tenantDB');

(async () => {
    try {
        const tenantId = process.argv[2] || '697c757f5977cdc15b8dd10c';
        console.log('Setting weeklyOffDays to [0,6] for tenant', tenantId);
        const db = await getTenantDB(tenantId);
        const AttendanceSettings = db.model('AttendanceSettings', require('../models/AttendanceSettings'));
        const res = await AttendanceSettings.findOneAndUpdate({ tenant: tenantId }, { $set: { weeklyOffDays: [0, 6] } }, { upsert: true, new: true });
        console.log('Result:', res);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();