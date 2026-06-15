const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const db = mongoose.connection.useDb('company_pnr');
        const Earning = db.collection('salarycomponents');
        const Benefit = db.collection('benefitcomponents');
        
        // 1. Deactivate Minimum Wage
        await Earning.updateOne({ name: 'Minimum Wage' }, { $set: { isActive: false } });
        console.log('Deactivated Minimum Wage');
        
        // 2. Move Leave Encashment from Earning to Benefit
        const leaveEncash = await Earning.findOne({ name: 'Leave Encashment' });
        if (leaveEncash) {
            await Earning.deleteOne({ _id: leaveEncash._id });
            await Benefit.updateOne(
                { name: 'Leave Encashment' },
                {
                    $set: {
                        tenantId: leaveEncash.tenantId,
                        name: 'Leave Encashment',
                        code: 'LEAVE_ENCASHMENT',
                        calculationType: 'FLAT',
                        value: 1538,
                        isActive: true
                    }
                },
                { upsert: true }
            );
            console.log('Moved Leave Encashment to benefits');
        }
        
        // 3. Update Basic
        await Earning.updateOne(
            { name: 'Basic' },
            { $set: { calculationType: 'PERCENTAGE_OF_CTC', percentage: 46.48 } }
        );
        console.log('Updated Basic to 46.48% of CTC');
        
        // 4. Update HRA @ 50%
        await Earning.updateOne(
            { name: { $regex: /HRA/i } },
            { $set: { calculationType: 'PERCENTAGE_OF_BASIC', percentage: 50 } }
        );
        console.log('Updated HRA to 50% of Basic');
        
        // 5. Update Conveyance Allowance @ 15%
        await Earning.updateOne(
            { name: { $regex: /Conveyance/i } },
            { $set: { calculationType: 'PERCENTAGE_OF_BASIC', percentage: 15 } }
        );
        console.log('Updated Conveyance to 15% of Basic');
        
        // 6. Update Compensatory
        await Earning.updateOne(
            { name: { $regex: /Compensatory/i } },
            { $set: { calculationType: 'FIXED', amount: 2170, value: 2170 } }
        );
        console.log('Updated Compensatory to flat 2170');
        
        // 7. Update Bonus
        await Earning.updateOne(
            { name: { $regex: /Bonus/i } },
            { $set: { calculationType: 'FIXED', amount: 1110, value: 1110 } }
        );
        console.log('Updated Bonus to flat 1110');
        
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
