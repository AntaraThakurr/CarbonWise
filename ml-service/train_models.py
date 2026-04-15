#!/usr/bin/env python3
"""
ML Model Training for CarbonWise
Trains K-Means clustering and Random Forest prediction models
"""

import json
import pickle
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor, IsolationForest, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import silhouette_score, mean_absolute_error, r2_score
import os
import warnings
warnings.filterwarnings('ignore')

# Categories for labeling
CATEGORIES = ['transport', 'electricity', 'food', 'waste']

def determine_cluster_label(centroid):
    """Determine cluster label based on dominant category in centroid"""
    # centroid is [transport_pct, electricity_pct, food_pct, waste_pct]
    max_idx = np.argmax(centroid)
    max_val = centroid[max_idx]
    
    # If one category dominates (>40%), label by that category
    if max_val > 40:
        labels = ['commute_heavy', 'energy_heavy', 'diet_heavy', 'waste_heavy']
        return labels[max_idx]
    
    # If fairly balanced (all within 15-35%), label as balanced
    if all(15 <= v <= 35 for v in centroid):
        return 'balanced'
    
    # If generally low emissions across all
    if max_val < 30:
        return 'eco_conscious'
    
    # Default: label by highest category
    labels = ['commute_heavy', 'energy_heavy', 'diet_heavy', 'waste_heavy']
    return labels[max_idx]

def load_features(data_path='data/user_features.json'):
    """Load feature vectors from JSON"""
    with open(data_path, 'r') as f:
        features = json.load(f)
    return features

def prepare_clustering_features(features):
    """Prepare feature matrix for clustering"""
    # Use percentage features for clustering
    X = []
    for f in features:
        X.append([
            f['transport_pct'],
            f['electricity_pct'],
            f['food_pct'],
            f['waste_pct']
        ])
    return np.array(X)

def prepare_prediction_features(features):
    """Prepare features for emission prediction"""
    X = []
    y = []
    for f in features:
        X.append([
            f['transport_pct'],
            f['electricity_pct'],
            f['food_pct'],
            f['waste_pct'],
            f['transport_freq'],
            f['electricity_freq'],
            f['food_freq'],
            f['waste_freq'],
            f['total_activities']
        ])
        y.append(f['daily_avg_emission'])
    return np.array(X), np.array(y)

def train_clustering_model(X, n_clusters=5):
    """Train K-Means clustering model with optimized parameters"""
    print("\n=== Training K-Means Clustering ===")
    
    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Find optimal number of clusters using elbow method
    print("Finding optimal cluster count...")
    inertias = []
    silhouettes = []
    K_range = range(3, 8)
    for k in K_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=20)
        km.fit(X_scaled)
        inertias.append(km.inertia_)
        silhouettes.append(silhouette_score(X_scaled, km.labels_))
    
    # Use silhouette score to pick best k
    best_k_idx = np.argmax(silhouettes)
    best_k = list(K_range)[best_k_idx]
    print(f"  Silhouette scores: {dict(zip(K_range, [f'{s:.3f}' for s in silhouettes]))}")
    print(f"  Best cluster count: {best_k} (silhouette: {silhouettes[best_k_idx]:.4f})")
    
    # Train final K-Means with optimized parameters
    kmeans = KMeans(
        n_clusters=best_k, 
        random_state=42, 
        n_init=30,  # More initializations for better centroids
        max_iter=500,  # Allow more iterations for convergence
        algorithm='lloyd'  # Use lloyd algorithm for better accuracy
    )
    clusters = kmeans.fit_predict(X_scaled)
    
    # Evaluate
    silhouette = silhouette_score(X_scaled, clusters)
    print(f"Silhouette Score: {silhouette:.4f}")
    
    # Cluster distribution
    unique, counts = np.unique(clusters, return_counts=True)
    print("Cluster distribution:")
    for cluster, count in zip(unique, counts):
        print(f"  Cluster {cluster}: {count} users ({count/len(clusters)*100:.1f}%)")
    
    # Analyze cluster centroids and determine labels dynamically
    print("\nCluster centroids (category percentages):")
    centroids = scaler.inverse_transform(kmeans.cluster_centers_)
    categories = ['Transport', 'Electricity', 'Food', 'Waste']
    
    # Generate dynamic cluster labels based on actual centroid patterns
    cluster_labels = {}
    for i, centroid in enumerate(centroids):
        label = determine_cluster_label(centroid)
        cluster_labels[i] = label
        print(f"  Cluster {i}: {dict(zip(categories, [f'{v:.1f}%' for v in centroid]))} → {label}")
    
    print(f"\nDynamic cluster labels: {cluster_labels}")
    
    return kmeans, scaler, clusters, cluster_labels

