import { Router } from 'express';
import { healthCheck, identify } from '../controllers/contact.controller';
import { validateIdentify } from '../middlewares/validateIdentify';

const router = Router();

// health check route to ensure server is running
router.get('/health', healthCheck);

// identify route to handle contact identification with validation
router.post('/identify', validateIdentify, identify);

export default router;