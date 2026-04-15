// ===== ML Insights Engine =====
// Rule-based recommendation system with pattern analysis
// Enhanced with Ollama LLM for AI-powered insights

const db = require('../database/db');
const ollama = require('./ollama');

// Insight templates with conditions
const INSIGHT_TEMPLATES = {
    transport: [
        {
            id: 'switch-to-public-transit',
            title: 'Switch to Public Transit',
            description: 'Your car usage accounts for a significant portion of emissions. Using public transit just 2 days a week could reduce your transport footprint by 40%.',
            condition: (data) => data.carTrips > 5 && data.publicTransitTrips < 2,
            calculateSavings: (data) => data.carEmissions * 0.4,
            priority: 9,
            category: 'transport'
        },
        {
            id: 'try-cycling',
            title: 'Try Active Commuting',
            description: 'Short trips under 5km are perfect for cycling. You could save emissions and improve your health!',
            condition: (data) => data.shortCarTrips > 3,
            calculateSavings: (data) => data.shortCarTrips * 2.5,
            priority: 8,
            category: 'transport'
        },
        {
            id: 'carpooling',
            title: 'Consider Carpooling',
            description: 'Sharing rides with colleagues or neighbors could cut your transport emissions in half.',
            condition: (data) => data.soloCarTrips > 8,
            calculateSavings: (data) => data.carEmissions * 0.3,
            priority: 7,
            category: 'transport'
        },
        {
            id: 'reduce-flights',
            title: 'Reduce Air Travel',
            description: 'A single flight can emit more CO2 than months of driving. Consider video calls for business or trains for shorter trips.',
            condition: (data) => data.flightEmissions > 100,
            calculateSavings: (data) => data.flightEmissions * 0.5,
            priority: 10,
            category: 'transport'
        }
    ],
    electricity: [
        {
            id: 'switch-renewable',
            title: 'Go Renewable Now',
            description: 'Switch to a green energy provider - cuts your electricity emissions by 85% instantly.',
            condition: (data) => data.energySource !== 'renewable' && data.electricityEmissions > 20,
            calculateSavings: (data) => data.electricityEmissions * 0.85,
            priority: 9,
            category: 'electricity'
        },
        {
            id: 'reduce-standby',
            title: 'Kill Standby Power',
            description: 'Devices on standby eat 10% of your electricity. Use power strips to cut them dead.',
            condition: (data) => data.electricityUsage > 300,
            calculateSavings: (data) => data.electricityEmissions * 0.1,
            priority: 6,
            category: 'electricity'
        },
        {
            id: 'led-lighting',
            title: 'Switch to LEDs',
            description: 'LED bulbs use 75% less power. Easy swap, big impact.',
            condition: (data) => data.electricityUsage > 250,
            calculateSavings: (data) => data.electricityEmissions * 0.05,
            priority: 5,
            category: 'electricity'
        },
        {
            id: 'smart-thermostat',
            title: 'Get a Smart Thermostat',
            description: 'Auto-adjust heating = 10-15% energy savings. Set it and forget it.',
            condition: (data) => data.heatingEmissions > 30,
            calculateSavings: (data) => data.heatingEmissions * 0.12,
            priority: 7,
            category: 'electricity'
        }
    ],
    diet: [
        {
            id: 'meatless-days',
            title: 'Try Meatless Days',
            description: 'Reducing meat consumption by just one day per week can significantly lower your dietary carbon footprint.',
            condition: (data) => data.dietType === 'meat-heavy' || data.dietType === 'average',
            calculateSavings: (data) => (data.dietEmissions || 40) * 0.15,
            priority: 8,
            category: 'diet'
        },
        {
            id: 'local-seasonal',
            title: 'Choose Local & Seasonal',
            description: 'Locally sourced, seasonal produce requires less transportation and storage, reducing emissions by 10-15%.',
            condition: (data) => !data.localFood,
            calculateSavings: (data) => (data.dietEmissions || 30) * 0.12,
            priority: 6,
            category: 'diet'
        },
        {
            id: 'reduce-food-waste',
            title: 'Reduce Food Waste',
            description: 'About 30% of food is wasted. Planning meals and using leftovers can cut diet emissions significantly.',
            condition: (data) => !data.lowFoodWaste,
            calculateSavings: (data) => (data.dietEmissions || 30) * 0.2,
            priority: 7,
            category: 'diet'
        },
        {
            id: 'plant-protein',
            title: 'Explore Plant Proteins',
            description: 'Beans, lentils, and tofu have 10-50x lower emissions than beef. Try swapping just a few meals.',
            condition: (data) => data.dietType !== 'vegetarian' && data.dietType !== 'vegan',
            calculateSavings: (data) => (data.dietEmissions || 35) * 0.2,
            priority: 7,
            category: 'diet'
        }
    ],
    waste: [
        {
            id: 'start-composting',
            title: 'Start Composting',
            description: 'Composting food waste prevents methane emissions from landfills and creates nutrient-rich soil.',
            condition: (data) => !data.composts && data.wasteEmissions > 5,
            calculateSavings: (data) => (data.wasteEmissions || 10) * 0.3,
            priority: 7,
            category: 'waste'
        },
        {
            id: 'improve-recycling',
            title: 'Improve Recycling Habits',
            description: 'Recycling just one more material type (paper, plastic, glass, or metal) can reduce waste emissions by 10%.',
            condition: (data) => data.recyclingScore < 4,
            calculateSavings: (data) => (data.wasteEmissions || 8) * 0.1,
            priority: 6,
            category: 'waste'
        },
        {
            id: 'reduce-single-use',
            title: 'Reduce Single-Use Items',
            description: 'Switching to reusable bags, bottles, and containers can eliminate significant waste and emissions.',
            condition: (data) => data.singleUseLevel === 'high' || data.singleUseLevel === 'medium',
            calculateSavings: (data) => (data.wasteEmissions || 8) * 0.15,
            priority: 6,
            category: 'waste'
        }
    ]
};

