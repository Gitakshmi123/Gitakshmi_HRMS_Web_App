const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const EmployeeSchema = require('../models/Employee');
const getTenantDB = require('../utils/tenantDB');

const { stringifyId } = require('../utils/idUtils');

exports.listAll = async function(req, res) {
  try {
    const tenants = await Tenant.find({ status: 'active' }).lean();
    const allEmployees = [];

    // Query each tenant database
    for (const tenant of tenants) {
      try {
        const tenantDB = await getTenantDB(tenant._id);
        const Employee = tenantDB.model('Employee', EmployeeSchema);
        const employees = await Employee.find({ tenant: tenant._id }).lean();
        
        // Add tenant info to each employee and ensure string IDs
        const mappedEmployees = employees.map(emp => ({
          ...emp,
          _id: stringifyId(emp._id),
          tenant: tenant
        }));
        
        allEmployees.push(...mappedEmployees);
      } catch (err) {
        console.error(`Error querying tenant ${tenant.code}:`, err.message);
        // Continue with other tenants
      }
    }

    // Sort by creation date (newest first)
    allEmployees.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    res.json(allEmployees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list all employees' });
  }
};

exports.get = async function(req, res) {
  try {
    const employeeId = req.params.id;
    const tenants = await Tenant.find({ status: 'active' }).lean();

    // Search across all tenant databases
    for (const tenant of tenants) {
      try {
        const tenantDB = await getTenantDB(tenant._id);
        const Employee = tenantDB.model('Employee', EmployeeSchema);
        const employee = await Employee.findOne({ 
          _id: employeeId, 
          tenant: tenant._id 
        }).lean();
        
        if (employee) {
          employee.tenant = tenant;
          return res.json(employee);
        }
      } catch (err) {
        // Continue searching in other tenants
        continue;
      }
    }

    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get employee' });
  }
};
