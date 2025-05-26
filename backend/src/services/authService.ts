import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  googleId?: string;
  displayName?: string;
  picture?: string;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  google_id?: string;
  display_name?: string;
  picture?: string;
}

export class AuthService {
  private db: Database.Database;
  private readonly JWT_SECRET: string;

  constructor(db: Database.Database) {
    this.db = db;
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  }


  generateToken(user: User): string {
    return jwt.sign(
      { 
        id: user.id,
        email: user.email,
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

  async findOrCreateUser(profile: any): Promise<User | null> {
    try {
      // Check if user exists with this Google ID
      const stmt = this.db.prepare('SELECT * FROM users WHERE google_id = ?');
      let row = stmt.get(profile.id) as UserRow | undefined;

      if (!row) {
        // Check if user exists with this email
        const emailStmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        row = emailStmt.get(profile.emails[0].value) as UserRow | undefined;

        if (!row) {
          // Create new user
          const insertStmt = this.db.prepare(`
            INSERT INTO users (username, email, google_id, display_name, picture, is_admin)
            VALUES (?, ?, ?, ?, ?, 0)
          `);
          
          const result = insertStmt.run(
            profile.emails[0].value.split('@')[0],
            profile.emails[0].value,
            profile.id,
            profile.displayName,
            profile.photos?.[0]?.value
          );

          // Get the newly created user
          const newUserStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
          row = newUserStmt.get(result.lastInsertRowid) as UserRow;
        } else {
          // Update existing user with Google info
          const updateStmt = this.db.prepare(`
            UPDATE users 
            SET google_id = ?, display_name = ?, picture = ?
            WHERE id = ?
          `);
          
          updateStmt.run(
            profile.id,
            profile.displayName,
            profile.photos?.[0]?.value,
            row.id
          );
        }
      }

      return {
        id: row.id,
        username: row.username,
        email: row.email,
        isAdmin: row.is_admin === 1,
        googleId: row.google_id,
        displayName: row.display_name,
        picture: row.picture
      };
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      return null;
    }
  }
} 