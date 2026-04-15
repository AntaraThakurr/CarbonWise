// ===== Database Setup with SQLite (sql.js - pure JavaScript) =====
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'carbonwise.db');

// Create a wrapper class to mimic better-sqlite3 API
class DatabaseWrapper {
    constructor() {
        this.db = null;
        this.ready = false;
    }

    async initialize() {
        const SQL = await initSqlJs();
        
        // Load existing database or create new one
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
        }

        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');
        this.ready = true;
        return this;
    }

    // Save database to file
    save() {
        if (this.db) {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(dbPath, buffer);
        }
    }

    // Execute SQL without returning results
    exec(sql) {
        this.db.run(sql);
        this.save();
    }

    // Prepare a statement (returns a statement-like object)
    prepare(sql) {
        const dbWrapper = this;
        
        const getLastInsertRowId = () => {
            try {
                const stmt = dbWrapper.db.prepare('SELECT last_insert_rowid() as id');
                if (stmt.step()) {
                    const result = stmt.get()[0];
                    stmt.free();
                    return result;
                }
                stmt.free();
                return 0;
            } catch (e) {
                console.error('Error getting last insert rowid:', e);
                return 0;
            }
        };

        // Convert params to sql.js format
        const formatParams = (params) => {
            if (params.length === 0) return undefined;
            if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
                // Named parameters - convert to sql.js format
                const namedParams = {};
                for (const [key, value] of Object.entries(params[0])) {
                    // sql.js expects $key format for named params
                    namedParams[`$${key}`] = value;
                }
                return namedParams;
            }
            // Positional params - sql.js accepts arrays directly
            return params;
        };
        
        return {
            run: (...params) => {
                try {
                    const stmt = dbWrapper.db.prepare(sql);
                    const formattedParams = formatParams(params);
                    if (formattedParams) {
                        stmt.bind(formattedParams);
                    }
                    stmt.step();
                    // Get lastInsertRowid IMMEDIATELY after step, before free/save
                    const lastId = getLastInsertRowId();
                    const changes = dbWrapper.db.getRowsModified();
                    stmt.free();
                    dbWrapper.save();
                    return { changes, lastInsertRowid: lastId };
                } catch (err) {
                    console.error('DB run error:', err.message, 'SQL:', sql, 'Params:', params);
                    throw err;
                }
            },
            get: (...params) => {
                try {
                    const formattedParams = formatParams(params);
                    const stmt = dbWrapper.db.prepare(sql);
                    if (formattedParams) {
                        stmt.bind(formattedParams);
                    }
                    
                    if (stmt.step()) {
                        const columns = stmt.getColumnNames();
                        const values = stmt.get();
                        stmt.free();
                        const result = {};
                        columns.forEach((col, i) => result[col] = values[i]);
                        return result;
                    }
                    stmt.free();
                    return undefined;
                } catch (err) {
                    console.error('DB get error:', err.message, 'SQL:', sql, 'Params:', params);
                    throw err;
                }
            },
            all: (...params) => {
                try {
                    let results = [];
                    const formattedParams = formatParams(params);
                    const stmt = dbWrapper.db.prepare(sql);
                    if (formattedParams) {
                        stmt.bind(formattedParams);
                    }
                    
                    const columns = stmt.getColumnNames();
                    while (stmt.step()) {
                        const values = stmt.get();
                        const row = {};
                        columns.forEach((col, i) => row[col] = values[i]);
                        results.push(row);
                    }
                    stmt.free();
                    return results;
                } catch (err) {
                    console.error('DB all error:', err.message, 'SQL:', sql, 'Params:', params);
                    throw err;
                }
            }
        };
    }
    
    pragma(statement) {
        this.db.run(`PRAGMA ${statement}`);
    }

    close() {
        if (this.db) {
            this.save();
            this.db.close();
        }
    }
}

// Create and export the database wrapper
const dbWrapper = new DatabaseWrapper();

