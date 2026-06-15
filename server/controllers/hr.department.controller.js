const mongoose = require('mongoose');

/* ----------------------------------------------------
   HELPER → Get models from tenant database
   Models are already registered by dbManager, just retrieve them
   ---------------------------------------------------- */
function getModels(req) {
  if (!req.tenantDB) {
    throw new Error("Tenant database connection not available");
  }
  const db = req.tenantDB;
  try {
    // Models are already registered by dbManager, just retrieve them
    // Do NOT pass schema - use connection.model(name) only
    return {
      Department: db.model("Department"),
      Employee: db.model("Employee")
    };
  } catch (err) {
    console.error("[hr.department.controller] Error retrieving models:", err.message);
    throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
  }
}

/* ----------------------------------------------------
   LIST DEPARTMENTS (per-tenant)
   ---------------------------------------------------- */
exports.list = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    const { Department, Employee } = getModels(req);

    // Relaxed tenant filter since we are in tenant-specific DB
    const departments = await Department.find(req.hierarchyFilter).sort({ name: 1 }).lean();

    // Aggregate employee count by department — only ACTIVE employees (excluded deactivated/exited)
    const activeStatuses = ['ACTIVE', 'Active', 'active'];

    const counts = await Employee.aggregate([
      { $match: { status: { $in: activeStatuses } } },
      { $group: { _id: "$departmentId", count: { $sum: 1 } } }
    ]);

    const countMap = {};
    counts.forEach(c => {
      if (c._id) countMap[c._id.toString()] = c.count;
    });

    const result = departments.map(d => ({
      ...d,
      employeeCount: countMap[d._id.toString()] || 0
    }));

    res.json({ success: true, count: result.length, data: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list departments" });
  }
};

/* ----------------------------------------------------
   CREATE DEPARTMENT (per-tenant)
   ---------------------------------------------------- */
exports.create = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    if (!req.tenantDB) {
      return res.status(500).json({ error: "Tenant database connection not available" });
    }

    // Use already-registered models on the tenant connection
    const { Department } = getModels(req);

    // console.log("[DEPT_CREATE] Req Body:", req.body);
    const { name, code, status, description, isDefault } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Department name must be at least 2 characters" });
    }

    if (!code || typeof code !== "string" || code.trim().length < 1) {
      return res.status(400).json({ error: "Department code is required" });
    }

    if (name.trim().length > 50) {
      return res.status(400).json({ error: "Department name must be at most 50 characters" });
    }

    // Check for duplicate name or code in same tenant
    const existsName = await Department.findOne({ name: name.trim() });
    if (existsName) {
      return res.status(400).json({ error: "Department name already exists" });
    }

    const existsCode = await Department.findOne({ code: code.trim().toUpperCase() });
    if (existsCode) {
      return res.status(400).json({ error: "Department code already exists" });
    }

    // console.log("[DEPT_CREATE] Saving item...");
    const item = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      status: (status || 'active').toLowerCase(),
      description: (description || "").trim(),
      parentDepartment: req.body.parentDepartment || null,
      head: req.body.head || null,
      budgetedHeadcount: req.body.budgetedHeadcount || 0,
      meta: req.body.meta || {},
      isDefault: Boolean(isDefault),
      mainCompanyId: req.tenantId,
      subCompanyId: req.body.subCompanyId || req.user.subCompanyId || null,
      branchId: req.body.branchId || req.user.branchId || null,
      divisionId: req.body.divisionId || req.user.divisionId || null
    });

    // console.log("[DEPT_CREATE] Success:", item._id);
    res.json({ success: true, data: item });

  } catch (err) {
    console.error("Department create error:", err);
    console.error("Error stack:", err.stack);

    // Handle duplicate name error (MongoDB unique index)
    // Handle duplicate name/code error (MongoDB unique index)
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.code) {
        return res.status(400).json({ error: "Department code already exists" });
      }
      return res.status(400).json({ error: "Department name already exists" });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors || {}).map(e => e.message).join(', ');
      return res.status(400).json({ error: "Validation failed", message: messages });
    }

    // Generic error response
    res.status(500).json({
      error: "Failed to create department",
      message: err.message || "Unknown error occurred"
    });
  }
};

/* ----------------------------------------------------
   UPDATE DEPARTMENT (per-tenant)
   ---------------------------------------------------- */
exports.update = async function (req, res) {
  try {
    // console.log("[DEPT_UPDATE] ID:", req.params.id, "Body:", req.body);
    const tenantId = req.tenantId;
    const { Department, Employee } = getModels(req);

    const updatePayload = {
      name: req.body.name,
      description: req.body.description || "",
      isDefault: req.body.isDefault !== undefined ? Boolean(req.body.isDefault) : undefined
    };

    if (req.body.code) updatePayload.code = req.body.code.trim().toUpperCase();
    if (req.body.status) updatePayload.status = req.body.status.toLowerCase();
    
    // Support all model fields in update
    if (req.body.head !== undefined) updatePayload.head = req.body.head || null;
    if (req.body.parentDepartment !== undefined) updatePayload.parentDepartment = req.body.parentDepartment || null;
    if (req.body.budgetedHeadcount !== undefined) updatePayload.budgetedHeadcount = req.body.budgetedHeadcount || 0;
    if (req.body.meta !== undefined) updatePayload.meta = req.body.meta || {};

    // Validate head (must be an employee within this tenant) when provided
    if (req.body.head) {
      const headExists = await Employee.findOne({ _id: req.body.head }).select('_id').lean();
      if (!headExists) {
        return res.status(400).json({ error: "Department head not found in this tenant" });
      }
    }

    // Check for duplicate code if updating
    if (req.body.code) {
      const existsCode = await Department.findOne({
        code: req.body.code.trim().toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existsCode) {
        return res.status(400).json({ error: "Department code already exists" });
      }
    }

    const updated = await Department.findOneAndUpdate(
      { _id: req.params.id },
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: "Not found" });

    res.json({ success: true, data: updated });

  } catch (err) {
    console.error(err);
    // Handle duplicate name error
    // Handle duplicate name/code error
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.code) {
        return res.status(400).json({ error: "Department code already exists" });
      }
      return res.status(400).json({ error: "Department name already exists" });
    }
    res.status(500).json({ error: "Failed to update department", message: err.message });
  }
};

