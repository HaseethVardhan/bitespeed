// Global file to handle all the routes

import { Router } from 'express';
import routes from './contact.routes';

const router = Router();

router.use('/', routes);

export default router;
