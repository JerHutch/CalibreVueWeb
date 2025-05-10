import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.development.env' });

export interface Book {
  id: number;
  title: string;
  author: string;
  publisher: string;
  pubdate: string;
  isbn: string;
  path: string;
  has_cover: number;
  timestamp: string;
  last_modified: string;
  series_index: number;
  series: string;
  language: string;
  format: string;
}

export class CalibreService {
  private db: Database;

  constructor() {
    const dbFilename = process.env.DB_FILENAME || 'metadata.db';
    const dbPath = path.join(process.cwd(), dbFilename);
    
    if (!dbFilename) {
      throw new Error('DB_FILENAME environment variable is not set');
    }

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error connecting to database:', err);
        throw err;
      }
      console.log('Connected to Calibre database:', dbPath);
    });
  }

  async getBooks(page: number = 1, pageSize: number = 20): Promise<{ books: Book[], total: number }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * pageSize;
      
      // First get total count
      this.db.get('SELECT COUNT(*) as count FROM books', (err, result: any) => {
        if (err) {
          reject(err);
          return;
        }

        const total = result.count;

        // Then get paginated books
        const query = `
          SELECT 
            b.id,
            b.title,
            (SELECT GROUP_CONCAT(a.name, ', ') FROM books_authors_link bal 
             JOIN authors a ON a.id = bal.author 
             WHERE bal.book = b.id) as author,
            b.publisher,
            b.pubdate,
            b.isbn,
            b.path,
            b.has_cover,
            b.timestamp,
            b.last_modified,
            b.series_index,
            (SELECT name FROM series WHERE id = b.series) as series,
            b.language,
            (SELECT format FROM data WHERE book = b.id LIMIT 1) as format
          FROM books b
          ORDER BY b.timestamp DESC
          LIMIT ? OFFSET ?
        `;
        
        this.db.all(query, [pageSize, offset], (err, rows: Book[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ books: rows, total });
        });
      });
    });
  }

  async getBookById(id: number): Promise<Book | null> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          b.id,
          b.title,
          (SELECT GROUP_CONCAT(a.name, ', ') FROM books_authors_link bal 
           JOIN authors a ON a.id = bal.author 
           WHERE bal.book = b.id) as author,
          b.publisher,
          b.pubdate,
          b.isbn,
          b.path,
          b.has_cover,
          b.timestamp,
          b.last_modified,
          b.series_index,
          (SELECT name FROM series WHERE id = b.series) as series,
          b.language,
          (SELECT format FROM data WHERE book = b.id LIMIT 1) as format
        FROM books b
        WHERE b.id = ?
      `;
      
      this.db.get(query, [id], (err, row: Book) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row || null);
      });
    });
  }

  close() {
    this.db.close();
  }
} 