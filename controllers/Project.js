import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import projectModel, {
  PROJECT_STATUSES,
  PROPERTY_TYPES,
} from "../models/project.js";
import {
  collectProjectAssetUrls,
  diffUrlsToDelete,
  deleteS3Objects,
  isS3AssetUrl,
  parseS3KeyFromUrl,
} from "../utils/s3Assets.js";
import { buildProjectFilterOptions } from "../utils/projectFilters.js";
import { normalizeLayoutsForSave } from "../utils/layoutNormalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(path.join(__dirname, "..", "uploads"));

function parseStatus(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "Under Construction";
  if (!PROJECT_STATUSES.includes(s)) {
    return { error: `Status must be one of: ${PROJECT_STATUSES.join(", ")}` };
  }
  return s;
}

function parseContactNumber(v) {
  return typeof v === "string" ? v.trim() : "";
}

function parseReraNo(v) {
  return typeof v === "string" ? v.trim() : "";
}

function parseAddress(v) {
  return typeof v === "string" ? v.trim() : "";
}

function parsePropertyType(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (!PROPERTY_TYPES.includes(s)) {
    return {
      error: `Property type must be one of: ${PROPERTY_TYPES.join(", ")}`,
    };
  }
  return s;
}

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Legacy single URL → one titled entry. */
function normalizeReraCertificates(val) {
  if (!val) return [];
  if (typeof val === "string" && val.trim()) {
    return [{ title: "Project", file: val.trim() }];
  }
  return Array.isArray(val) ? val : [];
}

function normalizeReraScannerImages(val) {
  if (!val) return [];
  if (typeof val === "string" && val.trim()) {
    return [{ title: "Project", image: val.trim() }];
  }
  return Array.isArray(val) ? val : [];
}

function validateTitledAssets(items, label, fileKey) {
  if (!Array.isArray(items)) {
    return { error: `${label} must be an array` };
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.title?.trim()) {
      return { error: `${label} ${i + 1}: title is required` };
    }
    if (!item?.[fileKey]) {
      return { error: `${label} ${i + 1}: ${fileKey} is required` };
    }
  }
  return items.map((item) => ({
    title: item.title.trim(),
    [fileKey]: item[fileKey],
  }));
}

/** Optional WGS84 coordinate from multipart / JSON body. */
function parseCoord(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseActive(v, defaultVal = true) {
  if (v === undefined || v === null) return defaultVal;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === true || v === 1 || v === "1") return true;
  if (v === "false" || v === false || v === 0 || v === "0") return false;
  return defaultVal;
}

/** Public routes only return projects visible on the website. */
function publicProjectQuery() {
  return { active: { $ne: false } };
}

