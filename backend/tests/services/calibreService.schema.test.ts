import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { existsSync } from 'fs';
import { CalibreService } from '../../src/services/calibreService';

const sampleDatabasePath = path.resolve(__dirname, '../../../app_data/sample_metadata.db');

function createCalibreSchema(db: Database.Database) {
  // This is the relational schema used by the supplied Calibre metadata.db.
  db.exec(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Unknown' COLLATE NOCASE,
      sort TEXT COLLATE NOCASE,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      pubdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      series_index REAL NOT NULL DEFAULT 1.0,
      author_sort TEXT COLLATE NOCASE,
      path TEXT NOT NULL DEFAULT '',
      uuid TEXT,
      has_cover BOOL DEFAULT 0,
      last_modified TIMESTAMP NOT NULL DEFAULT '2000-01-01 00:00:00+00:00'
    );
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE,
      sort TEXT COLLATE NOCASE,
      link TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE publishers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE,
      sort TEXT COLLATE NOCASE,
      link TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE series (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE,
      sort TEXT COLLATE NOCASE,
      link TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE languages (
      id INTEGER PRIMARY KEY,
      lang_code TEXT NOT NULL COLLATE NOCASE,
      link TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE books_authors_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      author INTEGER NOT NULL,
      UNIQUE(book, author)
    );
    CREATE TABLE books_publishers_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      publisher INTEGER NOT NULL,
      UNIQUE(book)
    );
    CREATE TABLE books_series_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      series INTEGER NOT NULL,
      UNIQUE(book)
    );
    CREATE TABLE books_languages_link (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      lang_code INTEGER NOT NULL,
      item_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(book, lang_code)
    );
    CREATE TABLE identifiers (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'isbn' COLLATE NOCASE,
      val TEXT NOT NULL COLLATE NOCASE,
      UNIQUE(book, type)
    );
    CREATE TABLE data (
      id INTEGER PRIMARY KEY,
      book INTEGER NOT NULL,
      format TEXT NOT NULL COLLATE NOCASE,
      uncompressed_size INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(book, format)
    );
  `);
}

function seedCalibreSchema(db: Database.Database) {
  db.exec(`
    INSERT INTO authors (id, name) VALUES (1, 'Author One'), (2, 'Author Two');
    INSERT INTO publishers (id, name) VALUES (1, 'Example Publisher');
    INSERT INTO series (id, name) VALUES (1, 'Example Series');
    INSERT INTO languages (id, lang_code) VALUES (1, 'eng'), (2, 'spa');

    INSERT INTO books (id, title, timestamp, pubdate, series_index, path, has_cover, last_modified)
    VALUES
      (1, 'Older Book', '2024-01-01 00:00:00+00:00', '2020-01-01 00:00:00+00:00', 1.0, 'Author One/Older Book (1)', 0, '2024-01-01 00:00:00+00:00'),
      (2, 'Primary Book', '2024-02-01 00:00:00+00:00', '2021-02-01 00:00:00+00:00', 2.5, 'Author One/Primary Book (2)', 1, '2024-02-01 00:00:00+00:00'),
      (3, 'No Metadata Book', '2024-03-01 00:00:00+00:00', '2022-03-01 00:00:00+00:00', 1.0, 'Unknown/No Metadata Book (3)', 0, '2024-03-01 00:00:00+00:00');

    INSERT INTO books_authors_link (id, book, author) VALUES (1, 1, 1), (2, 2, 1), (3, 2, 2);
    INSERT INTO books_publishers_link (id, book, publisher) VALUES (1, 2, 1);
    INSERT INTO books_series_link (id, book, series) VALUES (1, 2, 1);
    INSERT INTO books_languages_link (id, book, lang_code, item_order) VALUES (1, 2, 1, 0), (2, 2, 2, 1);
    INSERT INTO identifiers (id, book, type, val) VALUES (1, 2, 'isbn', '978-1-234-56789-0'), (2, 2, 'asin', 'B000000001');
    INSERT INTO data (id, book, format, uncompressed_size, name)
    VALUES
      (1, 1, 'EPUB', 100, 'Older Book - Author One'),
      (2, 2, 'EPUB', 200, 'Primary Book - Author One, Author Two'),
      (3, 2, 'AZW3', 300, 'Primary Book - Author One, Author Two');
  `);
}

describe('CalibreService Calibre schema contract', () => {
  let db: Database.Database;
  let calibreService: CalibreService;

  beforeEach(() => {
    db = new Database(':memory:');
    createCalibreSchema(db);
    seedCalibreSchema(db);
    calibreService = new CalibreService(db, '/library/metadata.db');
  });

  afterEach(() => {
    db.close();
  });

  it('maps relational metadata from the Calibre schema', async () => {
    const book = await calibreService.getBookById(2);

    expect(book).toMatchObject({
      id: 2,
      title: 'Primary Book',
      author: 'Author One, Author Two',
      publisher: 'Example Publisher',
      isbn: '978-1-234-56789-0',
      series_index: 2.5,
      series: 'Example Series',
      language: 'eng, spa',
      format: 'AZW3',
      file_name: 'Primary Book - Author One, Author Two'
    });
  });

  it('returns a stable, timestamp-ordered page and accurate total', async () => {
    const result = await calibreService.getBooks(1, 2);

    expect(result.total).toBe(3);
    expect(result.books.map(book => book.id)).toEqual([3, 2]);

    const secondPage = await calibreService.getBooks(2, 2);
    expect(secondPage.books.map(book => book.id)).toEqual([1]);
  });

  it('searches both titles and linked author names', async () => {
    const titleResult = await calibreService.getBooks(1, 20, 'Primary');
    const authorResult = await calibreService.getBooks(1, 20, 'Author Two');

    expect(titleResult).toMatchObject({ total: 1 });
    expect(titleResult.books.map(book => book.id)).toEqual([2]);
    expect(authorResult).toMatchObject({ total: 1 });
    expect(authorResult.books.map(book => book.id)).toEqual([2]);
  });

  it('preserves null optional metadata and returns null for an unknown book', async () => {
    const book = await calibreService.getBookById(3);

    expect(book).toMatchObject({
      id: 3,
      publisher: null,
      isbn: null,
      series: null,
      language: null,
      format: null,
      file_name: null
    });
    await expect(calibreService.getBookById(999)).resolves.toBeNull();
  });

  it('uses Calibre data.name and a lower-case format extension for the ebook path', async () => {
    const book = await calibreService.getBookById(2);

    expect(book).not.toBeNull();
    expect(calibreService.getBookFilePath(book!)).toBe(
      '/library/Author One/Primary Book (2)/Primary Book - Author One, Author Two.azw3'
    );
  });

  it('derives cover paths from Calibre book paths', async () => {
    const primaryBook = await calibreService.getBookById(2);
    const olderBook = await calibreService.getBookById(1);

    expect(calibreService.getCoverPath(primaryBook!)).toBe('/library/Author One/Primary Book (2)/cover.jpg');
    expect(calibreService.getCoverPath(olderBook!)).toBeNull();
  });
});

const describeSampleDatabase = existsSync(sampleDatabasePath) ? describe : describe.skip;

describeSampleDatabase('CalibreService supplied metadata database', () => {
  let db: Database.Database;
  let calibreService: CalibreService;

  beforeEach(() => {
    db = new Database(sampleDatabasePath, { fileMustExist: true, readonly: true });
    calibreService = new CalibreService(db, sampleDatabasePath);
  });

  afterEach(() => {
    db.close();
  });

  it('queries the supplied database schema and resolves relational ISBN metadata', async () => {
    const expectedTotal = (db.prepare('SELECT COUNT(*) AS count FROM books').get() as { count: number }).count;
    const result = await calibreService.getBooks(1, 20);
    const bookWithIsbn = await calibreService.getBookById(3);

    expect(result.total).toBe(expectedTotal);
    expect(result.books).toHaveLength(20);
    expect(bookWithIsbn).toMatchObject({
      id: 3,
      isbn: '9780743486620',
      language: 'eng',
      format: 'EPUB'
    });
  });

  it('uses data.name when Calibre truncates a long book filename', async () => {
    const book = await calibreService.getBookById(630);

    expect(book).toMatchObject({
      id: 630,
      file_name: 'The Ashes and the Star-Cursed K - Broadbent, Carissa'
    });
    expect(calibreService.getBookFilePath(book!)).toContain(
      'The Ashes and the Star-Cursed K - Broadbent, Carissa.epub'
    );
  });
});
