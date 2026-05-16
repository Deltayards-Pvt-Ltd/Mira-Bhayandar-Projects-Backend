import cloudinary from "../config/cloudinary.js";

const CLOUDINARY_HOST = "res.cloudinary.com";

export function isCloudinaryUrl(url) {
  return typeof url === "string" && url.includes(CLOUDINARY_HOST);
}

/** Parse public_id + resource_type from a Cloudinary secure_url. */
export function parseCloudinaryAsset(url) {
  if (!isCloudinaryUrl(url)) return null;

  const resourceType = url.includes("/video/")
    ? "video"
    : url.includes("/raw/")
      ? "raw"
      : "image";

  const afterUpload = url.split("/upload/")[1];
  if (!afterUpload) return null;

  let publicId = afterUpload.replace(/^v\d+\//, "");
  publicId = publicId.replace(/\.[^/.]+$/, "");

  return { publicId, resourceType };
}

export async function destroyCloudinaryUrl(url) {
  const parsed = parseCloudinaryAsset(url);
  if (!parsed) return;

  try {
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType,
      invalidate: true,
    });
  } catch (err) {
    console.warn("Cloudinary destroy failed:", parsed.publicId, err?.message || err);
  }
}

export async function destroyCloudinaryUrls(urls) {
  const unique = [...new Set((urls || []).filter(isCloudinaryUrl))];
  await Promise.all(unique.map((url) => destroyCloudinaryUrl(url)));
}

const PROJECT_SCALAR_KEYS = [
  "logo",
  "coverImage",
  "coverVideo",
  "bannerImage",
  "browcherPdf",
  "reraCertificate",
  "ocCertificate",
];

/** Collect every asset URL stored on a project document. */
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
    if (l?.image) urls.push(l.image);
  }

  return urls;
}

/** URLs present before update but not after — safe to delete from Cloudinary. */
export function diffUrlsToDelete(oldUrls, newUrls) {
  const newSet = new Set((newUrls || []).filter(Boolean));
  return (oldUrls || []).filter((u) => u && isCloudinaryUrl(u) && !newSet.has(u));
}
