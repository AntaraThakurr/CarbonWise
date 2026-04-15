#!/usr/bin/env python3
"""
Synthetic Data Generator for CarbonWise ML Training
Generates realistic user activity data with different lifestyle patterns
"""

import json
import random
import numpy as np
from datetime import datetime, timedelta
import os

# Seed for reproducibility
random.seed(42)
np.random.seed(42)

# User lifestyle profiles with emission patterns
# More distinct patterns to improve clustering accuracy
LIFESTYLE_PROFILES = {
    'commute_heavy': {
        'transport': 0.70,
        'electricity': 0.15,
        'food': 0.10,
        'waste': 0.05
    },
    'diet_heavy': {
        'transport': 0.10,
        'electricity': 0.15,
        'food': 0.70,
        'waste': 0.05
    },
    'energy_heavy': {
        'transport': 0.10,
        'electricity': 0.70,
        'food': 0.15,
        'waste': 0.05
    },
    'balanced': {
        'transport': 0.30,
        'electricity': 0.30,
        'food': 0.30,
        'waste': 0.10
    },
    'eco_conscious': {
        'transport': 0.25,
        'electricity': 0.25,
        'food': 0.35,
        'waste': 0.15
    }
}

# Activity types per category with emission factors (kg CO2 per unit)
ACTIVITY_TYPES = {
    'transport': {
        'car': {'unit': 'km', 'emission_factor': 0.21, 'typical_range': (5, 100)},
        'bus': {'unit': 'km', 'emission_factor': 0.089, 'typical_range': (5, 50)},
        'train': {'unit': 'km', 'emission_factor': 0.041, 'typical_range': (10, 200)},
        'flight': {'unit': 'km', 'emission_factor': 0.255, 'typical_range': (200, 5000)},
        'bicycle': {'unit': 'km', 'emission_factor': 0, 'typical_range': (2, 30)},
        'motorcycle': {'unit': 'km', 'emission_factor': 0.103, 'typical_range': (5, 80)}
    },
    'electricity': {
        'electricity': {'unit': 'kWh', 'emission_factor': 0.233, 'typical_range': (5, 50)},
        'natural_gas': {'unit': 'm3', 'emission_factor': 2.0, 'typical_range': (1, 10)},
        'solar': {'unit': 'kWh', 'emission_factor': 0, 'typical_range': (5, 30)}
    },
    'food': {
        'beef': {'unit': 'kg', 'emission_factor': 27.0, 'typical_range': (0.1, 2)},
        'poultry': {'unit': 'kg', 'emission_factor': 6.9, 'typical_range': (0.2, 3)},
        'fish': {'unit': 'kg', 'emission_factor': 5.4, 'typical_range': (0.1, 2)},
        'vegetables': {'unit': 'kg', 'emission_factor': 2.0, 'typical_range': (0.5, 5)},
        'dairy': {'unit': 'kg', 'emission_factor': 3.2, 'typical_range': (0.2, 2)},
        'grains': {'unit': 'kg', 'emission_factor': 1.4, 'typical_range': (0.3, 3)}
    },
    'waste': {
        'general_waste': {'unit': 'kg', 'emission_factor': 0.5, 'typical_range': (0.5, 5)},
        'recycling': {'unit': 'kg', 'emission_factor': 0.1, 'typical_range': (0.5, 10)},
        'composting': {'unit': 'kg', 'emission_factor': 0.05, 'typical_range': (0.5, 5)}
    }
}

def generate_user(user_id):
    """Generate a single user with profile and activities"""
    # Randomly assign a lifestyle profile
    profile_name = random.choice(list(LIFESTYLE_PROFILES.keys()))
    profile = LIFESTYLE_PROFILES[profile_name]
    
    # User metadata
    user = {
        'user_id': user_id,
        'profile': profile_name,
        'created_at': (datetime.now() - timedelta(days=random.randint(30, 365))).isoformat(),
        'activities': []
    }
    
    # Generate 30-90 activities over the past 90 days
    num_activities = random.randint(30, 90)
    
    for _ in range(num_activities):
        # Select category based on profile weights
        category = np.random.choice(
            list(profile.keys()),
            p=list(profile.values())
        )
        
        # Select activity type within category
        activity_types = ACTIVITY_TYPES[category]
        activity_type = random.choice(list(activity_types.keys()))
        type_info = activity_types[activity_type]
        
        # Generate amount with some variance
        min_val, max_val = type_info['typical_range']
        amount = round(random.uniform(min_val, max_val), 2)
        
        # Add seasonal variation (higher energy in winter months)
        date = datetime.now() - timedelta(days=random.randint(0, 90))
        if category == 'electricity' and date.month in [11, 12, 1, 2]:
            amount *= random.uniform(1.2, 1.5)
        
        # Calculate emission
        emission = round(amount * type_info['emission_factor'], 4)
        
        activity = {
            'date': date.strftime('%Y-%m-%d'),
            'category': category,
            'type': activity_type,
            'amount': amount,
            'unit': type_info['unit'],
            'emission': emission
        }
        
        user['activities'].append(activity)
    
    # Sort activities by date
    user['activities'].sort(key=lambda x: x['date'])
    
    return user

