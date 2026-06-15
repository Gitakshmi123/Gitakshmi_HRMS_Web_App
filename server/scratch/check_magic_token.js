require('dotenv').config();
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { getModels } = require('../utils/tenantUtils');
const { getWorkflowModels } = require('../services/workflowRuntimeCore.service');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tenantId = '6a0c43ab3245aa33f5c2a410';
  const tenantDB = await getTenantDB(tenantId);
  const { WorkflowAssignment, WorkflowInstance } = getWorkflowModels(tenantDB);
  const { GeneratedLetter, Applicant } = getModels(tenantDB);

  const token = '114e992b1c2d59b5f35fef894cf0b165';
  const fullToken = `${tenantId}_${token}`;

  const assignment = await WorkflowAssignment.findOne({ magicToken: { $regex: token } });
  console.log('--- WORKFLOW ASSIGNMENT ---');
  console.log(JSON.stringify(assignment, null, 2));

  if (assignment) {
    const instance = await WorkflowInstance.findById(assignment.instanceId);
    console.log('--- WORKFLOW INSTANCE ---');
    console.log(JSON.stringify(instance, null, 2));

    if (instance) {
      const letter = await GeneratedLetter.findById(instance.entityId);
      console.log('--- GENERATED LETTER ---');
      console.log(JSON.stringify(letter, null, 2));

      const applicant = await Applicant.findById(instance.contextSnapshot?.applicantId);
      console.log('--- APPLICANT ---');
      console.log(JSON.stringify(applicant, null, 2));
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
