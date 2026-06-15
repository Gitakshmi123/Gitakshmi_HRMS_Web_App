const path=require("path");
require("dotenv").config({path:path.resolve(__dirname,".env")});
const mongoose=require("mongoose");
const Tenant=require("./models/Tenant");
const getTenantDB=require("./utils/tenantDB");
(async()=>{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:8000});
  const tenants=await Tenant.find({status:"active"}).select("_id code dbUri dbName").lean();
  console.log('activeTenants',tenants.length);
  let ok=0, fail=0;
  for(const t of tenants.slice(0,10)){
    try{
      const db=await getTenantDB(t._id);
      ok++;
      const Employee=db.model("Employee");
      const c=await Employee.countDocuments();
      console.log('tenant',t.code,'employees',c);
    }catch(e){
      fail++;
      console.log('tenant',t.code,'ERR',e.message);
    }
  }
  console.log({ok,fail});
  await mongoose.disconnect();
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
