// ===== Activities Routes =====
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { checkBadges, awardXP, updateGoalProgress } = require('../utils/gamification');

// Emission factors (kg CO2 per unit) - MUST match frontend/app.js
const EMISSION_FACTORS = {
    electricity: {
        coal: 0.91,
        'natural-gas': 0.42,
        mixed: 0.48,
        renewable: 0.02,
        nuclear: 0.012
    },
    transport: {
        car: { petrol: 0.21, diesel: 0.27, hybrid: 0.12, electric: 0.05 },
        bus: 0.089,
        train: 0.041,
        plane: 0.255,
        bike: 0,
        walk: 0,
        metro: 0.035,
        motorcycle: 0.103,
        carpool: 0.07
    },
    heating: {
        'natural-gas': 0.20,
        oil: 0.27,
        electric: 0.12,
        'heat-pump': 0.03,
        wood: 0.05
    },
    diet: {
        'meat-heavy': 7.2,
        average: 5.6,
        'low-meat': 4.7,
        pescatarian: 3.9,
        vegetarian: 3.8,
        vegan: 2.9
    },
    waste: {
        perBag: 2.5,
        recyclingReduction: 0.1,
        compostReduction: 0.2
    }
};

// Get all activities for user
router.get('/', authenticateToken, (req, res) => {
    try {
        const { date, startDate, endDate, category } = req.query;

        let query = 'SELECT * FROM activities WHERE user_id = ?';
        const params = [req.user.id];

        if (date) {
            query += ' AND date = ?';
            params.push(date);
        } else if (startDate && endDate) {
            query += ' AND date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY date DESC, created_at DESC';

        const rawActivities = db.prepare(query).all(...params);
        
        // Transform to include frontend-expected field names
        const activities = rawActivities.map(a => ({
            ...a,
            activity_type: a.description,
            amount: a.value
        }));

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM activities WHERE user_id = ?';
        const countParams = [req.user.id];
        if (date) {
            countQuery += ' AND date = ?';
            countParams.push(date);
        }
        if (category) {
            countQuery += ' AND category = ?';
            countParams.push(category);
        }
        const total = db.prepare(countQuery).get(...countParams).count;

        res.json({ activities, total });
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ error: 'Failed to fetch activities', message: error.message });
    }
});

// Helper to detect eco-friendly activity type from description
function detectActivityType(category, description) {
    const desc = (description || '').toLowerCase();
    
    // Preserve exact calculator activity types
    const calculatorTypes = ['electricity', 'driving', 'heating', 'daily_diet', 'household_waste'];
    if (calculatorTypes.includes(desc)) {
        return desc;
    }
    
    if (category === 'transport') {
        if (desc.includes('bike') || desc.includes('cycling') || desc.includes('biking')) return 'bike';
        if (desc.includes('walk') || desc.includes('walking')) return 'walk';
        if (desc.includes('bus')) return 'bus';
        if (desc.includes('train') || desc.includes('rail')) return 'train';
        if (desc.includes('metro') || desc.includes('subway') || desc.includes('underground')) return 'metro';
        if (desc.includes('carpool') || desc.includes('shared ride') || desc.includes('ride share')) return 'carpool';
        if (desc.includes('car') || desc.includes('drive') || desc.includes('driving')) return 'car';
    }
    
    if (category === 'diet' || category === 'food') {
        if (desc.includes('vegan')) return 'vegan';
        if (desc.includes('vegetarian') || desc.includes('veggie')) return 'vegetarian';
        if (desc.includes('low meat') || desc.includes('low-meat') || desc.includes('less meat')) return 'low-meat';
    }
    
    if (category === 'electricity' || category === 'energy') {
        if (desc.includes('solar')) return 'solar';
        if (desc.includes('wind')) return 'wind';
        if (desc.includes('renewable') || desc.includes('green energy')) return 'renewable';
        if (desc.includes('nuclear')) return 'nuclear';
    }
    
    return description;
}