def train_prediction_model(X, y):
    """Train Random Forest with hyperparameter tuning"""
    print("\n=== Training Random Forest Predictor ===")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Standardize
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Hyperparameter grid search
    print("Running hyperparameter tuning (this may take a minute)...")
    param_grid = {
        'n_estimators': [200, 500],
        'max_depth': [None, 20, 30],
        'min_samples_split': [2, 5],
        'min_samples_leaf': [1, 2]
    }
    
    rf_base = RandomForestRegressor(random_state=42, n_jobs=-1)
    grid_search = GridSearchCV(
        rf_base, 
        param_grid, 
        cv=5,  # 5-fold cross-validation
        scoring='neg_mean_absolute_error',
        n_jobs=-1,
        verbose=0
    )
    grid_search.fit(X_train_scaled, y_train)
    
    print(f"Best parameters: {grid_search.best_params_}")
    
    # Train final model with best parameters
    rf = grid_search.best_estimator_
    
    # Cross-validation score on training data
    cv_scores = cross_val_score(rf, X_train_scaled, y_train, cv=5, scoring='r2')
    print(f"Cross-validation R² scores: {[f'{s:.3f}' for s in cv_scores]}")
    print(f"Mean CV R²: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")
    
    # Evaluate on test set
    y_pred = rf.predict(X_test_scaled)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"\nTest Set Performance:")
    print(f"  Mean Absolute Error: {mae:.4f} kg CO₂/day")
    print(f"  R² Score: {r2:.4f}")
    
    # Feature importance
    feature_names = ['transport_pct', 'electricity_pct', 'food_pct', 'waste_pct',
                     'transport_freq', 'electricity_freq', 'food_freq', 'waste_freq', 'total_activities']
    importances = sorted(zip(feature_names, rf.feature_importances_), key=lambda x: x[1], reverse=True)
    print("\nFeature importances:")
    for name, imp in importances:
        print(f"  {name}: {imp:.4f}")
    
    return rf, scaler

def train_anomaly_detector(X):
    """Train Isolation Forest with optimized parameters"""
    print("\n=== Training Anomaly Detector ===")
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Isolation Forest with more estimators for better detection
    iso_forest = IsolationForest(
        n_estimators=200,  # More trees for better anomaly detection
        contamination='auto',  # Let the model determine contamination
        max_samples='auto',
        random_state=42,
        n_jobs=-1
    )
    iso_forest.fit(X_scaled)
    
    # Check anomaly rate
    anomalies = iso_forest.predict(X_scaled)
    anomaly_count = np.sum(anomalies == -1)
    print(f"Detected {anomaly_count} anomalies ({anomaly_count/len(X)*100:.1f}%)")
    
    # Calculate anomaly scores for more detailed analysis
    scores = iso_forest.decision_function(X_scaled)
    print(f"Anomaly score range: [{scores.min():.3f}, {scores.max():.3f}]")
    print(f"Mean anomaly score: {scores.mean():.3f}")
    
    return iso_forest, scaler

def save_models(models, output_dir='models'):
    """Save trained models to disk"""
    os.makedirs(output_dir, exist_ok=True)
    
    for name, model in models.items():
        filepath = os.path.join(output_dir, f'{name}.pkl')
        with open(filepath, 'wb') as f:
            pickle.dump(model, f)
        print(f"Saved {name} to {filepath}")

def main():
    print("="*50)
    print("CarbonWise ML Model Training")
    print("="*50)
    
    # Load data
    features = load_features()
    print(f"Loaded {len(features)} user feature vectors")
    
    # Prepare features
    X_cluster = prepare_clustering_features(features)
    X_pred, y_pred = prepare_prediction_features(features)
    
    # Train models
    kmeans, cluster_scaler, _, cluster_labels = train_clustering_model(X_cluster)
    rf, pred_scaler = train_prediction_model(X_pred, y_pred)
    iso_forest, anomaly_scaler = train_anomaly_detector(X_pred)
    
    # Save all models including cluster labels
    print("\n=== Saving Models ===")
    models = {
        'kmeans': kmeans,
        'cluster_scaler': cluster_scaler,
        'cluster_labels': cluster_labels,  # Dynamic labels based on training data
        'random_forest': rf,
        'prediction_scaler': pred_scaler,
        'isolation_forest': iso_forest,
        'anomaly_scaler': anomaly_scaler
    }
    save_models(models)
    
    print("\n✅ Training complete!")

if __name__ == '__main__':
    main()
