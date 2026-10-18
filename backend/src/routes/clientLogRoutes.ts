import { Router } from 'express';
import { receiveClientLogs } from '../controllers/clientLogController';

const router = Router();

router.post('/', receiveClientLogs);

export default router;
