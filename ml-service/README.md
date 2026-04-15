# CarbonWise ML Service

A Python-based Machine Learning microservice for intelligent carbon footprint analysis, providing user clustering, emission prediction, anomaly detection, and personalized recommendations.

## Architecture Overview

```
┌──────────────────┐     HTTP/REST      ┌──────────────────┐
│   Node.js App    │ ◄──────────────────► │   Flask ML API   │
│   (Port 3000)    │                      │   (Port 5001)    │
└──────────────────┘                      └──────────────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │   ML Models     │
                                          │  (scikit-learn) │
                                          └─────────────────┘
```

## Features

### 1. User Classification (K-Means Clustering)
Segments users into lifestyle profiles based on emission patterns:
- **commute_heavy**: Transportation dominates (>40% of emissions)
- **diet_heavy**: Food/dietary choices dominate
- **energy_heavy**: Electricity usage dominates
- **balanced**: Relatively even distribution across categories
- **eco_conscious**: Low emissions across all categories

### 2. Emission Prediction (Random Forest Regressor)
Forecasts future emissions using ensemble learning:
- Daily, weekly, and monthly predictions
- Confidence intervals included
- Feature importance analysis

### 3. Anomaly Detection (Isolation Forest)
Identifies unusual patterns that may indicate:
- Data entry errors
- Sudden lifestyle changes
- Opportunities for improvement

### 4. Personalized Recommendations
ML-powered suggestions based on:
- User's cluster profile
- Highest emission categories
- Similar users' successful strategies

---

## Quick Start

```bash
# Navigate to ML service directory
cd ml-service

# Install dependencies
pip install -r requirements.txt

# Generate training data (10,000 synthetic users)
python generate_data.py

# Train models with hyperparameter tuning
python train_models.py

# Start ML service
python app.py
```

The service runs on **http://localhost:5001**

---

## Training Pipeline

### Data Generation (`generate_data.py`)

Generates synthetic user data with realistic carbon footprint patterns:

```python
# Configuration
NUM_USERS = 10000  # Training dataset size

# Lifestyle profiles with distinct emission patterns
LIFESTYLE_PROFILES = {
    'commute_heavy':  {'transport': 70%, 'electricity': 10%, 'food': 15%, 'waste': 5%},
    'diet_heavy':     {'transport': 15%, 'electricity': 15%, 'food': 65%, 'waste': 5%},
    'energy_heavy':   {'transport': 20%, 'electricity': 55%, 'food': 20%, 'waste': 5%},
    'balanced':       {'transport': 30%, 'electricity': 25%, 'food': 35%, 'waste': 10%},
    'eco_conscious':  {'transport': 25%, 'electricity': 25%, 'food': 35%, 'waste': 15%}
}
```

**Output files:**
- `data/users_raw.json` - Raw activity data (10K users × 30-90 activities each)
- `data/user_features.json` - Extracted feature vectors
- `data/user_features.csv` - CSV format for analysis

### Model Training (`train_models.py`)

#### K-Means Clustering
- **Auto-tuned cluster count**: Tests k=3 to 7, selects best silhouette score
- **Optimized initialization**: 30 random starts (`n_init=30`)
- **Extended convergence**: Up to 500 iterations (`max_iter=500`)
- **Dynamic labeling**: Clusters automatically labeled based on centroid patterns

```python
# Automatic cluster selection
for k in range(3, 8):
    silhouette_scores[k] = silhouette_score(X, KMeans(k).fit_predict(X))
best_k = argmax(silhouette_scores)  # Currently: k=4
```

#### Random Forest Regressor
- **Hyperparameter tuning**: GridSearchCV with 5-fold cross-validation
- **Parameter grid searched**:
  - `n_estimators`: [200, 500]
  - `max_depth`: [None, 20, 30]
  - `min_samples_split`: [2, 5]
  - `min_samples_leaf`: [1, 2]

```python
# Best parameters found:
{
    'n_estimators': 500,
    'max_depth': None,      # Unlimited depth
    'min_samples_split': 5,
    'min_samples_leaf': 2
}
```

#### Isolation Forest
- **200 estimators** for robust anomaly detection
- **Auto contamination**: Model determines outlier threshold
- **Anomaly scoring**: Provides continuous scores, not just binary labels

---

## Model Performance

### Current Metrics (10,000 users, trained 9 March 2026)

| Model | Metric | Value |
|-------|--------|-------|
| **K-Means** | Silhouette Score | **0.6596** |
| **K-Means** | Optimal Clusters | 4 |
| **Random Forest** | Test R² Score | **0.9142** |
| **Random Forest** | Cross-Val R² | 0.9086 ± 0.011 |
| **Random Forest** | MAE | 3.78 kg CO₂/day |
| **Isolation Forest** | Anomaly Rate | 25.5% (auto) |

### Feature Importance (Random Forest)

| Feature | Importance |
|---------|------------|
| transport_pct | 72.68% |
| transport_freq | 11.48% |
| total_activities | 8.51% |
| electricity_pct | 1.79% |
| waste_pct | 1.66% |
| electricity_freq | 1.28% |
| food_freq | 1.10% |
| food_pct | 0.99% |
| waste_freq | 0.50% |

### Cluster Distribution

