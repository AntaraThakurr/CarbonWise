// ===== Insights Routes =====
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { generateInsights, generateInsightsFromActivities, identifyTrends, generateAISummary, getInsights, generateAIInsights } = require('../utils/insights-engine');
const { isMLServiceAvailable, getFullAnalysis, extractMLFeatures, classifyUser, predictEmissions, detectAnomaly, getRecommendations } = require('../utils/ml-client');

// Get all insights for user (AI-powered with fallback)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, refresh = 'false', startDate, endDate } = req.query;
        const forceRefresh = refresh === 'true';

        // Get AI-powered insights (with caching and fallback) - pass date range for filtering
        const insightsData = await getInsights(userId, forceRefresh, startDate, endDate);

        // Get enhanced statistics (with optional date range)
        const stats = getEnhancedStats(userId, startDate, endDate);

        res.json({
            source: insightsData.source,
            model: insightsData.model || null,
            aiSummary: {
                summary: insightsData.summary
            },
            topInsight: insightsData.topInsight,
            insights: (insightsData.insights || []).slice(0, parseInt(limit)),
            trends: insightsData.trends || identifyTrends(userId),
            encouragement: insightsData.encouragement,
            stats: stats,
            generatedAt: insightsData.generatedAt,
            dateRange: startDate && endDate ? { startDate, endDate } : null
        });
    } catch (error) {
        console.error('Insights error:', error);
        res.status(500).json({ error: 'Failed to generate insights', message: error.message });
    }
});

