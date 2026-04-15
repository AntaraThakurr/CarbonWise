# CarbonWise: Hybrid ML + LLM Architecture

## Executive Summary

CarbonWise employs a **dual AI approach** combining traditional Machine Learning (ML) models with Large Language Models (LLMs) to provide comprehensive carbon footprint analysis. This hybrid architecture leverages the strengths of both paradigms:

- **ML Models**: Fast, deterministic, quantitative analysis
- **LLMs**: Natural language understanding, contextual recommendations, nuanced explanations

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CarbonWise Application                             │
│                              (Node.js/Express)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌───────────────────┐ ┌─────────────┐ ┌───────────────────┐
        │   ML Microservice │ │   SQLite    │ │   Ollama LLM      │
        │   (Python/Flask)  │ │   Database  │ │   (Local/API)     │
        │    Port 5001      │ │             │ │   Port 11434      │
        └───────────────────┘ └─────────────┘ └───────────────────┘
                │                                       │
        ┌───────┴───────┐                      ┌───────┴───────┐
        │  scikit-learn │                      │   LLaMA 3.2   │
        │    Models     │                      │   or similar  │
        └───────────────┘                      └───────────────┘
```

---

## Component Breakdown

### 1. Machine Learning Microservice (Python/Flask)

**Purpose**: Quantitative analysis, pattern recognition, and prediction

| Model | Algorithm | Purpose | Output |
|-------|-----------|---------|--------|
| **User Classifier** | K-Means Clustering | Segment users into lifestyle profiles | `commute_heavy`, `diet_heavy`, `energy_heavy`, `balanced` |
| **Emission Predictor** | Random Forest Regressor | Forecast future emissions | Daily/weekly/monthly CO₂ predictions |
| **Anomaly Detector** | Isolation Forest | Identify unusual patterns | Anomaly score + binary flag |

**Technical Specifications**:
- **Training Data**: 10,000 synthetic users with realistic emission patterns
- **Model Performance**:
  - K-Means Silhouette: 0.66 (excellent cluster separation)
  - Random Forest R²: 0.91 (91% variance explained)
  - MAE: 3.78 kg CO₂/day

**Key Strengths**:
- ✅ **Fast inference** (~10ms per request)
- ✅ **Deterministic outputs** (same input → same output)
- ✅ **Quantifiable confidence** (probability distributions)
- ✅ **Interpretable** (feature importance analysis)

### 2. Large Language Model (Ollama)

**Purpose**: Natural language generation, contextual advice, nuanced interpretations

**Model**: LLaMA 3.2 (or DeepSeek, Mistral - configurable)

**Capabilities**:
- Generate human-readable report narratives
- Provide context-aware recommendations
- Answer user questions about their footprint
- Explain complex environmental concepts
- Adapt tone and detail to user preferences

**Key Strengths**:
- ✅ **Natural language output** (human-readable reports)
- ✅ **Contextual understanding** (considers full user history)
- ✅ **Adaptive responses** (different explanations for different users)
- ✅ **Creative suggestions** (novel reduction strategies)

---

## Why a Hybrid Approach?

### Limitations of ML-Only Approach

| Issue | Impact |
|-------|--------|
| Rigid outputs | Can only return predefined categories/numbers |
| No natural language | Users get raw data, not explanations |
| Context-blind | Each prediction is independent |
| Fixed recommendations | Same advice for all "commute_heavy" users |

### Limitations of LLM-Only Approach

| Issue | Impact |
|-------|--------|
| Non-deterministic | May give different answers to same question |
| Computational cost | Slower inference (~1-3 seconds) |
| Hallucination risk | May generate inaccurate statistics |
| No pattern learning | Can't discover clusters in data |

### Hybrid Solution Benefits

```
ML Models provide:                  LLM provides:
─────────────────                   ─────────────
• Accurate numbers                  • Natural explanations
• Fast predictions                  • Contextual advice
• Cluster assignments               • Personalized narratives
• Anomaly detection                 • Creative suggestions
         │                                   │
         └───────────────┬───────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Combined Output:   │
              │  Accurate + Natural │
              │  Fast + Contextual  │
              │  Data + Narrative   │
              └─────────────────────┘
```

---

## Data Flow: Detailed Report Generation

### Step 1: User Requests Report
```
User clicks "Generate Detailed Report"
              │
              ▼
