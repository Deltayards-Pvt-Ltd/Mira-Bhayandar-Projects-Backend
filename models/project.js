import mongoose from "mongoose";

export const PROJECT_STATUSES = ["Under Construction", "Ready to Move"];

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

    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "Under Construction",
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

    reraPossession: {
      month: { type: String, default: "" },
      year: { type: Number },
    },
    reraCertificate: { type: String, default: "" },
    ocCertificate: { type: String, default: "" },

    layouts: [
      {
        title: { type: String, required: true },
        area: { type: Number },
        price: { type: Number },
        image: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

const projectModel = mongoose.model("Project", projectSchema);
export default projectModel;
