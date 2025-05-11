import { Router } from 'express';
import { getBooks, getBookById } from '../controllers/bookController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Protect all book routes with authentication
router.use(authenticateToken);

// Get all books with pagination
router.get('/', getBooks);

// Get a specific book by ID
router.get('/:id', getBookById);

export default router; 