import "./config/loadEnv.js";
import express from "express";
import cors from "cors";

import connectDb from "./config/db.js";
import corsOptions from "./cors.js";

import adminRouter from "./routes/admin.js";
import projectRouter from "./routes/project.js";
import blogRouter from "./routes/blog.js";
import testimonialRouter from "./routes/testimonial.js";
import faqRouter from "./routes/faq.js";
import contactRouter from "./routes/contact.js";
import leadRouter from "./routes/lead.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors(corsOptions));

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

connectDb();

app.use("/api/admin", adminRouter);
app.use("/api/project", projectRouter);
app.use("/api/blog", blogRouter);
app.use("/api/testimonial", testimonialRouter);
app.use("/api/faq", faqRouter);
app.use("/api/contact", contactRouter);
app.use("/api/lead", leadRouter);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Hello from Backend");
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
