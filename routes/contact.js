import express from "express";
import { authAdmin } from "../controllers/admin.js";
import { getContactSettings, updateContactSettings } from "../controllers/Contact.js";

const contactRouter = express.Router();

contactRouter.get("/settings", getContactSettings);
contactRouter.put("/settings", authAdmin, updateContactSettings);

export default contactRouter;
