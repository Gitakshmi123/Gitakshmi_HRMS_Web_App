const mongoose = require('mongoose');
const ShiftMasterSchema = require('./models/ShiftMaster');
const ShiftPolicySchema = require('./models/ShiftPolicy');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://nitesh:nitesh@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0");
        const ShiftMaster = mongoose.model('ShiftMaster', ShiftMasterSchema);
        
        const shiftMasterData = {
            name: "Test Shift",
            code: "TEST1",
            type: "Morning",
            status: "Active",
            coreTiming: {
                startTime: "10:00",
                endTime: "19:00",
                isNightShiftAcrossMidnight: false
            },
            workingHours: {
                minimumHoursForFullDay: 480,
                minimumHoursForHalfDay: 240
            },
            tenant: '60c72b2f9b1d8b0015a5a123'
        };

        const newShift = new ShiftMaster(shiftMasterData);
        await newShift.validate();
        console.log("Validation passed!");
        
        // await newShift.save();
        console.log("Save passed!");
    } catch (err) {
        console.error("VALIDATION ERROR:", err);
    } finally {
        mongoose.disconnect();
    }
}

test();
