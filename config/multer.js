import path from "path";
import multer from "multer";
import multerS3 from "multer-s3";
import { s3Client, s3Bucket, s3StorageClass, isExpressBucket } from "./s3.js";
import { buildProjectObjectKey } from "../utils/projectS3Keys.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (videos / large PDFs)

function blogObjectKey(file) {
  const ext = path.extname(file.originalname);
  const base = file.originalname
    .replace(/\s+/g, "_")
    .replace(/\.[^/.]+$/, "");
  return `blogs/${Date.now()}_${base}${ext}`;
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

const projectStorage = multerS3(
  multerS3Options((req, file, cb) => {
    cb(
      null,
      buildProjectObjectKey(req.body.name, file.fieldname, file.originalname)
    );
  })
);

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
