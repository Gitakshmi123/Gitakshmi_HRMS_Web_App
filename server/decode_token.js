const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NWQ0YTZjNDA5ZjkzMDFhMGRmOWExZCIsImVtYWlsIjoiZ29vZ2xlQGdtYWlsLmNvbSIsInJvbGUiOiJociIsImNvbXBhbnlDb2RlIjoiZ29vMDAxIiwidGVuYW50SWQiOiI2OTVkNGE2YzQwOWY5MzAxYTBkZjlhMWQiLCJpYXQiOjE3NzEzMTk1NjIsImV4cCI6MTc3MzkxMTU2Mn0.5CqUZGeHKGHMJ5EAo7gCVnbF9rMSh1Lv7CcnG8DovmM";
const payload = token.split('.')[1];
const decoded = Buffer.from(payload, 'base64').toString();
console.log(JSON.parse(decoded));