def compute_user_features(user):
    """Extract feature vector from user activities for ML"""
    activities = user['activities']
    
    if not activities:
        return None
    
    # Category totals
    category_emissions = {'transport': 0, 'electricity': 0, 'food': 0, 'waste': 0}
    category_counts = {'transport': 0, 'electricity': 0, 'food': 0, 'waste': 0}
    
    for act in activities:
        cat = act['category']
        category_emissions[cat] += act['emission']
        category_counts[cat] += 1
    
    total_emission = sum(category_emissions.values())
    
    # Normalize to percentages
    features = {
        'user_id': user['user_id'],
        'true_profile': user['profile'],
        'total_emission': round(total_emission, 2),
        'total_activities': len(activities),
        
        # Category percentages
        'transport_pct': round(category_emissions['transport'] / max(total_emission, 0.01) * 100, 2),
        'electricity_pct': round(category_emissions['electricity'] / max(total_emission, 0.01) * 100, 2),
        'food_pct': round(category_emissions['food'] / max(total_emission, 0.01) * 100, 2),
        'waste_pct': round(category_emissions['waste'] / max(total_emission, 0.01) * 100, 2),
        
        # Activity frequency
        'transport_freq': category_counts['transport'],
        'electricity_freq': category_counts['electricity'],
        'food_freq': category_counts['food'],
        'waste_freq': category_counts['waste'],
        
        # Daily average
        'daily_avg_emission': round(total_emission / 90, 4),
        
        # Category-specific emissions
        'transport_emission': round(category_emissions['transport'], 2),
        'electricity_emission': round(category_emissions['electricity'], 2),
        'food_emission': round(category_emissions['food'], 2),
        'waste_emission': round(category_emissions['waste'], 2)
    }
    
    return features

def generate_dataset(num_users=10000):
    """Generate complete dataset"""
    print(f"Generating {num_users} synthetic users...")
    
    users = []
    features_list = []
    
    for i in range(num_users):
        user = generate_user(i + 1)
        users.append(user)
        
        features = compute_user_features(user)
        if features:
            features_list.append(features)
        
        if (i + 1) % 100 == 0:
            print(f"  Generated {i + 1} users...")
    
    return users, features_list

def save_dataset(users, features, output_dir='data'):
    """Save generated data to files"""
    os.makedirs(output_dir, exist_ok=True)
    
    # Save raw user data
    with open(os.path.join(output_dir, 'users_raw.json'), 'w') as f:
        json.dump(users, f, indent=2)
    
    # Save feature vectors
    with open(os.path.join(output_dir, 'user_features.json'), 'w') as f:
        json.dump(features, f, indent=2)
    
    # Save as CSV for easier analysis
    import csv
    if features:
        with open(os.path.join(output_dir, 'user_features.csv'), 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=features[0].keys())
            writer.writeheader()
            writer.writerows(features)
    
    print(f"\nDataset saved to {output_dir}/")
    print(f"  - users_raw.json: {len(users)} users with activities")
    print(f"  - user_features.json: {len(features)} feature vectors")
    print(f"  - user_features.csv: CSV format for analysis")
    
    # Summary statistics
    profiles = {}
    for f in features:
        p = f['true_profile']
        profiles[p] = profiles.get(p, 0) + 1
    
    print("\nProfile distribution:")
    for profile, count in sorted(profiles.items()):
        print(f"  {profile}: {count} users ({count/len(features)*100:.1f}%)")

if __name__ == '__main__':
    users, features = generate_dataset(10000)
    save_dataset(users, features)