// Analyze user data and generate insights
function analyzeUserData(userId, startDate = null, endDate = null) {
    const data = {};

    // Get user's activities - use custom date range if provided, otherwise current calendar month
    let dateFilter;
    let params = [userId];
    
    if (startDate && endDate) {
        dateFilter = 'date >= ? AND date <= ?';
        params.push(startDate, endDate);
    } else {
        const today = new Date();
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0];
        dateFilter = 'date >= ?';
        params.push(thisMonthStartStr);
    }

    const activities = db.prepare(`
        SELECT * FROM activities 
        WHERE user_id = ? AND ${dateFilter}
    `).all(...params);

    return analyzeActivitiesData(activities, userId);
}

// Analyze pre-filtered activities (for date-range reports)
function analyzeActivitiesData(activities, userId) {
    const data = {};
    const normalizeCategory = (cat) => {
        const lower = cat.toLowerCase();
        if (lower === 'energy' || lower === 'electricity') return 'electricity';
        if (lower === 'food' || lower === 'diet') return 'diet';
        return lower;
    };

    // Track which categories have logged data (normalized)
    const categoriesWithData = new Set();
    activities.forEach(a => categoriesWithData.add(normalizeCategory(a.category)));
    data.categoriesWithData = Array.from(categoriesWithData);
    data.activityCount = activities.length;

    // Get calculator profile
    const profile = db.prepare(`
        SELECT * FROM calculator_profiles WHERE user_id = ?
    `).get(userId);

    // Analyze transport
    const transportActivities = activities.filter(a => a.category === 'transport');
    data.carTrips = transportActivities.filter(a => 
        a.description.toLowerCase().includes('car') || 
        a.description.toLowerCase().includes('drove')
    ).length;
    data.publicTransitTrips = transportActivities.filter(a =>
        a.description.toLowerCase().includes('bus') ||
        a.description.toLowerCase().includes('train') ||
        a.description.toLowerCase().includes('metro')
    ).length;
    data.shortCarTrips = transportActivities.filter(a =>
        (a.description.toLowerCase().includes('car') || a.description.toLowerCase().includes('drove')) &&
        a.value < 5
    ).length;
    data.soloCarTrips = data.carTrips; // Assume solo unless specified
    data.carEmissions = transportActivities
        .filter(a => a.description.toLowerCase().includes('car') || a.description.toLowerCase().includes('drove'))
        .reduce((sum, a) => sum + a.emissions, 0);
    data.flightEmissions = transportActivities
        .filter(a => a.description.toLowerCase().includes('flight') || a.description.toLowerCase().includes('plane'))
        .reduce((sum, a) => sum + a.emissions, 0);
    data.transportEmissions = transportActivities.reduce((sum, a) => sum + a.emissions, 0);
    data.hasTransportData = transportActivities.length > 0;

    // Analyze electricity (includes 'energy' category)
    const electricityActivities = activities.filter(a => a.category === 'electricity' || a.category === 'energy');
    data.electricityEmissions = electricityActivities.reduce((sum, a) => sum + a.emissions, 0);
    data.electricityUsage = electricityActivities.reduce((sum, a) => sum + a.value, 0);
    data.energySource = profile?.energy_source || null;
    data.hasElectricityData = electricityActivities.length > 0;

    // Analyze heating
    const heatingActivities = activities.filter(a => a.category === 'heating');
    data.heatingEmissions = heatingActivities.reduce((sum, a) => sum + a.emissions, 0);
    data.hasHeatingData = heatingActivities.length > 0;

    // Analyze diet
    const dietActivities = activities.filter(a => a.category === 'diet' || a.category === 'food');
    data.dietEmissions = dietActivities.reduce((sum, a) => sum + a.emissions, 0);
    data.dietType = profile?.diet_type || null;
    data.localFood = profile?.local_food || false;
    data.lowFoodWaste = profile?.low_food_waste || false;
    data.hasDietData = dietActivities.length > 0;

    // Analyze waste
    const wasteActivities = activities.filter(a => a.category === 'waste');
    data.wasteEmissions = wasteActivities.reduce((sum, a) => sum + a.emissions, 0);
    data.composts = profile?.compost || false;
    data.recyclingScore = (profile?.recycle_paper ? 1 : 0) + 
                          (profile?.recycle_plastic ? 1 : 0) + 
                          (profile?.recycle_glass ? 1 : 0) + 
                          (profile?.recycle_metal ? 1 : 0);
    data.singleUseLevel = profile?.single_use || 'medium';
    data.hasWasteData = wasteActivities.length > 0;

    // Calculate totals
    data.totalEmissions = activities.reduce((sum, a) => sum + a.emissions, 0);
    data.hasAnyData = activities.length > 0;

    return data;
}

