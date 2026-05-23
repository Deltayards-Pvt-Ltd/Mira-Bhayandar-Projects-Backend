/** Collect image URLs from layout (supports legacy single `image`). */
export function layoutImageUrls(layout) {
  if (!layout) return [];
  const fromArray = Array.isArray(layout.images)
    ? layout.images.map((u) => String(u || "").trim()).filter(Boolean)
    : [];
  if (fromArray.length) return fromArray;
  const single = String(layout.image || "").trim();
  return single ? [single] : [];
}

/** Normalize layout payload before save. */
export function normalizeLayoutForSave(layout) {
  const title = String(layout?.title || "").trim();
  const images = layoutImageUrls(layout);
  const areaRaw = layout?.area;
  const area =
    areaRaw === undefined || areaRaw === null || areaRaw === ""
      ? ""
      : String(areaRaw).trim();
  const priceRaw = layout?.price;
  const price =
    priceRaw === undefined || priceRaw === null || priceRaw === ""
      ? undefined
      : Number(priceRaw);

  return {
    title,
    area,
    price: price !== undefined && Number.isFinite(price) ? price : undefined,
    images,
    image: images[0] || "",
  };
}

export function normalizeLayoutsForSave(layouts) {
  if (!Array.isArray(layouts)) return [];
  return layouts.map(normalizeLayoutForSave);
}
