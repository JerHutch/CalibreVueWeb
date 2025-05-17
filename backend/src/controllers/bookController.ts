import { Request, Response } from 'express';
import { CalibreService } from '../services/calibreService';
import path from 'path';
import fs from 'fs';

let calibreService: CalibreService;

export const initializeController = (service: CalibreService) => {
  calibreService = service;
};

export const getBooks = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    
    const result = await calibreService.getBooks(page, limit, search);
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

export const getBookCover = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid book ID' });
    }

    const book = await calibreService.getBookById(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const coverPath = calibreService.getCoverPath(book);
    console.log('coverPath', coverPath);
    if (!coverPath) {
      return res.status(404).json({ error: 'Cover not found' });
    }

    // Check if file exists
    if (!fs.existsSync(coverPath)) {
      return res.status(404).json({ error: 'Cover file not found' });
    }

    // Send the file
    res.sendFile(coverPath);
  } catch (error) {
    console.error('Error serving book cover:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' });
  }
};

export const downloadBook = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid book ID' });
    }

    const book = await calibreService.getBookById(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const filePath = calibreService.getBookFilePath(book);
    console.log('filePath', filePath);
    if (!filePath) {
      return res.status(404).json({ error: 'Book file not found' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Book file not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${book.title}.${book.format}"`);
    res.setHeader('Content-Type', `application/${book.format}`);

    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving book file:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' });
  }
}; 