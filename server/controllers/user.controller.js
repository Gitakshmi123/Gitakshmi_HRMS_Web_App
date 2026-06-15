const UserSchema = require("../models/User"); 
const getTenantDB = require("../utils/tenantDB");

/* ---------------------------------------------------
   LIST USERS (TENANT SCOPED)
--------------------------------------------------- */
exports.getUsers = async (req, res, next) => {
  try {
    const db = await getTenantDB(req.tenantId); 
    const User = db.model("User", UserSchema);

    const users = await User.find({ mainCompanyId: req.tenantId }).sort({ createdAt: -1 });

    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

/* ---------------------------------------------------
   GET SINGLE USER
--------------------------------------------------- */
exports.getUser = async (req, res, next) => {
  try {
    const db = await getTenantDB(req.tenantId);
    const User = db.model("User", UserSchema);

    const user = await User.findOne({ _id: req.params.id, mainCompanyId: req.tenantId });

    if (!user)
      return res.status(404).json({ success: false, message: "not_found" });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/* ---------------------------------------------------
   CREATE USER (TENANT-SCOPED)
--------------------------------------------------- */
exports.createUser = async (req, res, next) => {
  try {
    const db = await getTenantDB(req.tenantId);
    const User = db.model("User", UserSchema);

    const user = await User.create({
      ...req.body,
      mainCompanyId: req.tenantId,
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/* ---------------------------------------------------
   UPDATE USER
--------------------------------------------------- */
exports.updateUser = async (req, res, next) => {
  try {
    const db = await getTenantDB(req.tenantId);
    const User = db.model("User", UserSchema);

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, mainCompanyId: req.tenantId },
      req.body,
      { new: true }
    );

    if (!user)
      return res.status(404).json({ success: false, message: "not_found" });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/* ---------------------------------------------------
   DELETE USER
--------------------------------------------------- */
exports.deleteUser = async (req, res, next) => {
  try {
    const db = await getTenantDB(req.tenantId);
    const User = db.model("User", UserSchema);

    const deleted = await User.findOneAndDelete({ _id: req.params.id, mainCompanyId: req.tenantId });

    if (!deleted)
      return res.status(404).json({ success: false, message: "not_found" });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
