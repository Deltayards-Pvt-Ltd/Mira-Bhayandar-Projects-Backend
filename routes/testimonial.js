import express from 'express';
import { createTestimonial, deleteTestimonial, getAllTestimonials } from '../controllers/Testimonail.js';

const testimonialRouter = express.Router();

testimonialRouter.post('/addTestimonial', createTestimonial);
testimonialRouter.get('/allTestimonials', getAllTestimonials);
testimonialRouter.post('/deleteTestimonial/:id', deleteTestimonial);

export default testimonialRouter;