const createProject = async (req, res) => {
  try {
    const {
      name,
      builder,
      location,
      description,
      features,
      reraMonth,
      reraYear,
      reraNo,
      status,
      contactNumber,
      address,
      propertyType,
    } = req.body;

    const parsedStatus = parseStatus(status);
    if (parsedStatus?.error) {
      return res.status(400).json({ success: false, message: parsedStatus.error });
    }

    const parsedPropertyType = parsePropertyType(propertyType);
    if (parsedPropertyType?.error) {
      return res.status(400).json({ success: false, message: parsedPropertyType.error });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!description?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Description is required" });
    }

    const galleryPaths = parseJsonField(req.body.galleryImages, []);
    if (!Array.isArray(galleryPaths)) {
      return res.status(400).json({ success: false, message: "galleryImages must be an array" });
    }

    const pdfPath = req.body.browcherPdf || "";
    const logoPath = req.body.logo || "";
    if (!logoPath) {
      return res.status(400).json({ success: false, message: "Logo is required" });
    }

    const coverImagePath = req.body.coverImage || "";
    const coverVideoPath = req.body.coverVideo || "";
    const bannerImagePath = req.body.bannerImage || "";
    const reraCertificates = validateTitledAssets(
      normalizeReraCertificates(parseJsonField(req.body.reraCertificate, [])),
      "RERA certificate",
      "file"
    );
    if (reraCertificates?.error) {
      return res.status(400).json({ success: false, message: reraCertificates.error });
    }

    const reraScannerImages = validateTitledAssets(
      normalizeReraScannerImages(parseJsonField(req.body.reraScannerImage, [])),
      "RERA scanner image",
      "image"
    );
    if (reraScannerImages?.error) {
      return res.status(400).json({ success: false, message: reraScannerImages.error });
    }

    const ocCertPath = req.body.ocCertificate || "";

    const layoutsRaw = parseJsonField(req.body.layouts, []);
    if (!Array.isArray(layoutsRaw)) {
      return res.status(400).json({ success: false, message: "Layouts must be an array" });
    }
    const layouts = normalizeLayoutsForSave(layoutsRaw);
    for (let i = 0; i < layouts.length; i++) {
      const l = layouts[i];
      if (!l?.title?.trim()) {
        return res
          .status(400)
          .json({ success: false, message: `Layout ${i + 1}: title is required` });
      }
    }

    const yearNum =
      reraYear !== undefined && reraYear !== "" && !Number.isNaN(Number(reraYear))
        ? Number(reraYear)
        : undefined;

    const parsedFeatures = parseJsonField(features, []);
    if (!Array.isArray(parsedFeatures)) {
      return res.status(400).json({ success: false, message: "features must be an array" });
    }

    const project = new projectModel({
      name,
      builder,
      location,
      address: parseAddress(address),
      propertyType: parsedPropertyType,
      status: parsedStatus,
      contactNumber: parseContactNumber(contactNumber),
      latitude: parseCoord(req.body.latitude),
      longitude: parseCoord(req.body.longitude),
      description,
      features: parsedFeatures,
      galleryImages: galleryPaths,
      layouts,
      browcherPdf: pdfPath,
      logo: logoPath,
      coverImage: coverImagePath,
      coverVideo: coverVideoPath,
      bannerImage: bannerImagePath,
      reraNo: parseReraNo(reraNo),
      reraPossession: {
        month: typeof reraMonth === "string" ? reraMonth.trim() : "",
        year: yearNum,
      },
      reraCertificate: reraCertificates,
      reraScannerImage: reraScannerImages,
      ocCertificate: ocCertPath,
      active: parseActive(req.body.active, true),
    });

    await project.save();

    res.status(201).json({ success: true, message: "New Project Added", project });
  } catch (err) {
    console.error(err.message);
    const msg =
      err.name === "ValidationError"
        ? Object.values(err.errors || {})
            .map((e) => e.message)
            .join(" ")
        : "Failed to create project";
    res.status(err.name === "ValidationError" ? 400 : 500).json({
      success: false,
      message: msg,
    });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const includeInactive =
      req.query.includeInactive === "true" || req.query.includeInactive === "1";
    const filter = includeInactive ? {} : publicProjectQuery();
    const allProjects = await projectModel.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "All Project Fetched", allProjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch all projects" });
  }
};

/** Unique locality + configuration options derived from all projects (for filter dropdowns). */
const getProjectFilters = async (req, res) => {
  try {
    const projects = await projectModel
      .find(publicProjectQuery(), { location: 1, layouts: 1 })
      .lean();
    const filters = buildProjectFilterOptions(projects);
    res.status(200).json({
      success: true,
      message: "Project filters fetched",
      filters,
    });
  } catch (error) {
    console.error("getProjectFilters error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch project filters" });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }
    const includeInactive =
      req.query.includeInactive === "true" || req.query.includeInactive === "1";
    const project = await projectModel.findById(id).lean();
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    if (!includeInactive && project.active === false) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    res.status(200).json({ success: true, message: "Project fetched", project });
  } catch (error) {
    console.error("getProjectById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch project" });
  }
};

/**
 * Lean payload for the hero: _id, name, location, coverVideo, coverImage.
 * Only projects with coverVideo or coverImage.
 */
