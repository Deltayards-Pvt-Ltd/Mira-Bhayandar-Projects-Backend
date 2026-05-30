import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { s3Client, s3Bucket } from "../config/s3.js";

export function isS3AssetUrl(url) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
  return (
    url.includes(s3Bucket) ||
    url.includes("amazonaws.com") ||
    url.includes(".s3express-")
  );
}

/** Extract S3 object key from a stored public URL. */
export function parseS3KeyFromUrl(url) {
  if (!isS3AssetUrl(url)) return null;
  try {
    const u = new URL(url);
    let pathname = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    if (pathname.startsWith(`${s3Bucket}/`)) {
      pathname = pathname.slice(s3Bucket.length + 1);
    }
    return pathname || null;
  } catch {
    return null;
  }
}

export async function deleteS3Object(url) {
  const key = parseS3KeyFromUrl(url);
  if (!key) return;

  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: s3Bucket, Key: key })
    );
  } catch (err) {
    console.warn("S3 delete failed:", key, err?.message || err);
  }
}

export async function deleteS3Objects(urls) {
  const keys = [
    ...new Set((urls || []).map(parseS3KeyFromUrl).filter(Boolean)),
  ];
  if (keys.length === 0) return;

  const chunkSize = 1000;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    try {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: s3Bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    } catch (err) {
      console.warn("S3 batch delete failed:", err?.message || err);
    }
  }
}

const PROJECT_SCALAR_KEYS = [
  "logo",
  "builderLogo",
  "coverImage",
  "coverVideo",
  "bannerImage",
  "ocCertificate",
  "walkthroughVideo",
];

export function collectProjectAssetUrls(project) {
  if (!project) return [];
  const urls = [];

  for (const key of PROJECT_SCALAR_KEYS) {
    if (project[key]) urls.push(project[key]);
  }
  for (const g of project.galleryImages || []) {
    if (g?.image) urls.push(g.image);
  }
  for (const l of project.layouts || []) {
    if (Array.isArray(l?.images) && l.images.length) {
      for (const img of l.images) {
        if (img) urls.push(img);
      }
    } else if (l?.image) {
      urls.push(l.image);
    }
  }
  const browcher = project.browcherPdf;
  if (typeof browcher === "string" && browcher.trim()) {
    urls.push(browcher.trim());
  } else {
    for (const b of browcher || []) {
      if (b?.file) urls.push(b.file);
    }
  }
  for (const r of project.reraCertificate || []) {
    if (r?.file) urls.push(r.file);
  }
  for (const s of project.reraScannerImage || []) {
    if (s?.image) urls.push(s.image);
  }

  return urls;
}

export function diffUrlsToDelete(oldUrls, newUrls) {
  const newSet = new Set((newUrls || []).filter(Boolean));
  return (oldUrls || []).filter(
    (u) => u && isS3AssetUrl(u) && !newSet.has(u)
  );
}
