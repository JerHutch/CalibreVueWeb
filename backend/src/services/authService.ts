import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export type UserStatus = 'pending' | 'approved' | 'denied';
const USER_SELECT_COLUMNS = 'id, username, email, google_id, display_name, picture, is_admin, status';

export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  googleId?: string;
  displayName?: string;
  picture?: string;
  status: UserStatus;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  google_id?: string;
  display_name?: string;
  picture?: string;
  status: UserStatus;
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
        isAdmin: user.isAdmin,
        status: user.status
      },
      this.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  async getUserById(id: string): Promise<User | null> {
    logger.info(`Getting user by ID: ${id}`);

    try {
      const stmt = this.db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`);
      const row = stmt.get(id) as UserRow | undefined;

      if (!row) {
        return null;
      }

      return this.mapUser(row);
    } catch (error) {
      logger.error(`Database error during get user by ID: ${error}`);
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
      const stmt = this.db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE google_id = ?`);
      let row = stmt.get(profile.id) as UserRow | undefined;

      if (!row) {
        // Check if user exists with this email
        const emailStmt = this.db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE email = ?`);
        row = emailStmt.get(profile.emails[0].value) as UserRow | undefined;

        if (!row) {
          // Create new user with pending status
          const insertStmt = this.db.prepare(`
            INSERT INTO users (
              username,
              email,
              google_id,
              display_name,
              picture,
              is_admin,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, 0, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);

          const result = insertStmt.run(
            profile.emails[0].value.split('@')[0],
            profile.emails[0].value,
            profile.id,
            profile.displayName,
            profile.photos?.[0]?.value
          );

          // Get the newly created user
          const newUserStmt = this.db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`);
          row = newUserStmt.get(result.lastInsertRowid) as UserRow;
        } else {
          // Update existing user with Google info
          const updateStmt = this.db.prepare(`
            UPDATE users
            SET
              google_id = ?,
              display_name = ?,
              picture = ?,
              created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);

          updateStmt.run(
            profile.id,
            profile.displayName,
            profile.photos?.[0]?.value,
            row.id
          );

          const updatedUserStmt = this.db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`);
          row = updatedUserStmt.get(row.id) as UserRow;
        }
      }

      return this.mapUser(row);
    } catch (error) {
      logger.error(`Error in findOrCreateUser: ${error}`);
      return null;
    }
  }

  async getPendingUsers(): Promise<User[]> {
    try {
      const stmt = this.db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE status = ?`);
      const rows = stmt.all('pending') as UserRow[];

      return rows.map(row => this.mapUser(row));
    } catch (error) {
      logger.error(`Error getting pending users: ${error}`);
      throw error;
    }
  }

  async updateUserStatus(userId: number, status: UserStatus): Promise<User | null> {
    try {
      const updateStmt = this.db.prepare('UPDATE users SET status = ? WHERE id = ?');
      updateStmt.run(status, userId);

      return this.getUserById(userId.toString());
    } catch (error) {
      logger.error(`Error updating user status: ${error}`);
      throw error;
    }
  }

  private mapUser(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      isAdmin: row.is_admin === 1,
      googleId: row.google_id,
      displayName: row.display_name,
      picture: row.picture,
      status: row.status
    };
  }
}
