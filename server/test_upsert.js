const mongoose = require('mongoose');
const { Schema } = mongoose;
mongoose.connect('mongodb://127.0.0.1:27017/tenant_test_3').then(async () => {
    const db = mongoose.connection;
    const schema = new Schema({
        applicantId: Schema.Types.ObjectId,
        status: { type: String, enum: ['Pending', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' }
    });
    const Model = db.model('TestModel', schema);
    try {
        const doc = await Model.findOneAndUpdate(
            { applicantId: new mongoose.Types.ObjectId(), status: { $in: ['Pending', 'Submitted', 'Rejected'] } },
            { $set: { status: 'Pending' } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('Successfully created:', doc);
    } catch(e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
});
