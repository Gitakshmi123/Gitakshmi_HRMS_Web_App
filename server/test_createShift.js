const mongoose = require('mongoose');
const { createShift } = require('./controllers/shiftMaster.controller');
require('dotenv').config();

async function test() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://nitesh:nitesh@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0");

    const req = {
        tenantId: '60c72b2f9b1d8b0015a5a123',
        tenantDB: mongoose.connection,
        user: { id: new mongoose.Types.ObjectId().toString(), tenantId: '60c72b2f9b1d8b0015a5a123' },
        body: {
            shiftMaster: {
                name: "Test Shift from Controller",
                code: "TEST_CTRL_01",
                type: "Morning",
                status: "Active",
                validFrom: new Date(),
                coreTiming: {
                    startTime: "10:00",
                    endTime: "19:00",
                    isNightShiftAcrossMidnight: false
                },
                workingHours: {
                    minimumHoursForFullDay: 480,
                    minimumHoursForHalfDay: 240
                }
            },
            policyRules: null
        }
    };

    const res = {
        status: function(code) {
            console.log("STATUS:", code);
            return this;
        },
        json: function(data) {
            console.log("JSON:", JSON.stringify(data, null, 2));
        }
    };

    try {
        await createShift(req, res);
    } catch (err) {
        console.error("Uncaught Error:", err);
    } finally {
        mongoose.disconnect();
    }
}

test();
