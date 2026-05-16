import path from "path";
import multer from "multer";
import multerS3 from "multer-s3";
import { s3Client, s3Bucket, s3StorageClass, isExpressBucket } from "./s3.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (videos / large PDFs)

function sanitizeName(name) {
  return (name || "unnamed_project").replace(/\s+/g, "_");
}

function projectSubFolder(fieldname) {
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
  return originalname
    .replace(/\s+/g, "_")
    .replace(/\.[^/.]+$/, "");
}

function projectObjectKey(req, file) {
  const projectName = sanitizeName(req.body.name);
  const subFolder = projectSubFolder(file.fieldname);
  const ext = path.extname(file.originalname);
  return `${projectName}/${subFolder}/${Date.now()}_${fileBaseName(file.originalname)}${ext}`;
}

function blogObjectKey(file) {
  const ext = path.extname(file.originalname);
  return `blogs/${Date.now()}_${fileBaseName(file.originalname)}${ext}`;
}

function multerS3Options(keyFn) {
  return {
    s3: s3Client,
    bucket: s3Bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    ...(s3StorageClass && { storageClass: s3StorageClass }),
    ...(isExpressBucket && {
      acl: (_req, _file, cb) => cb(null, undefined),
    }),
    key: keyFn,
  };
}

const projectStorage = multerS3(multerS3Options((req, file, cb) => {
  cb(null, projectObjectKey(req, file));
}));

const blogStorage = multerS3(multerS3Options((_req, file, cb) => {
  cb(null, blogObjectKey(file));
}));

export const upload = multer({
  storage: projectStorage,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const blogUpload = multer({
  storage: blogStorage,
  limits: { fileSize: MAX_FILE_SIZE },
});
