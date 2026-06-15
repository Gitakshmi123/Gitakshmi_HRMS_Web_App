const mongoose = require('mongoose');

function getModels(reqOrDb) {
  let db;
  if (reqOrDb && reqOrDb.tenantDB) {
    db = reqOrDb.tenantDB;
  } else if (reqOrDb && reqOrDb.model) {
    db = reqOrDb;
  } else if (reqOrDb && reqOrDb.db) {
    db = reqOrDb.db;
  } else {
    throw new Error("Database connection or Request with tenantDB not available for resolving tenant models");
  }

  // Safe Lazy Loading for all required models
  if (!db.models.GeneratedLetter) {
    try { db.model('GeneratedLetter', require('../models/GeneratedLetter')); } catch (e) { }
  }
  if (!db.models.LetterTemplate) {
    try { db.model('LetterTemplate', require('../models/LetterTemplate')); } catch (e) { }
  }
  if (!db.models.Applicant) {
    try { db.model('Applicant', require('../models/Applicant')); } catch (e) { }
  }
  if (!db.models.Candidate) {
    try { db.model('Candidate', require('../models/Candidate')); } catch (e) { }
  }
  if (!db.models.Employee) {
    try { db.model('Employee', require('../models/Employee')); } catch (e) { }
  }
  if (!db.models.CompanyProfile) {
    try { db.model('CompanyProfile', require('../models/CompanyProfile')); } catch (e) { }
  }
  if (!db.models.LetterApproval) {
    try { db.model('LetterApproval', require('../models/LetterApproval')); } catch (e) { }
  }
  if (!db.models.Notification) {
    try { db.model('Notification', require('../models/Notification')); } catch (e) { }
  }
  if (!db.models.SignedLetter) {
    try { db.model('SignedLetter', require('../models/SignedLetter')); } catch (e) { }
  }
  if (!db.models.BGVCase) {
    try { db.model('BGVCase', require('../models/BGVCase')); } catch (e) { }
  }
  if (!db.models.LetterRevocation) {
    try { db.model('LetterRevocation', require('../models/LetterRevocation')); } catch (e) { }
  }
  if (!db.models.EmployeeSalarySnapshot) {
    try { db.model('EmployeeSalarySnapshot', require('../models/EmployeeSalarySnapshot')); } catch (e) { }
  }
  if (!db.models.SalaryAssignment) {
    try { db.model('SalaryAssignment', require('../models/SalaryAssignment')); } catch (e) { }
  }
  if (!db.models.SalaryTemplate) {
    try { db.model('SalaryTemplate', require('../models/SalaryTemplate')); } catch (e) { }
  }
  if (!db.models.User) {
    try { db.model('User', require('../models/User')); } catch (e) { }
  }
  if (!db.models.Approval) {
    try { db.model('Approval', require('../models/Approval')); } catch (e) { }
  }
  if (!db.models.ApprovalWorkflow) {
    try { db.model('ApprovalWorkflow', require('../models/ApprovalWorkflow')); } catch (e) { }
  }
  if (!db.models.ApprovalLog) {
    try { db.model('ApprovalLog', require('../models/ApprovalLog')); } catch (e) { }
  }
  if (!db.models.EmailTemplate) {
    try { db.model('EmailTemplate', require('../models/EmailTemplate')); } catch (e) { }
  }

  return {
    GeneratedLetter: db.model("GeneratedLetter"),
    LetterTemplate: db.model("LetterTemplate"),
    Applicant: db.model("Applicant"),
    Candidate: db.model("Candidate"),
    Employee: db.model("Employee"),
    CompanyProfile: db.model("CompanyProfile"),
    LetterApproval: db.model("LetterApproval"),
    LetterRevocation: db.model("LetterRevocation"),
    EmployeeSalarySnapshot: db.model("EmployeeSalarySnapshot"),
    SalaryAssignment: db.model("SalaryAssignment"),
    SalaryTemplate: db.model("SalaryTemplate"),
    SignedLetter: db.model("SignedLetter"),
    BGVCase: db.model("BGVCase"),
    Notification: db.model("Notification"),
    User: db.model("User"),
    Approval: db.model("Approval"),
    ApprovalWorkflow: db.model("ApprovalWorkflow"),
    ApprovalLog: db.model("ApprovalLog"),
    EmailTemplate: db.model("EmailTemplate")
  };
}

module.exports = {
  getModels
};
