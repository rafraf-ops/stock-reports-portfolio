import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken } from '../middleware/auth.js';
import * as userDB from '../services/user-database.js';
import db from '../services/init-database.js';
import { sendPasswordResetEmail } from '../services/email.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register new user with email/password
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check if user exists
    const existingUser = userDB.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = userDB.createUser({
      email,
      password: hashedPassword,
      name,
      provider: 'local'
    });
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find user
    const user = userDB.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/google
 * Google OAuth login (simplified - we'll enhance this)
 */
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name } = req.body;
    
    // Find or create user
    let user = userDB.findUserByGoogleId(googleId);
    
    if (!user) {
      user = userDB.createUser({
        email,
        name,
        provider: 'google',
        googleId
      });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      error: 'Google login failed'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset link
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const user = userDB.findUserByEmail(email);

    // Always respond success so we don't reveal whether an email is registered
    if (!user || user.provider !== 'local') {
      return res.json({ success: true, emailSent: false });
    }

    // Invalidate old tokens for this user
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, user.id, expiresAt);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl    = `${frontendUrl}/reset-password?token=${token}`;

    const emailSent = await sendPasswordResetEmail(email, resetUrl);

    // In dev (no email) expose the URL in the response so admin can use it
    const devPayload = (!emailSent && process.env.NODE_ENV !== 'production') ? { resetUrl } : {};

    res.json({ success: true, emailSent, ...devPayload });
  } catch (error) {
    console.error('Forgot-password error:', error);
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Set a new password using a reset token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ success: false, error: 'Token and password are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    const record = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token);

    if (!record || record.used || record.expires_at < Date.now()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    userDB.updateUserPassword(record.user_id, hashedPassword);

    // Mark token as used (single-use)
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset-password error:', error);
    res.status(500).json({ success: false, error: 'Reset failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
    
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    
    const user = userDB.findUserById(decoded.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider
      }
    });
    
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

export default router;