POST /api/insights/report/detailed
```

### Step 2: Backend Orchestration
```javascript
// routes/insights.js
const activities = await getActivities(userId, startDate, endDate);
const statsAnalysis = analyzeStatistics(activities);
```

### Step 3: ML Analysis (Parallel)
```
┌─────────────────────────────────────────────────────────┐
│               ML Service Requests (Parallel)            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  /classify  │  │  /predict   │  │  /anomaly   │     │
│  │   (K-Means) │  │ (Rand.For.) │  │ (Iso.For.)  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         ▼                ▼                ▼             │
│  "commute_heavy"   15.2 kg/day    score: 0.035        │
│   confidence: 0.32  ±3.78 MAE     is_anomaly: false   │
└─────────────────────────────────────────────────────────┘
```

### Step 4: LLM Narrative Generation
```
┌─────────────────────────────────────────────────────────┐
│                   LLM Processing                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Input (System Prompt + Context):                       │
│  ┌────────────────────────────────────────────┐        │
│  │ You are a sustainability expert...          │        │
│  │ User profile: commute_heavy                 │        │
│  │ Monthly emissions: 456.9 kg CO₂             │        │
│  │ Trend: +5% vs last month                    │        │
│  │ ML prediction: 480 kg next month            │        │
│  └────────────────────────────────────────────┘        │
│                         │                               │
│                         ▼                               │
│  Output:                                                │
│  "Your transportation habits account for 75% of        │
│   your carbon footprint, placing you in our            │
│   'commute-heavy' user segment. Based on your          │
│   patterns, we predict next month's emissions          │
│   will reach 480 kg CO₂ unless changes are made.       │
│   Consider these personalized strategies..."           │
└─────────────────────────────────────────────────────────┘
```

### Step 5: Combined Response
```json
{
  "report": {
    "statistics": {
      "totalEmissions": 456.9,
      "categoryBreakdown": {...}
    },
    "mlAnalysis": {
      "classification": "commute_heavy",
      "prediction": 480.2,
      "anomalyDetected": false
    },
    "narrative": "Your transportation habits account for...",
    "recommendations": [
      "Switch to public transit 2-3 days per week",
      "Consider an electric vehicle for your commute"
    ]
  }
}
```

---

## Technical Implementation Details

### ML Service Integration (`utils/ml-client.js`)

```javascript
const ML_SERVICE_URL = 'http://localhost:5001';

async function getFullAnalysis(features) {
    const [classification, prediction, anomaly, recommendations] = 
        await Promise.all([
            classifyUser(features),
            predictEmissions(features),
            detectAnomaly(features),
            getRecommendations(features)
        ]);
    
    return { classification, prediction, anomaly, recommendations };
}
```

### LLM Integration (`utils/ollama-client.js`)

```javascript
async function generateInsights(prompt, data) {
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        body: JSON.stringify({
            model: 'llama3.2',
            prompt: buildPrompt(prompt, data),
            stream: false,
            options: { temperature: 0.7 }
        })
    });
    return parseResponse(response);
}
```

### Feature Extraction Pipeline

```javascript
function extractMLFeatures(activities) {
    const totals = { transport: 0, electricity: 0, food: 0, waste: 0 };
    const freqs = { transport: 0, electricity: 0, food: 0, waste: 0 };
    
    activities.forEach(a => {
        const cat = normalizeCategory(a.category);
        totals[cat] += a.emission;
        freqs[cat]++;
    });
    
    const totalEmission = Object.values(totals).reduce((a, b) => a + b, 0);
    
    return {
        transport_pct: (totals.transport / totalEmission) * 100,
        electricity_pct: (totals.electricity / totalEmission) * 100,
        food_pct: (totals.food / totalEmission) * 100,
        waste_pct: (totals.waste / totalEmission) * 100,
        transport_freq: freqs.transport,
        electricity_freq: freqs.electricity,
        food_freq: freqs.food,
        waste_freq: freqs.waste,
        total_activities: activities.length
    };
}
```

---

## Performance Comparison

| Metric | ML Only | LLM Only | Hybrid |
|--------|---------|----------|--------|
| Response Time | ~50ms | ~2s | ~2.5s |
| Accuracy (predictions) | ✅ High | ⚠️ Variable | ✅ High |
| Natural Language | ❌ None | ✅ Excellent | ✅ Excellent |
| Personalization | ⚠️ Limited | ✅ High | ✅ High |
| Consistency | ✅ 100% | ⚠️ ~85% | ✅ ~95% |
| Explainability | ⚠️ Technical | ✅ Natural | ✅ Both |

---

## Use Cases in CarbonWise

### 1. Dashboard Quick Stats (ML Only)
- Fast category breakdown
- Real-time emission totals
- No LLM needed for raw numbers

### 2. Detailed Reports (Hybrid)
- ML provides: classification, predictions, anomaly flags
- LLM provides: narrative, personalized advice, explanations

### 3. Chat/Q&A (LLM Primary)
- User asks questions about their footprint
- LLM contextualizes with ML data
- Example: "Why is my footprint higher this month?"

### 4. Goal Setting (Hybrid)
- ML predicts feasible reduction targets
- LLM explains the path to achieve them

---

## Model Training & Maintenance

### ML Models
```bash
# Retrain when new data patterns emerge
cd ml-service
python generate_data.py    # Update synthetic data
python train_models.py     # Retrain with hyperparameter tuning

