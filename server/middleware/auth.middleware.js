const jwt = require("jsonwebtoken");

/**
 * Middleware to verify JWT token and HRMS product access
 */
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Use SSO_JWT_SECRET if provided, fallback to JWT_SECRET
    const secret = process.env.SSO_JWT_SECRET || process.env.JWT_SECRET || "hrms@123";
    const decoded = jwt.verify(token, secret);

    // Requirement: Check if user has access to HRMS product
    const requiredProduct = process.env.SSO_REQUIRED_PRODUCT || "HRMS";
    if (!decoded.products || !decoded.products.includes(requiredProduct)) {
      console.warn(`[Auth] Access Denied for ${decoded.email}: ${requiredProduct} not in products [${decoded.products || ""}]`);
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied: You do not have an active HRMS subscription." 
      });
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }
};
