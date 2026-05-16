import mongoose from "mongoose";
import projectModel, { PROJECT_STATUSES } from "../models/project.js";
import {
  collectProjectAssetUrls,
  diffUrlsToDelete,
  destroyCloudinaryUrls,
} from "../utils/cloudinaryAssets.js";

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

/** Multer + CloudinaryStorage sets file.path to secure_url. */
function fileUrl(file) {
  return file?.path || "";
}

/** Optional WGS84 coordinate from multipart / JSON body. */
function parseCoord(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
      status,
      contactNumber,
    } = req.body;

    const parsedStatus = parseStatus(status);
    if (parsedStatus?.error) {
      return res.status(400).json({ success: false, message: parsedStatus.error });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!description?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Description is required" });
    }

    const galleryPaths = (req.files.galleryImages || []).map((file) => ({
      title: file.originalname.replace(/\s+/g, "_").split(".")[0],
      image: fileUrl(file),
    }));

    const pdfFile = req.files?.browcherPdf?.[0];
    const pdfPath = fileUrl(pdfFile);

    const logoPath = fileUrl(req.files?.logo?.[0]);
    if (!logoPath) {
      return res.status(400).json({ success: false, message: "Logo file is required" });
    }

    const coverImagePath = fileUrl(req.files?.coverImage?.[0]);
    const coverVideoPath = fileUrl(req.files?.coverVideo?.[0]);
    const bannerImagePath = fileUrl(req.files?.bannerImage?.[0]);
    const reraCertPath = fileUrl(req.files?.reraCertificate?.[0]);
    const ocCertPath = fileUrl(req.files?.ocCertificate?.[0]);

    let layoutMeta = [];
    try {
      layoutMeta = JSON.parse(req.body.layouts || "[]");
    } catch {
      return res.status(400).json({ success: false, message: "Invalid layouts JSON" });
    }
    if (!Array.isArray(layoutMeta)) {
      return res.status(400).json({ success: false, message: "Layouts must be an array" });
    }
    const layoutImages = req.files?.layoutImages || [];
    for (let i = 0; i < layoutMeta.length; i++) {
      if (!layoutMeta[i]?.title?.trim()) {
        return res
          .status(400)
          .json({ success: false, message: `Layout ${i + 1}: title is required` });
      }
      const imgPath = fileUrl(layoutImages[i]);
      if (!imgPath) {
        return res
          .status(400)
          .json({ success: false, message: `Layout ${i + 1}: image file is required` });
      }
    }
    const layouts = layoutMeta.map((meta, i) => ({
      ...meta,
      image: fileUrl(layoutImages[i]) || "",
    }));

    const yearNum =
      reraYear !== undefined && reraYear !== "" && !Number.isNaN(Number(reraYear))
        ? Number(reraYear)
        : undefined;

    let parsedFeatures = [];
    try {
      parsedFeatures = features ? JSON.parse(features) : [];
    } catch {
      return res.status(400).json({ success: false, message: "Invalid features JSON" });
    }

    const project = new projectModel({
      name,
      builder,
      location,
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
      reraPossession: {
        month: typeof reraMonth === "string" ? reraMonth.trim() : "",
        year: yearNum,
      },
      reraCertificate: reraCertPath,
      ocCertificate: ocCertPath,
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
    const allProjects = await projectModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "All Project Fetched", allProjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch all projects" });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }
    const project = await projectModel.findById(id).lean();
    if (!project) {
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
const getHeroProjects = async (req, res) => {
  try {
    const docs = await projectModel
      .find(
        {
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
      ocCertificateChanged,
      reraMonth,
      reraYear,
      status,
      contactNumber,
      galleryImages: galleryImagesStr = "[]",
      layouts: layoutsStr = "[]",
      newLayouts: newLayoutsStr = "[]",
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

    const existingGalleryImages = JSON.parse(galleryImagesStr);
    const existingLayouts = JSON.parse(layoutsStr);
    const newLayoutsMeta = JSON.parse(newLayoutsStr);

    const galleryNewImages = req.files?.galleryNewImages || [];
    const newlayoutImages = req.files?.newlayoutImages || [];

    let pdfPathWithExt = existingProject.browcherPdf || "";
    if (pdfChanged === "true") {
      pdfPathWithExt = fileUrl(req.files?.browcherPdf?.[0]) || pdfPathWithExt;
    }

    let logo = existingProject.logo;
    if (logoChanged === "true") {
      logo = fileUrl(req.files?.logo?.[0]) || logo;
    }
    if (!logo) {
      return res.status(400).json({ success: false, message: "Logo is required" });
    }

    let coverImage = existingProject.coverImage;
    if (coverImageChanged === "true") {
      coverImage = fileUrl(req.files?.coverImage?.[0]) || coverImage;
    }

    let coverVideo = existingProject.coverVideo || "";
    if (coverVideoChanged === "true") {
      coverVideo = fileUrl(req.files?.coverVideo?.[0]) || "";
    }

    let bannerImage = existingProject.bannerImage || "";
    if (bannerImageChanged === "true") {
      bannerImage = fileUrl(req.files?.bannerImage?.[0]) || "";
    }

    let reraCertificate = existingProject.reraCertificate || "";
    if (reraCertificateChanged === "true") {
      reraCertificate = fileUrl(req.files?.reraCertificate?.[0]) || "";
    }

    let ocCertificate = existingProject.ocCertificate || "";
    if (ocCertificateChanged === "true") {
      ocCertificate = fileUrl(req.files?.ocCertificate?.[0]) || "";
    }

    const newGalleryPaths = galleryNewImages.map((file) => ({
      title: file.originalname.replace(/\s+/g, "_").split(".")[0],
      image: fileUrl(file),
    }));

    const newLayouts = newLayoutsMeta.map((meta, i) => ({
      ...meta,
      image: fileUrl(newlayoutImages[i]) || "",
    }));

    const updatedGalleryImages = [...existingGalleryImages, ...newGalleryPaths];
    const updatedLayouts = [...existingLayouts, ...newLayouts];

    if (updatedLayouts.length > 0) {
      for (let i = 0; i < updatedLayouts.length; i++) {
        const l = updatedLayouts[i];
        if (!l?.title?.trim() || !l?.image) {
          return res.status(400).json({
            success: false,
            message: `Layout ${i + 1} must have title and image`,
          });
        }
      }
    }

    let parsedFeatures = [];
    try {
      parsedFeatures = features ? JSON.parse(features) : [];
    } catch {
      parsedFeatures = [];
    }

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
      reraPossession: {
        month:
          typeof reraMonth === "string"
            ? reraMonth.trim()
            : existingProject.reraPossession?.month || "",
        year: yearNum,
      },
      reraCertificate,
      ocCertificate,
    };

    const oldUrls = collectProjectAssetUrls(existingProject);
    const newUrls = collectProjectAssetUrls(updatedFields);
    const toDelete = diffUrlsToDelete(oldUrls, newUrls);
    await destroyCloudinaryUrls(toDelete);

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

const deleteProject = async (req, res) => {
  try {
    const { id } = req.body;
    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    await destroyCloudinaryUrls(collectProjectAssetUrls(project));
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
  getProjectById,
  getHeroProjects,
  deleteProject,
};
