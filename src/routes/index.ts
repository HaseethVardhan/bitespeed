
// Global file to handle all the routes
import { Router } from 'express';
import contactRoutes from './contact.routes';

const router = Router();

router.use('/', contactRoutes);

export default router;
