import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

function sanitizeName(name) {
  return (name || "unnamed_project").replace(/\s+/g, "_");
}

function projectSubFolder(fieldname) {
  if (fieldname === "logo") return "logo";
  if (fieldname === "coverImage") return "coverImage";
  if (fieldname === "coverVideo") return "coverVideo";
  if (fieldname === "bannerImage") return "bannerImage";
  if (["galleryImages", "galleryNewImages"].includes(fieldname)) return "galleryImages";
  if (fieldname === "browcherPdf") return "browcherPdf";
  if (["layoutImages", "newlayoutImages"].includes(fieldname)) return "layouts";
  if (fieldname === "reraCertificate") return "reraCertificate";
  if (fieldname === "ocCertificate") return "ocCertificate";
  return "others";
}

function resourceTypeForField(fieldname) {
  if (fieldname === "coverVideo") return "video";
  if (["browcherPdf", "reraCertificate", "ocCertificate"].includes(fieldname)) return "raw";
  return "image";
}

function publicIdFromFile(file) {
  const base = file.originalname
    .replace(/\s+/g, "_")
    .replace(/\.[^/.]+$/, "");
  return `${Date.now()}_${base}`;
}

const projectStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const projectName = sanitizeName(req.body.name);
    const subFolder = projectSubFolder(file.fieldname);
    return {
      folder: `${projectName}/${subFolder}`,
      public_id: publicIdFromFile(file),
      resource_type: resourceTypeForField(file.fieldname),
    };
  },
});

const blogStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "blogs",
    public_id: publicIdFromFile(file),
    resource_type: "image",
  }),
});

export const upload = multer({ storage: projectStorage });
export const blogUpload = multer({ storage: blogStorage });
