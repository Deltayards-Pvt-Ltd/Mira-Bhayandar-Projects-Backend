import path from "path";

export function sanitizeProjectName(name) {
  return (name || "unnamed_project").replace(/\s+/g, "_");
}

export function projectSubFolder(fieldname) {
  if (fieldname === "logo") return "logo";
  if (fieldname === "coverImage") return "coverImage";
  if (fieldname === "coverVideo") return "coverVideo";
  if (fieldname === "bannerImage") return "bannerImage";
  if (["galleryImages", "galleryNewImages"].includes(fieldname))
    return "galleryImages";
  if (fieldname === "browcherPdf") return "browcherPdf";
  if (["layoutImages", "newlayoutImages"].includes(fieldname)) return "layouts";
  if (fieldname === "reraCertificate") return "reraCertificate";
  if (fieldname === "ocCertificate") return "ocCertificate";
  return "others";
}

function fileBaseName(originalname) {
  return originalname.replace(/\s+/g, "_").replace(/\.[^/.]+$/, "");
}

/** S3 object key for a project asset (used by multer and presigned uploads). */
export function buildProjectObjectKey(projectName, fieldname, originalname) {
  const safeName = sanitizeProjectName(projectName);
  const subFolder = projectSubFolder(fieldname);
  const ext = path.extname(originalname || "");
  const base = fileBaseName(originalname || "file");
  return `${safeName}/${subFolder}/${Date.now()}_${base}${ext}`;
}
