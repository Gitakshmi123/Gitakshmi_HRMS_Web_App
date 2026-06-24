// ----------------------------------------------------------
// GET DEPARTMENTS (Tenant + Branch Scoped)
// ----------------------------------------------------------
exports.getDepartments = async (req, res, next) => {
  try {
    const db = req.tenantDB;
    const Department = db.model("Department");
    const Employee = db.model("Employee");

    // Build filter: always scoped to tenant
    const filter = { mainCompanyId: req.tenantId };

    const items = await Department.find(filter)
      .populate({
        path: "head",
        select: "firstName lastName email",
        model: Employee
      });

    res.json({ success: true, data: items });

  } catch (err) { next(err); }
};

// ----------------------------------------------------------
// CREATE DEPARTMENT (Tenant + Branch Scoped)
// ----------------------------------------------------------
exports.createDepartment = async (req, res, next) => {
  try {
    const db = req.tenantDB;
    const Department = db.model("Department");
    const Employee = db.model("Employee");
    const companyIdConfig = require('./companyIdConfig.controller');

    const { name, description, head, code } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50)
      return res.status(400).json({ success: false, message: "Department name must be 2-50 characters" });

    if (description && description.length > 250)
      return res.status(400).json({ success: false, message: "Description must be at most 250 characters" });

    // Generate or resolve department code based on sequence configuration
    let deptCode = code?.trim();
    try {
      const idResult = await companyIdConfig.generateIdInternal({
        tenantId: req.tenantId,
        entityType: 'DEPT',
        increment: false
      });
      const generationMode = idResult.generationMode || 'AUTO';

      if (generationMode === 'AUTO') {
        const incrementResult = await companyIdConfig.generateIdInternal({
          tenantId: req.tenantId,
          entityType: 'DEPT',
          increment: true
        });
        deptCode = incrementResult.id;
      } else if (!deptCode) {
        deptCode = name.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 10) + '_' + Date.now().toString().slice(-4);
      } else {
        deptCode = deptCode.toUpperCase();
      }
    } catch (configErr) {
      console.warn("DEPT ID generation warning, falling back to manual generation:", configErr.message);
      if (!deptCode) {
        deptCode = name.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 10) + '_' + Date.now().toString().slice(-4);
      } else {
        deptCode = deptCode.toUpperCase();
      }
    }

    // Duplicate name inside SAME tenant DB
    const dupFilter = { name: name.trim(), mainCompanyId: req.tenantId };

    const exists = await Department.findOne(dupFilter);
    if (exists)
      return res.status(400).json({ success: false, message: "Department name already exists" });

    // Check head (must be valid employee in this tenant)
    if (head) {
      const emp = await Employee.findById(head);
      if (!emp)
        return res.status(400).json({ success: false, message: "Department head not found" });
    }

    const item = await Department.create({
      name: name.trim(),
      code: deptCode,
      description: description || "",
      head: head || null,
      mainCompanyId: req.tenantId,
      meta: req.body.meta || {}
    });

    res.status(201).json({ success: true, data: item });

  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: "Department name must be unique" });
    next(err);
  }
};

// ----------------------------------------------------------
// UPDATE DEPARTMENT (Tenant Scoped)
// ----------------------------------------------------------
exports.updateDepartment = async (req, res, next) => {
  try {
    const db = req.tenantDB;
    const Department = db.model("Department");
    const Employee = db.model("Employee");

    const { name, description, head } = req.body;
    const id = req.params.id;

    if (name && (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50))
      return res.status(400).json({ success: false, message: "Department name must be 2-50 characters" });

    if (description && description.length > 250)
      return res.status(400).json({ success: false, message: "Description must be at most 250 characters" });

    const duplicate = await Department.findOne({
      name: name?.trim(),
      mainCompanyId: req.tenantId,
      _id: { $ne: id }
    });

    if (duplicate)
      return res.status(400).json({ success: false, message: "Department name already exists" });

    if (head) {
      const emp = await Employee.findById(head);
      if (!emp)
        return res.status(400).json({ success: false, message: "Department head not found" });
    }

    const updateData = {
      name: name?.trim(),
      description: description || "",
      head: head || null,
      meta: req.body.meta || {}
    };

    const item = await Department.findOneAndUpdate(
      { _id: id, mainCompanyId: req.tenantId },
      updateData,
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: item });

  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: "Department name must be unique" });
    next(err);
  }
};

// ----------------------------------------------------------
// DELETE DEPARTMENT (Tenant Scoped)
// ----------------------------------------------------------
exports.deleteDepartment = async (req, res, next) => {
  try {
    const db = req.tenantDB;
    const Department = db.model("Department");

    await Department.findOneAndDelete({ _id: req.params.id, mainCompanyId: req.tenantId });

    res.json({ success: true });

  } catch (err) { next(err); }
};
