const fs = require('fs');
const path = 'client/src/context/AuthContext.jsx';
let content = fs.readFileSync(path, 'utf8');

// Update loginHR
const loginHRSearch = /const loginHR = useCallback\(async \(\.\.\.args\) => \{[\s\S]*?const \[firstArg, secondArg, thirdArg\] = args;[\s\S]*?const email = args\.length >= 3 \? secondArg : firstArg;[\s\S]*?const password = args\.length >= 3 \? thirdArg : secondArg;[\s\S]*?try \{[\s\S]*?const res = await hrmsApi\.post\("\/auth\/login-hr", \{ email, password \}\);/m;
const loginHRReplace = `const loginHR = useCallback(async (companyCode, email, password) => {
    try {
      const res = await hrmsApi.post("/auth/login-hr", { companyCode, email, password });`;

content = content.replace(loginHRSearch, loginHRReplace);

// Update loginEmployee
const loginEmployeeSearch = /const loginEmployee = useCallback\(async \(\.\.\.args\) => \{[\s\S]*?const \[firstArg, secondArg, thirdArg\] = args;[\s\S]*?const identifier = args\.length >= 3 \? secondArg : firstArg;[\s\S]*?const password = args\.length >= 3 \? thirdArg : secondArg;[\s\S]*?try \{[\s\S]*?const res = await hrmsApi\.post\("\/auth\/login-employee", \{ identifier, password \}\);/m;
const loginEmployeeReplace = `const loginEmployee = useCallback(async (companyCode, identifier, password) => {
    try {
      const res = await hrmsApi.post("/auth/login-employee", { companyCode, identifier, password });`;

content = content.replace(loginEmployeeSearch, loginEmployeeReplace);

fs.writeFileSync(path, content);
console.log('Successfully updated AuthContext.jsx');
