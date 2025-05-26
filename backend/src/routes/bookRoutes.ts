import { Router } from 'express';
import { getBooks, getBookById, getBookCover, downloadBook } from '../controllers/bookController';
const router = Router();


// Get all books with pagination
router.get('/', getBooks);

// Get a specific book by ID
router.get('/:id', getBookById);

// Get book cover
router.get('/:id/cover', getBookCover);

// Download book
router.get('/:id/download', downloadBook);

export default router; 