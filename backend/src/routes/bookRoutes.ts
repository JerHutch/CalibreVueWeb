import { Router } from 'express';
import { getBooks, getBookById, getBookCover, downloadBook } from '../controllers/bookController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Protect all book routes with authentication
router.use(authenticateToken);

// Get all books with pagination
router.get('/', getBooks);

// Get a specific book by ID
router.get('/:id', getBookById);

// Get book cover
router.get('/:id/cover', getBookCover);

// Download book
router.get('/:id/download', downloadBook);

export default router; 