/** Random public projects with cover media for the home featured grid. */
const getFeaturedProjects = async (req, res) => {
  try {
    const parsed = parseInt(String(req.query.limit ?? "3"), 10);
    const limit = Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 3;
    const match = {
      ...publicProjectQuery(),
      $or: [
        { coverVideo: { $exists: true, $ne: "" } },
        { coverImage: { $exists: true, $ne: "" } },
      ],
    };

    const count = await projectModel.countDocuments(match);
    if (count === 0) {
      return res.status(200).json({
        success: true,
        message: "Featured projects fetched",
        featuredProjects: [],
      });
    }

    const sampleSize = Math.min(limit, count);
    const featuredProjects = await projectModel.aggregate([
      { $match: match },
      { $sample: { size: sampleSize } },
    ]);

    res.status(200).json({
      success: true,
      message: "Featured projects fetched",
      featuredProjects,
    });
  } catch (error) {
    console.error("getFeaturedProjects error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch featured projects" });
  }
};

const getHeroProjects = async (req, res) => {
  try {
    const docs = await projectModel
      .find(
        {
          ...publicProjectQuery(),
          $or: [
            { coverVideo: { $exists: true, $ne: "" } },
            { coverImage: { $exists: true, $ne: "" } },
          ],
        },
        {
          _id: 1,
          name: 1,
          location: 1,
          builder: 1,
          coverVideo: 1,
          coverImage: 1,
          "layouts.title": 1,
        }
      )
      .sort({ createdAt: -1 })
      .lean();

    // Derive BHK list from layout titles (e.g. "1 BHK", "2 BHK"). De-duped, original order kept.
    const heroProjects = docs.map((p) => {
      const seen = new Set();
      const bhkTypes = [];
      for (const l of p.layouts || []) {
        const t = (l?.title || "").trim();
        if (t && !seen.has(t)) {
          seen.add(t);
          bhkTypes.push(t);
        }
      }
      const { layouts, ...rest } = p;
      return { ...rest, bhkTypes };
    });

    res.status(200).json({
      success: true,
      message: "Hero projects fetched",
      heroProjects,
    });
  } catch (error) {
    console.error("getHeroProjects error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch hero projects" });
  }
};

