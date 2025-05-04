import { User, UserInput } from '../types/user';
import { db } from '../database';

const convertDbUserToUser = (dbUser: any): User => ({
  id: dbUser.id,
  name: dbUser.name,
  email: dbUser.email,
  isAdmin: Boolean(dbUser.isAdmin),
  isApproved: Boolean(dbUser.isApproved),
  createdAt: new Date(dbUser.createdAt),
  updatedAt: new Date(dbUser.updatedAt)
});

export const findOrCreateUser = async (input: UserInput & { id: string }): Promise<User> => {
  const existingUser = await db.get('SELECT * FROM users WHERE id = ? OR email = ?', [input.id, input.email]);
  if (existingUser) {
    return convertDbUserToUser(existingUser);
  }

  const now = new Date();
  const user: User = {
    id: input.id,
    name: input.name,
    email: input.email,
    isAdmin: input.isAdmin || false,
    isApproved: input.isApproved || false,
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

  return convertDbUserToUser(updatedUser);
}; 