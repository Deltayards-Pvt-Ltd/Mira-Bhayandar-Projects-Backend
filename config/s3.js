import { S3Client } from "@aws-sdk/client-s3";
import "./loadEnv.js";

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim();
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim();
const AWS_REGION = process.env.AWS_REGION?.trim();
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME?.trim();

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET_NAME) {
  console.warn(
    "⚠️  AWS S3 env vars missing (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME)"
  );
}

/** S3 Express directory buckets always end with --{zone-id}--x-s3 (e.g. my-bucket--aps1-az1--x-s3). */
export const isExpressBucket = /--[a-z0-9-]+--x-s3$/i.test(
  AWS_S3_BUCKET_NAME || ""
);

/** Zone id parsed from bucket name, or AWS_S3_EXPRESS_ZONE_ID for overrides. */
const expressZoneFromBucket = AWS_S3_BUCKET_NAME?.match(
  /--([a-z0-9-]+)--x-s3$/i
)?.[1];
export const s3ExpressZoneId =
  process.env.AWS_S3_EXPRESS_ZONE_ID?.trim() || expressZoneFromBucket || "";

/** Only set on Express uploads; standard buckets use S3 default (STANDARD). */
export const s3StorageClass = isExpressBucket ? "EXPRESS_ONEZONE" : undefined;

export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export const s3Bucket = AWS_S3_BUCKET_NAME;
export const s3Region = AWS_REGION;

/** Public object URL (virtual-hosted style). */
export function getPublicObjectUrl(key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (isExpressBucket && s3ExpressZoneId) {
    return `https://${s3Bucket}.s3express-${s3ExpressZoneId}.${s3Region}.amazonaws.com/${encodedKey}`;
  }
  return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${encodedKey}`;
}
