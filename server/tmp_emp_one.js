const path=require('path');
require('dotenv').config({path:path.resolve(__dirname,'.env')});
const mongoose=require('mongoose');
const Tenant=require('./models/Tenant');
const getTenantDB=require('./utils/tenantDB');
(async()=>{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:8000});
  const t=await Tenant.findOne({status:'active'}).select('_id code').lean();
  const db=await getTenantDB(t._id);
  const Employee=db.model('Employee');
  const emp=await Employee.findOne({}).select('employeeId email status firstName lastName password').lean();
  console.log({tenant:t.code,employeeId:emp.employeeId,email:emp.email,status:emp.status,name:(emp.firstName||'')+' '+(emp.lastName||''),passPrefix:String(emp.password||'').slice(0,4),passLen:String(emp.password||'').length});
  await mongoose.disconnect();
})();
