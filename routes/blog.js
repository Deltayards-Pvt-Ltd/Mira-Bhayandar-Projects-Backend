import express from "express";
import { createBlog, deleteBlog, getAllBlogs, getBlogById } from "../controllers/Blog.js";
import { blogUpload } from "../config/multer.js";   

const blogRouter = express.Router();

blogRouter.post('/addBlog', blogUpload.single("blogImage"), createBlog);
blogRouter.get('/allBlogs', getAllBlogs);
blogRouter.get('/:id', getBlogById);
blogRouter.delete('/deleteBlog/:id', deleteBlog);
export default blogRouter;