// ===== CarbonWise Backend Server =====
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for development
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Wait for database to initialize before setting up routes
async function startServer() {
    // Wait for database initialization
    await db.initPromise;
    
    // Import routes after DB is ready
    const authRoutes = require('./routes/auth');
    const activityRoutes = require('./routes/activities');
    const goalRoutes = require('./routes/goals');
    const insightRoutes = require('./routes/insights');
    const statsRoutes = require('./routes/stats');
    const leaderboardRoutes = require('./routes/leaderboard');

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/activities', activityRoutes);
    app.use('/api/goals', goalRoutes);
    app.use('/api/insights', insightRoutes);
    app.use('/api/stats', statsRoutes);
    app.use('/api/leaderboard', leaderboardRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', message: 'CarbonWise API is running' });
    });

    // Serve frontend
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Something went wrong!', message: err.message });
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`🌱 CarbonWise server running on http://localhost:${PORT}`);
        console.log(`📊 API available at http://localhost:${PORT}/api`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

module.exports = app;
