/**
 * ML Service Client for CarbonWise
 * Calls the Python ML microservice for predictions and clustering
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

/**
 * Check if ML service is available
 */
async function isMLServiceAvailable() {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/health`, {
            method: 'GET',
            timeout: 2000
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Classify user into lifestyle cluster
 * @param {Object} features - User feature percentages
 * @returns {Object} Classification result with cluster name and description
 */
async function classifyUser(features) {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features)
        });
        
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('ML Classification error:', error.message);
        return null;
    }
}

/**
 * Predict future emissions based on current patterns
 * @param {Object} features - Full user feature set
 * @returns {Object} Prediction with daily/weekly/monthly estimates
 */
async function predictEmissions(features) {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features)
        });
        
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('ML Prediction error:', error.message);
        return null;
    }
}

/**
 * Detect anomalies in user's emission patterns
 * @param {Object} features - Full user feature set
 * @returns {Object} Anomaly detection result
 */
async function detectAnomaly(features) {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/anomaly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features)
        });
        
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('ML Anomaly detection error:', error.message);
        return null;
    }
}

/**
 * Get ML-powered recommendations for user
 * @param {Object} features - User feature percentages
 * @returns {Object} Recommendations based on user cluster
 */
async function getRecommendations(features) {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features)
        });
        
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('ML Recommendations error:', error.message);
        return null;
    }
}

/**
 * Get full ML analysis for user
 * @param {Object} features - Full user feature set
 * @returns {Object} Complete analysis with clustering, prediction, anomaly, recommendations
 */
async function getFullAnalysis(features) {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features)
        });
        
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('ML Full analysis error:', error.message);
        return null;
    }
}

/**
 * Extract ML features from activities
 * @param {Array} activities - User activities array
 * @returns {Object} Feature object for ML service
 */
function extractMLFeatures(activities) {
    if (!activities || activities.length === 0) {
        return null;
    }
    
    // Normalize category names to match ML model
    function normalizeCategory(cat) {
        const lower = (cat || '').toLowerCase();
        if (lower === 'energy' || lower === 'electricity') return 'electricity';
        if (lower === 'food' || lower === 'diet') return 'food';
        if (lower === 'transport' || lower === 'transportation') return 'transport';
        if (lower === 'waste' || lower === 'recycling') return 'waste';
        return 'waste'; // default to waste for unknown categories
    }
    
    // Calculate category totals
    const categoryEmissions = { transport: 0, electricity: 0, food: 0, waste: 0 };
    const categoryFreq = { transport: 0, electricity: 0, food: 0, waste: 0 };
    
    for (const act of activities) {
        const cat = normalizeCategory(act.category);
        const emission = parseFloat(act.emissions) || parseFloat(act.emission) || 0;
        
        categoryEmissions[cat] += emission;
        categoryFreq[cat] += 1;
    }
    
    const totalEmission = Object.values(categoryEmissions).reduce((a, b) => a + b, 0);
    
    // Calculate percentages - use actual 0% if category has no emissions
    const features = {
        transport_pct: totalEmission > 0 ? (categoryEmissions.transport / totalEmission) * 100 : 0,
        electricity_pct: totalEmission > 0 ? (categoryEmissions.electricity / totalEmission) * 100 : 0,
        food_pct: totalEmission > 0 ? (categoryEmissions.food / totalEmission) * 100 : 0,
        waste_pct: totalEmission > 0 ? (categoryEmissions.waste / totalEmission) * 100 : 0,
        transport_freq: categoryFreq.transport,
        electricity_freq: categoryFreq.electricity,
        food_freq: categoryFreq.food,
        waste_freq: categoryFreq.waste,
        total_activities: activities.length,
        total_emission: totalEmission
    };
    
    return features;
}

module.exports = {
    isMLServiceAvailable,
    classifyUser,
    predictEmissions,
    detectAnomaly,
    getRecommendations,
    getFullAnalysis,
    extractMLFeatures,
    ML_SERVICE_URL
};
