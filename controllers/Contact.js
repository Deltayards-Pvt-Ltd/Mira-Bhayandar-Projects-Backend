import contactSettingsModel from "../models/contactSettings.js";

const DEFAULTS = {
  phone1: "+91 98765 43210",
  phone2: "+91 98765 43211",
  whatsapp: "919876543210",
};

function settingsFromDoc(doc) {
  return {
    phone1: typeof doc.phone1 === "string" ? doc.phone1.trim() : "",
    phone2: typeof doc.phone2 === "string" ? doc.phone2.trim() : "",
    whatsapp:
      String(doc.whatsapp ?? "")
        .replace(/\D/g, "")
        .trim() || DEFAULTS.whatsapp,
  };
}

/** Public — for marketing site */
export const getContactSettings = async (req, res) => {
  try {
    const doc = await contactSettingsModel.findOne();
    if (!doc) {
      return res.json({ success: true, settings: { ...DEFAULTS } });
    }
    res.json({ success: true, settings: settingsFromDoc(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to load contact settings" });
  }
};

/** Admin — upserts the single document */
export const updateContactSettings = async (req, res) => {
  try {
    const { phone1, phone2, whatsapp } = req.body ?? {};
    const waDigits = String(whatsapp ?? "")
      .replace(/\D/g, "")
      .trim();

    if (!waDigits || waDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message:
          "WhatsApp must be a valid number with country code (digits only, e.g. 919876543210)",
      });
    }

    const payload = {
      phone1: typeof phone1 === "string" ? phone1.trim() : "",
      phone2: typeof phone2 === "string" ? phone2.trim() : "",
      whatsapp: waDigits,
    };

    const doc = await contactSettingsModel.findOneAndUpdate(
      {},
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "Contact settings saved",
      settings: settingsFromDoc(doc),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save contact settings" });
  }
};