/* ----------------------------------------------------
   DELETE DEPARTMENT (per-tenant)
   ---------------------------------------------------- */
exports.remove = async function (req, res) {
  try {
    const { Department } = getModels(req);

    const deleted = await Department.findOneAndDelete({
      _id: req.params.id
    });

    if (!deleted) return res.status(404).json({ error: "Not found" });

    res.json({ success: true, data: deleted });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete department" });
  }
};

/* ----------------------------------------------------
   GET FULL ORGANIZATION HIERARCHY (Company → Departments → Managers → Employees)
   Returns nested structure combining departments and employees
   ---------------------------------------------------- */
exports.getFullOrgHierarchy = async function (req, res) {
  try {
    const { Department, Employee } = getModels(req);

    // Fetch all departments with their heads
    const departments = await Department.find({})
      .populate('head', 'firstName lastName email employeeId role department profilePic')
      .populate('parentDepartment', 'name')
      .sort({ name: 1 })
      .lean();

    // Fetch only active employees for hierarchy (excluded deactivated/exited)
    const activeStatuses = ['ACTIVE', 'Active', 'active'];
    const employees = await Employee.find({ status: { $in: activeStatuses } })
      .select('firstName lastName employeeId role department departmentId manager email profilePic joiningDate')
      .populate('manager', 'firstName lastName employeeId role')
      .populate('departmentId', 'name')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    // Build department tree structure
    const deptMap = new Map();
    const rootDepartments = [];

    // First pass: create department nodes
    departments.forEach(dept => {
      deptMap.set(String(dept._id), {
        ...dept,
        employees: [],
        managers: [],
        subDepartments: []
      });
    });

    // Second pass: build department hierarchy
    departments.forEach(dept => {
      const deptNode = deptMap.get(String(dept._id));
      if (dept.parentDepartment) {
        const parentNode = deptMap.get(String(dept.parentDepartment));
        if (parentNode) {
          parentNode.subDepartments.push(deptNode);
        } else {
          rootDepartments.push(deptNode);
        }
      } else {
        rootDepartments.push(deptNode);
      }
    });

    // Third pass: assign employees to departments
    employees.forEach(emp => {
      const empData = {
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeId: emp.employeeId,
        role: emp.role,
        email: emp.email,
        profilePic: emp.profilePic,
        joiningDate: emp.joiningDate,
        manager: emp.manager ? {
          _id: emp.manager._id,
          firstName: emp.manager.firstName,
          lastName: emp.manager.lastName,
          employeeId: emp.manager.employeeId
        } : null,
        subordinates: []
      };

      // Try to find department by departmentId first, then by name
      let targetDept = null;
      if (emp.departmentId) {
        targetDept = deptMap.get(String(emp.departmentId));
      }
      if (!targetDept && emp.department) {
        // Fallback: find by department name
        for (const [deptId, deptNode] of deptMap.entries()) {
          if (deptNode.name === emp.department) {
            targetDept = deptNode;
            break;
          }
        }
      }

      if (targetDept) {
        targetDept.employees.push(empData);
        // If employee is a manager (has subordinates or is department head), add to managers
        const hasSubordinates = employees.some(e =>
          e.manager && String(e.manager._id || e.manager) === String(emp._id)
        );
        if (hasSubordinates || String(targetDept.head?._id) === String(emp._id)) {
          targetDept.managers.push(empData);
        }
      }
    });

    // Build employee reporting hierarchy within each department
    function buildEmployeeHierarchy(employeesList) {
      const empMap = new Map();
      const roots = [];

      employeesList.forEach(emp => {
        empMap.set(String(emp._id), { ...emp, subordinates: [] });
      });

      employeesList.forEach(emp => {
        const empNode = empMap.get(String(emp._id));
        if (emp.manager) {
          const managerId = String(emp.manager._id || emp.manager);
          const managerNode = empMap.get(managerId);
          if (managerNode) {
            managerNode.subordinates.push(empNode);
          } else {
            roots.push(empNode);
          }
        } else {
          roots.push(empNode);
        }
      });

      return roots.length > 0 ? roots : Array.from(empMap.values());
    }

    // Build employee hierarchies for each department
    function processDepartment(deptNode) {
      deptNode.employeeHierarchy = buildEmployeeHierarchy(deptNode.employees);
      deptNode.subDepartments.forEach(subDept => processDepartment(subDept));
    }

    rootDepartments.forEach(dept => processDepartment(dept));

    // Calculate stats
    const stats = {
      totalDepartments: departments.length,
      totalEmployees: employees.length,
      departmentsWithEmployees: departments.filter(d =>
        employees.some(e =>
          (e.departmentId && String(e.departmentId) === String(d._id)) ||
          e.department === d.name
        )
      ).length,
      employeesWithManagers: employees.filter(e => e.manager).length,
      topLevelEmployees: employees.filter(e => !e.manager).length
    };

    res.json({
      success: true,
      hierarchy: rootDepartments,
      stats
    });

  } catch (err) {
    console.error("getFullOrgHierarchy error:", err);
    res.status(500).json({
      error: "Failed to fetch organization hierarchy",
      message: err.message
    });
  }
};
