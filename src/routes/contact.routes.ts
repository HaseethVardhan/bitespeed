import { Router } from 'express';
import { healthCheck, identify } from '../controllers/contact.controller';

const router = Router();

// health check route to ensure server is running
router.get('/health', healthCheck);

// identify route to handle contact identification
router.post('/identify', identify);

export default router;