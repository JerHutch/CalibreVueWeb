import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  password: string;
}

export class AuthService {
  private db: Database.Database;
  private readonly JWT_SECRET: string;

  constructor(db: Database.Database) {
    this.db = db;
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    console.log(`Attempting to validate user: ${username}`);
    
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
      const row = stmt.get(username) as UserRow | undefined;

      if (!row) {
        console.log(`No user found with username: ${username}`);
        return null;
      }

      console.log(`Found user in database: ${username} ${row.id}`);
      console.log('Comparing passwords...');
      
      // const isValid = await bcrypt.compare(password, row.password);
      const isValid = password === row.password;
      console.log(`Password comparison result: ${isValid}`);
      
      if (!isValid) {
        console.log(`Invalid password for user: ${username}`);
        return null;
      }

      console.log(`Successfully validated user: ${username}`);
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        isAdmin: row.is_admin === 1
      };
    } catch (error) {
      console.error('Database error during user validation:', error);
      throw error;
    }
  }

  generateToken(user: User): string {
    return jwt.sign(
      { 
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin 
      },
      this.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  async getUserById(id: string): Promise<User | null> {
    console.log(`Getting user by ID: ${id}`);

    try {
      const stmt = this.db.prepare('SELECT id, username, email, is_admin FROM users WHERE id = ?');
      const row = stmt.get(id) as UserRow | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        username: row.username,
        email: row.email,
        isAdmin: row.is_admin === 1
      };
    } catch (error) {
      console.error('Database error during get user by ID:', error);
      throw error;
    }
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
} 