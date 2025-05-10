import Database from 'better-sqlite3';

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
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async getBooks(page: number = 1, pageSize: number = 20): Promise<{ books: Book[], total: number }> {
    try {
      const offset = (page - 1) * pageSize;
      
      // First get total count
      const countResult = this.db.prepare('SELECT COUNT(*) as count FROM books').get();
      const total = countResult.count;

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
      
      const books = this.db.prepare(query).all(pageSize, offset) as Book[];
      return { books, total };
    } finally {
      this.db.close();
    }
  }

  async getBookById(id: number): Promise<Book | null> {
    try {
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
      
      const book = this.db.prepare(query).get(id) as Book | undefined;
      return book || null;
    } finally {
      this.db.close();
    }
  }
} 