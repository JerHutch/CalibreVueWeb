import { Router } from 'express';
import { authenticateGoogle, handleGoogleCallback, redirectAfterAuth } from '../controllers/googleAuthController';

const router = Router();

router.get('/google', authenticateGoogle());
router.get('/google/callback', handleGoogleCallback(), redirectAfterAuth);

export default router;
