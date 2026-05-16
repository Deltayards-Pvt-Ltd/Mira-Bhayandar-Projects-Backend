import express from "express";

import { addfaq, updateFaq, getAllFaqs, deleteFaq } from "../controllers/FAQ.js";

const faqRouter = express.Router();

faqRouter.post("/addfaq", addfaq);
faqRouter.get("/allFaqs", getAllFaqs);
faqRouter.put("/updateFaq", updateFaq); 
faqRouter.delete("/deleteFaq/:id", deleteFaq);

export default faqRouter;
