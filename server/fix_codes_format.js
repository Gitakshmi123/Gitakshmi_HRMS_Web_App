const mongoose = require('mongoose');

// Execute data migration
mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0')
    .then(async () => {
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({}).sort({ createdAt: 1 }); // Sort by created auth so earlier gets 001

        // Group to keep track of sequences
        const sequences = {};

        for (let t of tenants) {
            const name = t.companyName || t.name || 'cmp';
            const prefix = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toLowerCase() || 'cmp';

            if (!sequences[prefix]) sequences[prefix] = 0;
            sequences[prefix]++;

            const newCode = `${prefix}${String(sequences[prefix]).padStart(3, '0')}`;

            console.log('Updating', name, 'from', t.code, 'to', newCode);
            await Tenant.updateOne({ _id: t._id }, { $set: { code: newCode } });
        }

        console.log('Database Company Codes standardized to prefix+001 format!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Mongo Error:', err);
        process.exit(1);
    });
