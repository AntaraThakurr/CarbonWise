// ===== Authentication Routes =====
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'carbonwise_secret_key';
const TOKEN_EXPIRY = '7d';

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, name, username, password } = req.body;
        const displayName = name || username;

        // Validation
        if (!email || !displayName || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        const result = db.prepare(`
            INSERT INTO users (email, username, password, xp, level, streak, last_activity_date)
            VALUES (?, ?, ?, 0, 1, 0, ?)
        `).run(email, displayName, hashedPassword, new Date().toISOString().split('T')[0]);

        const userId = result.lastInsertRowid;

        // Create default calculator profile
        db.prepare('INSERT INTO calculator_profiles (user_id) VALUES (?)').run(userId);

        // Generate token
        const token = jwt.sign({ id: userId, email, username: displayName }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

        // Award first registration badge
        try {
            const firstStepsBadge = db.prepare('SELECT id FROM badges WHERE name = ?').get('First Steps');
            if (firstStepsBadge) {
                db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, firstStepsBadge.id);
            }
        } catch (e) { /* Badge already exists or not found */ }

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: userId,
                email,
                name: displayName,
                xp: 0,
                level: 1,
                streak: 0
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed', message: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update streak
        const today = new Date().toISOString().split('T')[0];
        const lastDate = user.last_activity_date;
        let newStreak = user.streak;

        if (lastDate) {
            const lastDateObj = new Date(lastDate);
            const todayObj = new Date(today);
            const diffDays = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak = user.streak + 1;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }

        db.prepare('UPDATE users SET streak = ?, last_activity_date = ? WHERE id = ?').run(newStreak, today, user.id);

        // Generate token
        const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.username,
                xp: user.xp,
                level: user.level,
                streak: newStreak
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed', message: error.message });
    }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT id, email, username as name, xp, level, streak, last_activity_date, created_at
            FROM users WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Recalculate level from XP to ensure accuracy
        const { calculateLevel } = require('../utils/gamification');
        const correctLevel = calculateLevel(user.xp || 0);
        
        // Update level in database if it's wrong
        if (correctLevel !== user.level) {
            db.prepare('UPDATE users SET level = ? WHERE id = ?').run(correctLevel, user.id);
            user.level = correctLevel;
        }

        // Get user badges
        const badges = db.prepare(`
            SELECT b.*, ub.earned_at
            FROM badges b
            JOIN user_badges ub ON b.id = ub.badge_id
            WHERE ub.user_id = ?
        `).all(req.user.id);

        res.json({
            ...user,
            badges,
            badgeCount: badges.length
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile', message: error.message });
    }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { username, email } = req.body;

        // Check if username is already taken
        if (username) {
            const existingUsername = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
            if (existingUsername) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }

        // Check if email is already taken
        if (email) {
            const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        // Update fields
        if (username && email) {
            db.prepare('UPDATE users SET username = ?, email = ? WHERE id = ?').run(username, email, req.user.id);
        } else if (username) {
            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
        } else if (email) {
            db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.user.id);
        }

        const user = db.prepare('SELECT id, email, username, xp, level, streak FROM users WHERE id = ?').get(req.user.id);
        res.json({ message: 'Profile updated', user });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile', message: error.message });
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, req.user.id);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password', message: error.message });
    }
});

module.exports = router;
