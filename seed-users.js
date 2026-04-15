/**
 * Seed Script: Create 5 Demo Users with Synthetic Activity History
 * 
 * Users span different ML classification profiles:
 * 1. commute_heavy - High transport emissions
 * 2. diet_heavy - High food/diet emissions
 * 3. energy_heavy - High electricity emissions
 * 4. balanced - Even distribution across categories
 * 5. eco_conscious - Low emissions overall
 * 
 * Includes: XP calculation, streak tracking, and XP history
 * Activity period: January 1, 2026 - Today
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database', 'carbonwise.db');

// XP Constants (matching gamification.js)
const XP_PER_ACTIVITY = 10;
const LEVEL_THRESHOLDS = [
    0, 200, 500, 1000, 1800, 2800, 4000, 5500, 7500, 10000,
    13000, 16500, 20500, 25000, 30000
];

function calculateLevel(xp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
}

// User profiles
const USERS = [
    {
        username: 'alex_commuter',
        email: 'alex.commuter@demo.com',
        password: 'demo123',
        profile: 'commute_heavy',
        description: 'Daily long-distance car commuter'
    },
    {
        username: 'bella_foodie',
        email: 'bella.foodie@demo.com',
        password: 'demo123',
        profile: 'diet_heavy',
        description: 'Meat-heavy diet, frequent dining out'
    },
    {
        username: 'charlie_homebody',
        email: 'charlie.homebody@demo.com',
        password: 'demo123',
        profile: 'energy_heavy',
        description: 'Works from home, high electricity usage'
    },
    {
        username: 'diana_average',
        email: 'diana.average@demo.com',
        password: 'demo123',
        profile: 'balanced',
        description: 'Typical urban lifestyle, mixed activities'
    },
    {
        username: 'evan_green',
        email: 'evan.green@demo.com',
        password: 'demo123',
        profile: 'eco_conscious',
        description: 'Environmentally conscious, low footprint'
    }
];

// Activity templates by category (with default values for calculation)
const ACTIVITY_TEMPLATES = {
    transport: [
        { name: 'Car commute to work', emission: 8.5, unit: 'km', value: 25 },
        { name: 'Car commute from work', emission: 8.5, unit: 'km', value: 25 },
        { name: 'Weekend car trip', emission: 15.0, unit: 'km', value: 50 },
        { name: 'Uber/Taxi ride', emission: 4.2, unit: 'km', value: 15 },
        { name: 'Bus commute', emission: 1.2, unit: 'km', value: 20 },
        { name: 'Train journey', emission: 0.8, unit: 'km', value: 30 },
        { name: 'Domestic flight', emission: 120.0, unit: 'km', value: 500 },
        { name: 'Motorcycle ride', emission: 2.5, unit: 'km', value: 20 },
        { name: 'Electric car commute', emission: 1.5, unit: 'km', value: 25 },
        { name: 'Cycling to store', emission: 0.0, unit: 'km', value: 5 },
        { name: 'Walking', emission: 0.0, unit: 'km', value: 2 }
    ],
    electricity: [
        { name: 'Daily home electricity', emission: 3.5, unit: 'kWh', value: 8 },
        { name: 'Air conditioning (8hrs)', emission: 4.8, unit: 'hours', value: 8 },
        { name: 'Electric heating (8hrs)', emission: 5.2, unit: 'hours', value: 8 },
        { name: 'Washing machine cycle', emission: 0.6, unit: 'loads', value: 1 },
        { name: 'Dishwasher cycle', emission: 0.5, unit: 'loads', value: 1 },
        { name: 'Electric oven cooking', emission: 0.8, unit: 'hours', value: 1 },
        { name: 'Gaming PC (4hrs)', emission: 1.2, unit: 'hours', value: 4 },
        { name: 'Home office equipment', emission: 1.8, unit: 'hours', value: 8 },
        { name: 'TV and entertainment', emission: 0.4, unit: 'hours', value: 3 },
        { name: 'Clothes dryer cycle', emission: 2.0, unit: 'loads', value: 1 },
        { name: 'Hot water usage', emission: 1.5, unit: 'liters', value: 50 }
    ],
    diet: [
        { name: 'Beef steak dinner', emission: 6.5, unit: 'servings', value: 1 },
        { name: 'Beef burger lunch', emission: 4.0, unit: 'servings', value: 1 },
        { name: 'Lamb chops', emission: 5.5, unit: 'servings', value: 1 },
        { name: 'Pork meal', emission: 2.5, unit: 'servings', value: 1 },
        { name: 'Chicken dinner', emission: 1.8, unit: 'servings', value: 1 },
        { name: 'Fish and chips', emission: 1.5, unit: 'servings', value: 1 },
        { name: 'Cheese pizza', emission: 2.2, unit: 'servings', value: 2 },
        { name: 'Vegetarian meal', emission: 0.8, unit: 'servings', value: 1 },
        { name: 'Vegan meal', emission: 0.4, unit: 'servings', value: 1 },
        { name: 'Eggs and toast', emission: 0.6, unit: 'servings', value: 1 },
        { name: 'Salad lunch', emission: 0.3, unit: 'servings', value: 1 },
        { name: 'Dairy products', emission: 1.2, unit: 'servings', value: 2 },
        { name: 'Restaurant dining (meat)', emission: 5.0, unit: 'servings', value: 1 }
    ],
    waste: [
        { name: 'General household waste', emission: 0.8, unit: 'bags', value: 1 },
        { name: 'Plastic packaging', emission: 0.4, unit: 'kg', value: 0.5 },
        { name: 'Food waste (landfill)', emission: 1.2, unit: 'kg', value: 1 },
        { name: 'Electronic waste disposed', emission: 2.5, unit: 'items', value: 1 },
        { name: 'Clothing disposed', emission: 1.5, unit: 'items', value: 2 },
        { name: 'Recycled materials', emission: 0.1, unit: 'kg', value: 2 },
        { name: 'Composted food waste', emission: 0.05, unit: 'kg', value: 1 },
        { name: 'Paper waste', emission: 0.3, unit: 'kg', value: 0.5 }
    ]
};

// Profile-specific activity patterns
const PROFILE_PATTERNS = {
    commute_heavy: {
        transport: { frequency: 2.5, multiplier: 1.2, heavyBias: true },   // 2-3 transport activities/day
        electricity: { frequency: 0.5, multiplier: 0.8, heavyBias: false },
        diet: { frequency: 1.0, multiplier: 1.0, heavyBias: false },
        waste: { frequency: 0.15, multiplier: 1.0, heavyBias: false }
    },
    diet_heavy: {
        transport: { frequency: 0.5, multiplier: 0.7, heavyBias: false },
        electricity: { frequency: 0.5, multiplier: 0.9, heavyBias: false },
        diet: { frequency: 2.5, multiplier: 1.3, heavyBias: true },        // 2-3 meals logged/day, heavy
        waste: { frequency: 0.2, multiplier: 1.2, heavyBias: false }
    },
    energy_heavy: {
        transport: { frequency: 0.3, multiplier: 0.5, heavyBias: false },  // Works from home
        electricity: { frequency: 2.0, multiplier: 1.4, heavyBias: true }, // High electricity
        diet: { frequency: 1.0, multiplier: 1.0, heavyBias: false },
        waste: { frequency: 0.15, multiplier: 1.0, heavyBias: false }
    },
    balanced: {
        transport: { frequency: 0.8, multiplier: 1.0, heavyBias: false },
        electricity: { frequency: 0.8, multiplier: 1.0, heavyBias: false },
        diet: { frequency: 1.2, multiplier: 1.0, heavyBias: false },
        waste: { frequency: 0.15, multiplier: 1.0, heavyBias: false }
    },
    eco_conscious: {
        transport: { frequency: 0.8, multiplier: 0.5, heavyBias: false },  // Low emission transport
        electricity: { frequency: 0.5, multiplier: 0.6, heavyBias: false },
        diet: { frequency: 1.5, multiplier: 0.4, heavyBias: false },       // Vegetarian/vegan
        waste: { frequency: 0.3, multiplier: 0.3, heavyBias: false }       // Recycles
    }
};

// Helper functions
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
}

function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function pickWeighted(array, heavyBias) {
    if (heavyBias) {
        // Bias towards higher emission activities (first items in list are heavier)
        const weights = array.map((_, i) => Math.pow(0.7, i));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < array.length; i++) {
            random -= weights[i];
            if (random <= 0) return array[i];
        }
    } else {
        // Bias towards lower emission activities
        const weights = array.map((_, i) => Math.pow(0.7, array.length - 1 - i));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < array.length; i++) {
            random -= weights[i];
            if (random <= 0) return array[i];
        }
    }
    return pickRandom(array);
}

function generateDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function formatDate(date) {
    // Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateActivitiesForUser(userId, profile, dates) {
    const activities = [];
    const pattern = PROFILE_PATTERNS[profile];
    
    for (const date of dates) {
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Generate activities for each category
        for (const [category, config] of Object.entries(pattern)) {
            // Adjust frequency for weekends
            let freq = config.frequency;
            if (category === 'transport' && isWeekend) freq *= 0.5;
            if (category === 'electricity' && isWeekend) freq *= 1.3;
            
            // Determine number of activities (Poisson-like distribution)
            const numActivities = Math.floor(freq + (Math.random() < (freq % 1) ? 1 : 0));
            
            for (let i = 0; i < numActivities; i++) {
                const templates = ACTIVITY_TEMPLATES[category];
                const activity = pickWeighted(templates, config.heavyBias);
                
                // Apply multiplier with some randomness
                const variance = randomBetween(0.8, 1.2);
                const emission = Math.round(activity.emission * config.multiplier * variance * 100) / 100;
                const value = Math.round(activity.value * variance * 10) / 10;
                
                // Random time during the day
                const hour = randomInt(6, 22);
                const minute = randomInt(0, 59);
                const timestamp = new Date(date);
                timestamp.setHours(hour, minute, 0, 0);
                
                activities.push({
                    user_id: userId,
                    category: category,
                    description: activity.name,
                    value: value,
                    unit: activity.unit,
                    emissions: emission,
                    date: formatDate(date),
                    created_at: timestamp.toISOString()
                });
            }
        }
    }
    
    return activities;
}

async function seedDatabase() {
    console.log('🌱 Starting database seed...\n');
    
    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // Load or create database
    let db;
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log('📂 Loaded existing database');
    } else {
        db = new SQL.Database();
        console.log('📂 Created new database');
    }
    
    // Ensure tables exist
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak INTEGER DEFAULT 0,
            last_activity_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            emissions REAL NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    
    // Create xp_history table with activity/goal/badge references
    db.run(`
        CREATE TABLE IF NOT EXISTS xp_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            source TEXT NOT NULL,
            description TEXT,
            activity_id INTEGER,
            goal_id INTEGER,
            badge_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
            FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL
        )
    `);
    
    // Date range: Jan 1, 2026 to today
    const startDate = new Date('2026-01-01');
    const endDate = new Date(); // Use current date
    const dates = generateDateRange(startDate, endDate);
    
    console.log(`📅 Generating activities from ${formatDate(startDate)} to ${formatDate(endDate)} (${dates.length} days)\n`);
    
    let totalActivities = 0;
    
    for (const user of USERS) {
        console.log(`👤 Creating user: ${user.username} (${user.profile})`);
        console.log(`   Description: ${user.description}`);
        
        // Check if user exists
        const existing = db.exec(`SELECT id FROM users WHERE email = '${user.email}'`);
        let userId;
        
        if (existing.length > 0 && existing[0].values.length > 0) {
            userId = existing[0].values[0][0];
            console.log(`   ⚠️  User exists (ID: ${userId}), deleting old activities and xp_history...`);
            db.run(`DELETE FROM activities WHERE user_id = ${userId}`);
            db.run(`DELETE FROM xp_history WHERE user_id = ${userId}`);
        } else {
            // Hash password and create user
            const hashedPassword = bcrypt.hashSync(user.password, 10);
            db.run(`
                INSERT INTO users (username, email, password) 
                VALUES ('${user.username}', '${user.email}', '${hashedPassword}')
            `);
            const result = db.exec('SELECT last_insert_rowid()');
            userId = result[0].values[0][0];
            console.log(`   ✅ Created user (ID: ${userId})`);
        }
        
        // Generate activities
        const activities = generateActivitiesForUser(userId, user.profile, dates);
        console.log(`   📊 Generated ${activities.length} activities`);
        
        // Insert activities
        const insertStmt = db.prepare(`
            INSERT INTO activities (user_id, category, description, value, unit, emissions, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Track inserted activity IDs for XP history linking
        const activityIds = [];
        
        for (const activity of activities) {
            insertStmt.run([
                activity.user_id,
                activity.category,
                activity.description,
                activity.value,
                activity.unit,
                activity.emissions,
                activity.date,
                activity.created_at
            ]);
            // Get the last inserted activity ID
            const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
            activityIds.push({ id: lastId, activity });
        }
        insertStmt.free();
        
        // Calculate XP (10 XP per activity)
        const totalXP = activities.length * XP_PER_ACTIVITY;
        const level = calculateLevel(totalXP);
        
        // Calculate streak (consecutive days with activities ending today or yesterday)
        const uniqueDates = [...new Set(activities.map(a => a.date))].sort().reverse();
        let streak = 0;
        const today = formatDate(new Date());
        const yesterday = formatDate(new Date(Date.now() - 86400000));
        
        // Check if user has logged activity today or yesterday (active streak)
        if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
            // Count consecutive days
            let checkDate = new Date(uniqueDates[0]); // Start from most recent activity
            for (let i = 0; i < uniqueDates.length; i++) {
                const expectedDate = formatDate(checkDate);
                if (uniqueDates.includes(expectedDate)) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
        }
        
        // Update user with XP, level, streak
        db.run(`UPDATE users SET xp = ${totalXP}, level = ${level}, streak = ${streak}, last_activity_date = '${uniqueDates[0]}' WHERE id = ${userId}`);
        
        // Seed XP history - one entry per activity, linked by activity_id
        const insertXPHistory = db.prepare(`
            INSERT INTO xp_history (user_id, amount, source, description, activity_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const { id: activityId, activity } of activityIds) {
            insertXPHistory.run([
                userId,
                XP_PER_ACTIVITY,
                'activity',
                `Logged ${activity.category}: ${activity.description}`,
                activityId,
                activity.created_at
            ]);
        }
        insertXPHistory.free();
        
        // Calculate stats
        const stats = {
            transport: activities.filter(a => a.category === 'transport').reduce((sum, a) => sum + a.emissions, 0),
            electricity: activities.filter(a => a.category === 'electricity').reduce((sum, a) => sum + a.emissions, 0),
            diet: activities.filter(a => a.category === 'diet').reduce((sum, a) => sum + a.emissions, 0),
            waste: activities.filter(a => a.category === 'waste').reduce((sum, a) => sum + a.emissions, 0)
        };
        const total = stats.transport + stats.electricity + stats.diet + stats.waste;
        
        console.log(`   📈 Emission breakdown:`);
        console.log(`      Transport:   ${stats.transport.toFixed(1)} kg (${(stats.transport/total*100).toFixed(1)}%)`);
        console.log(`      Electricity: ${stats.electricity.toFixed(1)} kg (${(stats.electricity/total*100).toFixed(1)}%)`);
        console.log(`      Diet:        ${stats.diet.toFixed(1)} kg (${(stats.diet/total*100).toFixed(1)}%)`);
        console.log(`      Waste:       ${stats.waste.toFixed(1)} kg (${(stats.waste/total*100).toFixed(1)}%)`);
        console.log(`      TOTAL:       ${total.toFixed(1)} kg CO₂`);
        console.log(`   🎮 Gamification:`);
        console.log(`      XP:     ${totalXP} (Level ${level})`);
        console.log(`      Streak: ${streak} days`);
        console.log(`      XP History: ${activityIds.length} entries (1:1 with activities)`);
        console.log();
        
        totalActivities += activities.length;
    }
    
    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    
    console.log('═'.repeat(50));
    console.log(`✅ Seed complete!`);
    console.log(`   Users created: ${USERS.length}`);
    console.log(`   Total activities: ${totalActivities}`);
    console.log(`   Database saved to: ${DB_PATH}`);
    console.log('═'.repeat(50));
    console.log('\n📝 Login credentials (all passwords: demo123):');
    USERS.forEach(u => {
        console.log(`   ${u.email}`);
    });
    
    db.close();
}

// Run seed
seedDatabase().catch(console.error);
