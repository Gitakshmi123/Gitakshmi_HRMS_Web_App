require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Applicant = require('./models/Applicant');
const LetterTemplate = require('./models/LetterTemplate');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

const findData = async () => {
    await connectDB();

    try {
        const applicant = await Applicant.findOne({ status: 'Selected' });
        const applicantNoOffer = await Applicant.findOne({ offerLetterPath: { $exists: false } });
        const template = await LetterTemplate.findOne({ type: 'joining' });

        console.log('DATA_START');
        console.log(JSON.stringify({
            validApplicantId: applicant?._id,
            noOfferApplicantId: applicantNoOffer?._id,
            templateId: template?._id
        }));
        console.log('DATA_END');

    } catch (error) {
        console.error(error);
    } finally {
        mongoose.connection.close();
    }
};

findData();
