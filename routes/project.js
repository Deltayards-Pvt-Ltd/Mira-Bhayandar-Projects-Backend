import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectById,
  getHeroProjects,
  updateProject,
} from '../controllers/Project.js';
import { presignProjectUploads } from '../controllers/upload.js';

import express from 'express';

const projectRouter = express.Router();

projectRouter.post('/presignUploads', presignProjectUploads);
projectRouter.post('/addProject', createProject);
projectRouter.post('/updateProject', updateProject);
projectRouter.get('/allProjects', getAllProjects);
projectRouter.get('/hero', getHeroProjects);
projectRouter.get('/:id', getProjectById);
projectRouter.post('/deleteProject', deleteProject);

export default projectRouter;
