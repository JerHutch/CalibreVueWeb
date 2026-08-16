import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

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
  file_name: string | null;
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

  async getBooks(page: number = 1, pageSize: number = 20, search?: string): Promise<{ books: Book[], total: number }> {
    const offset = (page - 1) * pageSize;
    
    // Build the WHERE clause for search
    let whereClause = '';
    let params: any[] = [];
    
    if (search) {
      whereClause = `
        WHERE b.title LIKE ? 
        OR EXISTS (
          SELECT 1 FROM books_authors_link bal 
          JOIN authors a ON a.id = bal.author 
          WHERE bal.book = b.id AND a.name LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      params = [searchPattern, searchPattern];
    }

    // First get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM books b
      ${whereClause}
    `;
    const countStmt = this.db.prepare(countQuery);
    const countResult = countStmt.get(...params) as { count: number };
    const total = countResult.count;
    logger.info(`Total books: ${total}`);

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
        (SELECT i.val FROM identifiers i
         WHERE i.book = b.id AND i.type = 'isbn'
         LIMIT 1) as isbn,
        b.path,
        b.has_cover,
        b.timestamp,
        b.last_modified,
        b.series_index,
        (SELECT s.name FROM books_series_link bsl
         JOIN series s ON s.id = bsl.series
         WHERE bsl.book = b.id) as series,
        (SELECT GROUP_CONCAT(l.lang_code, ', ') FROM books_languages_link bll
         JOIN languages l ON l.id = bll.lang_code
         WHERE bll.book = b.id) as language,
        (SELECT d.format FROM data d
         WHERE d.book = b.id
         ORDER BY d.format COLLATE NOCASE
         LIMIT 1) as format,
        (SELECT d.name FROM data d
         WHERE d.book = b.id
         ORDER BY d.format COLLATE NOCASE
         LIMIT 1) as file_name
      FROM books b
      ${whereClause}
      ORDER BY b.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    const booksStmt = this.db.prepare(query);
    const books = booksStmt.all(...params, pageSize, offset) as Book[];
    logger.info(`Found ${books.length} books`);
    if (books.length > 0) {
      logger.info('First book: ' + JSON.stringify(books[0]));
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
        (SELECT i.val FROM identifiers i
         WHERE i.book = b.id AND i.type = 'isbn'
         LIMIT 1) as isbn,
        b.path,
        b.has_cover,
        b.timestamp,
        b.last_modified,
        b.series_index,
        (SELECT s.name FROM books_series_link bsl
         JOIN series s ON s.id = bsl.series
         WHERE bsl.book = b.id) as series,
        (SELECT GROUP_CONCAT(l.lang_code, ', ') FROM books_languages_link bll
         JOIN languages l ON l.id = bll.lang_code
         WHERE bll.book = b.id) as language,
        (SELECT d.format FROM data d
         WHERE d.book = b.id
         ORDER BY d.format COLLATE NOCASE
         LIMIT 1) as format,
        (SELECT d.name FROM data d
         WHERE d.book = b.id
         ORDER BY d.format COLLATE NOCASE
         LIMIT 1) as file_name
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
    const author = book.author.split('| ').map(name => name.trim()).join(', ');
    const fileName = book.file_name || `${book.title} - ${author}`;
    return path.join(this.basePath, book.path, `${fileName}.${book.format.toLowerCase()}`);
  }
}
