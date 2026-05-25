import {
  createProject,
  deleteProject,
  downloadProjectAsset,
  getAllProjects,
  getFilterOptions,
  getFeaturedProjects,
  getProjectById,
  getHeroProjects,
  updateProject,
  getAllProjectsAdmin,
  getUpcomingProjects,
} from '../controllers/Project.js';
import { presignProjectUploads } from '../controllers/upload.js';

import express from 'express';

const projectRouter = express.Router();

projectRouter.post('/presignUploads', presignProjectUploads);
projectRouter.post('/addProject', createProject);
projectRouter.post('/updateProject', updateProject);
projectRouter.get('/allProjects', getAllProjects);
projectRouter.get('/filter-options', getFilterOptions);
projectRouter.get('/featured', getFeaturedProjects);
projectRouter.get('/hero', getHeroProjects);
projectRouter.get('/download-asset', downloadProjectAsset);
projectRouter.get('/getAllProjectsAdmin', getAllProjectsAdmin);
projectRouter.get('/upcomingProjects', getUpcomingProjects);
projectRouter.get('/:id', getProjectById);
projectRouter.post('/deleteProject', deleteProject);

export default projectRouter;