// Generate personalized insights
function generateInsights(userId) {
    const userData = analyzeUserData(userId);
    const insights = [];

    // If no data, return helpful getting-started tips
    if (!userData.hasAnyData) {
        return [
            {
                id: 'get-started-transport',
                title: 'Start Tracking Transport',
                description: 'Log your commute, car trips, and transit to see your transport emissions.',
                category: 'transport',
                potentialSavings: 0,
                priority: 10
            },
            {
                id: 'get-started-electricity',
                title: 'Track Your Electricity',
                description: 'Add your electricity usage to see how home energy impacts your footprint.',
                category: 'electricity',
                potentialSavings: 0,
                priority: 9
            },
            {
                id: 'get-started-diet',
                title: 'Log Your Meals',
                description: 'Track dietary choices to see how food impacts your carbon footprint.',
                category: 'diet',
                potentialSavings: 0,
                priority: 8
            }
        ];
    }

    // Only check templates for categories with data
    for (const category of Object.keys(INSIGHT_TEMPLATES)) {
        // Map category to data flag
        const categoryDataMap = {
            'transport': userData.hasTransportData,
            'electricity': userData.hasElectricityData || userData.hasHeatingData,
            'diet': userData.hasDietData,
            'waste': userData.hasWasteData
        };

        // Skip categories without logged data
        if (!categoryDataMap[category]) continue;

        // Track if we've added an insight for this category (one per category max)
        let categoryInsightAdded = false;

        for (const template of INSIGHT_TEMPLATES[category]) {
            if (categoryInsightAdded) break; // Only one insight per category
            
            try {
                if (template.condition(userData)) {
                    const savings = template.calculateSavings(userData);
                    if (savings > 0) {
                        insights.push({
                            id: template.id,
                            title: template.title,
                            description: template.description,
                            category: template.category,
                            potentialSavings: Math.round(savings * 10) / 10,
                            priority: template.priority
                        });
                        categoryInsightAdded = true;
                    }
                }
            } catch (e) {
                // Skip if template evaluation fails
            }
        }
    }

    // Sort by priority and potential savings
    insights.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.potentialSavings - a.potentialSavings;
    });

    return insights;
}

