const axios = require('axios');

const TMS_URL = 'http://localhost:5002';
const email = 'baldaniyanitesh2003@gmail.com';
const companyId = '69ddd0f7800b442c114befbe';
const KEY = 'hrms_secret_key_999';

async function test() {
  try {
    const res = await axios.post(`${TMS_URL}/api/v1/integrations/hrms/dashboard`, {
       email,
       companyId,
       includeCompleted: true
    }, {
       headers: { 'x-integration-key': KEY }
    });
    const w = res.data.data.workspaces[0];
    console.log('WORKSPACES COUNT:', res.data.data.workspaces.length);
    console.log('WS PROJECTS:', w?.projects?.length);
    console.log('WS TASKS:', w?.tasks?.length);
    if (w?.projects?.length > 0) console.log('FIRST PROJECT:', w.projects[0].name);
  } catch (err) {
    if (err.response) {
      console.error('ERROR DATA:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERROR OBJECT:', err);
    }
  }
}

test();