| Cluster | Label | Users | Centroid |
|---------|-------|-------|----------|
| 0 | commute_heavy | 74.4% | Transport: 83.9% |
| 1 | energy_heavy | 10.8% | Electricity: 69.3% |
| 2 | diet_heavy | 11.3% | Food: 71.0% |
| 3 | diet_heavy | 3.5% | Mixed (42.2% Food) |

---

## API Reference

### Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "models_loaded": 6,
  "available_endpoints": ["/classify", "/predict", "/anomaly", "/recommend"]
}
```

### Classify User
```http
POST /classify
Content-Type: application/json

{
  "transport_pct": 75,
  "electricity_pct": 15,
  "food_pct": 10,
  "waste_pct": 0,
  "transport_freq": 10,
  "electricity_freq": 2,
  "food_freq": 0,
  "waste_freq": 0,
  "total_activities": 12
}
```
**Response:**
```json
{
  "cluster": 0,
  "cluster_name": "commute_heavy",
  "confidence": 0.326,
  "all_probabilities": {
    "commute_heavy": 0.326,
    "energy_heavy": 0.127,
    "diet_heavy": 0.102
  },
  "description": "Your carbon footprint is dominated by transportation. Consider carpooling, public transit, or cycling."
}
```

### Predict Emissions
```http
POST /predict
Content-Type: application/json

{
  "transport_pct": 50,
  "electricity_pct": 25,
  "food_pct": 20,
  "waste_pct": 5,
  "transport_freq": 5,
  "electricity_freq": 3,
  "food_freq": 7,
  "waste_freq": 2,
  "total_activities": 17
}
```
**Response:**
```json
{
  "predicted_daily_emission": 15.23,
  "confidence_range": {
    "low": 11.45,
    "high": 19.01
  },
  "weekly_prediction": 106.61,
  "monthly_prediction": 456.90
}
```

### Detect Anomalies
```http
POST /anomaly
Content-Type: application/json

{
  // Same feature object as /predict
}
```
**Response:**
```json
{
  "is_anomaly": false,
  "anomaly_score": 0.035,
  "interpretation": "Normal emission pattern",
  "score_range": {
    "min": -0.163,
    "max": 0.116
  }
}
```

### Get Recommendations
```http
POST /recommend
Content-Type: application/json

{
  "cluster_name": "commute_heavy",
  "transport_pct": 75,
  "electricity_pct": 15,
  "food_pct": 10,
  "waste_pct": 0
}
```
**Response:**
```json
{
  "primary_recommendations": [
    "Switch to public transit 2-3 days per week",
    "Consider carpooling for regular commutes",
    "Explore remote work options if available"
  ],
  "secondary_recommendations": [
    "Use energy-efficient LED lighting",
    "Reduce meat consumption to 2-3 days per week"
  ],
  "impact_estimate": "Following these could reduce your footprint by 20-35%"
}
```

### Full Analysis
```http
POST /analyze
Content-Type: application/json

{
  // Complete feature object
}
```
Returns combined results from all endpoints.

---

## Node.js Integration

The CarbonWise Node.js backend integrates via `utils/ml-client.js`:

```javascript
const { getFullAnalysis, isMLServiceAvailable } = require('../utils/ml-client');

// Check if ML service is running
const available = await isMLServiceAvailable();

// Get complete ML analysis
const analysis = await getFullAnalysis(userFeatures);
```

### Category Normalization
The client automatically maps database categories to ML categories:
- `diet` → `food`
- `energy` → `electricity`

---

## File Structure

```
ml-service/
├── app.py                  # Flask REST API server
├── generate_data.py        # Synthetic data generator (10K users)
├── train_models.py         # Model training with hyperparameter tuning
├── requirements.txt        # Python dependencies
│
├── data/                   # Generated datasets
│   ├── users_raw.json      # Raw activity data (30-90 activities/user)
│   ├── user_features.json  # Feature vectors for ML
│   └── user_features.csv   # CSV for analysis (10,001 rows)
│
└── models/                 # Trained model files
    ├── kmeans.pkl          # K-Means clustering model (40 KB)
    ├── cluster_scaler.pkl  # StandardScaler for clustering
    ├── cluster_labels.pkl  # Dynamic cluster → label mapping
    ├── random_forest.pkl   # Random Forest regressor (124 MB)
    ├── prediction_scaler.pkl
    ├── isolation_forest.pkl # Anomaly detector (2.5 MB)
    └── anomaly_scaler.pkl
```

---

## Requirements

```
flask>=2.0.0
scikit-learn>=1.0.0
numpy>=1.21.0
pandas>=1.3.0
```

Install via: `pip install -r requirements.txt`

---

## Retraining Models

To retrain with new data or parameters:

```bash
# 1. Regenerate synthetic data (optional)
python generate_data.py

# 2. Train models (takes ~30-60 seconds with hyperparameter tuning)
python train_models.py

# 3. Restart the service to load new models
pkill -f "python.*app.py"
python app.py
```

---

## Troubleshooting

### Service won't start
```bash
# Check if port 5001 is in use
lsof -i :5001

# Kill existing process
lsof -ti:5001 | xargs kill -9
```

### Model loading errors
```bash
# Ensure models exist
ls -la models/

# Retrain if missing
python train_models.py
```

### Node.js can't connect
- Verify ML service is running: `curl http://localhost:5001/health`
- Check firewall isn't blocking localhost:5001
