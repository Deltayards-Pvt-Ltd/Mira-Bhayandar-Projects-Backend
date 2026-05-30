import path from "path";

export function sanitizeProjectName(name) {
  return (name || "unnamed_project").replace(/\s+/g, "_");
}

export function projectSubFolder(fieldname) {
  if (fieldname === "logo") return "logo";
  if (fieldname === "builderLogo") return "builderLogo";
  if (fieldname === "coverImage") return "coverImage";
  if (fieldname === "coverVideo") return "coverVideo";
  if (fieldname === "bannerImage") return "bannerImage";
  if (["galleryImages", "galleryNewImages"].includes(fieldname))
    return "galleryImages";
  if (["browcherPdf", "newBrowcherPdfs"].includes(fieldname)) return "browcherPdf";
  if (["layoutImages", "newlayoutImages"].includes(fieldname)) return "layouts";
  if (["reraCertificate", "newReraCertificates"].includes(fieldname))
    return "reraCertificate";
  if (["reraScannerImage", "newReraScannerImages"].includes(fieldname))
    return "reraScannerImage";
  if (fieldname === "ocCertificate") return "ocCertificate";
  if (fieldname === "walkthroughVideo") return "walkthroughVideo";
  return "others";
}

function fileBaseName(originalname) {
  return originalname.replace(/\s+/g, "_").replace(/\.[^/.]+$/, "");
}

/** S3 object key for a project asset (presigned uploads). */
export function buildProjectObjectKey(projectName, fieldname, originalname) {
  const safeName = sanitizeProjectName(projectName);
  const subFolder = projectSubFolder(fieldname);
  const ext = path.extname(originalname || "");
  const base = fileBaseName(originalname || "file");
  return `${safeName}/${subFolder}/${Date.now()}_${base}${ext}`;
}