// Generate insights from pre-filtered activities (for date-range reports)
function generateInsightsFromActivities(activities, userId) {
    const userData = analyzeActivitiesData(activities, userId);
    const insights = [];

    // If no data, return helpful getting-started tips
    if (!userData.hasAnyData) {
        return [{
            id: 'no-data-in-range',
            title: 'No Data in Selected Range',
            description: 'No activities found in the selected date range.',
            category: 'general',
            potentialSavings: 0,
            priority: 10
        }];
    }

    // Only check templates for categories with data
    for (const category of Object.keys(INSIGHT_TEMPLATES)) {
        const categoryDataMap = {
            'transport': userData.hasTransportData,
            'electricity': userData.hasElectricityData || userData.hasHeatingData,
            'diet': userData.hasDietData,
            'waste': userData.hasWasteData
        };

        if (!categoryDataMap[category]) continue;

        let categoryInsightAdded = false;

        for (const template of INSIGHT_TEMPLATES[category]) {
            if (categoryInsightAdded) break;
            
            try {
                if (template.condition(userData)) {
                    const savings = template.calculateSavings(userData);
                    if (savings > 0) {
                        insights.push({
                            id: template.id,
                            title: template.title,
                            description: template.description,
                            category: template.category,
                            potentialSavings: Math.round(savings * 10) / 10,
                            priority: template.priority
                        });
                        categoryInsightAdded = true;
                    }
                }
            } catch (e) {
                // Skip if template evaluation fails
            }
        }
    }

    insights.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.potentialSavings - a.potentialSavings;
    });

    return insights;
}

