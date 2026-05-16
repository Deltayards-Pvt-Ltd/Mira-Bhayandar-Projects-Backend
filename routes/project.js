import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectById,
  getHeroProjects,
  updateProject,
} from '../controllers/Project.js';
import { upload } from '../config/multer.js';


import express from 'express';

const projectRouter = express.Router();

const addProjectUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
  { name: "coverVideo", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 20 },
  { name: "browcherPdf", maxCount: 1 },
  { name: "layoutImages", maxCount: 10 },
  { name: "reraCertificate", maxCount: 1 },
  { name: "ocCertificate", maxCount: 1 },
]);

projectRouter.post(
    "/addProject",
    (req, res, next) => {
        addProjectUpload(req, res, (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ message: 'File upload failed', error: err });
            }
            next();
        });
    },
    createProject
);

projectRouter.post(
    "/updateProject",
    upload.fields([
        { name: "galleryImages", maxCount: 20 },
        { name: "galleryNewImages", maxCount: 20 },
        { name: "layoutImages", maxCount: 50 },
        { name: "newlayoutImages", maxCount: 50 },
        { name: "browcherPdf", maxCount: 1 },
        { name: "logo", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
        { name: "coverVideo", maxCount: 1 },
        { name: "bannerImage", maxCount: 1 },
        { name: "reraCertificate", maxCount: 1 },
        { name: "ocCertificate", maxCount: 1 },
    ]),
    updateProject

);
projectRouter.get('/allProjects', getAllProjects)
projectRouter.get('/hero', getHeroProjects)
projectRouter.get('/:id', getProjectById)
projectRouter.post('/deleteProject', deleteProject)

export default projectRouter;
