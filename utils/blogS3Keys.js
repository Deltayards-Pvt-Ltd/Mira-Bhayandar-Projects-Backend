import path from "path";

/** S3 object key for a blog cover image. */
export function buildBlogObjectKey(fileName) {
  const ext = path.extname(fileName || "");
  const base = (fileName || "file")
    .replace(/\s+/g, "_")
    .replace(/\.[^/.]+$/, "");
  return `blogs/${Date.now()}_${base}${ext}`;
}
