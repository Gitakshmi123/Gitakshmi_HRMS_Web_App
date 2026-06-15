const fs = require("fs");
const path = require("path");
const CloudinaryService = require("../services/CloudinaryService");

exports.uploadLogo = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || req.user?.tenant || "public";

    if (!req.file)
      return res.status(400).json({ success: false, message: "no_file" });

    // 1. Try Cloudinary first if configured
    if (CloudinaryService.isConfigured()) {
      try {
        const result = await CloudinaryService.uploadFile(
          req.file.path,
          `hrms/${tenantId}/branding`,
          true // cleanup local file
        );
        return res.json({ success: true, url: result.url });
      } catch (cloudError) {
        console.warn("Cloudinary upload failed, falling back to local:", cloudError.message);
        // continue to local fallback
      }
    }

    // 2. Local Fallback
    let url;
    if (tenantId && tenantId !== "public") {
      const tenantDir = path.join(__dirname, '..', 'uploads', tenantId.toString());
      if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });
      const newPath = path.join(tenantDir, req.file.filename);
      fs.renameSync(req.file.path, newPath);
      url = `/uploads/${tenantId}/${req.file.filename}`;
    } else {
      url = `/uploads/${req.file.filename}`;
    }

    res.json({ success: true, url });
  } catch (err) {
    console.error("Upload error:", err);
    next(err);
  }
};
