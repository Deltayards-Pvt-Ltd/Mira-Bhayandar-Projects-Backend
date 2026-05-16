import blogModel from "../models/blog.js";
import { deleteS3Object, isS3AssetUrl } from "../utils/s3Assets.js";

const createBlog = async (req, res) => {
    try {
        const { title, content, writer, tagline } = req.body;

        const imagePath = req.file?.location || req.file?.path || "";

        const blog = new blogModel({
            title,
            content,
            writer,
            tagline: typeof tagline === "string" ? tagline.trim() : "",
            image: imagePath,
        });
        await blog.save();
        res.status(201).json({ success: true, message: "Blog Created", blog });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: "Failed to create blog" });
    }

};

const getAllBlogs = async (req, res) => {
    try {
        const allblogs = await blogModel.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, allblogs });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: "Failed to fetch blogs" });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await blogModel.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        if (blog.image && isS3AssetUrl(blog.image)) {
            await deleteS3Object(blog.image);
        }

        await blogModel.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Blog Deleted" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: "Failed to delete blog" });
    }
};


export { createBlog, getAllBlogs, deleteBlog };
