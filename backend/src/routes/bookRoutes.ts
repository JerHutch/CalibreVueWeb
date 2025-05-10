import { Router } from 'express';
import { getBooks, getBookById } from '../controllers/bookController';

const router = Router();

// Get all books with pagination
router.get('/', getBooks);

// Get a specific book by ID
router.get('/:id', getBookById);

export default router; 