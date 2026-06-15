const fs = require('fs');

const file = 'D:\\Project\\GT_HRMS\\server\\controllers\\public.controller.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `const applicant = new Applicant({
        applicationId: applicationId,
        tenant: tenantDB.tenantId,`;

const replace1 = `let isOverBudget = false;
      if (expectedCTC && requirement.jobDetails?.salaryMax) {
          const parsedExpected = parseFloat(String(expectedCTC).replace(/[^0-9.]/g, ''));
          const maxCtc = parseFloat(requirement.jobDetails.salaryMax);
          if (!isNaN(parsedExpected) && !isNaN(maxCtc) && parsedExpected > maxCtc) {
              isOverBudget = true;
          }
      }

      const applicant = new Applicant({
        applicationId: applicationId,
        tenant: tenantDB.tenantId,`;

content = content.replace(target1, replace1);

const target2 = `currentDesignation: currentDesignation?.trim(),
        expectedCTC: expectedCTC?.trim(),`;

const replace2 = `currentDesignation: currentDesignation?.trim(),
        expectedCTC: expectedCTC?.trim(),
        isOverBudget: isOverBudget,`;

content = content.replace(target2, replace2);

fs.writeFileSync(file, content);
console.log('Fixed public.controller.js');
