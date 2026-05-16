import mongoose from "mongoose";
import testimonialModel from "../models/testimonals.js";

function normalizeStarCount(value) {
    let n = Number(value);
    if (!Number.isFinite(n)) return 5;
    n = Math.round(n);
    return Math.min(5, Math.max(1, n));
}

const createTestimonial = async (req, res) => {
    try {
        const { name, message, purchasedAtProject, starCount } = req.body;

        if (!purchasedAtProject || !mongoose.Types.ObjectId.isValid(purchasedAtProject)) {
            return res.status(400).json({
                success: false,
                message: "purchasedAtProject must be a valid Project id",
            });
        }

        const testimonial = new testimonialModel({
            name,
            message,
            purchasedAtProject,
            starCount: normalizeStarCount(starCount),
        });
        await testimonial.save();
        await testimonial.populate("purchasedAtProject", "name");

        res.status(201).json({ success: true, message: "New Testimonial Added", testimonial });
    } catch (err) {
        console.error(err.message);
        console.log("create testimonial failed");
        res.status(500).json({ success: false, message: "Failed to create testimonial" });
    }
};

const getAllTestimonials = async (req, res) => {
    try {
        const allTestimonials = await testimonialModel
            .find()
            .populate("purchasedAtProject", "name")
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, message: "All Testimonials Fetched", allTestimonials });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch all testimonials" });
    }
};

const deleteTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        await testimonialModel.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Testimonial Deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to delete testimonial" });
    }
};

export { createTestimonial, getAllTestimonials, deleteTestimonial };
