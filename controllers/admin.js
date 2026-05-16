import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import adminModel from "../models/admin.js";

const createToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
/** First admin only; override in .env for production */
const bootstrapPin = () => process.env.ADMIN_BOOTSTRAP_PIN || "1234";

export const authAdmin = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.adminId = payload.id;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export const bootstrapStatus = async (req, res) => {
  try {
    const count = await adminModel.countDocuments();
    return res.json({ success: true, needsBootstrap: count === 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const setupAdmin = async (req, res) => {
  try {
    const count = await adminModel.countDocuments();
    if (count > 0) {
      return res.status(403).json({
        success: false,
        message: "Admin already exists — log in and change password on the dashboard",
      });
    }

    const { secret, username, password } = req.body;
    if (secret !== bootstrapPin()) {
      return res.status(401).json({ success: false, message: "Wrong PIN" });
    }
    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ success: false, message: "Username is required" });
    }
    if (!password || typeof password !== "string" || !password.length) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const trimmedUser = username.trim();
    const hashed = await bcrypt.hash(password, 10);
    await adminModel.create({ username: trimmedUser, password: hashed });
    return res.status(201).json({
      success: true,
      message: "Admin created — you can log in now",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string" || !newPassword.length) {
      return res
        .status(400)
        .json({ success: false, message: "Password is required" });
    }
    const admin = await adminModel.findById(req.adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    return res.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await adminModel.findOne({ username });

    if (!admin) {
      return res.status(400).json({ success: false, message: "user not found" });
    }

    let valid = false;
    if (admin.password?.startsWith("$2")) {
      valid = await bcrypt.compare(password, admin.password);
    } else if (password === admin.password) {
      valid = true;
      admin.password = await bcrypt.hash(password, 10);
      await admin.save();
    }

    if (!valid) {
      return res.status(400).json({ success: false, message: "Password Wrong" });
    }

    const token = createToken(admin._id);
    return res.status(201).json({ success: true, message: "Login Successfull", token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
