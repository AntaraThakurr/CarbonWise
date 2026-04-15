#!/usr/bin/env python3
"""
CarbonWise ML API Service
Flask API for ML-powered insights
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load models on startup
MODELS = {}
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')

# Cluster labels - will be loaded from trained model
CLUSTER_LABELS = {}

CLUSTER_DESCRIPTIONS = {
    'commute_heavy': 'Your carbon footprint is dominated by transportation. Consider carpooling, public transit, or cycling.',
    'diet_heavy': 'Food choices significantly impact your emissions. Try reducing red meat and choosing local produce.',
    'energy_heavy': 'Home energy usage is your biggest emission source. Consider energy-efficient appliances and renewable energy.',
    'balanced': 'Your emissions are spread across categories. Focus on the highest-impact area for best results.',
    'eco_conscious': 'You already maintain low emissions. Keep up the great work and inspire others!',
    'waste_heavy': 'Waste management is a significant factor. Consider recycling, composting, and reducing single-use items.'
}

def load_models():
    """Load all trained models from disk"""
    global MODELS, CLUSTER_LABELS
    
    model_files = [
        'kmeans', 'cluster_scaler',
        'random_forest', 'prediction_scaler',
        'isolation_forest', 'anomaly_scaler'
    ]
    
    for name in model_files:
        filepath = os.path.join(MODEL_DIR, f'{name}.pkl')
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                MODELS[name] = pickle.load(f)
            print(f"✓ Loaded {name}")
        else:
            print(f"⚠ Model not found: {filepath}")
    
    # Load dynamic cluster labels
    labels_path = os.path.join(MODEL_DIR, 'cluster_labels.pkl')
    if os.path.exists(labels_path):
        with open(labels_path, 'rb') as f:
            CLUSTER_LABELS.update(pickle.load(f))
        print(f"✓ Loaded cluster_labels: {CLUSTER_LABELS}")
    else:
        # Fallback to default labels
        CLUSTER_LABELS.update({
            0: 'balanced',
            1: 'commute_heavy',
            2: 'energy_heavy',
            3: 'diet_heavy',
            4: 'eco_conscious'
        })
        print(f"⚠ Using default cluster labels")
    
    return len(MODELS) == len(model_files)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': len(MODELS),
        'available_endpoints': ['/classify', '/predict', '/anomaly', '/recommend']
    })

@app.route('/classify', methods=['POST'])
def classify_user():
    """
    Classify user into lifestyle cluster based on activity patterns
    
    Input: {
        "transport_pct": 45.2,
        "electricity_pct": 20.1,
        "food_pct": 25.3,
        "waste_pct": 9.4
    }
    """
    try:
        data = request.get_json()
        
        # Validate input
        required = ['transport_pct', 'electricity_pct', 'food_pct', 'waste_pct']
        if not all(k in data for k in required):
            return jsonify({'error': f'Missing required fields: {required}'}), 400
        
        # Prepare feature vector
        X = np.array([[
            data['transport_pct'],
            data['electricity_pct'],
            data['food_pct'],
            data['waste_pct']
        ]])
        
        # Scale and predict
        X_scaled = MODELS['cluster_scaler'].transform(X)
        cluster = MODELS['kmeans'].predict(X_scaled)[0]
        
        # Get cluster probabilities (distance to centroids)
        distances = MODELS['kmeans'].transform(X_scaled)[0]
        # Convert distances to confidence (inverse, normalized)
        confidence = 1 / (1 + distances)
        confidence = confidence / confidence.sum()
        
        cluster_name = CLUSTER_LABELS.get(cluster, 'unknown')
        
        return jsonify({
            'cluster': int(cluster),
            'cluster_name': cluster_name,
            'description': CLUSTER_DESCRIPTIONS.get(cluster_name, ''),
            'confidence': float(confidence[cluster]),
            'all_probabilities': {
                CLUSTER_LABELS[i]: float(confidence[i]) 
                for i in range(len(confidence))
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict_emissions():
    """
    Predict future emissions based on current patterns
    
    Input: {
        "transport_pct": 45.2,
        "electricity_pct": 20.1,
        "food_pct": 25.3,
        "waste_pct": 9.4,
        "transport_freq": 15,
        "electricity_freq": 10,
        "food_freq": 20,
        "waste_freq": 5,
        "total_activities": 50
    }
    """
    try:
        data = request.get_json()
        
        required = ['transport_pct', 'electricity_pct', 'food_pct', 'waste_pct',
                   'transport_freq', 'electricity_freq', 'food_freq', 'waste_freq',
                   'total_activities']
        
        if not all(k in data for k in required):
            return jsonify({'error': f'Missing required fields: {required}'}), 400
        
        # Prepare feature vector
        X = np.array([[
            data['transport_pct'],
            data['electricity_pct'],
            data['food_pct'],
            data['waste_pct'],
            data['transport_freq'],
            data['electricity_freq'],
            data['food_freq'],
            data['waste_freq'],
            data['total_activities']
        ]])
        
        # Scale and predict
        X_scaled = MODELS['prediction_scaler'].transform(X)
        daily_prediction = MODELS['random_forest'].predict(X_scaled)[0]
        
        # Calculate weekly and monthly projections
        weekly_prediction = daily_prediction * 7
        monthly_prediction = daily_prediction * 30
        
        # Get feature importances for explanation
        feature_names = ['transport_pct', 'electricity_pct', 'food_pct', 'waste_pct',
                        'transport_freq', 'electricity_freq', 'food_freq', 'waste_freq', 
                        'total_activities']
        importances = dict(zip(feature_names, MODELS['random_forest'].feature_importances_))
        
        # Find top contributors
        top_factors = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return jsonify({
            'predicted_daily_emission': round(daily_prediction, 4),
            'predicted_weekly_emission': round(weekly_prediction, 4),
            'predicted_monthly_emission': round(monthly_prediction, 4),
            'unit': 'kg CO₂',
            'top_contributing_factors': [
                {'factor': f[0], 'importance': round(f[1], 4)} 
                for f in top_factors
            ],
            'model_confidence': 0.85  # R² score from training
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/anomaly', methods=['POST'])
def detect_anomaly():
    """
    Detect unusual emission patterns (spikes or anomalies)
    
    Input: Same as /predict endpoint
    """
    try:
        data = request.get_json()
        
        required = ['transport_pct', 'electricity_pct', 'food_pct', 'waste_pct',
                   'transport_freq', 'electricity_freq', 'food_freq', 'waste_freq',
                   'total_activities']
        
        if not all(k in data for k in required):
            return jsonify({'error': f'Missing required fields: {required}'}), 400
        
        X = np.array([[
            data['transport_pct'],
            data['electricity_pct'],
            data['food_pct'],
            data['waste_pct'],
            data['transport_freq'],
            data['electricity_freq'],
            data['food_freq'],
            data['waste_freq'],
            data['total_activities']
        ]])
        
        X_scaled = MODELS['anomaly_scaler'].transform(X)
        prediction = MODELS['isolation_forest'].predict(X_scaled)[0]
        score = MODELS['isolation_forest'].score_samples(X_scaled)[0]
        
        is_anomaly = prediction == -1
        
        # Determine which category is anomalous
        anomaly_reason = None
        if is_anomaly:
            pcts = [data['transport_pct'], data['electricity_pct'], 
                   data['food_pct'], data['waste_pct']]
            categories = ['transport', 'electricity', 'food', 'waste']
            max_idx = np.argmax(pcts)
            if pcts[max_idx] > 60:  # If any category is >60%, flag it
                anomaly_reason = f"Unusually high {categories[max_idx]} emissions"
        
        return jsonify({
            'is_anomaly': is_anomaly,
            'anomaly_score': round(float(score), 4),
            'reason': anomaly_reason,
            'recommendation': 'Review recent activities for unusual patterns' if is_anomaly else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/recommend', methods=['POST'])
def get_recommendations():
    """
    Get ML-powered recommendations based on user profile
    
    Input: Same as /classify endpoint plus current emissions
    """
    try:
        data = request.get_json()
        
        # First classify the user
        X = np.array([[
            data.get('transport_pct', 25),
            data.get('electricity_pct', 25),
            data.get('food_pct', 25),
            data.get('waste_pct', 25)
        ]])
        
        X_scaled = MODELS['cluster_scaler'].transform(X)
        cluster = MODELS['kmeans'].predict(X_scaled)[0]
        cluster_name = CLUSTER_LABELS.get(cluster, 'balanced')
        
        # Generate recommendations based on cluster
        recommendations = []
        
        if cluster_name == 'commute_heavy':
            recommendations = [
                {'action': 'Switch to public transit 2 days/week', 'potential_reduction': '15%', 'priority': 'high'},
                {'action': 'Consider carpooling for regular commutes', 'potential_reduction': '10%', 'priority': 'high'},
                {'action': 'Work from home when possible', 'potential_reduction': '20%', 'priority': 'medium'},
                {'action': 'Plan errands to reduce trip frequency', 'potential_reduction': '5%', 'priority': 'low'}
            ]
        elif cluster_name == 'diet_heavy':
            recommendations = [
                {'action': 'Reduce red meat to once per week', 'potential_reduction': '20%', 'priority': 'high'},
                {'action': 'Choose local and seasonal produce', 'potential_reduction': '10%', 'priority': 'medium'},
                {'action': 'Try plant-based meals 3 days/week', 'potential_reduction': '15%', 'priority': 'high'},
                {'action': 'Reduce food waste through meal planning', 'potential_reduction': '8%', 'priority': 'medium'}
            ]
        elif cluster_name == 'energy_heavy':
            recommendations = [
                {'action': 'Switch to LED lighting throughout home', 'potential_reduction': '5%', 'priority': 'medium'},
                {'action': 'Optimize heating/cooling schedules', 'potential_reduction': '15%', 'priority': 'high'},
                {'action': 'Unplug devices when not in use', 'potential_reduction': '5%', 'priority': 'low'},
                {'action': 'Consider renewable energy options', 'potential_reduction': '30%', 'priority': 'high'}
            ]
        elif cluster_name == 'eco_conscious':
            recommendations = [
                {'action': 'Share your sustainability tips with others', 'potential_reduction': '0%', 'priority': 'medium'},
                {'action': 'Look for carbon offset opportunities', 'potential_reduction': '10%', 'priority': 'low'},
                {'action': 'Continue tracking to maintain progress', 'potential_reduction': '0%', 'priority': 'high'},
                {'action': 'Explore advanced efficiency measures', 'potential_reduction': '5%', 'priority': 'medium'}
            ]
        else:  # balanced
            recommendations = [
                {'action': 'Focus on your highest emission category', 'potential_reduction': '15%', 'priority': 'high'},
                {'action': 'Set weekly reduction goals for each area', 'potential_reduction': '10%', 'priority': 'medium'},
                {'action': 'Track daily to identify patterns', 'potential_reduction': '5%', 'priority': 'medium'},
                {'action': 'Start with easiest changes first', 'potential_reduction': '8%', 'priority': 'high'}
            ]
        
        return jsonify({
            'cluster': cluster_name,
            'profile_description': CLUSTER_DESCRIPTIONS.get(cluster_name, ''),
            'recommendations': recommendations,
            'total_potential_reduction': sum(int(r['potential_reduction'].replace('%', '')) for r in recommendations[:2])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
def full_analysis():
    """
    Complete ML analysis - clustering, prediction, anomaly detection, and recommendations
    
    Input: Full user feature set
    """
    try:
        data = request.get_json()
        
        # Run all analyses
        classify_result = classify_user_internal(data)
        predict_result = predict_emissions_internal(data)
        anomaly_result = detect_anomaly_internal(data)
        recommend_result = get_recommendations_internal(data)
        
        return jsonify({
            'classification': classify_result,
            'prediction': predict_result,
            'anomaly': anomaly_result,
            'recommendations': recommend_result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Internal helper functions (same logic, no HTTP context)
def classify_user_internal(data):
    X = np.array([[
        data.get('transport_pct', 25),
        data.get('electricity_pct', 25),
        data.get('food_pct', 25),
        data.get('waste_pct', 25)
    ]])
    X_scaled = MODELS['cluster_scaler'].transform(X)
    cluster = MODELS['kmeans'].predict(X_scaled)[0]
    cluster_name = CLUSTER_LABELS.get(cluster, 'unknown')
    return {
        'cluster': int(cluster),
        'cluster_name': cluster_name,
        'description': CLUSTER_DESCRIPTIONS.get(cluster_name, '')
    }

def predict_emissions_internal(data):
    X = np.array([[
        data.get('transport_pct', 25),
        data.get('electricity_pct', 25),
        data.get('food_pct', 25),
        data.get('waste_pct', 25),
        data.get('transport_freq', 10),
        data.get('electricity_freq', 10),
        data.get('food_freq', 10),
        data.get('waste_freq', 5),
        data.get('total_activities', 35)
    ]])
    X_scaled = MODELS['prediction_scaler'].transform(X)
    daily = MODELS['random_forest'].predict(X_scaled)[0]
    return {
        'predicted_daily': round(daily, 4),
        'predicted_weekly': round(daily * 7, 4),
        'predicted_monthly': round(daily * 30, 4)
    }

def detect_anomaly_internal(data):
    X = np.array([[
        data.get('transport_pct', 25),
        data.get('electricity_pct', 25),
        data.get('food_pct', 25),
        data.get('waste_pct', 25),
        data.get('transport_freq', 10),
        data.get('electricity_freq', 10),
        data.get('food_freq', 10),
        data.get('waste_freq', 5),
        data.get('total_activities', 35)
    ]])
    X_scaled = MODELS['anomaly_scaler'].transform(X)
    prediction = MODELS['isolation_forest'].predict(X_scaled)[0]
    return {
        'is_anomaly': prediction == -1,
        'score': float(MODELS['isolation_forest'].score_samples(X_scaled)[0])
    }

def get_recommendations_internal(data):
    classify = classify_user_internal(data)
    cluster_name = classify['cluster_name']
    
    recs = {
        'commute_heavy': ['Use public transit', 'Carpool', 'Work remotely'],
        'diet_heavy': ['Reduce red meat', 'Buy local', 'Plan meals'],
        'energy_heavy': ['LED lighting', 'Smart thermostat', 'Renewable energy'],
        'eco_conscious': ['Maintain habits', 'Offset carbon', 'Share tips'],
        'balanced': ['Target biggest category', 'Set goals', 'Track daily']
    }
    
    return {
        'cluster': cluster_name,
        'top_recommendations': recs.get(cluster_name, recs['balanced'])
    }

if __name__ == '__main__':
    print("="*50)
    print("CarbonWise ML Service Starting...")
    print("="*50)
    
    if load_models():
        print("\n✅ All models loaded successfully!")
        print("Starting Flask server on port 5001...")
        app.run(host='0.0.0.0', port=5001, debug=False)
    else:
        print("\n❌ Some models missing. Run train_models.py first.")
        print("Usage: python generate_data.py && python train_models.py")
