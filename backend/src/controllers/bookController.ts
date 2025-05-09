import { Request, Response } from 'express';
import { CalibreService } from '../services/calibreService';

let calibreService: CalibreService;

export const initializeController = (service: CalibreService) => {
  calibreService = service;
};

export const getBooks = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await calibreService.getBooks(page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Database error' });
  }
};

export const getBookById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid book ID' });
    }

    const book = await calibreService.getBookById(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Database error' });
  }
}; 