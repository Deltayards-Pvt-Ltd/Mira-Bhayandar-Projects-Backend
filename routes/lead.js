import express from "express";
import { authAdmin } from "../controllers/admin.js";
import {
  createLead,
  deleteLead,
  getAllLeads,
  getLeadCounts,
} from "../controllers/Lead.js";

const leadRouter = express.Router();

leadRouter.post("/submit", createLead);
leadRouter.get("/counts", authAdmin, getLeadCounts);
leadRouter.get("/allLeads", authAdmin, getAllLeads);
leadRouter.delete("/deleteLead/:id", authAdmin, deleteLead);

export default leadRouter;