const updateProject = async (req, res) => {
  try {
    const {
      id,
      name,
      builder,
      location,
      latitude: latitudeRaw,
      longitude: longitudeRaw,
      description,
      features,
      pdfChanged,
      logoChanged,
      coverImageChanged,
      coverVideoChanged,
      bannerImageChanged,
      reraCertificateChanged,
      reraScannerImageChanged,
      ocCertificateChanged,
      reraMonth,
      reraYear,
      reraNo,
      status,
      contactNumber,
      address,
      propertyType,
      galleryImages: galleryImagesStr = "[]",
      layouts: layoutsStr = "[]",
      newLayouts: newLayoutsStr = "[]",
      reraCertificate: reraCertificateStr = "[]",
      newReraCertificates: newReraCertificatesStr = "[]",
      reraScannerImage: reraScannerImageStr = "[]",
      newReraScannerImages: newReraScannerImagesStr = "[]",
    } = req.body;

    const existingProject = await projectModel.findById(id);
    if (!existingProject) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!description?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Description is required" });
    }

    const parsedStatus = parseStatus(status ?? existingProject.status);
    if (parsedStatus?.error) {
      return res.status(400).json({ success: false, message: parsedStatus.error });
    }

    const parsedPropertyType = parsePropertyType(
      propertyType ?? existingProject.propertyType ?? ""
    );
    if (parsedPropertyType?.error) {
      return res.status(400).json({ success: false, message: parsedPropertyType.error });
    }

    const existingGalleryImages = parseJsonField(galleryImagesStr, []);
    const existingLayouts = parseJsonField(layoutsStr, []);
    const newGalleryPaths = parseJsonField(req.body.galleryNewImages, []);
    const newLayouts = parseJsonField(newLayoutsStr, []);
    const existingReraCertificates = normalizeReraCertificates(
      parseJsonField(reraCertificateStr, [])
    );
    const newReraCertificates = parseJsonField(newReraCertificatesStr, []);
    const existingReraScannerImages = normalizeReraScannerImages(
      parseJsonField(reraScannerImageStr, [])
    );
    const newReraScannerImages = parseJsonField(newReraScannerImagesStr, []);

    if (!Array.isArray(existingGalleryImages) || !Array.isArray(newGalleryPaths)) {
      return res.status(400).json({ success: false, message: "Invalid gallery images" });
    }
    if (!Array.isArray(existingLayouts) || !Array.isArray(newLayouts)) {
      return res.status(400).json({ success: false, message: "Invalid layouts" });
    }
    if (!Array.isArray(existingReraCertificates) || !Array.isArray(newReraCertificates)) {
      return res.status(400).json({ success: false, message: "Invalid RERA certificates" });
    }
    if (!Array.isArray(existingReraScannerImages) || !Array.isArray(newReraScannerImages)) {
      return res.status(400).json({ success: false, message: "Invalid RERA scanner images" });
    }

    let pdfPathWithExt = existingProject.browcherPdf || "";
    if (pdfChanged === "true" || pdfChanged === true) {
      pdfPathWithExt = req.body.browcherPdf || pdfPathWithExt;
    }

    let logo = existingProject.logo;
    if (logoChanged === "true" || logoChanged === true) {
      logo = req.body.logo || logo;
    }
    if (!logo) {
      return res.status(400).json({ success: false, message: "Logo is required" });
    }

    let coverImage = existingProject.coverImage;
    if (coverImageChanged === "true" || coverImageChanged === true) {
      coverImage = req.body.coverImage ?? coverImage;
    }

    let coverVideo = existingProject.coverVideo || "";
    if (coverVideoChanged === "true" || coverVideoChanged === true) {
      coverVideo = req.body.coverVideo ?? "";
    }

    let bannerImage = existingProject.bannerImage || "";
    if (bannerImageChanged === "true" || bannerImageChanged === true) {
      bannerImage = req.body.bannerImage ?? "";
    }

    const reraCertsTouched =
      reraCertificateChanged === "true" ||
      reraCertificateChanged === true ||
      reraCertificateStr !== "[]" ||
      newReraCertificatesStr !== "[]";

    let reraCertificate = normalizeReraCertificates(existingProject.reraCertificate);
    if (reraCertsTouched) {
      reraCertificate = [...existingReraCertificates, ...newReraCertificates];
      const validatedReraCerts = validateTitledAssets(
        reraCertificate,
        "RERA certificate",
        "file"
      );
      if (validatedReraCerts?.error) {
        return res.status(400).json({ success: false, message: validatedReraCerts.error });
      }
      reraCertificate = validatedReraCerts;
    }

    const reraScannerTouched =
      reraScannerImageChanged === "true" ||
      reraScannerImageChanged === true ||
      reraScannerImageStr !== "[]" ||
      newReraScannerImagesStr !== "[]";

    let reraScannerImage = normalizeReraScannerImages(existingProject.reraScannerImage);
    if (reraScannerTouched) {
      reraScannerImage = [...existingReraScannerImages, ...newReraScannerImages];
      const validatedScanner = validateTitledAssets(
        reraScannerImage,
        "RERA scanner image",
        "image"
      );
      if (validatedScanner?.error) {
        return res.status(400).json({ success: false, message: validatedScanner.error });
      }
      reraScannerImage = validatedScanner;
    }

    let ocCertificate = existingProject.ocCertificate || "";
    if (ocCertificateChanged === "true" || ocCertificateChanged === true) {
      if (req.body.ocCertificate) ocCertificate = req.body.ocCertificate;
    }

    const updatedGalleryImages = [...existingGalleryImages, ...newGalleryPaths];
    const updatedLayouts = normalizeLayoutsForSave([
      ...existingLayouts,
      ...newLayouts,
    ]);

    if (updatedLayouts.length > 0) {
      for (let i = 0; i < updatedLayouts.length; i++) {
        const l = updatedLayouts[i];
        if (!l?.title?.trim()) {
          return res.status(400).json({
            success: false,
            message: `Layout ${i + 1}: title is required`,
          });
        }
      }
    }

    const parsedFeatures = parseJsonField(features, []);

    const yearNum =
      reraYear === "" || reraYear === undefined || reraYear === null
        ? undefined
        : Number.isNaN(Number(reraYear))
          ? existingProject.reraPossession?.year
          : Number(reraYear);

    const nextLat = parseCoord(latitudeRaw);
    const nextLng = parseCoord(longitudeRaw);

    const updatedFields = {
      name,
      builder,
      location,
      address: parseAddress(address ?? existingProject.address),
      propertyType: parsedPropertyType,
      status: parsedStatus,
      contactNumber: parseContactNumber(contactNumber),
      latitude: nextLat !== undefined ? nextLat : existingProject.latitude,
      longitude: nextLng !== undefined ? nextLng : existingProject.longitude,
      description,
      logo,
      coverImage,
      coverVideo,
      bannerImage,
      features: parsedFeatures,
      galleryImages: updatedGalleryImages,
      layouts: updatedLayouts,
      browcherPdf: pdfPathWithExt,
      reraNo: parseReraNo(reraNo ?? existingProject.reraNo),
      reraPossession: {
        month:
          typeof reraMonth === "string"
            ? reraMonth.trim()
            : existingProject.reraPossession?.month || "",
        year: yearNum,
      },
      reraCertificate,
      reraScannerImage,
      ocCertificate,
      active: parseActive(req.body.active, existingProject.active !== false),
    };

    const oldUrls = collectProjectAssetUrls(existingProject);
    const newUrls = collectProjectAssetUrls(updatedFields);
    const toDelete = diffUrlsToDelete(oldUrls, newUrls);
    await deleteS3Objects(toDelete);

    const updatedProject = await projectModel.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });

    res.status(200).json({ success: true, message: "Project updated", updatedProject });
  } catch (error) {
    console.error("Update project error:", error);
    const msg =
      error.name === "ValidationError"
        ? Object.values(error.errors || {})
            .map((e) => e.message)
            .join(" ")
        : "Failed to update project";
    res.status(error.name === "ValidationError" ? 400 : 500).json({
      success: false,
      message: msg,
    });
  }
};

