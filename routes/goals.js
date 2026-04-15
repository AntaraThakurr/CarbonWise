// ===== Goals Routes =====
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { awardXP, checkBadges } = require('../utils/gamification');

// Get all goals for user
router.get('/', authenticateToken, (req, res) => {
    try {
        const { status } = req.query;

        let query = 'SELECT * FROM goals WHERE user_id = ?';
        const params = [req.user.id];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const goals = db.prepare(query).all(...params);

        // Calculate progress for each goal
        const goalsWithProgress = goals.map(goal => {
            const progress = goal.target_value ? Math.min(100, (goal.current_value / goal.target_value) * 100) : 0;
            const daysRemaining = Math.ceil((new Date(goal.end_date) - new Date()) / (1000 * 60 * 60 * 24));
            return {
                ...goal,
                progress: Math.round(progress),
                daysRemaining: Math.max(0, daysRemaining),
                isExpired: daysRemaining < 0 && goal.status === 'active'
            };
        });

        res.json({ goals: goalsWithProgress });
    } catch (error) {
        console.error('Get goals error:', error);
        res.status(500).json({ error: 'Failed to fetch goals', message: error.message });
    }
});

// Create new goal
router.post('/', authenticateToken, (req, res) => {
    try {
        // Support both old and new field names for compatibility
        const { 
            type, category, 
            title, 
            target, target_value, targetValue,
            duration, duration_days 
        } = req.body;

        const goalType = type || category || 'general';
        const goalTitle = title || `${goalType} reduction goal`;
        const goalTarget = target_value || targetValue || target || 10;
        const goalDuration = duration || 'month';
        const durationDays = duration_days || 30;

        if (!goalType) {
            return res.status(400).json({ error: 'Goal type/category is required' });
        }

        // Calculate end date based on duration
        const startDate = new Date();
        let endDate = new Date();
        
        if (duration_days) {
            endDate.setDate(endDate.getDate() + parseInt(duration_days));
        } else {
            switch (goalDuration) {
                case 'week':
                    endDate.setDate(endDate.getDate() + 7);
                    break;
                case '2weeks':
                    endDate.setDate(endDate.getDate() + 14);
                    break;
                case 'month':
                    endDate.setMonth(endDate.getMonth() + 1);
                    break;
                case '3months':
                    endDate.setMonth(endDate.getMonth() + 3);
                    break;
                default:
                    endDate.setDate(endDate.getDate() + 30);
            }
        }

        // Determine XP reward based on difficulty
        let xpReward = 100;
        const days = duration_days || (goalDuration === 'month' ? 30 : goalDuration === '3months' ? 90 : 7);
        if (days >= 30) xpReward = 150;
        if (days >= 60) xpReward = 250;

        const result = db.prepare(`
            INSERT INTO goals (user_id, type, title, target, target_value, duration, xp_reward, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.user.id,
            goalType,
            goalTitle,
            goalTitle,
            goalTarget,
            goalDuration,
            xpReward,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        const goalId = Number(result.lastInsertRowid);

        // Award XP for creating a goal (linked to this goal)
        awardXP(req.user.id, 15, 'goal', `Created goal: ${goalTitle}`, { goalId });

        const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);

        res.status(201).json({
            message: 'Goal created successfully',
            goal,
            xpAwarded: 15
        });
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Failed to create goal', message: error.message });
    }
});

// Update goal progress
router.put('/:id/progress', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { currentValue, increment } = req.body;

        const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        let newValue = currentValue !== undefined ? currentValue : goal.current_value;
        if (increment) {
            newValue = goal.current_value + increment;
        }

        // Check if goal completed
        let status = goal.status;
        let xpAwarded = 0;
        if (newValue >= goal.target_value && goal.status === 'active') {
            status = 'completed';
            xpAwarded = goal.xp_reward;
            awardXP(req.user.id, goal.xp_reward, 'goal', `Completed goal: ${goal.title}`, { goalId: parseInt(id) });
            checkBadges(req.user.id);
        }

        db.prepare('UPDATE goals SET current_value = ?, status = ? WHERE id = ?').run(newValue, status, id);

        const updatedGoal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
        const progress = Math.round((newValue / goal.target_value) * 100);

        res.json({
            message: status === 'completed' ? 'Congratulations! Goal completed!' : 'Progress updated',
            goal: { ...updatedGoal, progress },
            xpAwarded,
            completed: status === 'completed'
        });
    } catch (error) {
        console.error('Update goal progress error:', error);
        res.status(500).json({ error: 'Failed to update goal', message: error.message });
    }
});

// Update goal
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { title, target_value, type, duration_days, xp_reward } = req.body;

        const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        // Calculate new end date if duration changed
        let endDate = goal.end_date;
        if (duration_days) {
            const startDate = new Date(goal.start_date);
            endDate = new Date(startDate.getTime() + duration_days * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];
        }

        db.prepare(`
            UPDATE goals 
            SET title = COALESCE(?, title),
                target_value = COALESCE(?, target_value),
                type = COALESCE(?, type),
                duration = COALESCE(?, duration),
                end_date = ?,
                xp_reward = COALESCE(?, xp_reward)
            WHERE id = ?
        `).run(
            title, 
            target_value, 
            type, 
            duration_days ? `${duration_days} days` : null,
            endDate,
            xp_reward,
            id
        );

        const updatedGoal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
        res.json({ message: 'Goal updated', goal: updatedGoal });
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Failed to update goal', message: error.message });
    }
});

// Abandon/cancel goal
router.put('/:id/abandon', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        db.prepare('UPDATE goals SET status = ? WHERE id = ?').run('abandoned', id);

        res.json({ message: 'Goal abandoned' });
    } catch (error) {
        console.error('Abandon goal error:', error);
        res.status(500).json({ error: 'Failed to abandon goal', message: error.message });
    }
});

// Delete goal
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        // Prevent deletion of completed goals
        if (goal.status === 'completed') {
            return res.status(400).json({ error: 'Cannot delete completed goals' });
        }

        // Find all XP entries linked to this goal and deduct XP
        const xpEntries = db.prepare('SELECT * FROM xp_history WHERE goal_id = ? AND user_id = ?').all(id, req.user.id);
        let totalXpDeducted = 0;
        
        if (xpEntries.length > 0) {
            // Sum up all XP from this goal
            totalXpDeducted = xpEntries.reduce((sum, entry) => sum + entry.amount, 0);
            
            // Get current user XP and subtract
            const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(req.user.id);
            if (user) {
                const newXP = Math.max(0, user.xp - totalXpDeducted);
                // Recalculate level based on new XP
                const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000];
                let newLevel = 1;
                for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
                    if (newXP >= LEVEL_THRESHOLDS[i]) {
                        newLevel = i + 1;
                        break;
                    }
                }
                db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXP, newLevel, req.user.id);
            }
            
            // Delete all XP history entries linked to this goal
            db.prepare('DELETE FROM xp_history WHERE goal_id = ?').run(id);
        }

        db.prepare('DELETE FROM goals WHERE id = ?').run(id);

        res.json({ 
            message: 'Goal deleted',
            xpDeducted: totalXpDeducted
        });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Failed to delete goal', message: error.message });
    }
});

// Get goal templates
router.get('/templates', (req, res) => {
    const templates = [
        { type: 'reduce-transport', title: 'Reduce Transport Emissions', description: 'Cut your transportation carbon footprint', targetUnit: '%' },
        { type: 'reduce-energy', title: 'Reduce Energy Usage', description: 'Lower your electricity consumption', targetUnit: 'kWh' },
        { type: 'diet-change', title: 'Meatless Days Challenge', description: 'Go vegetarian for specified days', targetUnit: 'days' },
        { type: 'zero-waste', title: 'Zero Waste Challenge', description: 'Minimize landfill waste', targetUnit: 'days' },
        { type: 'streak', title: 'Logging Streak', description: 'Log activities consistently', targetUnit: 'days' },
        { type: 'bike-commute', title: 'Bike to Work', description: 'Cycle instead of driving', targetUnit: 'trips' },
        { type: 'public-transit', title: 'Public Transit Challenge', description: 'Use buses or trains', targetUnit: 'trips' }
    ];
    res.json({ templates });
});

module.exports = router;
