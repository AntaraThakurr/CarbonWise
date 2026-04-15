// ===== Leaderboard Routes =====
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Get leaderboard
router.get('/', optionalAuth, (req, res) => {
    try {
        const { type = 'global', limit = 20 } = req.query;
        const userId = req.user?.id;

        // Get top users by XP
        const leaderboard = db.prepare(`
            SELECT 
                u.id,
                u.username,
                u.xp,
                u.level,
                u.streak,
                (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) as badge_count,
                (SELECT COALESCE(SUM(emissions), 0) FROM activities WHERE user_id = u.id) as total_emissions,
                (SELECT COUNT(DISTINCT date) FROM activities WHERE user_id = u.id) as days_tracked
            FROM users u
            ORDER BY u.xp DESC
            LIMIT ?
        `).all(parseInt(limit));

        // Calculate rankings and reduction percentages
        const rankedLeaderboard = leaderboard.map((user, index) => {
            const dailyAvg = user.days_tracked > 0 ? user.total_emissions / user.days_tracked : 0;
            const annualProjection = dailyAvg * 365;
            const globalAvg = 4800; // 4.8 tons/year in kg
            const reductionPercent = annualProjection > 0 
                ? Math.round(((globalAvg - annualProjection) / globalAvg) * 100)
                : 0;

            return {
                rank: index + 1,
                id: user.id,
                username: user.username,
                xp: user.xp,
                level: user.level,
                streak: user.streak,
                badgeCount: user.badge_count,
                reductionPercent: Math.min(100, Math.max(-100, reductionPercent)),
                isCurrentUser: userId && user.id === userId
            };
        });

        // Get current user's rank if logged in
        let userRank = null;
        if (userId) {
            const userPosition = db.prepare(`
                SELECT COUNT(*) + 1 as rank
                FROM users
                WHERE xp > (SELECT xp FROM users WHERE id = ?)
            `).get(userId);

            const userData = db.prepare(`
                SELECT 
                    u.id,
                    u.username,
                    u.xp,
                    u.level,
                    u.streak,
                    (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) as badge_count,
                    (SELECT COALESCE(SUM(emissions), 0) FROM activities WHERE user_id = u.id) as total_emissions,
                    (SELECT COUNT(DISTINCT date) FROM activities WHERE user_id = u.id) as days_tracked
                FROM users u
                WHERE u.id = ?
            `).get(userId);

            if (userData) {
                const dailyAvg = userData.days_tracked > 0 ? userData.total_emissions / userData.days_tracked : 0;
                const annualProjection = dailyAvg * 365;
                const globalAvg = 4800;
                const reductionPercent = annualProjection > 0 
                    ? Math.round(((globalAvg - annualProjection) / globalAvg) * 100)
                    : 0;

                userRank = {
                    rank: userPosition.rank,
                    username: userData.username,
                    xp: userData.xp,
                    level: userData.level,
                    streak: userData.streak,
                    badgeCount: userData.badge_count,
                    reductionPercent: Math.min(100, Math.max(-100, reductionPercent))
                };
            }
        }

        res.json({
            leaderboard: rankedLeaderboard,
            userRank,
            type,
            totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard', message: error.message });
    }
});

// Get weekly leaderboard (by XP - same as global since we don't track weekly XP)
router.get('/weekly', optionalAuth, (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const userId = req.user?.id;

        // Use calendar week: Monday to Sunday
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - daysFromMonday);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Get users ranked by XP (sorted properly)
        const leaderboard = db.prepare(`
            SELECT 
                u.id,
                u.username,
                u.xp,
                u.level,
                u.streak,
                COALESCE(
                    (SELECT SUM(emissions) FROM activities WHERE user_id = u.id AND date >= ?),
                    0
                ) as this_week_emissions,
                COALESCE(
                    (SELECT COUNT(*) FROM activities WHERE user_id = u.id AND date >= ?),
                    0
                ) as this_week_activities
            FROM users u
            ORDER BY u.xp DESC
            LIMIT ?
        `).all(weekStartStr, weekStartStr, parseInt(limit));

        const rankedLeaderboard = leaderboard.map((user, index) => {
            return {
                rank: index + 1,
                id: user.id,
                username: user.username,
                xp: user.xp,
                level: user.level,
                streak: user.streak,
                thisWeekEmissions: user.this_week_emissions.toFixed(1),
                thisWeekActivities: user.this_week_activities,
                isCurrentUser: userId && user.id === userId
            };
        });

        res.json({
            leaderboard: rankedLeaderboard,
            period: 'weekly',
            startDate: weekStartStr
        });
    } catch (error) {
        console.error('Weekly leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly leaderboard', message: error.message });
    }
});

// Get streak leaderboard
router.get('/streaks', optionalAuth, (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const userId = req.user?.id;

        const leaderboard = db.prepare(`
            SELECT 
                id,
                username,
                streak,
                xp,
                level
            FROM users
            WHERE streak > 0
            ORDER BY streak DESC, xp DESC
            LIMIT ?
        `).all(parseInt(limit));

        const rankedLeaderboard = leaderboard.map((user, index) => ({
            rank: index + 1,
            id: user.id,
            username: user.username,
            streak: user.streak,
            xp: user.xp,
            level: user.level,
            isCurrentUser: userId && user.id === userId
        }));

        res.json({
            leaderboard: rankedLeaderboard,
            type: 'streaks'
        });
    } catch (error) {
        console.error('Streak leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch streak leaderboard', message: error.message });
    }
});

module.exports = router;
