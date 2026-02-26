import bcrypt from 'bcryptjs';
import db from './init-database.js';

// Insert dev user if doesn't exist
const devUserExists = db.prepare('SELECT id FROM users WHERE email = ?').get('dev@local.com');

if (!devUserExists) {
  const devPasswordHash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO users (email, password, name, provider, google_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('dev@local.com', devPasswordHash, 'Dev User', 'local', null, new Date().toISOString());
  
  console.log('✅ Dev user created: dev@local.com / password123');
}

export const findUserById = (id) => {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
};

export const findUserByEmail = (email) => {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
};

export const findUserByGoogleId = (googleId) => {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
};

export const createUser = (userData) => {
  const result = db.prepare(`
    INSERT INTO users (email, password, name, provider, google_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userData.email.toLowerCase(),
    userData.password || null,
    userData.name,
    userData.provider || 'local',
    userData.googleId || null,
    new Date().toISOString()
  );
  
  const user = findUserById(result.lastInsertRowid);
  console.log(`✅ User created: ${user.email}`);
  return user;
};

export const getAllUsers = () => {
  return db.prepare('SELECT id, email, name, provider, created_at FROM users').all();
};

export const updateUserPassword = (userId, hashedPassword) => {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
};

export default {
  findUserById,
  findUserByEmail,
  findUserByGoogleId,
  createUser,
  getAllUsers,
  updateUserPassword
};