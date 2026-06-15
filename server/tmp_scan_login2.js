const path=require("path");
require("dotenv").config({path:path.resolve(__dirname,".env")});
const mongoose=require("mongoose");
const Tenant=require("./models/Tenant");
const getTenantDB=require("./utils/tenantDB");
(async()=>{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:8000});
  const needle="1234";
  const tenants=await Tenant.find({status:"active"}).select("_id code").lean();
  const found=[];
  for(const t of tenants){
    try{
      const db=await getTenantDB(t._id);
      const Employee=db.model("Employee");
      const emp=await Employee.findOne({ employeeId: new RegExp(needle,'i') }).select('employeeId email status firstName lastName password').lean();
      if(emp){
        const pass=String(emp.password||"");
        found.push({tenant:t.code,employeeId:emp.employeeId,email:emp.email,name:`${emp.firstName||''} ${emp.lastName||''}`.trim(),status:emp.status,passPrefix:pass.slice(0,4),passLen:pass.length});
      }
    }catch(e){}
  }
  console.log(JSON.stringify(found,null,2));
  await mongoose.disconnect();
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
