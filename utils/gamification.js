// ===== Gamification Utilities =====
const db = require('../database/db');

// XP thresholds for each level
const LEVEL_THRESHOLDS = [
    0,      // Level 1
    200,    // Level 2
    500,    // Level 3
    1000,   // Level 4
    1800,   // Level 5
    2800,   // Level 6
    4000,   // Level 7
    5500,   // Level 8
    7500,   // Level 9
    10000,  // Level 10
    13000,  // Level 11
    16500,  // Level 12
    20500,  // Level 13
    25000,  // Level 14
    30000   // Level 15
];

// Level titles
const LEVEL_TITLES = [
    'Seedling',         // 1
    'Sprout',           // 2
    'Green Thumb',      // 3
    'Eco Enthusiast',   // 4
    'Eco Warrior',      // 5
    'Carbon Cutter',    // 6
    'Earth Defender',   // 7
    'Climate Champion', // 8
    'Sustainability Star', // 9
    'Eco Legend',       // 10
    'Planet Protector', // 11
    'Green Guardian',   // 12
    'Earth Ambassador', // 13
    'Climate Hero',     // 14
    'Eco Master'        // 15
];

// Award XP to user
// refs = { activityId, goalId, badgeId } - optional references to link XP entry
function awardXP(userId, amount, source = 'activity', description = null, refs = {}) {
    try {
        const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId);
        if (!user) return null;

        const newXP = user.xp + amount;
        const newLevel = calculateLevel(newXP);
        const leveledUp = newLevel > user.level;

        db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXP, newLevel, userId);

        // Log XP to history with optional references
        const { activityId = null, goalId = null, badgeId = null } = refs;
        const createdAt = new Date().toISOString();
        const result = db.prepare(
            'INSERT INTO xp_history (user_id, amount, source, description, activity_id, goal_id, badge_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(userId, amount, source, description, activityId, goalId, badgeId, createdAt);

        return {
            previousXP: user.xp,
            newXP,
            xpAwarded: amount,
            previousLevel: user.level,
            newLevel,
            leveledUp,
            levelTitle: LEVEL_TITLES[newLevel - 1] || 'Eco Master',
            xpHistoryId: result.lastInsertRowid
        };
    } catch (error) {
        console.error('Award XP error:', error);
        return null;
    }
}

// Calculate level based on XP
function calculateLevel(xp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
}

// Get XP progress for current level
function getLevelProgress(xp, level) {
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const xpInLevel = xp - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;
    const progress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

    return {
        currentXP: xp,
        level,
        levelTitle: LEVEL_TITLES[level - 1] || 'Eco Master',
        xpInLevel,
        xpToNext: xpNeeded - xpInLevel,
        xpNeeded,
        progress
    };
}

// Check and award badges
function checkBadges(userId) {
    try {
        const earnedBadges = [];
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) return earnedBadges;

        // Get all badges
        const badges = db.prepare('SELECT * FROM badges').all();

        // Get user's current badges
        const userBadges = db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').all(userId);
        const earnedBadgeIds = new Set(userBadges.map(b => b.badge_id));

        // Get user stats
        const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ?').get(userId).count;
        const distinctDays = db.prepare('SELECT COUNT(DISTINCT date) as count FROM activities WHERE user_id = ?').get(userId).count;
        
        // Eco-friendly trips
        const ecoTrips = db.prepare(`
            SELECT COUNT(*) as count FROM activities 
            WHERE user_id = ? AND category = 'transport' 
            AND (description LIKE '%bike%' OR description LIKE '%walk%' OR description LIKE '%bus%' OR description LIKE '%train%')
        `).get(userId).count;

        // Veggie days
        const veggieDays = db.prepare(`
            SELECT COUNT(DISTINCT date) as count FROM activities 
            WHERE user_id = ? AND category = 'diet' 
            AND (description LIKE '%vegetarian%' OR description LIKE '%vegan%' OR description LIKE '%plant%')
        `).get(userId).count;

        // Check each badge
        for (const badge of badges) {
            if (earnedBadgeIds.has(badge.id)) continue;

            let earned = false;

            switch (badge.condition_type) {
                case 'activity_count':
                    earned = activityCount >= badge.condition_value;
                    break;
                case 'streak':
                    earned = user.streak >= badge.condition_value;
                    break;
                case 'eco_trips':
                    earned = ecoTrips >= badge.condition_value;
                    break;
                case 'veggie_days':
                    earned = veggieDays >= badge.condition_value;
                    break;
                case 'level':
                    earned = user.level >= badge.condition_value;
                    break;
                case 'total_days':
                    earned = distinctDays >= badge.condition_value;
                    break;
                case 'below_average':
                    // Check if user is below global average
                    const totalEmissions = db.prepare('SELECT COALESCE(SUM(emissions), 0) as total FROM activities WHERE user_id = ?').get(userId).total;
                    const dailyAvg = distinctDays > 0 ? totalEmissions / distinctDays : 0;
                    const annualProjection = dailyAvg * 365;
                    earned = annualProjection < 4800 && distinctDays >= 7; // At least a week of data
                    break;
            }

            if (earned) {
                // Award badge
                db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, badge.id);
                
                // Award XP for badge (linked to this badge)
                awardXP(userId, badge.xp_reward, 'badge', `Earned badge: ${badge.name}`, { badgeId: badge.id });

                earnedBadges.push({
                    id: badge.id,
                    name: badge.name,
                    description: badge.description,
                    icon: badge.icon,
                    xpReward: badge.xp_reward
                });
            }
        }

        return earnedBadges;
    } catch (error) {
        console.error('Check badges error:', error);
        return [];
    }
}

