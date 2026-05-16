import leadModel from "../models/lead.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const rawLimit = parseInt(String(query.limit ?? "20"), 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export const createLead = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    if (!phone?.trim()) {
      return res.status(400).json({ success: false, message: "Phone is required" });
    }
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const lead = await leadModel.create({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
    });

    res.status(201).json({ success: true, message: "Enquiry received", lead });
  } catch (err) {
    console.error("createLead:", err);
    res.status(500).json({ success: false, message: "Failed to save enquiry" });
  }
};

export const getLeadCounts = async (req, res) => {
  try {
    const todayFilter = {
      createdAt: { $gte: startOfToday(), $lte: endOfToday() },
    };
    const [todayCount, totalCount] = await Promise.all([
      leadModel.countDocuments(todayFilter),
      leadModel.countDocuments(),
    ]);
    res.status(200).json({
      success: true,
      todayCount,
      totalCount,
    });
  } catch (err) {
    console.error("getLeadCounts:", err);
    res.status(500).json({ success: false, message: "Failed to fetch lead counts" });
  }
};

export const getAllLeads = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const todayOnly = String(req.query.today ?? "").toLowerCase() === "true";

    const filter = todayOnly
      ? { createdAt: { $gte: startOfToday(), $lte: endOfToday() } }
      : {};

    const [leads, total] = await Promise.all([
      leadModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      leadModel.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Leads fetched",
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error("getAllLeads:", err);
    res.status(500).json({ success: false, message: "Failed to fetch leads" });
  }
};

export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    await leadModel.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Lead deleted" });
  } catch (err) {
    console.error("deleteLead:", err);
    res.status(500).json({ success: false, message: "Failed to delete lead" });
  }
};
