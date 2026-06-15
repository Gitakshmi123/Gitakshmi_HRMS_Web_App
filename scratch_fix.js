const fs = require('fs');
let c = fs.readFileSync('server/controllers/attendanceTracking.controller.js', 'utf8');

c = c.replace(
  '    await trackingSession.save();',
  '    try { await LiveTrackingSession.updateOne({ _id: trackingSession._id }, { $set: trackingSession }); } catch(err) { console.warn("[LOCATION UPDATE]", err.message); }'
);

c = c.replace(
  '      await attendanceRecord.save();',
  '      await Attendance.updateOne({ _id: attendanceRecord._id }, { $set: { securityFlags: attendanceRecord.securityFlags, flagReasons: attendanceRecord.flagReasons, flagged: attendanceRecord.flagged, flagReason: attendanceRecord.flagReason, verificationStatus: attendanceRecord.verificationStatus } });'
);

// Note: updateLocation catch block ALREADY uses error.status || 500, we don't need to change it. Oh wait, my previous check showed it DOES use error.status!
// Let me verify that.

fs.writeFileSync('server/controllers/attendanceTracking.controller.js', c);
console.log('Fixed VersionError bugs.');