// Get all badges with user's earned status
function getUserBadges(userId) {
    try {
        const badges = db.prepare(`
            SELECT 
                b.*,
                CASE WHEN ub.id IS NOT NULL THEN 1 ELSE 0 END as earned,
                ub.earned_at
            FROM badges b
            LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = ?
            ORDER BY earned DESC, b.id
        `).all(userId);

        return badges.map(b => ({
            ...b,
            earned: b.earned === 1,
            earnedAt: b.earned_at
        }));
    } catch (error) {
        console.error('Get user badges error:', error);
        return [];
    }
}

// Update user streak
function updateStreak(userId) {
    try {
        const user = db.prepare('SELECT last_activity_date, streak FROM users WHERE id = ?').get(userId);
        if (!user) return 0;

        const today = new Date().toISOString().split('T')[0];
        const lastDate = user.last_activity_date;

        let newStreak = user.streak;

        if (lastDate !== today) {
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

            db.prepare('UPDATE users SET streak = ?, last_activity_date = ? WHERE id = ?').run(newStreak, today, userId);
        }

        return newStreak;
    } catch (error) {
        console.error('Update streak error:', error);
        return 0;
    }
}

module.exports = {
    awardXP,
    calculateLevel,
    getLevelProgress,
    checkBadges,
    getUserBadges,
    updateStreak,
    updateGoalProgress,
    LEVEL_THRESHOLDS,
    LEVEL_TITLES
};

// Daily baseline emissions for average person (kg CO2)
const DAILY_BASELINES = {
    transport: 4.6,      // Average daily transport emissions (driving ~22km)
    energy: 7.5,         // Average daily electricity + heating
    electricity: 4.5,    // Average daily electricity (12 kWh * 0.375)
    heating: 3.0,        // Average daily heating
    food: 5.5,           // Average daily diet emissions
    diet: 5.5,
    waste: 1.5           // Average daily waste
};

// Calculator activity type to goal type mapping
const CALCULATOR_MAPPINGS = {
    'driving': 'reduce-transport',
    'electricity': 'reduce-energy',
    'heating': 'reduce-energy',
    'daily_diet': 'diet-change',
    'household_waste': 'zero-waste'
};

// Get baseline category for calculator activity type
function getBaselineCategory(activityType) {
    const mappings = {
        'driving': 'transport',
        'electricity': 'electricity',
        'heating': 'heating',
        'daily_diet': 'food',
        'household_waste': 'waste'
    };
    return mappings[activityType];
}

// Update goal progress based on calculator entries
function updateGoalProgress(userId, category, activityType, value, emissions) {
    try {
        // Get active goals for user
        const activeGoals = db.prepare(`
            SELECT * FROM goals 
            WHERE user_id = ? AND status = 'active'
        `).all(userId);

        if (activeGoals.length === 0) return;

        // Check if this is a calculator entry
        const isCalculatorEntry = ['driving', 'electricity', 'heating', 'daily_diet', 'household_waste'].includes(activityType);
        
        for (const goal of activeGoals) {
            let progressIncrement = 0;

            if (isCalculatorEntry) {
                // Calculator-based goal tracking: compare emissions to baseline
                const goalTypeForActivity = CALCULATOR_MAPPINGS[activityType];
                
                if (goal.type === goalTypeForActivity) {
                    const baselineCategory = getBaselineCategory(activityType);
                    const dailyBaseline = DAILY_BASELINES[baselineCategory] || 5;
                    
                    // If today's emissions are LOWER than baseline, count the reduction
                    const reduction = dailyBaseline - emissions;
                    if (reduction > 0) {
                        progressIncrement = reduction;
                    }
                }
            } else {
                // Eco-friendly activity tracking (bike, walk, etc.)
                switch (goal.type) {
                    case 'reduce-transport':
                        if (category === 'transport') {
                            if (['bike', 'walk', 'bus', 'train', 'metro', 'carpool'].includes(activityType)) {
                                // Saved emissions vs driving
                                progressIncrement = value * 0.21; // km * car emission factor
                            }
                        }
                        break;

                    case 'reduce-energy':
                        if (category === 'electricity' || category === 'energy') {
                            if (['renewable', 'nuclear', 'solar', 'wind'].includes(activityType)) {
                                progressIncrement = value * 0.45; // kWh saved vs grid
                            }
                        }
                        break;

                    case 'diet-change':
                        if (category === 'diet' || category === 'food') {
                            if (['vegan', 'vegetarian', 'low-meat'].includes(activityType)) {
                                const savings = { vegan: 4.3, vegetarian: 3.4, 'low-meat': 3.0 };
                                progressIncrement = savings[activityType] || 3.0;
                            }
                        }
                        break;

                    case 'zero-waste':
                        if (category === 'waste') {
                            progressIncrement = value * 0.5;
                        }
                        break;

                    case 'streak':
                        const user = db.prepare('SELECT streak FROM users WHERE id = ?').get(userId);
                        progressIncrement = user.streak - goal.current_value;
                        if (progressIncrement < 0) progressIncrement = 0;
                        break;
                }
            }

            if (progressIncrement > 0) {
                const newValue = goal.current_value + progressIncrement;
                let status = goal.status;
                let xpAwarded = 0;

                // Check if goal completed
                if (newValue >= goal.target_value && goal.status === 'active') {
                    status = 'completed';
                    xpAwarded = goal.xp_reward || 100;
                    awardXP(userId, xpAwarded, 'goal', `Completed goal: ${goal.title}`, { goalId: goal.id });
                }

                db.prepare('UPDATE goals SET current_value = ?, status = ? WHERE id = ?')
                    .run(newValue, status, goal.id);
            }
        }
    } catch (error) {
        console.error('Update goal progress error:', error);
    }
}
