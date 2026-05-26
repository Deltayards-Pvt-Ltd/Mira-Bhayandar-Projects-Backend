import express from "express";
import { createBlog, deleteBlog, getAllBlogs, getBlogById } from "../controllers/Blog.js";
import { presignBlogUpload } from "../controllers/upload.js";

const blogRouter = express.Router();

blogRouter.post("/presignUpload", presignBlogUpload);
blogRouter.post("/addBlog", createBlog);
blogRouter.get('/allBlogs', getAllBlogs);
blogRouter.get('/:id', getBlogById);
blogRouter.delete('/deleteBlog/:id', deleteBlog);
export default blogRouter;