import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        message: { type: String, required: true },
        /** Which project they bought at (name comes from populate). */
        purchasedAtProject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        starCount: {
            type: Number,
            required: true,
            default: 5,
            min: 1,
            max: 5,
        },
    },
    { timestamps: true }
);

const testimonialModel = mongoose.model("Testimonial", testimonialSchema);
export default testimonialModel;