// Create new activity
router.post('/', authenticateToken, (req, res) => {
    try {
        // Support both old and new field names for compatibility
        const { 
            category, 
            description, activity_type,
            value, amount,
            unit, 
            date,
            emissions: providedEmissions,
            subType, fuelType,
            inputPeriod
        } = req.body;

        const activityDescription = description || activity_type || 'Unknown activity';
        const rawValue = value !== undefined ? value : (amount !== undefined ? amount : null);
        const activityValue = rawValue !== null ? parseFloat(rawValue) : null;
        // Use local date format (not UTC) for consistency
        const now = new Date();
        const localDateDefault = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const activityDate = date || localDateDefault;
        const activityUnit = unit || 'kg';

        if (!category || activityValue === null || isNaN(activityValue)) {
            return res.status(400).json({ error: 'Category and value/amount are required' });
        }

        // Determine activity type for goal tracking
        const calcType = subType || detectActivityType(category, activityDescription);

        // Use provided emissions if available (from frontend calculation)
        // Otherwise calculate emissions from raw values
        let emissions = 0;
        
        if (providedEmissions !== undefined && providedEmissions !== null && !isNaN(parseFloat(providedEmissions))) {
            emissions = parseFloat(providedEmissions);
        } else {
            // Fallback: Calculate emissions if not provided
            switch (category) {
                case 'transport':
                    if (calcType === 'car') {
                        const fuelFactor = EMISSION_FACTORS.transport.car[fuelType] || EMISSION_FACTORS.transport.car.petrol;
                        emissions = activityValue * fuelFactor;
                    } else if (calcType in EMISSION_FACTORS.transport && typeof EMISSION_FACTORS.transport[calcType] === 'number') {
                        emissions = activityValue * EMISSION_FACTORS.transport[calcType];
                    } else {
                        emissions = activityValue * 0.21;
                    }
                    break;
                case 'electricity':
                case 'energy':
                    if (activityUnit === 'kWh') {
                        emissions = activityValue * (EMISSION_FACTORS.electricity[calcType] || 0.5);
                    } else {
                        emissions = activityValue; // Already in kg
                    }
                    break;
                case 'heating':
                    emissions = activityValue * (EMISSION_FACTORS.heating[calcType] || 2.0);
                    break;
                case 'diet':
                case 'food':
                    // Diet emissions are per day, stored value is for the period
                    emissions = EMISSION_FACTORS.diet[calcType] || 5.6;
                    break;
                case 'waste':
                    emissions = activityValue * EMISSION_FACTORS.waste.perBag;
                    break;
                default:
                    emissions = activityValue * 0.5;
            }
        }

        // Use current time in ISO format for proper timezone handling
        const createdAt = new Date().toISOString();

        const result = db.prepare(`
            INSERT INTO activities (user_id, category, description, value, unit, emissions, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, category, activityDescription, activityValue, activityUnit, emissions, activityDate, createdAt);

        // Update user streak
        const today = new Date().toISOString().split('T')[0];
        const user = db.prepare('SELECT last_activity_date, streak FROM users WHERE id = ?').get(req.user.id);
        
        let newStreak = user ? (user.streak || 0) : 0;
        if (user && user.last_activity_date !== today) {
            const lastDate = new Date(user.last_activity_date);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                newStreak = user.streak + 1;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
            
            db.prepare('UPDATE users SET streak = ?, last_activity_date = ? WHERE id = ?').run(newStreak, today, req.user.id);
        }

        // Get activity ID before awarding XP
        const activityId = result.lastInsertRowid;

        // Award XP for logging activity (linked to this activity)
        const xpResult = awardXP(req.user.id, 10, 'activity', `Logged ${category} activity`, { activityId });

        // Check for new badges
        checkBadges(req.user.id);

        // Update goal progress based on activity
        updateGoalProgress(req.user.id, category, calcType, activityValue, emissions);

        // Get the newly created activity
        let activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
        
        // Fallback: if not found by id, get the most recent activity for this user
        if (!activity) {
            activity = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
        }
        
        // Transform to include frontend-expected field names
        const responseActivity = activity ? {
            ...activity,
            activity_type: activity.description,
            amount: activity.value
        } : { id: activityId, category, description: activityDescription, value: activityValue };

        res.status(201).json({
            message: 'Activity logged successfully',
            activity: responseActivity,
            xpEarned: 10,
            streak: newStreak,
            xpDetails: xpResult ? {
                newXP: xpResult.newXP,
                leveledUp: xpResult.leveledUp,
                newLevel: xpResult.newLevel,
                levelTitle: xpResult.levelTitle
            } : null
        });
    } catch (error) {
        console.error('Create activity error:', error);
        res.status(500).json({ error: 'Failed to create activity', message: error.message });
    }
});

// Update activity
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { 
            category, description, value, amount, unit, date, 
            emissions: providedEmissions, subType, fuelType 
        } = req.body;

        // Check ownership
        const activity = db.prepare('SELECT * FROM activities WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        const newValue = value !== undefined ? parseFloat(value) : (amount !== undefined ? parseFloat(amount) : activity.value);
        const newCategory = category || activity.category;
        const newUnit = unit || activity.unit;
        const newDescription = description || activity.description;

        // Use provided emissions if available, otherwise recalculate
        let emissions;
        if (providedEmissions !== undefined && providedEmissions !== null && !isNaN(parseFloat(providedEmissions))) {
            emissions = parseFloat(providedEmissions);
        } else {
            // Recalculate emissions based on category, value, and unit
            const calcType = subType || detectActivityType(newCategory, newDescription);
            
            switch (newCategory) {
                case 'transport':
                    if (calcType === 'car') {
                        const fuelFactor = EMISSION_FACTORS.transport.car[fuelType] || EMISSION_FACTORS.transport.car.petrol;
                        emissions = newValue * fuelFactor;
                    } else if (calcType in EMISSION_FACTORS.transport && typeof EMISSION_FACTORS.transport[calcType] === 'number') {
                        emissions = newValue * EMISSION_FACTORS.transport[calcType];
                    } else {
                        emissions = newValue * 0.21;
                    }
                    break;
                case 'electricity':
                case 'energy':
                    if (newUnit === 'kWh') {
                        emissions = newValue * (EMISSION_FACTORS.electricity[calcType] || 0.5);
                    } else if (newUnit === 'sqft') {
                        // Heating: (size / 1000) * factor * hours / 8
                        emissions = (newValue / 1000) * (EMISSION_FACTORS.heating[calcType] || 2.0);
                    } else {
                        emissions = newValue; // Already in kg
                    }
                    break;
                case 'diet':
                case 'food':
                    // Diet: monthly emissions = daily factor * 30
                    const dailyFactor = EMISSION_FACTORS.diet[calcType] || 5.6;
                    emissions = dailyFactor * 30;
                    break;
                case 'waste':
                    // Waste: weekly bags * 4.33 * factor
                    emissions = newValue * 4.33 * EMISSION_FACTORS.waste.perBag;
                    break;
                default:
                    emissions = newValue * 0.5;
            }
        }

        db.prepare(`
            UPDATE activities SET
                category = COALESCE(?, category),
                description = COALESCE(?, description),
                value = COALESCE(?, value),
                unit = COALESCE(?, unit),
                date = COALESCE(?, date),
                emissions = ?
            WHERE id = ? AND user_id = ?
        `).run(newCategory !== activity.category ? newCategory : null, 
               newDescription !== activity.description ? newDescription : null, 
               newValue !== activity.value ? newValue : null, 
               newUnit !== activity.unit ? newUnit : null, 
               date || null, 
               emissions, id, req.user.id);

        const updatedActivity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
        
        // Transform for frontend
        const responseActivity = {
            ...updatedActivity,
            activity_type: updatedActivity.description,
            amount: updatedActivity.value
        };
        
        res.json({ message: 'Activity updated', activity: responseActivity });
    } catch (error) {
        console.error('Update activity error:', error);
        res.status(500).json({ error: 'Failed to update activity', message: error.message });
    }
});

// Delete activity
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const activity = db.prepare('SELECT * FROM activities WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        // Find and delete linked XP history entry, subtract XP from user
        const xpEntry = db.prepare('SELECT * FROM xp_history WHERE activity_id = ? AND user_id = ?').get(id, req.user.id);
        let xpDeducted = 0;
        let newXP = 0;
        
        if (xpEntry) {
            xpDeducted = xpEntry.amount;
            // Get current user XP and subtract
            const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(req.user.id);
            if (user) {
                newXP = Math.max(0, user.xp - xpDeducted);
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
            // Delete the XP history entry
            db.prepare('DELETE FROM xp_history WHERE id = ?').run(xpEntry.id);
        }

        db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').run(id, req.user.id);

        res.json({ 
            message: 'Activity deleted',
            xpDeducted,
            newXP
        });
    } catch (error) {
        console.error('Delete activity error:', error);
        res.status(500).json({ error: 'Failed to delete activity', message: error.message });
    }
});

// Get emission factors
router.get('/factors', (req, res) => {
    res.json(EMISSION_FACTORS);
});

module.exports = router;
