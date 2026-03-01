import { Router } from 'express';
import { healthCheck } from '../controllers/contact.controller';

const router = Router();

// health check route to ensure server is running
router.get('/health', healthCheck);

export default router;