// Get enhanced statistics for insights
function getEnhancedStats(userId, startDate = null, endDate = null) {
    const today = new Date();
    
    // Use custom date range if provided, otherwise use calendar month
    let periodStartStr, periodEndStr;
    let usingCustomRange = false;
    
    if (startDate && endDate) {
        periodStartStr = startDate;
        periodEndStr = endDate;
        usingCustomRange = true;
    } else {
        // Use calendar month boundaries
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        periodStartStr = thisMonthStart.toISOString().split('T')[0];
        periodEndStr = today.toISOString().split('T')[0];
    }
    
    // Use calendar week boundaries (Monday-Sunday) for comparisons
    const dayOfWeek = today.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - daysFromMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
    
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];

    // Normalize category names
    const normalizeCategory = (cat) => {
        const lower = (cat || '').toLowerCase();
        if (lower === 'energy' || lower === 'electricity') return 'electricity';
        if (lower === 'food' || lower === 'diet') return 'diet';
        return lower;
    };

    // Category breakdown (raw from DB) - using selected period
    const rawBreakdown = db.prepare(`
        SELECT category, 
               COUNT(*) as count,
               SUM(emissions) as total_emissions,
               AVG(emissions) as avg_emissions
        FROM activities 
        WHERE user_id = ? AND date >= ? AND date <= ?
        GROUP BY category
        ORDER BY total_emissions DESC
    `).all(userId, periodStartStr, periodEndStr);

    // Merge categories (energy → electricity, food → diet)
    const mergedMap = new Map();
    for (const c of rawBreakdown) {
        const normalizedCat = normalizeCategory(c.category);
        if (mergedMap.has(normalizedCat)) {
            const existing = mergedMap.get(normalizedCat);
            existing.count += c.count;
            existing.total_emissions += c.total_emissions || 0;
        } else {
            mergedMap.set(normalizedCat, {
                category: normalizedCat,
                count: c.count,
                total_emissions: c.total_emissions || 0
            });
        }
    }

    const categoryBreakdown = Array.from(mergedMap.values());
    categoryBreakdown.sort((a, b) => b.total_emissions - a.total_emissions);

    const totalEmissions = categoryBreakdown.reduce((sum, c) => sum + c.total_emissions, 0);

    // Add percentages and format
    const breakdown = categoryBreakdown.map(c => ({
        category: c.category,
        count: c.count,
        emissions: parseFloat(c.total_emissions.toFixed(2)),
        avgPerActivity: parseFloat((c.total_emissions / c.count).toFixed(2)),
        percentage: totalEmissions > 0 ? Math.round((c.total_emissions / totalEmissions) * 100) : 0
    }));

    // Weekly comparison (calendar week boundaries)
    const thisWeekEmissions = db.prepare(`
        SELECT COALESCE(SUM(emissions), 0) as total FROM activities 
        WHERE user_id = ? AND date >= ?
    `).get(userId, thisWeekStartStr).total;

    const lastWeekEmissions = db.prepare(`
        SELECT COALESCE(SUM(emissions), 0) as total FROM activities 
        WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(userId, lastWeekStartStr, lastWeekEndStr).total;

    const weeklyChange = lastWeekEmissions > 0 
        ? Math.round(((thisWeekEmissions - lastWeekEmissions) / lastWeekEmissions) * 100) 
        : 0;

    // Activity patterns (selected period)
    const activityCount = db.prepare(`
        SELECT COUNT(*) as count FROM activities WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(userId, periodStartStr, periodEndStr).count;

    const daysActive = db.prepare(`
        SELECT COUNT(DISTINCT date) as days FROM activities WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(userId, periodStartStr, periodEndStr).days;

    // Best performing category (lowest per-activity emissions)
    const bestCategory = breakdown.length > 0 
        ? breakdown.reduce((best, c) => c.avgPerActivity < best.avgPerActivity ? c : best, breakdown[0])
        : null;

    // Highest impact category
    const highestImpact = breakdown.length > 0 ? breakdown[0] : null;

    // Daily average
    const dailyAverage = daysActive > 0 ? (totalEmissions / daysActive) : 0;

    // Global average comparison (4.8 tons/year = 13.15 kg/day)
    const globalDailyAvg = 13.15;
    const vsGlobalPercent = globalDailyAvg > 0 
        ? Math.round(((dailyAverage - globalDailyAvg) / globalDailyAvg) * 100) 
        : 0;

    return {
        breakdown,
        totals: {
            monthly: parseFloat(totalEmissions.toFixed(2)),
            weekly: parseFloat(thisWeekEmissions.toFixed(2)),
            dailyAverage: parseFloat(dailyAverage.toFixed(2)),
            activityCount,
            daysActive
        },
        comparison: {
            weeklyChange,
            vsGlobal: vsGlobalPercent,
            isAboveAverage: dailyAverage > globalDailyAvg
        },
        highlights: {
            highestImpact: highestImpact ? {
                category: highestImpact.category,
                emissions: highestImpact.emissions,
                percentage: highestImpact.percentage
            } : null,
            bestCategory: bestCategory ? {
                category: bestCategory.category,
                avgPerActivity: bestCategory.avgPerActivity
            } : null
        }
    };
}

// Force refresh AI insights
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Force regenerate AI insights
        const insightsData = await getInsights(userId, true);

        res.json({
            message: 'Insights refreshed',
            source: insightsData.source,
            generatedAt: insightsData.generatedAt
        });
    } catch (error) {
        console.error('Refresh insights error:', error);
        res.status(500).json({ error: 'Failed to refresh insights', message: error.message });
    }
});

// Get specific insight details
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const insights = generateInsights(userId);
        const insight = insights.find(i => i.id === id);

        if (!insight) {
            return res.status(404).json({ error: 'Insight not found' });
        }

        // Add more details for specific insights
        const enhancedInsight = {
            ...insight,
            tips: getInsightTips(id),
            resources: getInsightResources(id)
        };

        res.json({ insight: enhancedInsight });
    } catch (error) {
        console.error('Get insight error:', error);
        res.status(500).json({ error: 'Failed to get insight', message: error.message });
    }
});

// Dismiss an insight
router.post('/:id/dismiss', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Store dismissed insight in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // Re-show after 30 days

        db.prepare(`
            INSERT OR REPLACE INTO insights (user_id, insight_type, category, title, description, is_dismissed, expires_at)
            VALUES (?, ?, 'dismissed', ?, '', 1, ?)
        `).run(userId, id, id, expiresAt.toISOString());

        res.json({ message: 'Insight dismissed', expiresAt: expiresAt.toISOString() });
    } catch (error) {
        console.error('Dismiss insight error:', error);
        res.status(500).json({ error: 'Failed to dismiss insight', message: error.message });
    }
});

// Get trends analysis
router.get('/analysis/trends', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const trends = identifyTrends(userId);

        res.json({ trends });
    } catch (error) {
        console.error('Trends error:', error);
        res.status(500).json({ error: 'Failed to analyze trends', message: error.message });
    }
});

// Get category-specific recommendations
router.get('/category/:category', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { category } = req.params;

        const allInsights = generateInsights(userId);
        const categoryInsights = allInsights.filter(i => i.category === category);

        res.json({
            category,
            insights: categoryInsights,
            tips: getCategoryTips(category)
        });
    } catch (error) {
        console.error('Category insights error:', error);
        res.status(500).json({ error: 'Failed to get category insights', message: error.message });
    }
});

// Helper function: Get tips for specific insights
function getInsightTips(insightId) {
    const tips = {
        'switch-to-public-transit': [
            'Plan your route using public transit apps',
            'Get a monthly pass for cost savings',
            'Use travel time productively - read or work',
            'Combine with cycling for the "last mile"'
        ],
        'try-cycling': [
            'Start with just one day per week',
            'Invest in a comfortable, reliable bike',
            'Use bike lanes and quiet streets',
            'Keep rain gear at work for bad weather'
        ],
        'switch-renewable': [
            'Compare green energy providers in your area',
            'Look for 100% renewable options',
            'Consider installing solar panels',
            'Many providers offer competitive rates'
        ],
        'meatless-days': [
            'Start with "Meatless Monday"',
            'Explore cuisines that are naturally vegetarian (Indian, Mediterranean)',
            'Learn to cook 3-4 delicious veggie meals',
            'Focus on what you\'re adding, not removing'
        ],
        'start-composting': [
            'Start with a simple countertop bin',
            'Compost fruit/veggie scraps, coffee grounds, eggshells',
            'Avoid meat, dairy, and oily foods',
            'Use the compost in your garden or donate it'
        ]
    };
    return tips[insightId] || ['Follow the recommendation to reduce your carbon footprint'];
}

// Helper function: Get resources for insights
function getInsightResources(insightId) {
    const resources = {
        'switch-to-public-transit': [
            { title: 'Local Transit Authority', type: 'link' },
            { title: 'Transit App Recommendations', type: 'article' }
        ],
        'switch-renewable': [
            { title: 'Green Energy Providers Comparison', type: 'tool' },
            { title: 'Solar Panel Calculator', type: 'tool' }
        ],
        'meatless-days': [
            { title: 'Easy Vegetarian Recipes', type: 'recipes' },
            { title: 'Plant-Based Protein Guide', type: 'guide' }
        ]
    };
    return resources[insightId] || [];
}

// Helper function: Get tips for categories
function getCategoryTips(category) {
    const categoryTips = {
        transport: [
            'Walk or bike for trips under 2km',
            'Use public transit for longer commutes',
            'Carpool when driving is necessary',
            'Maintain your vehicle for efficiency',
            'Consider an electric or hybrid vehicle'
        ],
        energy: [
            'Switch to LED bulbs throughout your home',
            'Unplug devices when not in use',
            'Use smart power strips',
            'Set thermostats efficiently',
            'Consider renewable energy providers'
        ],
        diet: [
            'Reduce red meat consumption',
            'Buy local and seasonal produce',
            'Plan meals to reduce food waste',
            'Grow some of your own herbs/vegetables',
            'Choose products with less packaging'
        ],
        waste: [
            'Follow the 5 Rs: Refuse, Reduce, Reuse, Recycle, Rot',
            'Bring reusable bags, bottles, and containers',
            'Compost food scraps',
            'Repair before replacing',
            'Buy second-hand when possible'
        ]
    };
    return categoryTips[category] || [];
}

// Generate Detailed Carbon Footprint Report
router.get('/report/detailed', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;
        
        // Build query with optional date filtering
        let query = `SELECT * FROM activities WHERE user_id = ?`;
        const params = [userId];
        
        // Add date filters if provided
        if (startDate) {
            query += ` AND date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND date <= ?`;
            params.push(endDate);
        }
        
        query += ` ORDER BY date DESC`;
        
        // Get filtered activities
        const allActivities = db.prepare(query).all(...params);

        if (allActivities.length === 0) {
            const dateRangeMsg = startDate && endDate 
                ? ` between ${startDate} and ${endDate}` 
                : startDate ? ` after ${startDate}` 
                : endDate ? ` before ${endDate}` 
                : '';
            return res.status(400).json({ 
                error: 'Insufficient data', 
                message: `No activities found${dateRangeMsg}. Please log some activities or adjust your date range.` 
            });
        }

        // Get date range
        const dates = allActivities.map(a => new Date(a.date));
        const earliestDate = new Date(Math.min(...dates));
        const latestDate = new Date(Math.max(...dates));
        const daysCovered = Math.max(1, Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24)) + 1);

        // Calculate totals by category
        const categoryTotals = {};
        const categoryDetails = {};
        
        for (const activity of allActivities) {
            const cat = normalizeCategory(activity.category);
            if (!categoryTotals[cat]) {
                categoryTotals[cat] = 0;
                categoryDetails[cat] = {
                    activities: [],
                    totalEmissions: 0,
                    count: 0,
                    avgPerActivity: 0
                };
            }
            categoryTotals[cat] += activity.emissions || 0;
            categoryDetails[cat].totalEmissions += activity.emissions || 0;
            categoryDetails[cat].count += 1;
            categoryDetails[cat].activities.push({
                description: activity.description,
                amount: activity.amount,
                emissions: activity.emissions,
                date: activity.date
            });
        }

        // Calculate averages
        for (const cat in categoryDetails) {
            categoryDetails[cat].avgPerActivity = categoryDetails[cat].totalEmissions / categoryDetails[cat].count;
        }

        // Total emissions
        const totalEmissions = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
        const dailyAverage = totalEmissions / daysCovered;
        const monthlyProjection = dailyAverage * 30;
        const yearlyProjection = dailyAverage * 365;

        // Get insights and fixes based on filtered activities
        const insights = generateInsightsFromActivities(allActivities, userId);
        
        // Calculate potential savings per fix
        const fixes = [];
        let totalPotentialSavings = 0;
        
        for (const insight of insights) {
            if (insight.potentialSavings && insight.potentialSavings > 0) {
                const savingsPercent = monthlyProjection > 0 
                    ? Math.round((insight.potentialSavings / monthlyProjection) * 100) 
                    : 0;
                    
                fixes.push({
                    category: insight.category,
                    title: insight.title,
                    description: insight.description,
                    currentUsage: categoryTotals[insight.category] || 0,
                    potentialSavings: insight.potentialSavings,
                    savingsPercent: savingsPercent,
                    priority: insight.priority || 5,
                    feasibility: insight.priority >= 8 ? 'Easy' : insight.priority >= 5 ? 'Moderate' : 'Challenging',
                    timeframe: insight.priority >= 8 ? 'Immediate' : insight.priority >= 5 ? '1-3 months' : '3-6 months',
                    specificActions: getSpecificActions(insight.id || insight.title)
                });
                totalPotentialSavings += insight.potentialSavings;
            }
        }

        // Sort fixes by potential impact
        fixes.sort((a, b) => b.potentialSavings - a.potentialSavings);

        // Calculate optimized projections
        const optimizedMonthly = Math.max(0, monthlyProjection - totalPotentialSavings);
        const optimizedYearly = optimizedMonthly * 12;
        const reductionPercent = monthlyProjection > 0 
            ? Math.round(((monthlyProjection - optimizedMonthly) / monthlyProjection) * 100) 
            : 0;

        // Category breakdown with percentages
        const categoryBreakdown = Object.entries(categoryTotals).map(([cat, emissions]) => ({
            category: cat,
            emissions: parseFloat(emissions.toFixed(2)),
            percentage: totalEmissions > 0 ? Math.round((emissions / totalEmissions) * 100) : 0,
            activitiesCount: categoryDetails[cat]?.count || 0,
            avgPerActivity: parseFloat((categoryDetails[cat]?.avgPerActivity || 0).toFixed(2)),
            topActivities: (categoryDetails[cat]?.activities || [])
                .sort((a, b) => (b.emissions || 0) - (a.emissions || 0))
                .slice(0, 3)
                .map(a => ({ description: a.description, emissions: parseFloat((a.emissions || 0).toFixed(2)) }))
        })).sort((a, b) => b.emissions - a.emissions);

        // Weekly trends
        const weeklyData = {};
        for (const activity of allActivities) {
            const date = new Date(activity.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = 0;
            }
            weeklyData[weekKey] += activity.emissions || 0;
        }

        const weeklyTrends = Object.entries(weeklyData)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([week, emissions]) => ({
                week,
                emissions: parseFloat(emissions.toFixed(2))
            }));

        // Determine trend direction
        let trendDirection = 'stable';
        if (weeklyTrends.length >= 2) {
            const recentWeeks = weeklyTrends.slice(-4);
            if (recentWeeks.length >= 2) {
                const firstHalf = recentWeeks.slice(0, Math.ceil(recentWeeks.length / 2));
                const secondHalf = recentWeeks.slice(Math.ceil(recentWeeks.length / 2));
                const firstAvg = firstHalf.reduce((sum, w) => sum + w.emissions, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((sum, w) => sum + w.emissions, 0) / secondHalf.length;
                
                if (secondAvg < firstAvg * 0.9) trendDirection = 'improving';
                else if (secondAvg > firstAvg * 1.1) trendDirection = 'worsening';
            }
        }

        // Global comparison
        const globalDailyAvg = 13.15; // 4.8 tons/year
        const vsGlobalPercent = Math.round(((dailyAverage - globalDailyAvg) / globalDailyAvg) * 100);

        // Generate AI summary if available
        let aiAnalysis = null;
        try {
            const prompt = `Analyze this carbon footprint data and provide a detailed executive summary:

Total Emissions (tracked period): ${totalEmissions.toFixed(2)} kg CO₂
Daily Average: ${dailyAverage.toFixed(2)} kg CO₂
Monthly Projection: ${monthlyProjection.toFixed(2)} kg CO₂
Yearly Projection: ${(yearlyProjection / 1000).toFixed(2)} tons CO₂
Days Tracked: ${daysCovered}
Activities Logged: ${allActivities.length}

Category Breakdown:
${categoryBreakdown.map(c => `- ${c.category}: ${c.emissions} kg (${c.percentage}%)`).join('\n')}

Top Fixes Available:
${fixes.slice(0, 5).map(f => `- ${f.title}: Could save ${f.potentialSavings} kg CO₂/month`).join('\n')}

Potential Reduction: ${reductionPercent}% (from ${monthlyProjection.toFixed(1)} to ${optimizedMonthly.toFixed(1)} kg/month)
Trend: ${trendDirection}
vs Global Average: ${vsGlobalPercent > 0 ? '+' : ''}${vsGlobalPercent}%

Provide:
1. A 2-3 sentence executive summary of their situation
2. The single most impactful change they should make
3. A realistic 3-month action plan (3 bullet points)
4. An encouraging message based on their progress

Format as JSON with keys: executiveSummary, topPriority, actionPlan (array), encouragement`;

            const aiResponse = await generateAISummary(userId, prompt, true);
            if (aiResponse && aiResponse.summary) {
                try {
                    aiAnalysis = JSON.parse(aiResponse.summary);
                } catch {
                    aiAnalysis = { executiveSummary: aiResponse.summary };
                }
            }
        } catch (error) {
            console.log('AI analysis not available, using algorithmic summary');
        }

        // ML-powered analysis (if ML service is available)
        let mlAnalysis = null;
        try {
            const mlAvailable = await isMLServiceAvailable();
            if (mlAvailable) {
                const mlFeatures = extractMLFeatures(allActivities);
                if (mlFeatures) {
                    // Run all ML analyses in parallel
                    const [classification, prediction, anomaly, recommendations] = await Promise.all([
                        classifyUser(mlFeatures),
                        predictEmissions(mlFeatures),
                        detectAnomaly(mlFeatures),
                        getRecommendations(mlFeatures)
                    ]);
                    
                    mlAnalysis = {
                        available: true,
                        userProfile: classification ? {
                            cluster: classification.cluster_name,
                            description: classification.description,
                            confidence: classification.confidence
                        } : null,
                        prediction: prediction ? {
                            daily: prediction.predicted_daily_emission,
                            weekly: prediction.predicted_weekly_emission,
                            monthly: prediction.predicted_monthly_emission,
                            topFactors: prediction.top_contributing_factors
                        } : null,
                        anomaly: anomaly ? {
                            isAnomaly: anomaly.is_anomaly,
                            reason: anomaly.reason,
                            recommendation: anomaly.recommendation
                        } : null,
                        recommendations: recommendations ? {
                            cluster: recommendations.cluster,
                            items: recommendations.recommendations,
                            totalPotentialReduction: recommendations.total_potential_reduction
                        } : null
                    };
                }
            } else {
                mlAnalysis = { available: false, reason: 'ML service not running' };
            }
        } catch (error) {
            console.log('ML analysis error:', error.message);
            mlAnalysis = { available: false, reason: error.message };
        }

        // Build response
        res.json({
            success: true,
            generatedAt: new Date().toISOString(),
            summary: {
                dateRange: {
                    start: earliestDate.toISOString().split('T')[0],
                    end: latestDate.toISOString().split('T')[0],
                    daysCovered
                },
                totalActivities: allActivities.length,
                totalEmissions: parseFloat(totalEmissions.toFixed(2)),
                dailyAverage: parseFloat(dailyAverage.toFixed(2)),
                monthlyProjection: parseFloat(monthlyProjection.toFixed(2)),
                yearlyProjection: parseFloat((yearlyProjection / 1000).toFixed(2)), // in tons
                vsGlobalPercent,
                trendDirection
            },
            comparison: {
                current: {
                    monthly: parseFloat(monthlyProjection.toFixed(2)),
                    yearly: parseFloat((yearlyProjection / 1000).toFixed(2))
                },
                optimized: {
                    monthly: parseFloat(optimizedMonthly.toFixed(2)),
                    yearly: parseFloat((optimizedYearly / 1000).toFixed(2))
                },
                savings: {
                    monthly: parseFloat(totalPotentialSavings.toFixed(2)),
                    yearly: parseFloat(((totalPotentialSavings * 12) / 1000).toFixed(2)),
                    percent: reductionPercent
                }
            },
            categoryBreakdown,
            fixes,
            weeklyTrends,
            aiAnalysis,
            mlAnalysis
        });

    } catch (error) {
        console.error('Detailed report error:', error);
        res.status(500).json({ error: 'Failed to generate report', message: error.message });
    }
});

// Helper to normalize category names
function normalizeCategory(cat) {
    const lower = (cat || '').toLowerCase();
    if (lower === 'energy' || lower === 'electricity') return 'electricity';
    if (lower === 'food' || lower === 'diet') return 'diet';
    return lower;
}

// Helper to get specific actions for fixes
function getSpecificActions(insightId) {
    const actions = {
        'switch-to-public-transit': [
            'Download local transit app and check your commute route',
            'Purchase a weekly/monthly transit pass',
            'Start with 2 days per week using transit',
            'Use commute time for reading or work'
        ],
        'try-cycling': [
            'Map safe bike routes for trips under 5km',
            'Consider an e-bike for longer distances',
            'Keep weather-appropriate gear at work',
            'Start with one cycling day per week'
        ],
        'switch-renewable': [
            'Compare green energy providers in your area',
            'Check if your current provider offers a renewable plan',
            'Most switches take less than 15 minutes online',
            'Look for solar panel incentives in your region'
        ],
        'meatless-days': [
            'Start with Meatless Mondays',
            'Find 3-4 vegetarian recipes you enjoy',
            'Stock up on plant-based protein sources',
            'Explore vegetarian cuisines (Indian, Mediterranean, Thai)'
        ],
        'reduce-flights': [
            'Use video calls for business meetings when possible',
            'Choose trains for trips under 500km',
            'Combine trips to reduce total flights',
            'Consider carbon offsets for necessary flights'
        ],
        'carpooling': [
            'Ask coworkers about shared commute schedules',
            'Try carpooling apps in your area',
            'Set up a rotation with neighbors',
            'Benefits: shared fuel costs + HOV lane access'
        ],
        'reduce-standby': [
            'Use smart power strips for entertainment centers',
            'Unplug chargers when not in use',
            'Enable auto-shutdown on computers',
            'Estimated savings: 10% of electricity bill'
        ],
        'start-composting': [
            'Get a countertop compost bin',
            'Learn what can and cannot be composted',
            'Find a local composting program or start backyard composting',
            'Reduces methane emissions from landfills'
        ]
    };
    
    // Check for partial matches
    const lowerInsightId = (insightId || '').toLowerCase();
    for (const [key, value] of Object.entries(actions)) {
        if (lowerInsightId.includes(key.replace(/-/g, ' ')) || key.includes(lowerInsightId.replace(/ /g, '-'))) {
            return value;
        }
    }
    
    return [
        'Review your current habits in this area',
        'Set a specific, measurable goal',
        'Track your progress weekly',
        'Celebrate small wins along the way'
    ];
}

module.exports = router;
