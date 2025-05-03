import { User, UserInput } from '../types/user';
import { db } from '../database';

export const findOrCreateUser = async (input: UserInput & { id: string }): Promise<User> => {
  const existingUser = await db.get(
    'SELECT * FROM users WHERE id = ? OR email = ?',
    [input.id, input.email]
  );

  if (existingUser) {
    return existingUser;
  }

  const now = new Date();
  const user: User = {
    ...input,
    createdAt: now,
    updatedAt: now
  };

  await db.run(
    `INSERT INTO users (id, name, email, isAdmin, isApproved, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.name,
      user.email,
      user.isAdmin ? 1 : 0,
      user.isApproved ? 1 : 0,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    ]
  );

  return user;
};

export const updateUser = async (id: string, updates: Partial<UserInput>): Promise<User> => {
  const now = new Date();
  const updateFields = Object.entries(updates)
    .filter(([_, value]) => value !== undefined)
    .map(([key]) => `${key} = ?`)
    .join(', ');

  const values = [
    ...Object.values(updates).filter(value => value !== undefined),
    now.toISOString(),
    id
  ];

  await db.run(
    `UPDATE users 
     SET ${updateFields}, updatedAt = ?
     WHERE id = ?`,
    values
  );

  const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  if (!updatedUser) {
    throw new Error('User not found');
  }

  return updatedUser;
}; 