import { Router } from 'express';
import { authenticateGoogle, handleGoogleCallback, redirectAfterAuth } from '../controllers/googleAuthController';

const router = Router();

router.get('/', authenticateGoogle());
router.get('/callback', handleGoogleCallback(), redirectAfterAuth);

export default router;
