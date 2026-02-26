#!/usr/bin/env node
/**
 * Admin password reset script
 * Usage:
 *   node src/scripts/reset-user-password.js                  ← list all users
 *   node src/scripts/reset-user-password.js user@email.com   ← list + prompt
 *   node src/scripts/reset-user-password.js user@email.com NewPass123
 */
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../../database.db'));

const users = db.prepare(`SELECT id, email, name, provider, created_at FROM users ORDER BY id`).all();

console.log('\n👥 Registered users:');
console.log('─'.repeat(60));
users.forEach(u => {
  const type = u.provider === 'local' ? '🔑 local' : `🌐 ${u.provider}`;
  console.log(`  #${u.id}  ${u.email.padEnd(32)}  ${u.name}  (${type})`);
});
console.log('─'.repeat(60));

const [,, email, newPassword] = process.argv;

if (!email) {
  console.log('\nUsage: node src/scripts/reset-user-password.js <email> [new-password]\n');
  db.close();
  process.exit(0);
}

const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
if (!user) {
  console.error(`\n❌  No user found with email: ${email}\n`);
  db.close();
  process.exit(1);
}
if (user.provider !== 'local') {
  console.error(`\n❌  User "${email}" uses ${user.provider} login — no password to reset.\n`);
  db.close();
  process.exit(1);
}

const doReset = async (password) => {
  if (password.length < 6) {
    console.error('\n❌  Password must be at least 6 characters.\n');
    db.close();
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  // Invalidate any existing reset tokens
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);
  console.log(`\n✅  Password updated for ${user.email} (${user.name})\n`);
  db.close();
};

if (newPassword) {
  // Password passed as argument
  doReset(newPassword);
} else {
  // Prompt interactively
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`\nNew password for ${user.email}: `, (answer) => {
    rl.close();
    doReset(answer.trim());
  });
}