# Training time: ~30-60 seconds
# Retraining frequency: Monthly or when accuracy drops
```

### LLM Configuration
```bash
# Pull/update models via Ollama
ollama pull llama3.2

# Or use alternative models
ollama pull deepseek-r1:7b
ollama pull mistral

# No training required - uses pre-trained weights
# Update frequency: As new model versions release
```

---

## Graceful Degradation

The system handles service unavailability gracefully:

```javascript
// If ML service is down
if (!await isMLServiceAvailable()) {
    // Fall back to rule-based classification
    mlAnalysis = generateFallbackAnalysis(activities);
}

// If Ollama is down
if (!await isOllamaAvailable()) {
    // Use template-based narratives instead
    narrative = generateTemplateNarrative(stats);
}
```

| Scenario | ML Down | LLM Down | Both Down |
|----------|---------|----------|-----------|
| Dashboard | ✅ Works | ✅ Works | ✅ Works |
| Reports | ⚠️ Rule-based | ⚠️ Templates | ⚠️ Basic stats |
| Predictions | ❌ Unavailable | ✅ Works | ❌ Unavailable |
| Narratives | ✅ Works | ⚠️ Templates | ⚠️ Templates |

---

## Future Enhancements

### Planned Improvements

1. **Retrieval-Augmented Generation (RAG)**
   - Index user history for LLM retrieval
   - More accurate historical comparisons

2. **Fine-tuned LLM**
   - Train on carbon footprint domain data
   - Improve recommendation quality

3. **Real-time Learning**
   - Update ML models with user feedback
   - Continuous improvement pipeline

4. **Multi-modal Analysis**
   - Receipt scanning with vision models
   - Voice input for activity logging

---

## Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **ML Service** | Python, scikit-learn, Flask | Quantitative analysis, predictions, clustering |
| **LLM Service** | Ollama, LLaMA 3.2 | Natural language, contextual advice, explanations |
| **Backend** | Node.js, Express | Orchestration, API, business logic |
| **Frontend** | HTML5, Chart.js | Visualization, user interaction |

The hybrid ML + LLM approach in CarbonWise demonstrates how **combining specialized AI systems** produces results superior to either approach alone:

- **ML ensures accuracy** in numerical predictions and classifications
- **LLM ensures accessibility** through natural language explanations
- **Together they provide** a complete, user-friendly sustainability tool

---

## Quick Reference

### Start All Services
```bash
# Terminal 1: Node.js Backend
cd CarbonWise && node server.js

# Terminal 2: ML Service
cd CarbonWise/ml-service && python app.py

# Terminal 3: Ollama (if not running)
ollama serve
```

### Health Checks
```bash
# Node.js
curl http://localhost:3000/health

# ML Service
curl http://localhost:5001/health

# Ollama
curl http://localhost:11434/api/tags
```

### Service Ports
| Service | Port | Protocol |
|---------|------|----------|
| Node.js Backend | 3000 | HTTP |
| ML Microservice | 5001 | HTTP |
| Ollama LLM | 11434 | HTTP |
