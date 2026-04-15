// ===== Authentication Middleware =====
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'carbonwise_secret_key';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // Return 401 for invalid/expired tokens (standard HTTP semantics)
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Token invalid but continue anyway
        }
    }
    next();
}

module.exports = { authenticateToken, optionalAuth };
