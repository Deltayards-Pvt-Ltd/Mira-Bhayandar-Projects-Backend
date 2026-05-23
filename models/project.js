import mongoose from "mongoose";

export const PROJECT_STATUSES = ["Under Construction", "Ready to Move"];

/** Residential / commercial mix shown on listings and filters. */
export const PROPERTY_TYPES = [
  "Residential",
  "Commercial",
  "Residential & Commercial",
];

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logo: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String,
      default: "",
    },
    coverVideo: {
      type: String,
      default: "",
    },
    bannerImage: {
      type: String,
      default: "",
    },

    builder: {
      type: String,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
    },

    /** Full postal / site address (comma-separated lines ok). */
    address: {
      type: String,
      trim: true,
      default: "",
    },

    propertyType: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "Under Construction",
    },

    /** When false, project is hidden from the public website. */
    active: {
      type: Boolean,
      default: true,
    },

    contactNumber: {
      type: String,
      trim: true,
      default: "",
    },

    /** Map pin for project detail (WGS84). Optional — set from admin. */
    latitude: { type: Number },
    longitude: { type: Number },

    description: {
      type: String,
      required: true,
    },

    features: [String],
    galleryImages: [
      {
        title: { type: String, required: true },
        image: { type: String, required: true },
      },
    ],

    browcherPdf: { type: String, default: "" },

    reraNo: {
      type: String,
      trim: true,
      default: "",
    },

    reraPossession: {
      month: { type: String, default: "" },
      year: { type: Number },
    },
    reraScannerImage: [
      {
        title: { type: String, required: true, trim: true },
        image: { type: String, required: true },
      },
    ],
    reraCertificate: [
      {
        title: { type: String, required: true, trim: true },
        file: { type: String, required: true },
      },
    ],
    ocCertificate: { type: String, default: "" },

    layouts: [
      {
        title: { type: String, required: true },
        area: { type: String, default: "" },
        price: { type: Number },
        image: { type: String, default: "" },
        images: [{ type: String }],
      },
    ],
  },
  { timestamps: true }
);

const projectModel = mongoose.model("Project", projectSchema);
export default projectModel;
