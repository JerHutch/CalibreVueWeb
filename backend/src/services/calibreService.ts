import Database from 'better-sqlite3';
import path from 'path';

export interface Book {
  id: number;
  title: string;
  author: string;
  publisher: string | null;
  pubdate: string;
  isbn: string;
  path: string;
  has_cover: number;
  timestamp: string;
  last_modified: string;
  series_index: number;
  series: string | null;
  language: string | null;
  format: string | null;
}

interface CountResult {
  count: number;
}

export class CalibreService {
  private db: Database.Database;
  private basePath: string;

  constructor(db: Database.Database, dbPath: string) {
    this.db = db;
    // Get the directory containing the database file
    this.basePath = path.dirname(dbPath);
  }

  async getBooks(page: number = 1, pageSize: number = 20): Promise<{ books: Book[], total: number }> {
    const offset = (page - 1) * pageSize;
    
    // First get total count
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM books');
    const countResult = countStmt.get() as { count: number };
    const total = countResult.count;
    console.log(`Total books: ${total}`);

    // Then get paginated books
    const query = `
      SELECT 
        b.id,
        b.title,
        (SELECT GROUP_CONCAT(a.name, ', ') FROM books_authors_link bal 
         JOIN authors a ON a.id = bal.author 
         WHERE bal.book = b.id) as author,
        (SELECT p.name FROM books_publishers_link bpl 
         JOIN publishers p ON p.id = bpl.publisher 
         WHERE bpl.book = b.id) as publisher,
        b.pubdate,
        b.isbn,
        b.path,
        b.has_cover,
        b.timestamp,
        b.last_modified,
        (SELECT format FROM data WHERE book = b.id LIMIT 1) as format
      FROM books b
      ORDER BY b.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    const booksStmt = this.db.prepare(query);
    const books = booksStmt.all(pageSize, offset) as Book[];
    console.log(`Found ${books.length} books`);
    if (books.length > 0) {
      console.log('First book:', books[0]);
    }
    return { books, total };
  }

  async getBookById(id: number): Promise<Book | null> {
    const query = `
      SELECT 
        b.id,
        b.title,
        (SELECT GROUP_CONCAT(a.name, ', ') FROM books_authors_link bal 
         JOIN authors a ON a.id = bal.author 
         WHERE bal.book = b.id) as author,
        (SELECT p.name FROM books_publishers_link bpl 
         JOIN publishers p ON p.id = bpl.publisher 
         WHERE bpl.book = b.id) as publisher,
        b.pubdate,
        b.isbn,
        b.path,
        b.has_cover,
        b.timestamp,
        b.last_modified,
        (SELECT format FROM data WHERE book = b.id LIMIT 1) as format
      FROM books b
      WHERE b.id = ?
    `;
    
    const bookStmt = this.db.prepare(query);
    const book = bookStmt.get(id) as Book | undefined;
    return book || null;
  }

  getCoverPath(book: Book): string | null {
    if (!book.has_cover) {
      return null;
    }
    return path.join(this.basePath, book.path, 'cover.jpg');
  }

  getBookFilePath(book: Book): string | null {
    if (!book.format) {
      return null;
    }
    return path.join(this.basePath, book.path, `${book.title}.${book.format}`);
  }
} 