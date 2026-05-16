import mongoose from "mongoose";


const blogSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, },
        /** Short label e.g. Infrastructure, Market update, Regulation */
        tagline: { type: String, default: "", trim: true },
        content: { type: String, required: true },
        date: { type: Date, default: Date.now },
        writer: { type: String, required: true },
        image: { type: String, required: false },
        
    },
    { timestamps: true }
);

const blogModel = mongoose.model("Blog", blogSchema);
export default blogModel;
