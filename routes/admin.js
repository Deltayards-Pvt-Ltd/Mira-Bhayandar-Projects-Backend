import express from "express";
import {
  login,
  setupAdmin,
  resetPassword,
  bootstrapStatus,
  authAdmin,
} from "../controllers/admin.js";

const adminRouter = express.Router();

adminRouter.get("/bootstrap", bootstrapStatus);
adminRouter.post("/login", login);
adminRouter.post("/setup", setupAdmin);
adminRouter.post("/reset-password", authAdmin, resetPassword);

export default adminRouter;