// Identify trends in user data
function identifyTrends(userId) {
    const trends = [];

    // Get emissions by category - using calendar week boundaries (Monday-Sunday)
    const today = new Date();
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

    const categories = ['transport', 'electricity', 'heating', 'diet', 'waste'];

    for (const category of categories) {
        const thisWeek = db.prepare(`
            SELECT COALESCE(SUM(emissions), 0) as total
            FROM activities
            WHERE user_id = ? AND category = ? AND date >= ?
        `).get(userId, category, thisWeekStartStr);

        const lastWeek = db.prepare(`
            SELECT COALESCE(SUM(emissions), 0) as total
            FROM activities
            WHERE user_id = ? AND category = ? AND date >= ? AND date <= ?
        `).get(userId, category, lastWeekStartStr, lastWeekEndStr);

        if (lastWeek.total > 0) {
            const changePercent = Math.round(((thisWeek.total - lastWeek.total) / lastWeek.total) * 100);
            
            if (Math.abs(changePercent) >= 5) {
                let trend, message;
                if (changePercent <= -10) {
                    trend = 'positive';
                    message = `Great job! Your ${category} emissions are down ${Math.abs(changePercent)}% this week.`;
                } else if (changePercent >= 10) {
                    trend = 'negative';
                    message = `Your ${category} emissions increased ${changePercent}% this week. Consider reviewing your habits.`;
                } else {
                    trend = 'neutral';
                    message = `Your ${category} emissions are relatively stable.`;
                }

                trends.push({
                    category,
                    changePercent,
                    trend,
                    message,
                    thisWeek: thisWeek.total.toFixed(1),
                    lastWeek: lastWeek.total.toFixed(1)
                });
            }
        }
    }

    return trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

// Generate main AI insight summary
function generateAISummary(userId) {
    const userData = analyzeUserData(userId);
    const insights = generateInsights(userId);

    // Handle no data case
    if (!userData.hasAnyData) {
        return {
            summary: "Welcome to CarbonWise! Start logging your daily activities to get personalized insights about your carbon footprint. We'll analyze your transport, energy, diet, and waste patterns to help you make eco-friendly choices.",
            topCategory: null,
            potentialSavings: '0',
            insightCount: 0
        };
    }

    // Find highest emission category (only from categories with data)
    const categories = [
        { name: 'transport', emissions: userData.transportEmissions, hasData: userData.hasTransportData },
        { name: 'electricity', emissions: userData.electricityEmissions, hasData: userData.hasElectricityData },
        { name: 'heating', emissions: userData.heatingEmissions, hasData: userData.hasHeatingData },
        { name: 'diet', emissions: userData.dietEmissions, hasData: userData.hasDietData },
        { name: 'waste', emissions: userData.wasteEmissions, hasData: userData.hasWasteData }
    ].filter(c => c.hasData);

    if (categories.length === 0) {
        return {
            summary: "You've started tracking! Keep logging activities to build a complete picture of your carbon footprint.",
            topCategory: null,
            potentialSavings: '0',
            insightCount: insights.length
        };
    }

    categories.sort((a, b) => b.emissions - a.emissions);
    const topCategory = categories[0];
    const totalEmissions = categories.reduce((sum, c) => sum + c.emissions, 0);
    const topPercentage = totalEmissions > 0 ? Math.round((topCategory.emissions / totalEmissions) * 100) : 0;

    // Calculate total potential savings
    const totalPotentialSavings = insights.reduce((sum, i) => sum + i.potentialSavings, 0);

    // Generate personalized summary
    let summary = `Based on ${userData.activityCount} logged activities, your highest emission source is **${topCategory.name}** at ${topCategory.emissions.toFixed(1)} kg CO₂ (${topPercentage}% of tracked emissions). `;

    if (insights.length > 0 && totalPotentialSavings > 0) {
        summary += `By following our recommendations, you could save up to ${totalPotentialSavings.toFixed(0)} kg CO₂ per month.`;
    } else {
        summary += `Keep tracking to unlock personalized reduction tips!`;
    }

    return {
        summary,
        topCategory: {
            name: topCategory.name,
            emissions: topCategory.emissions.toFixed(1),
            percentage: topPercentage
        },
        potentialSavings: totalPotentialSavings.toFixed(0),
        insightCount: insights.length
    };
}

// Get user's active goals for context
function getUserGoals(userId) {
    try {
        return db.prepare(`
            SELECT type, title, target_value, current_value, status
            FROM goals WHERE user_id = ? AND status = 'active'
        `).all(userId);
    } catch (e) {
        return [];
    }
}

// Generate AI-powered insights using Ollama
async function generateAIInsights(userId, startDate = null, endDate = null) {
    // Check if Ollama is available
    const ollamaAvailable = await ollama.isOllamaAvailable();
    
    if (!ollamaAvailable) {
        console.log('Ollama not available, using rule-based insights');
        return null;
    }

    // Gather user data with optional date range
    const userData = analyzeUserData(userId, startDate, endDate);
    const trends = identifyTrends(userId);
    const goals = getUserGoals(userId);

    // Add trends and goals to userData for context
    userData.trends = trends;
    userData.goals = goals;
    
    // Add date range info for AI context
    if (startDate && endDate) {
        userData.dateRange = { startDate, endDate };
    }

    try {
        const aiInsights = await ollama.generateCarbonInsights(userData);
        return {
            source: 'ai',
            model: ollama.OLLAMA_MODEL,
            generatedAt: new Date().toISOString(),
            ...aiInsights
        };
    } catch (error) {
        console.error('Failed to generate AI insights:', error);
        return null;
    }
}

// Get combined insights (AI + rule-based with caching)
async function getInsights(userId, forceRefresh = false, startDate = null, endDate = null) {
    const usingCustomDateRange = startDate && endDate;
    
    // Check cache first (only if not using custom date range and insights less than 6 hours old)
    if (!forceRefresh && !usingCustomDateRange) {
        const cached = db.prepare(`
            SELECT * FROM insights 
            WHERE user_id = ? AND is_dismissed = 0 
            AND datetime(created_at) > datetime('now', '-6 hours')
            ORDER BY priority DESC
            LIMIT 1
        `).get(userId);

        if (cached && cached.description) {
            try {
                const cachedData = JSON.parse(cached.description);
                if (cachedData.source === 'ai') {
                    return cachedData;
                }
            } catch (e) {
                // Invalid cache, regenerate
            }
        }
    }

    // Try to generate AI insights with optional date range
    let aiInsights = await generateAIInsights(userId, startDate, endDate);

    if (aiInsights) {
        // Only cache AI insights if not using custom date range
        if (!usingCustomDateRange) {
            try {
                // Clear old AI insights
                db.prepare(`
                    DELETE FROM insights 
                    WHERE user_id = ? AND insight_type = 'ai_generated'
                `).run(userId);

                // Store new AI insights
                db.prepare(`
                    INSERT INTO insights (user_id, insight_type, category, title, description, priority, created_at)
                    VALUES (?, 'ai_generated', 'all', 'AI Insights', ?, 10, datetime('now'))
                `).run(userId, JSON.stringify(aiInsights));
            } catch (e) {
                console.error('Failed to cache AI insights:', e);
            }
        }

        return aiInsights;
    }

    // Fallback to rule-based insights
    const ruleBasedInsights = generateInsights(userId);
    const trends = identifyTrends(userId);
    const summary = generateAISummary(userId);

    return {
        source: 'rules',
        generatedAt: new Date().toISOString(),
        summary: summary.summary,
        topInsight: ruleBasedInsights[0]?.description || '',
        insights: ruleBasedInsights.slice(0, 4),
        trends: trends,
        encouragement: getEncouragement(trends)
    };
}

// Generate encouragement based on trends
function getEncouragement(trends) {
    const positiveTrends = trends.filter(t => t.trend === 'positive');
    
    if (positiveTrends.length >= 2) {
        return "Amazing progress! You're making real changes across multiple categories. Keep up the fantastic work! 🌱";
    } else if (positiveTrends.length === 1) {
        return `Great job reducing your ${positiveTrends[0].category} emissions! Small steps lead to big changes. Keep it up! 💪`;
    } else if (trends.some(t => t.trend === 'neutral')) {
        return "You're maintaining steady habits. Ready to take the next step? Try one small change this week! 🌿";
    } else {
        return "Every journey starts somewhere. Pick one area to focus on this week, and you'll see progress! 🌍";
    }
}

module.exports = {
    analyzeUserData,
    analyzeActivitiesData,
    generateInsights,
    generateInsightsFromActivities,
    identifyTrends,
    generateAISummary,
    generateAIInsights,
    getInsights,
    getUserGoals,
    INSIGHT_TEMPLATES
};
