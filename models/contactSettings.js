import mongoose from "mongoose";

/** Single-row site contact info (phones + WhatsApp), edited from admin. */
const contactSettingsSchema = new mongoose.Schema(
  {
    phone1: { type: String, default: "+91 98765 43210", trim: true },
    phone2: { type: String, default: "+91 98765 43211", trim: true },
    /** Digits only, country code included, e.g. 919876543210 for wa.me */
    whatsapp: { type: String, default: "919876543210", trim: true },
  },
  { timestamps: true }
);

const contactSettingsModel = mongoose.model("ContactSettings", contactSettingsSchema);
export default contactSettingsModel;
