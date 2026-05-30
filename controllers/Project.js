import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "url";
import projectModel, {
  PLAN_OPTIONS,
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
import { normalizeLayoutsForSave } from "../utils/layoutNormalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(path.join(__dirname, "..", "uploads"));

const PUBLIC_ONLY = { active: { $ne: false } };

const trim = (v) => (typeof v === "string" ? v.trim() : "");

/** Multipart often sends JSON as a string. */
function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseStatus(v) {
  const s = trim(v);
  if (!s) return "Under Construction";
  if (!PROJECT_STATUSES.includes(s)) {
    return { error: `Status must be one of: ${PROJECT_STATUSES.join(", ")}` };
  }
  return s;
}

function parsePropertyType(v) {
  const s = trim(v);
  if (!s) return "";
  if (!PROPERTY_TYPES.includes(s)) {
    return { error: `Property type must be one of: ${PROPERTY_TYPES.join(", ")}` };
  }
  return s;
}

/** Unique, validated plan strings (e.g. "1 BHK", "JODI"). */
function parsePlans(value) {
  const raw = parseJson(value, []);
  if (!Array.isArray(raw)) return { error: "plans must be an array" };
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const s = trim(item);
    if (!s) continue;
    if (!PLAN_OPTIONS.includes(s)) {
      return { error: `Plan must be one of: ${PLAN_OPTIONS.join(", ")}` };
    }
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** Legacy single URL string → [{ title, [urlKey] }]. */
function asTitledList(val, urlKey) {
  if (!val) return [];
  if (typeof val === "string" && val.trim()) {
    return [{ title: "Project", [urlKey]: val.trim() }];
  }
  return Array.isArray(val) ? val : [];
}

function validateTitledAssets(items, label, urlKey) {
  if (!Array.isArray(items)) return { error: `${label} must be an array` };
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.title?.trim()) return { error: `${label} ${i + 1}: title is required` };
    if (!item?.[urlKey]) return { error: `${label} ${i + 1}: ${urlKey} is required` };
  }
  return items.map((item) => ({ title: item.title.trim(), [urlKey]: item[urlKey] }));
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

    const galleryPaths = parseJson(req.body.galleryImages, []);
    if (!Array.isArray(galleryPaths)) {
      return res.status(400).json({ success: false, message: "galleryImages must be an array" });
    }

    const parsedPlans = parsePlans(req.body.plans);
    if (parsedPlans?.error) {
      return res.status(400).json({ success: false, message: parsedPlans.error });
    }

    // const pdfPath = req.body.browcherPdf || "";
    const logoPath = req.body.logo || "";
    const builderLogoPath = req.body.builderLogo || "";

    const coverImagePath = req.body.coverImage || "";
    const coverVideoPath = req.body.coverVideo || "";
    const bannerImagePath = req.body.bannerImage || "";
    const walkthroughVideoPath = req.body.walkthroughVideo || "";

    const browcherPdfs = validateTitledAssets(
      asTitledList(parseJson(req.body.browcherPdf, []), "file"),
      "Browcher PDF",
      "file"
    );
    if (browcherPdfs?.error) {
      return res.status(400).json({ success: false, message: browcherPdfs.error });
    }

    const reraCertificates = validateTitledAssets(
      asTitledList(parseJson(req.body.reraCertificate, []), "file"),
      "RERA certificate",
      "file"
    );
    if (reraCertificates?.error) {
      return res.status(400).json({ success: false, message: reraCertificates.error });
    }

    const reraScannerImages = validateTitledAssets(
      asTitledList(parseJson(req.body.reraScannerImage, []), "image"),
      "RERA scanner image",
      "image"
    );
    if (reraScannerImages?.error) {
      return res.status(400).json({ success: false, message: reraScannerImages.error });
    }

    const ocCertPath = req.body.ocCertificate || "";

    const layoutsRaw = parseJson(req.body.layouts, []);
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

    const parsedFeatures = parseJson(features, []);
    if (!Array.isArray(parsedFeatures)) {
      return res.status(400).json({ success: false, message: "features must be an array" });
    }

    const project = new projectModel({
      name,
      builder,
      location,
      address: trim(address),
      propertyType: parsedPropertyType,
      status: parsedStatus,
      contactNumber: trim(contactNumber),
      latitude: Number(req.body.latitude) || undefined,
      longitude: Number(req.body.longitude) || undefined,
      description,
      features: parsedFeatures,
      galleryImages: galleryPaths,
      plans: parsedPlans,
      layouts,
      // browcherPdf: pdfPath,
      browcherPdf: browcherPdfs,
      logo: logoPath,
      builderLogo: builderLogoPath,
      coverImage: coverImagePath,
      coverVideo: coverVideoPath,
      bannerImage: bannerImagePath,
      walkthroughVideo: walkthroughVideoPath,
      reraNo: trim(reraNo),
      reraPossession: {
        month: typeof reraMonth === "string" ? reraMonth.trim() : "",
        year: yearNum,
      },
      reraCertificate: reraCertificates,
      reraScannerImage: reraScannerImages,
      ocCertificate: ocCertPath,
      active: req.body.active !== false && req.body.active !== "false" && req.body.active !== "0",
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
    const filter = includeInactive ? {} : PUBLIC_ONLY;
    const allProjects = await projectModel.find({ ...filter, status: { $ne: "Upcoming" } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "All Project Fetched", allProjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch all projects" });
  }
};

/** Unique area / configuration / property type strings for filter dropdowns. */
const getFilterOptions = async (req, res) => {
  try {
    const projects = await projectModel
      .find({ ...PUBLIC_ONLY, status: { $ne: "Upcoming" } }, { location: 1, plans: 1, propertyType: 1 })
      .lean();

    const areas = new Set();
    const configurations = new Set();
    const propertyTypes = new Set();

    for (const p of projects) {
      const loc = String(p.location || "").trim();
      if (loc) areas.add(loc);
      const propertyType = String(p.propertyType || "").trim();
      if (propertyType) propertyTypes.add(propertyType);
      for (const plan of p.plans || []) {
        const t = String(plan || "").trim();
        if (t) configurations.add(t);
      }
    }

    const sort = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
    res.status(200).json({
      success: true,
      message: "Filter options fetched",
      filterOptions: {
        areas: [...areas].sort(sort),
        configurations: [...configurations].sort(sort),
        propertyTypes: [...propertyTypes].sort(sort),
        planChoices: PLAN_OPTIONS,
      },
    });
  } catch (error) {
    console.error("getFilterOptions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch filter options" });
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
    const match = {
      ...PUBLIC_ONLY,
      status: { $ne: "Upcoming" },
      $or: [
        { coverVideo: { $exists: true, $ne: "" } },
        { coverImage: { $exists: true, $ne: "" } },
      ],
    };


    const featuredProjects = await projectModel.aggregate([
      { $match: match }
    ]);

    const shuffledProjects = featuredProjects.sort((a, b) => Math.random() - 0.5);

    res.status(200).json({
      success: true,
      message: "Featured projects fetched",
      featuredProjects: shuffledProjects,
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
          ...PUBLIC_ONLY,
          status: { $ne: "Upcoming" },
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
          plans: 1,
        }
      )
      .sort({ createdAt: -1 })
      .lean();

    const heroProjects = docs.map((p) => ({
      ...p,
      bhkTypes: (p.plans || []).map((t) => String(t || "").trim()).filter(Boolean),
    }));

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
      plans: plansRaw,
      browcherPdfChanged,
      logoChanged,
      coverImageChanged,
      coverVideoChanged,
      walkthroughVideoChanged,
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
      browcherPdf: browcherPdfStr = "[]",
      newBrowcherPdfs: newBrowcherPdfsStr = "[]",
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

    const existingGalleryImages = parseJson(galleryImagesStr, []);
    const existingLayouts = parseJson(layoutsStr, []);
    const newGalleryPaths = parseJson(req.body.galleryNewImages, []);
    const newLayouts = parseJson(newLayoutsStr, []);

    const parsedPlans =
      plansRaw !== undefined
        ? parsePlans(plansRaw)
        : (existingProject.plans ?? []);
    if (parsedPlans?.error) {
      return res.status(400).json({ success: false, message: parsedPlans.error });
    }
    const existingBrowcherPdfs = asTitledList(parseJson(browcherPdfStr, []), "file");
    const newBrowcherPdfs = parseJson(newBrowcherPdfsStr, []);
    const existingReraCertificates = asTitledList(parseJson(reraCertificateStr, []), "file");
    const newReraCertificates = parseJson(newReraCertificatesStr, []);
    const existingReraScannerImages = asTitledList(parseJson(reraScannerImageStr, []), "image");
    const newReraScannerImages = parseJson(newReraScannerImagesStr, []);

    if (!Array.isArray(existingGalleryImages) || !Array.isArray(newGalleryPaths)) {
      return res.status(400).json({ success: false, message: "Invalid gallery images" });
    }
    if (!Array.isArray(existingLayouts) || !Array.isArray(newLayouts)) {
      return res.status(400).json({ success: false, message: "Invalid layouts" });
    }
    if (!Array.isArray(existingBrowcherPdfs) || !Array.isArray(newBrowcherPdfs)) {
      return res.status(400).json({ success: false, message: "Invalid brochure PDFs" });
    }
    if (!Array.isArray(existingReraCertificates) || !Array.isArray(newReraCertificates)) {
      return res.status(400).json({ success: false, message: "Invalid RERA certificates" });
    }
    if (!Array.isArray(existingReraScannerImages) || !Array.isArray(newReraScannerImages)) {
      return res.status(400).json({ success: false, message: "Invalid RERA scanner images" });
    }

    const browcherTouched =
      browcherPdfChanged === "true" ||
      browcherPdfChanged === true ||
      browcherPdfStr !== "[]" ||
      newBrowcherPdfsStr !== "[]";

    let browcherPdf = asTitledList(existingProject.browcherPdf, "file");
    if (browcherTouched) {
      browcherPdf = [...existingBrowcherPdfs, ...newBrowcherPdfs];
      const validatedBrowcher = validateTitledAssets(
        browcherPdf,
        "Browcher PDF",
        "file"
      );
      if (validatedBrowcher?.error) {
        return res.status(400).json({ success: false, message: validatedBrowcher.error });
      }
      browcherPdf = validatedBrowcher;
    }

    let logo = existingProject.logo || "";
    if (logoChanged === "true" || logoChanged === true) {
      logo = req.body.logo ?? logo;
    }

    let coverImage = existingProject.coverImage;
    if (coverImageChanged === "true" || coverImageChanged === true) {
      coverImage = req.body.coverImage ?? coverImage;
    }

    let coverVideo = existingProject.coverVideo || "";
    if (coverVideoChanged === "true" || coverVideoChanged === true) {
      coverVideo = req.body.coverVideo ?? "";
    }

    let walkthroughVideo = existingProject.walkthroughVideo || "";
    if (walkthroughVideoChanged === "true" || walkthroughVideoChanged === true) {
      walkthroughVideo = req.body.walkthroughVideo ?? "";
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

    let reraCertificate = asTitledList(existingProject.reraCertificate, "file");
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

    let reraScannerImage = asTitledList(existingProject.reraScannerImage, "image");
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

    const parsedFeatures = parseJson(features, []);

    const yearNum =
      reraYear === "" || reraYear === undefined || reraYear === null
        ? undefined
        : Number.isNaN(Number(reraYear))
          ? existingProject.reraPossession?.year
          : Number(reraYear);

    const nextLat = Number(latitudeRaw);
    const nextLng = Number(longitudeRaw);

    const updatedFields = {
      name,
      builder,
      location,
      address: trim(address ?? existingProject.address),
      propertyType: parsedPropertyType,
      status: parsedStatus,
      contactNumber: trim(contactNumber),
      latitude: Number.isFinite(nextLat) ? nextLat : existingProject.latitude,
      longitude: Number.isFinite(nextLng) ? nextLng : existingProject.longitude,
      description,
      logo,
      coverImage,
      coverVideo,
      walkthroughVideo,
      bannerImage,
      features: parsedFeatures,
      galleryImages: updatedGalleryImages,
      plans: parsedPlans,
      layouts: updatedLayouts,
      browcherPdf,
      reraNo: trim(reraNo ?? existingProject.reraNo),
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
      active:
        req.body.active !== undefined
          ? req.body.active !== false && req.body.active !== "false" && req.body.active !== "0"
          : existingProject.active !== false,
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

      if (!upstream.body) {
        return res.status(502).json({ success: false, message: "Empty asset response" });
      }

      await pipeline(Readable.fromWeb(upstream.body), res);
      return;
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


const getAllProjectsAdmin = async (req, res) => {
  console.log("getAllProjectsAdmin called");
  try {
    const allProjects = await projectModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "All projects fetched", allProjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch all projects" });
  }
};


const getUpcomingProjects = async (req, res) => {
  try {
    const upcomingProjects = await projectModel
      .find({ ...PUBLIC_ONLY, status: "Upcoming" })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "Upcoming projects fetched", upcomingProjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch upcoming projects" });
  }
};

export {
  createProject,
  updateProject,
  getAllProjects,
  getFilterOptions,
  getFeaturedProjects,
  getProjectById,
  getHeroProjects,
  downloadProjectAsset,
  deleteProject,
  getAllProjectsAdmin,
  getUpcomingProjects,
};
