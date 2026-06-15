const mongoose = require('mongoose');

// Execute data migration
mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0')
    .then(async () => {
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({});

        for (let t of tenants) {
            if (!t.code || String(t.code).startsWith('tenant_') || String(t.code).length > 10) {
                const newCode = "CO" + Math.random().toString(36).substring(2, 6).toUpperCase();
                console.log('Updating', t.companyName || t.name, 'from', t.code, 'to', newCode);
                await Tenant.updateOne({ _id: t._id }, { $set: { code: newCode } });
            } else {
                console.log('Keeping valid code', t.companyName || t.name, 'code:', t.code);
            }
        }

        console.log('Database Company Codes cleaned perfectly!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Mongo Error:', err);
        process.exit(1);
    });