function safeDownloadFilename(name) {
  const base = String(name || "download")
    .replace(/[^\w.\- ]/g, "")
    .trim()
    .slice(0, 120);
  return base || "download";
}

function resolveLocalUploadPath(relativePath) {
  const clean = String(relativePath).replace(/^\/+/, "");
  if (!clean.startsWith("uploads/") || clean.includes("..")) return null;
  const full = path.resolve(path.join(__dirname, "..", clean));
  if (!full.startsWith(uploadsRoot)) return null;
  return full;
}

const downloadProjectAsset = async (req, res) => {

  console.log("downloadProjectAsset called");
  try {
    const raw = String(req.query.url || req.query.path || "").trim();
    const filename = safeDownloadFilename(req.query.filename);

    if (!raw) {
      return res.status(400).json({ success: false, message: "Missing asset url" });
    }

    // Public S3 objects: fetch over HTTPS (no IAM GetObject required).
    if (isS3AssetUrl(raw)) {
      const key = parseS3KeyFromUrl(raw);
      if (!key) {
        return res.status(400).json({ success: false, message: "Invalid S3 asset" });
      }

      const ext = path.extname(key) || "";
      const downloadName = filename.includes(".") ? filename : `${filename}${ext}`;
      const upstream = await fetch(raw);
      if (!upstream.ok) {
        return res.status(404).json({ success: false, message: "Asset not found" });
      }

      const contentType =
        upstream.headers.get("content-type") || "application/octet-stream";
      const contentLength = upstream.headers.get("content-length");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadName}"`
      );
      res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);

      const buffer = Buffer.from(await upstream.arrayBuffer());
      return res.end(buffer);
    }

    const localPath = resolveLocalUploadPath(raw);
    if (!localPath || !fs.existsSync(localPath)) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const ext = path.extname(localPath) || "";
    const downloadName = filename.includes(".") ? filename : `${filename}${ext}`;
    return res.download(localPath, downloadName);
  } catch (error) {
    console.error("Download asset error:", error);
    return res.status(500).json({ success: false, message: "Failed to download asset" });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.body;
    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    await deleteS3Objects(collectProjectAssetUrls(project));
    await projectModel.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Project deleted" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ success: false, message: "Failed to delete project" });
  }
};

export {
  createProject,
  updateProject,
  getAllProjects,
  getProjectFilters,
  getFeaturedProjects,
  getProjectById,
  getHeroProjects,
  downloadProjectAsset,
  deleteProject,
};
