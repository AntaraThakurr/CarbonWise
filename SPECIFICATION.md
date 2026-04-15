# CarbonWise - Technical & Feature Specification

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Technical Architecture](#technical-architecture)
4. [Feature Specifications](#feature-specifications)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [AI/LLM Integration](#aillm-integration)
8. [Gamification System](#gamification-system)
9. [Known Issues & Areas for Improvement](#known-issues--areas-for-improvement)
10. [Future Feature Possibilities](#future-feature-possibilities)
11. [Deployment Guide](#deployment-guide)

---

## Executive Summary

**CarbonWise** is a full-stack web application designed to help users track, analyze, and reduce their personal carbon footprint. The application combines activity logging, carbon calculations, AI-powered insights, and gamification elements to create an engaging sustainability tracking experience.

### Key Highlights
- **Personal carbon footprint tracking** across 5 categories: Electricity, Transport, Heating, Diet, and Waste
- **AI-powered insights** using local Ollama LLM integration (llama3.1:8b)
- **Gamification system** with XP, levels (1-15), badges, streaks, and leaderboards
- **Interactive calculator** with real-time emission calculations
- **Goal setting and tracking** with progress visualization
- **Responsive single-page application** with modern UI

---

## Project Overview

### What This Application Does

CarbonWise enables users to:

1. **Track Carbon Emissions**: Log daily activities that produce carbon emissions (driving, electricity usage, diet choices, etc.)

2. **Calculate Footprint**: Use an interactive calculator to estimate carbon emissions based on lifestyle factors

3. **Get AI Insights**: Receive personalized, data-driven recommendations from an AI model to reduce emissions

4. **Set Goals**: Create sustainability goals (reduce transport emissions by 20%, go meatless for a week, etc.)

5. **Earn Rewards**: Gain XP, level up, earn badges, and compete on leaderboards

6. **Visualize Progress**: View emissions over time via charts, category breakdowns, and comparison metrics

### Target Users
- Environmentally-conscious individuals
- People wanting to understand their carbon footprint
- Organizations tracking employee sustainability efforts
- Educational institutions teaching environmental awareness

---

## Technical Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | User interface |
| **Charts** | Chart.js (CDN) | Data visualization |
| **Icons** | Font Awesome 6.4 (CDN) | UI icons |
| **Backend** | Node.js + Express.js | REST API server |
| **Database** | SQLite (sql.js) | Data persistence |
| **Authentication** | JWT (jsonwebtoken) | User authentication |
| **Password Hashing** | bcryptjs | Secure password storage |
| **AI/LLM** | Ollama (local) | AI-powered insights |
| **LLM Model** | llama3.1:8b | Default AI model || **ML Service** | Python Flask + scikit-learn | User clustering, prediction, anomaly detection |
| **ML Algorithms** | K-Means, Random Forest, Isolation Forest | ML models |
### Project Structure

```
CarbonWise/
├── server.js              # Express server entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── database/
│   ├── db.js              # Database wrapper (sql.js)
│   └── carbonwise.db      # SQLite database file
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js            # User registration/login
│   ├── activities.js      # Activity CRUD operations
│   ├── goals.js           # Goal management
│   ├── insights.js        # AI insights endpoint
│   ├── stats.js           # Dashboard statistics
│   └── leaderboard.js     # Leaderboard data
├── utils/
│   ├── ollama.js          # Ollama LLM client
│   ├── insights-engine.js # Insights generation logic
│   ├── gamification.js    # XP, levels, badges system
│   └── ml-client.js       # Python ML service HTTP client
├── ml-service/            # Python ML microservice
│   ├── app.py             # Flask API server (port 5001)
│   ├── train_models.py    # Model training with hyperparameter tuning
│   ├── generate_data.py   # Synthetic training data generator
│   ├── requirements.txt   # Python dependencies
│   ├── models/            # Trained model files (.pkl)
│   └── data/              # Training datasets
└── public/
    ├── index.html         # Single-page application
    ├── app.js             # Frontend JavaScript (~3600 lines)
    └── styles.css         # Styles (~2700 lines)
```

### Dependencies

```json
{
  "express": "^4.18.2",       // Web framework
  "cors": "^2.8.5",           // Cross-origin resource sharing
  "bcryptjs": "^2.4.3",       // Password hashing
  "jsonwebtoken": "^9.0.2",   // JWT tokens
  "sql.js": "^1.10.2",        // SQLite in JavaScript
  "dotenv": "^16.4.1",        // Environment variables
  "uuid": "^9.0.1"            // Unique ID generation
}
```

### Environment Variables

```bash
PORT=3000                           # Server port
JWT_SECRET=your_secret_key          # JWT signing key
OLLAMA_URL=http://localhost:11434   # Ollama server URL
OLLAMA_MODEL=llama3.1:8b            # AI model to use
OLLAMA_TIMEOUT=60000                # Request timeout (ms)
ML_SERVICE_URL=http://localhost:5001  # Python ML microservice URL
```

---

## Feature Specifications

### 1. User Authentication

| Feature | Description |
|---------|-------------|
| **Registration** | Email, username, password (6+ chars) |
| **Login** | Email + password with JWT token |
| **Session** | 7-day JWT token expiry |
| **Auto-logout** | On 401/403 API responses |
| **Password Storage** | bcrypt with salt rounds = 10 |
| **Profile Editing** | Edit username/email with uniqueness validation |

### 2. Carbon Calculator

Interactive calculator with 5 tabs:

#### Electricity Tab
- Input: Monthly kWh usage
- Energy source selection (Mixed, Coal, Natural Gas, Nuclear, Renewable)
- Emission factors (kg CO₂/kWh):
  - Mixed: 0.5, Coal: 0.9, Natural Gas: 0.4, Nuclear: 0.02, Renewable: 0.05

#### Transport Tab
- 6 transport types: Car, Bus, Train, Plane, Bike, Walk
- Distance input (km/week)
- Fuel type for cars (Petrol, Diesel, Hybrid, Electric)
- Emission factors (kg CO₂/km):
  - Car Petrol: 0.21, Diesel: 0.18, Hybrid: 0.12, Electric: 0.05
  - Bus: 0.089, Train: 0.041, Plane: 0.255, Bike/Walk: 0

#### Heating Tab
- Heating type selection (Natural Gas, Oil, Electric, Wood, Heat Pump)
- Home size (sq ft)
- Daily heating hours (slider 0-24)
- Emission factors (kg CO₂/hour/sqft):
  - Natural Gas: 2.0, Oil: 2.5, Electric: 1.5, Wood: 0.3, Heat Pump: 0.5

#### Diet Tab
- 5 diet types: Meat Heavy, Average, Low Meat, Vegetarian, Vegan
- Food sourcing options (Local, Organic, Low Waste)
- Daily emission factors (kg CO₂/day):
  - Meat Heavy: 7.2, Average: 5.6, Low Meat: 4.2, Vegetarian: 3.8, Vegan: 2.9

#### Waste Tab
- Waste bags per week
- Recycling options (Paper, Plastic, Glass, Metal, Compost)
- Single-use items level (High, Medium, Low, Minimal)
- Emission factor: 0.5 kg CO₂/bag, reduced by recycling/composting

### 3. Activity Logging

| Feature | Description |
|---------|-------------|
| **Log Activities** | Category, description, value, unit, date |
| **View Modes** | Daily, Weekly, Monthly views |
| **Date Navigation** | Previous/next day/week/month buttons |
| **Edit/Delete** | Inline editing and deletion |
| **XP Deduction** | Deleting an activity deducts the earned XP |
| **Summary Stats** | Total activities, emissions, carbon saved |
| **Auto-save from Calculator** | Save calculator results as activities |

### 4. Dashboard

| Widget | Data Displayed |
|--------|----------------|
| **Today's Emissions** | Sum of today's logged emissions |
| **This Week** | Current calendar week emissions (Mon-Sun) |
| **This Month** | Current calendar month emissions |
| **vs Global Average** | Comparison to 4.8 tons/year global avg |
| **Emissions Chart** | Line chart (Week/Month/Year views) |
| **Category Chart** | Doughnut chart by category |
| **Progress Comparison** | User vs 2030 target (2 tons/year) |
| **Theme Toggle** | Dark/Light mode toggle button in navbar |
| **Leaderboard Widget** | Top users by XP with rankings |

### 5. AI Insights

Powered by local Ollama LLM:

| Component | Description |
|-----------|-------------|
| **AI Summary** | Natural language analysis of user's footprint |
| **Top Insight** | Highest-impact recommendation with math |
| **Insights Cards** | Category-specific actionable recommendations |
| **Weekly Challenge** | Specific weekly goal with target |
| **Cost Savings** | Estimated monetary savings per recommendation |
| **Trend Analysis** | Detecting increasing/decreasing patterns |
| **Fallback Mode** | Rule-based insights when AI unavailable |

#### ML-Powered Features (Python Microservice)

| Feature | Algorithm | Output |
|---------|-----------|--------|
| **User Classification** | K-Means Clustering | Profile: `commute_heavy`, `diet_heavy`, `energy_heavy`, `balanced`, `eco_conscious` |
| **Emission Prediction** | Random Forest Regressor | Daily/weekly/monthly CO₂ forecasts with confidence |
| **Anomaly Detection** | Isolation Forest | Flags unusual emission patterns |
| **Smart Recommendations** | Cluster-based | Personalized tips based on similar users |

#### Detailed Reports

Generate comprehensive reports with:
- **Executive Summary** (AI-generated)
- **Category Breakdown** with percentages
- **Trend Analysis** (week-over-week, month-over-month)
- **ML Insights** (cluster, predictions, anomalies)
- **Date Range Filtering** (custom start/end dates)

#### AI Output Format
```json
{
  "summary": "511 kg this month = 128% of average",
  "topInsight": {
    "title": "Cut car trips",
    "description": "3 trips × 89.9 kg = 270 kg → 2 fewer trips = save 80 kg",
    "category": "transport",
    "potentialSavings": 80.9
  },
  "insights": [...],
  "weeklyChallenge": {
    "title": "This week: Replace 2 car trips with transit",
    "targetSavings": 20
  },
  "ml": {
    "classification": { "cluster": "commute_heavy", "confidence": 0.89 },
    "prediction": { "daily": 12.5, "weekly": 87.5, "monthly": 375.0 },
    "anomaly": { "isAnomaly": false, "score": 0.12 }
  }
}
```

### 6. Goals System

| Feature | Description |
|---------|-------------|
| **Goal Types** | Emission reduction, Activity-based, Streak-based |
| **Duration** | Weekly, Monthly, Custom |
| **Progress Tracking** | Automatic progress updates |
| **XP Rewards** | Earn XP upon completion |
| **Goal Cards** | Visual progress bars and countdown |
| **Completed Section** | Past goals with green progress bars |

### 7. Gamification

#### XP System
| Action | XP Earned |
|--------|-----------|
| Log activity | 10 XP |
| Daily login streak | 5-25 XP |
| Complete goal | 50-200 XP |
| Earn badge | 25-500 XP |
| Level up | Bonus XP |
| Delete activity | -10 XP (deduction) |

#### XP History
Track all XP gains/deductions with:
- **Source Type**: Activity, goal, badge, streak
- **Amount**: XP earned or deducted
- **Timestamp**: When XP was earned
- **Linked Item**: Activity/goal/badge that triggered it

#### Level System (15 levels)
| Level | XP Required | Title |
|-------|-------------|-------|
| 1 | 0 | Seedling |
| 2 | 200 | Sprout |
| 3 | 500 | Green Thumb |
| 4 | 1000 | Eco Enthusiast |
| 5 | 1800 | Eco Warrior |
| 6 | 2800 | Carbon Cutter |
| 7 | 4000 | Earth Defender |
| 8 | 5500 | Climate Champion |
| 9 | 7500 | Sustainability Star |
| 10 | 10000 | Eco Legend |
| 11-15 | 13000-30000 | Planet Protector → Eco Master |

#### Badges (12 total)
| Badge | Condition |
|-------|-----------|
| First Steps | Log first activity |
| Week Warrior | 7-day streak |
| Month Master | 30-day streak |
| Green Commuter | 10 eco-friendly trips |
| Veggie Lover | 5 meat-free days |
| Carbon Champion | 50% emission reduction |
| Planet Protector | Below global average |
| Eco Legend | Reach Level 10 |
| Renewable Hero | 100% green energy for a month |
| Zero Waste Hero | Zero waste week |
| Consistent Tracker | 100 days logged |
| Community Leader | Top 10 on leaderboard |

### 8. Leaderboard

- View by: Daily, Weekly, Monthly, All-time
- Displays: Rank, Username, XP, Level, Streak
- Top 3 highlighted with medals (🥇🥈🥉)

---

## Database Schema

### Tables Overview

```sql
-- Users table
users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    last_activity_date TEXT,
    created_at TEXT,
    updated_at TEXT
)

-- Activities table
activities (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL (FK → users),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    emissions REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT
)

-- Goals table
goals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL (FK → users),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    target TEXT NOT NULL,
    target_value REAL,
    current_value REAL DEFAULT 0,
    duration TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 100,
    status TEXT DEFAULT 'active',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT
)

-- Badges table (predefined)
badges (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 50,
    condition_type TEXT NOT NULL,
    condition_value REAL NOT NULL
)

-- User badges (junction table)
user_badges (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL (FK → users),
    badge_id INTEGER NOT NULL (FK → badges),
    earned_at TEXT,
    UNIQUE(user_id, badge_id)
)

-- Calculator profiles (saved settings)
calculator_profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL (FK → users),
    electricity_usage REAL DEFAULT 0,
    energy_source TEXT DEFAULT 'mixed',
    transport_type TEXT DEFAULT 'car',
    transport_distance REAL DEFAULT 0,
    fuel_type TEXT DEFAULT 'petrol',
    heating_type TEXT DEFAULT 'natural-gas',
    home_size REAL DEFAULT 0,
    heating_hours REAL DEFAULT 8,
    diet_type TEXT DEFAULT 'average',
    local_food INTEGER DEFAULT 0,
    organic_food INTEGER DEFAULT 0,
    low_food_waste INTEGER DEFAULT 0,
    waste_bags REAL DEFAULT 0,
    recycle_paper INTEGER DEFAULT 1,
    recycle_plastic INTEGER DEFAULT 1,
    recycle_glass INTEGER DEFAULT 1,
    recycle_metal INTEGER DEFAULT 0,
    compost INTEGER DEFAULT 0,
    single_use TEXT DEFAULT 'medium',
    updated_at TEXT
)

-- Insights cache
insights (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL (FK → users),
    insight_type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    potential_savings REAL,
    priority INTEGER DEFAULT 5,
    is_dismissed INTEGER DEFAULT 0,
    created_at TEXT,
    expires_at TEXT
)

-- XP History (track XP gains/deductions over time)
xp_history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL (FK → users),
    amount INTEGER NOT NULL,
    source_type TEXT NOT NULL,  -- 'activity', 'goal', 'badge', 'streak', 'deduction'
    source_id INTEGER,          -- ID of activity/goal/badge
    activity_id INTEGER,        -- Direct link to activity (if applicable)
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
)
```

### Indexes
```sql
CREATE INDEX idx_activities_user_date ON activities(user_id, date);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_xp_history_user ON xp_history(user_id, created_at);
```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user |
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Get current user info |
| PUT | `/api/auth/me` | Update profile (username/email with uniqueness check) |

### Activity Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities` | List activities (with filters) |
| POST | `/api/activities` | Create new activity (+10 XP) |
| PUT | `/api/activities/:id` | Update activity |
| DELETE | `/api/activities/:id` | Delete activity (-10 XP deduction) |

### Stats Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/dashboard` | Dashboard statistics |
| GET | `/api/stats/charts` | Chart data (week/month/year) |
| GET | `/api/stats/xp-history` | XP history with pagination |

### Insights Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/insights` | AI-powered insights |
| GET | `/api/insights?refresh=true` | Force refresh insights |
| GET | `/api/insights/report/detailed` | Full report with ML analysis |
| GET | `/api/insights/report/detailed?startDate=X&endDate=Y` | Date-filtered report |

### Goals Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List user goals |
| POST | `/api/goals` | Create new goal |
| PUT | `/api/goals/:id` | Update goal |
| DELETE | `/api/goals/:id` | Delete goal |

### Leaderboard Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | Get leaderboard |
| GET | `/api/leaderboard?type=weekly` | Filter by timeframe |

---

## AI/LLM Integration

### Ollama Setup

CarbonWise integrates with [Ollama](https://ollama.ai/) for local AI inference.

#### Installation
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

#### Running Ollama
```bash
ollama serve              # Start Ollama server
ollama pull llama3.1:8b   # Download model
```

### How AI Insights Work

1. **Data Collection**: Gather user's activity data (emissions by category, trip counts, etc.)
2. **Prompt Construction**: Build structured prompt with actual user data and math
3. **LLM Call**: Send to Ollama with temperature=0.4 for consistent output
4. **JSON Parsing**: Extract structured insights from response
5. **Fallback**: Use rule-based insights if AI unavailable or fails

### AI Prompt Structure

The system prompt instructs the AI to:
- Use exact math (e.g., "3 trips × 89.9 kg = 269.7 kg")
- Compare to global average (400 kg/month)
- Include cost savings estimates
- Provide one insight per category
- Give a weekly challenge with specific target

---

## ML Service Integration

### Python Microservice Architecture

CarbonWise includes a Python Flask microservice (`ml-service/`) for machine learning analysis.

#### Setup
```bash
cd ml-service
pip install -r requirements.txt
python generate_data.py    # Generate 10,000 synthetic users
python train_models.py     # Train ML models
python app.py              # Start on port 5001
```

### ML Models

#### 1. User Classification (K-Means Clustering)
- **Training Data**: 10,000 synthetic users with realistic emission patterns
- **Clusters**: 5 lifestyle profiles
  - `commute_heavy`: Transportation >40% of emissions
  - `diet_heavy`: Food/dietary choices dominate
  - `energy_heavy`: Electricity usage dominates
  - `balanced`: Relatively even distribution
  - `eco_conscious`: Low emissions across all categories
- **Silhouette Score**: ~0.66 (excellent cluster separation)

#### 2. Emission Prediction (Random Forest Regressor)
- **Features**: Historical emissions by category, activity counts, trends
- **Outputs**: Daily, weekly, monthly CO₂ forecasts
- **R² Score**: ~0.91 (91% variance explained)
- **MAE**: ~3.78 kg CO₂/day

#### 3. Anomaly Detection (Isolation Forest)
- **Purpose**: Identify unusual emission patterns
- **Use Cases**: 
  - Data entry errors
  - Sudden lifestyle changes
  - Opportunities for improvement
- **Output**: Anomaly flag + confidence score

### ML API Endpoints (Port 5001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| POST | `/classify` | Classify user into lifestyle cluster |
| POST | `/predict` | Predict future emissions |
| POST | `/detect-anomaly` | Check for unusual patterns |
| POST | `/recommendations` | Get personalized recommendations |
| POST | `/analyze` | Full analysis (all above combined) |

---

## Gamification System

### XP Award Events

| Event | XP | Notes |
|-------|------|-------|
| Register account | 25 | First Steps badge |
| Log activity | 10 | Per activity |
| Daily login | 5-25 | Streak bonus |
| Complete goal | 50-200 | Based on difficulty |
| Earn badge | 25-500 | Badge-specific |
| Level up | Bonus | Progressive |
| Delete activity | -10 | XP deduction |

### Streak System

- **Streak Counter**: Consecutive days with logged activities
- **Streak Reset**: Missing a day resets to 0
- **Streak Rewards**: 
  - 7 days = Week Warrior badge
  - 30 days = Month Master badge
  - Daily XP bonus increases with streak

### Badge Unlock Conditions

1. **Activity Count**: Number of activities logged
2. **Streak Duration**: Consecutive active days
3. **Emission Reduction**: Percentage decrease vs baseline
4. **Category-specific**: Eco trips, veggie days, etc.
5. **Level-based**: Reaching specific levels
6. **Leaderboard**: Ranking position

---

## Known Issues & Areas for Improvement

### Current Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **Browser Caching** | Medium | Static files may be cached; requires hard refresh |
| **Single User Testing** | Low | Test data may mix between accounts |
| **No Password Reset** | Medium | Users cannot recover forgotten passwords |
| **No Email Verification** | Low | No email confirmation on registration |
| **Mobile Responsiveness** | Medium | Some UI elements need mobile optimization |

### Areas for Improvement

#### Code Quality
- [ ] Add TypeScript for type safety
- [ ] Implement unit and integration tests
- [ ] Add API request validation (Joi/Zod)
- [ ] Implement rate limiting
- [ ] Add request logging middleware
- [ ] Split large files (app.js is ~2400 lines)

#### Security
- [ ] Add password reset functionality
- [ ] Implement email verification
- [ ] Add CSRF protection
- [ ] Implement refresh tokens
- [ ] Add password strength validation
- [ ] Rate limit login attempts

#### Performance
- [ ] Add database connection pooling
- [ ] Implement response caching (Redis)
- [ ] Bundle and minify frontend assets
- [ ] Add lazy loading for charts
- [ ] Optimize database queries with better indexes

#### UX Improvements
- [ ] Add loading skeletons
- [ ] Improve error messages
- [ ] Add form validation feedback
- [ ] Implement undo for deletions
- [ ] Add export data feature

---

## Future Feature Possibilities

### High Priority (Short Term)

1. **Social Features**
   - Share achievements on social media
   - Challenge friends to emissions reduction competitions
   - Create teams/households for collective tracking

2. **Data Import/Export**
   - Import from fitness apps (Strava, Apple Health)
   - Export to CSV/PDF
   - Sync with smart home devices

3. **Notifications**
   - Daily/weekly email summaries
   - Goal deadline reminders
   - Achievement notifications (push/email)

4. **Enhanced Calculator**
   - More granular transport options (e.g., car models)
   - Flight-specific calculator (origin/destination)
   - Shopping/consumption tracking

### Medium Priority (Medium Term)

5. **Carbon Offsetting Integration**
   - Partner with offset providers
   - Track offset purchases
   - Offset recommendation based on footprint

6. **Community Features**
   - Local eco-challenges
   - Community leaderboards
   - Share tips and success stories

7. **Advanced Analytics**
   - ML-based trend prediction
   - Seasonal pattern analysis
   - Personalized reduction targets

8. **Corporate/Team Features**
   - Organization dashboards
   - Department-level tracking
   - Admin controls and reporting

### Innovative Features (Long Term)

9. **AR/VR Visualization**
   - Visualize emissions as physical objects
   - "See" your carbon footprint in AR

10. **IoT Integration**
    - Smart meter auto-import
    - Vehicle OBD-II integration
    - Smart thermostat sync

11. **Blockchain Verification**
    - Verified emission reductions
    - Carbon credit tokenization
    - Immutable activity log

12. **AI Coaching**
    - Conversational AI assistant
    - Personalized daily tips via chat
    - Voice-enabled logging

---

## Deployment Guide

### Local Development

```bash
# Clone repository
git clone https://github.com/AbhiramK01/CarbonWise.git
cd CarbonWise

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start Ollama (for AI insights)
ollama serve &
ollama pull llama3.1:8b

# Start server
npm start
# or for development with auto-reload
npm run dev
```

### Production Deployment

#### Option 1: Traditional VPS

```bash
# Install Node.js 18+
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name carbonwise

# Enable startup
pm2 startup
pm2 save
```

#### Option 2: Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

#### Option 3: Serverless (Vercel/Railway)

- Works out of the box with `npm start`
- Note: SQLite database will need to be replaced with PostgreSQL or similar for persistent storage

### Post-Deployment Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure HTTPS (SSL certificate)
- [ ] Set up database backups
- [ ] Configure monitoring (UptimeRobot, etc.)
- [ ] Set up error tracking (Sentry)
- [ ] Test Ollama connectivity (or setup cloud AI alternative)

---

## Contact & Support

**Repository**: https://github.com/AbhiramK01/CarbonWise

**Issues**: Submit via GitHub Issues

---

*CarbonWise - Carbon Footprint Tracking Application*
*CarbonWise Version: 1.0.0*
