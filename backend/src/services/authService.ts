import { Database } from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export class AuthService {
  private db: Database;
  private readonly JWT_SECRET: string;

  constructor(db: Database) {
    this.db = db;
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          const isValid = await bcrypt.compare(password, row.password);
          if (!isValid) {
            resolve(null);
            return;
          }

          resolve({
            id: row.id,
            username: row.username,
            email: row.email,
            isAdmin: row.is_admin === 1
          });
        }
      );
    });
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
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, email, is_admin FROM users WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          resolve({
            id: row.id,
            username: row.username,
            email: row.email,
            isAdmin: row.is_admin === 1
          });
        }
      );
    });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
} 