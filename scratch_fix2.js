const fs = require('fs');
let c = fs.readFileSync('server/controllers/attendanceTracking.controller.js', 'utf8');

c = c.replace(
  'try { await LiveTrackingSession.updateOne({ _id: trackingSession._id }, { $set: trackingSession }); } catch(err) { console.warn("[LOCATION UPDATE]", err.message); }',
  'await trackingSession.save();'
);

c = c.replace(
  /await trackingSession\.save\(\);\s*let trackingPoint/g,
  'try { await LiveTrackingSession.updateOne({ _id: trackingSession._id }, { $set: trackingSession }); } catch(err) { console.warn("[LOCATION UPDATE]", err.message); }\n\n    let trackingPoint'
);

fs.writeFileSync('server/controllers/attendanceTracking.controller.js', c);
console.log('Fixed markAttendance and updateLocation');
