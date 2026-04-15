// ===== Ollama LLM Client =====
// Integration with local Ollama for AI-powered insights

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT) || 60000; // 60 seconds

/**
 * Check if Ollama server is available
 */
async function isOllamaAvailable() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.log('Ollama not available:', error.message);
        return false;
    }
}

/**
 * Generate text completion using Ollama
 * @param {string} prompt - The prompt to send
 * @param {object} options - Generation options
 * @returns {Promise<string>} - Generated text
 */
async function generateCompletion(prompt, options = {}) {
    const {
        model = OLLAMA_MODEL,
        temperature = 0.7,
        maxTokens = 500,
        systemPrompt = null
    } = options;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options: {
                    temperature,
                    num_predict: maxTokens
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        return data.message?.content || '';
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Ollama request timed out');
        }
        throw error;
    }
}

/**
 * Generate carbon footprint insights from user data
 * @param {object} userData - User's emission data
 * @returns {Promise<object>} - AI-generated insights
 */
async function generateCarbonInsights(userData) {
    // Check if user has minimal data
    const hasData = userData.totalEmissions > 0 || 
                    userData.carTrips > 0 || 
                    userData.electricityUsage > 0 ||
                    userData.activityCount > 0;

    // Calculate comparison metrics
    const globalAvgMonthly = 400; // kg CO2/month average person
    const userVsAvg = userData.totalEmissions > 0 ? (userData.totalEmissions / globalAvgMonthly * 100).toFixed(0) : 0;
    const isAboveAvg = userData.totalEmissions > globalAvgMonthly;

    // Cost estimates (rough averages)
    const costPerKgCO2 = {
        transport: 0.15, // $/kg (fuel cost)
        electricity: 0.08, // $/kg 
        diet: 0.10,
        waste: 0.05
    };

    const systemPrompt = `You are a data-driven carbon analyst. Zero fluff. Math only.

OUTPUT RULES:
1. Show exact math: "X trips × Y kg = Z total → cut A = save B kg"
2. Compare to average: "You're at X%, average person is 400 kg/month"
3. Include weekly challenge: one specific thing to try THIS WEEK
4. Add cost savings: "Save X kg = save ~$Y/month"
5. ONE insight per category - highest ROI action only
6. Never invent data - use ONLY numbers provided below
7. Never say "consider" or "you could" - give direct commands

JSON FORMAT (strict):
{
    "summary": "[X kg this month] = [Y]% of average. [One sentence verdict]",
    "topInsight": {
        "title": "[VERB] [specific action]",
        "description": "[Math breakdown] → [Exact savings in kg AND $]",
        "category": "transport|electricity|diet|waste",
        "potentialSavings": [number],
        "weeklySavings": [number / 4]
    },
    "insights": [
        {
            "title": "[VERB] [specific action]",
            "description": "[Current usage] × [factor] = [total] → [action] = [savings]",
            "category": "transport|electricity|diet|waste",
            "potentialSavings": [number],
            "costSavings": [number in $]
        }
    ],
    "weeklyChallenge": {
        "title": "This week: [specific challenge]",
        "description": "[Exactly what to do] - target: [measurable goal]",
        "targetSavings": [number]
    },
    "encouragement": "[Fact-based motivator with number]"
}`;

    const noDataNote = !hasData ? '\n\nUSER HAS NO DATA. Response: Tell them to log 3 activities to get insights.' : '';

    const categoriesLogged = userData.categoriesWithData || [];
    
    // Build category breakdown with math
    let categoryBreakdown = '';
    if (userData.transportEmissions > 0) {
        const carEmissionsPerTrip = userData.carTrips > 0 ? (userData.transportEmissions / userData.carTrips).toFixed(1) : 0;
        const potentialCut = (userData.transportEmissions * 0.3).toFixed(1);
        const costSave = (potentialCut * costPerKgCO2.transport).toFixed(0);
        categoryBreakdown += `
TRANSPORT: ${userData.transportEmissions.toFixed(1)} kg
  - ${userData.carTrips || 0} car trips × ${carEmissionsPerTrip} kg/trip = ${userData.transportEmissions.toFixed(1)} kg
  - ${userData.publicTransitTrips || 0} transit trips (low emission)
  - MAX CUT: Replace 2 car trips with transit/bike → save ${potentialCut} kg (~$${costSave}/month)`;
    }
    
    if (userData.electricityEmissions > 0) {
        const kwhPerKg = userData.electricityUsage > 0 ? (userData.electricityUsage / userData.electricityEmissions).toFixed(1) : 2;
        const potentialCut = (userData.electricityEmissions * 0.2).toFixed(1);
        const costSave = (potentialCut * costPerKgCO2.electricity).toFixed(0);
        categoryBreakdown += `
ELECTRICITY: ${userData.electricityEmissions.toFixed(1)} kg
  - ${userData.electricityUsage || 0} kWh × 0.5 kg/kWh = ${userData.electricityEmissions.toFixed(1)} kg
  - MAX CUT: Reduce usage 20% → save ${potentialCut} kg (~$${costSave}/month)`;
    }
    
    if (userData.dietEmissions > 0) {
        const potentialCut = (userData.dietEmissions * 0.25).toFixed(1);
        const costSave = (potentialCut * costPerKgCO2.diet).toFixed(0);
        categoryBreakdown += `
DIET: ${userData.dietEmissions.toFixed(1)} kg
  - Diet type: ${userData.dietType || 'mixed'}
  - MAX CUT: 2 meatless days/week → save ${potentialCut} kg (~$${costSave}/month)`;
    }
    
    if (userData.wasteEmissions > 0) {
        const potentialCut = (userData.wasteEmissions * 0.3).toFixed(1);
        categoryBreakdown += `
WASTE: ${userData.wasteEmissions.toFixed(1)} kg
  - MAX CUT: Compost food scraps → save ${potentialCut} kg`;
    }

    const prompt = `ANALYZE THIS USER'S CARBON DATA:${noDataNote}

TOTALS:
- Monthly emissions: ${userData.totalEmissions?.toFixed(1) || 0} kg CO₂
- vs Global average: ${userVsAvg}% (average = 400 kg/month)
- Status: ${isAboveAvg ? 'ABOVE average - needs reduction' : 'BELOW average - good, optimize further'}
- Activities logged: ${userData.activityCount || 0}
${categoryBreakdown}

TASK:
1. Summary with exact % comparison
2. Top insight = highest kg category with exact math
3. One insight per other category (if data exists)
4. Weekly challenge = one specific thing to try this week
5. Use ONLY the numbers above - do not invent

Categories with data: ${categoriesLogged.length > 0 ? categoriesLogged.join(', ') : 'NONE'}`;

    try {
        const response = await generateCompletion(prompt, {
            systemPrompt,
            temperature: 0.4,
            maxTokens: 800
        });

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Deduplicate insights by category - keep only first (highest priority)
            const seenCategories = new Set();
            if (parsed.insights) {
                parsed.insights = parsed.insights.filter(insight => {
                    const cat = insight.category?.toLowerCase();
                    if (seenCategories.has(cat)) return false;
                    seenCategories.add(cat);
                    return true;
                });
            }
            
            return parsed;
        }
        
        // Fallback: return raw response wrapped
        return {
            summary: response,
            topInsight: '',
            insights: [],
            encouragement: ''
        };
    } catch (error) {
        console.error('Error generating AI insights:', error);
        throw error;
    }
}

/**
 * Generate a personalized tip based on category
 * @param {string} category - Emission category
 * @param {object} userData - User context
 * @returns {Promise<string>} - Generated tip
 */
async function generateQuickTip(category, userData) {
    const prompt = `Give one specific, actionable tip (1-2 sentences) to reduce ${category} emissions for someone who:
- Has ${userData[`${category}Emissions`]?.toFixed(1) || 0} kg CO₂ monthly ${category} emissions
- ${category === 'transport' ? `Takes ${userData.carTrips || 0} car trips and ${userData.publicTransitTrips || 0} public transit trips` : ''}
- ${category === 'diet' ? `Has a ${userData.dietType || 'average'} diet` : ''}
Be specific and practical.`;

    try {
        const response = await generateCompletion(prompt, {
            temperature: 0.8,
            maxTokens: 100
        });
        return response.trim();
    } catch (error) {
        return null; // Fallback to rule-based tip
    }
}

module.exports = {
    isOllamaAvailable,
    generateCompletion,
    generateCarbonInsights,
    generateQuickTip,
    OLLAMA_MODEL
};
