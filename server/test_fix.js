const dateVal = "2026-01-01T18:30:00.000Z"; // This is Jan 2nd in IST
let attendanceDate = new Date(dateVal);

console.log('Original ISO:', attendanceDate.toISOString());
console.log('Local Date:', attendanceDate.getDate()); // Should be 2 if system is IST

// My "Fix"
attendanceDate = new Date(Date.UTC(
    attendanceDate.getFullYear(),
    attendanceDate.getMonth(),
    attendanceDate.getDate(),
    0, 0, 0, 0
));

console.log('Fixed ISO:', attendanceDate.toISOString());
