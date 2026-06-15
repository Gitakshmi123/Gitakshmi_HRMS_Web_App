const fs = require('fs');
const path = 'server/controllers/auth.controller.js';
let content = fs.readFileSync(path, 'utf8');

const search = /async function resolveActiveTenant\(tenantId, companyCode = null\) \{[\s\S]*?if \(companyCode\) \{[\s\S]*?const tenant = await Tenant\.findOne\(\{ code: companyCode \}\)\.lean\(\);[\s\S]*?if \(tenant\) return tenant;[\s\S]*?\}[\s\S]*?return null;[\s\S]*?\}/m;

const replace = `async function resolveActiveTenant(tenantId, companyCode = null) {
  if (tenantId && mongoose.Types.ObjectId.isValid(String(tenantId))) {
    const tenant = await Tenant.findById(tenantId).lean();
    if (tenant) return tenant;
  }

  if (companyCode) {
    const tenant = await Tenant.findOne({
      code: { $regex: new RegExp(\`^\${escapeRegex(companyCode)}$\`, 'i') },
    }).lean();
    if (tenant) return tenant;
  }

  return null;
}`;

if (search.test(content)) {
  content = content.replace(search, replace);
  fs.writeFileSync(path, content);
  console.log('Successfully updated resolveActiveTenant');
} else {
  console.error('Could not find resolveActiveTenant pattern');
  // Try a simpler search
  const simplerSearch = /const tenant = await Tenant\.findOne\(\{ code: companyCode \}\)\.lean\(\);/g;
  if (simplerSearch.test(content)) {
      content = content.replace(simplerSearch, `const tenant = await Tenant.findOne({ code: { $regex: new RegExp(\`^\${escapeRegex(companyCode)}$\`, 'i') } }).lean();`);
      fs.writeFileSync(path, content);
      console.log('Successfully updated using simpler search');
  } else {
      console.error('Simpler search also failed');
  }
}
