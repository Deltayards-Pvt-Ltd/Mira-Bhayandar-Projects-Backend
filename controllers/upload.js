import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  s3Client,
  s3Bucket,
  s3StorageClass,
  getPublicObjectUrl,
} from "../config/s3.js";
import { buildProjectObjectKey } from "../utils/projectS3Keys.js";

const MAX_PRESIGN_FILES = 50;
const PRESIGN_EXPIRES_SEC = 900;

/**
 * Returns presigned PUT URLs so the admin client uploads directly to S3
 * (avoids Vercel's ~4.5 MB request body limit).
 */
export const presignProjectUploads = async (req, res) => {
  try {
    const { projectName, files } = req.body;

    if (!projectName?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "projectName is required" });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "files array is required" });
    }
    if (files.length > MAX_PRESIGN_FILES) {
      return res.status(400).json({
        success: false,
        message: `At most ${MAX_PRESIGN_FILES} files per request`,
      });
    }

    const uploads = await Promise.all(
      files.map(async (f) => {
        const field = f?.field;
        const fileName = f?.fileName || f?.originalName;
        if (!field || !fileName) {
          throw new Error("Each file needs field and fileName");
        }

        const key = buildProjectObjectKey(projectName, field, fileName);
        const contentType = f.contentType || "application/octet-stream";

        const command = new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          ContentType: contentType,
          ...(s3StorageClass && { StorageClass: s3StorageClass }),
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
          expiresIn: PRESIGN_EXPIRES_SEC,
        });

        return {
          field,
          key,
          uploadUrl,
          publicUrl: getPublicObjectUrl(key),
        };
      })
    );

    res.json({ success: true, uploads });
  } catch (err) {
    console.error("presignProjectUploads:", err);
    res.status(400).json({
      success: false,
      message: err.message || "Failed to create upload URLs",
    });
  }
};
