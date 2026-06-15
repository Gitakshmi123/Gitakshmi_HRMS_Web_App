const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const {
  buildSsoPayload,
  signSsoToken,
  setSsoCookie,
} = require("../middleware/ssoAuth.middleware");

const ALLOWED_ROLES = [
  "super_admin", "psa", "company_admin", "company_super_admin", "admin", "hr",
  "sub_company_admin", "branch_head", "division_head", "department_head", "designation_head",
  "SUB_COMPANY_ADMIN", "BRANCH_HEAD", "DIVISION_HEAD", "DEPARTMENT_HEAD", "DESIGNATION_HEAD"
];

function toAllowedRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (["psa", "super_admin", "superadmin"].includes(normalized)) return "super_admin";
  if (["sub_company_admin", "branch_head", "division_head", "department_head", "designation_head"].includes(normalized)) return normalized;
  return "company_admin";
}

async function comparePassword(password, storedHash) {
  const value = String(storedHash || "");
  if (!value) return false;
  if (value.startsWith("$2")) return bcrypt.compare(password, value);
  return value === String(password || "");
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const safeEmail = String(email || "").trim().toLowerCase();

    if (!safeEmail || !password) {
      return res.status(400).json({ success: false, message: "email_and_password_required" });
    }

    const User = mongoose.model("User");
    const user = await User.findOne({
      email: safeEmail,
      role: { $in: ALLOWED_ROLES },
    }).lean();

    if (!user) {
      return res.status(401).json({ success: false, message: "invalid_credentials" });
    }

    const passwordOk = await comparePassword(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: "invalid_credentials" });
    }

    const normalizedRole = toAllowedRole(user.role);
    const payload = buildSsoPayload({
      id: user._id,
      email: user.email,
      role: normalizedRole,
      tenantId: user.mainCompanyId,
      companyId: user.mainCompanyId,
      subCompanyId: user.subCompanyId,
      branchId: user.branchId,
      divisionId: user.divisionId,
      departmentId: user.departmentId,
      designationId: user.designationId
    });
    const token = signSsoToken(payload);
    setSsoCookie(res, token);

    return res.json({
      success: true,
      message: "login_successful",
      token,
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        products: payload.products,
      },
    });
  } catch (error) {
    return next(error);
  }
};