// Initialize the database
const initPromise = dbWrapper.initialize().then(() => {
    // Create tables
    dbWrapper.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        streak INTEGER DEFAULT 0,
        last_activity_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Activities table
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
    );

    -- Goals table
    CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        target TEXT NOT NULL,
        target_value REAL,
        current_value REAL DEFAULT 0,
        duration TEXT NOT NULL,
        xp_reward INTEGER DEFAULT 100,
        status TEXT DEFAULT 'active',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Achievements/Badges table
    CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        xp_reward INTEGER DEFAULT 50,
        condition_type TEXT NOT NULL,
        condition_value REAL NOT NULL
    );

    -- User badges (earned achievements)
    CREATE TABLE IF NOT EXISTS user_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        badge_id INTEGER NOT NULL,
        earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (badge_id) REFERENCES badges(id),
        UNIQUE(user_id, badge_id)
    );

    -- XP History table (track XP gains over time)
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
    );

    -- Index for xp_history performance
    CREATE INDEX IF NOT EXISTS idx_xp_history_user ON xp_history(user_id, created_at);

    -- Calculator profiles (saved calculations)
    CREATE TABLE IF NOT EXISTS calculator_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        electricity_usage REAL DEFAULT 0,
        energy_source TEXT DEFAULT 'mixed',
        transport_type TEXT DEFAULT 'car',
        transport_distance REAL DEFAULT 0,
        fuel_type TEXT DEFAULT 'petrol',
        heating_type TEXT DEFAULT 'natural-gas',
        home_size REAL DEFAULT 0,
        heating_hours REAL DEFAULT 8,
        diet_type TEXT DEFAULT 'average',
        local_food INTEGER DEFAULT 0,
        organic_food INTEGER DEFAULT 0,
        low_food_waste INTEGER DEFAULT 0,
        waste_bags REAL DEFAULT 0,
        recycle_paper INTEGER DEFAULT 1,
        recycle_plastic INTEGER DEFAULT 1,
        recycle_glass INTEGER DEFAULT 1,
        recycle_metal INTEGER DEFAULT 0,
        compost INTEGER DEFAULT 0,
        single_use TEXT DEFAULT 'medium',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Insights cache (for ML recommendations)
    CREATE TABLE IF NOT EXISTS insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        insight_type TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        potential_savings REAL,
        priority INTEGER DEFAULT 5,
        is_dismissed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

    // Insert default badges
    const defaultBadges = [
        { name: 'First Steps', description: 'Log your first activity', icon: 'fa-seedling', condition_type: 'activity_count', condition_value: 1, xp_reward: 25 },
        { name: 'Week Warrior', description: '7-day logging streak', icon: 'fa-fire', condition_type: 'streak', condition_value: 7, xp_reward: 100 },
        { name: 'Green Commuter', description: '10 eco-friendly trips logged', icon: 'fa-bicycle', condition_type: 'eco_trips', condition_value: 10, xp_reward: 75 },
        { name: 'Veggie Lover', description: '5 meat-free days', icon: 'fa-leaf', condition_type: 'veggie_days', condition_value: 5, xp_reward: 50 },
        { name: 'Carbon Champion', description: 'Reduce emissions by 50%', icon: 'fa-trophy', condition_type: 'reduction_percent', condition_value: 50, xp_reward: 200 },
        { name: 'Planet Protector', description: 'Below global average emissions', icon: 'fa-globe', condition_type: 'below_average', condition_value: 1, xp_reward: 150 },
        { name: 'Eco Legend', description: 'Reach Level 10', icon: 'fa-crown', condition_type: 'level', condition_value: 10, xp_reward: 300 },
        { name: 'Renewable Hero', description: '100% green energy for a month', icon: 'fa-solar-panel', condition_type: 'renewable_month', condition_value: 1, xp_reward: 200 },
        { name: 'Month Master', description: '30-day logging streak', icon: 'fa-calendar-check', condition_type: 'streak', condition_value: 30, xp_reward: 250 },
        { name: 'Zero Waste Hero', description: 'Complete a zero waste week', icon: 'fa-recycle', condition_type: 'zero_waste_week', condition_value: 1, xp_reward: 175 },
        { name: 'Consistent Tracker', description: 'Log activities for 100 days', icon: 'fa-chart-line', condition_type: 'total_days', condition_value: 100, xp_reward: 500 },
        { name: 'Community Leader', description: 'Reach top 10 on leaderboard', icon: 'fa-users', condition_type: 'leaderboard_rank', condition_value: 10, xp_reward: 150 }
    ];

    const insertBadge = dbWrapper.prepare(`
        INSERT OR IGNORE INTO badges (name, description, icon, condition_type, condition_value, xp_reward)
        VALUES (@name, @description, @icon, @condition_type, @condition_value, @xp_reward)
    `);

    for (const badge of defaultBadges) {
        insertBadge.run(badge);
    }

    console.log('✅ Database initialized successfully');
    return dbWrapper;
});

// Export both the wrapper and the init promise
module.exports = dbWrapper;
module.exports.initPromise = initPromise;
