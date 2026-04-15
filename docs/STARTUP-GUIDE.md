# CarbonWise Startup Guide

Complete guide to running CarbonWise from scratch on **macOS**, **Linux**, and **Windows**.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Backend server |
| Python | 3.9+ | ML microservice |
| pip | Latest | Python package manager |
| Ollama | Latest | LLM service (optional) |

### Verify Installations

**macOS/Linux:**
```bash
node --version    # Should show v18+
python3 --version # Should show 3.9+
pip3 --version    # Any recent version
ollama --version  # Optional
```

**Windows (PowerShell):**
```powershell
node --version
python --version
pip --version
ollama --version  # Optional
```

---

## First-Time Setup

### Step 1: Clone the Repository

**macOS/Linux/Windows:**
```bash
git clone https://github.com/AbhiramK01/CarbonWise.git
cd CarbonWise
```

### Step 2: Install Node.js Dependencies

**All Platforms:**
```bash
npm install
```

This installs:
- express (web server)
- sql.js (SQLite database)
- bcryptjs (password hashing)
- jsonwebtoken (authentication)
- node-fetch (HTTP client)
- And other dependencies...

### Step 2.5: (Optional) Seed Demo Users

**All Platforms:**
```bash
node seed-users.js
```

This creates 5 demo users with activity history for testing:

| Email | Profile | Description |
|-------|---------|-------------|
| alex.commuter@demo.com | Commute-heavy | High transport emissions |
| bella.foodie@demo.com | Diet-heavy | High food/diet emissions |
| charlie.homebody@demo.com | Energy-heavy | High electricity usage |
| diana.average@demo.com | Balanced | Typical mixed lifestyle |
| evan.green@demo.com | Eco-conscious | Low overall footprint |

**All passwords: `demo123`**

> **Note**: Activities are generated from January 1, 2026 to the current date automatically.

### Step 3: Install Python ML Dependencies

**macOS/Linux:**
```bash
cd ml-service
pip3 install -r requirements.txt
```

**Windows:**
```powershell
cd ml-service
pip install -r requirements.txt
```

This installs:
- flask (API server)
- scikit-learn (ML algorithms)
- numpy (numerical computing)
- pandas (data manipulation)

### Step 4: Generate Training Data

**macOS/Linux:**
```bash
cd ml-service
python3 generate_data.py
```

**Windows:**
```powershell
cd ml-service
python generate_data.py
```

**Expected Output:**
```
Generating 10000 synthetic users...
Dataset saved to data/
  - users_raw.json: 10000 users with activities
  - user_features.json: 10000 feature vectors
  - user_features.csv: CSV format for analysis
```

### Step 5: Train ML Models

**macOS/Linux:**
```bash
python3 train_models.py
```

**Windows:**
```powershell
python train_models.py
```

**Expected Output:**
```
==================================================
CarbonWise ML Model Training
==================================================
Loaded 10000 user feature vectors

=== Training K-Means Clustering ===
Silhouette Score: 0.6596

=== Training Random Forest Predictor ===
R² Score: 0.9142

=== Training Anomaly Detector ===
Detected anomalies

✅ Training complete!
```

**Time:** ~30-60 seconds (includes hyperparameter tuning)

### Step 6: (Optional) Setup Ollama

**macOS:**
```bash
brew install ollama
ollama pull llama3.2
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
```

**Windows:**
Download from https://ollama.ai, then:
```powershell
ollama pull llama3.2
```

---

## Starting the Application

### Option A: Start Services Individually

#### Terminal 1 - ML Service

**macOS/Linux:**
```bash
cd ml-service
python3 app.py
```

**Windows:**
```powershell
cd ml-service
python app.py
```

Runs on: http://localhost:5001

#### Terminal 2 - Node.js Server

**All Platforms:**
```bash
cd ..  # Return to project root if in ml-service
node server.js
```

Runs on: http://localhost:3000

#### Terminal 3 - Ollama (Optional)

**All Platforms:**
```bash
ollama serve
```

Runs on: http://localhost:11434

### Option B: Quick Start (Background Processes)

**macOS/Linux:**
```bash
# From project root directory
cd ml-service && python3 app.py &
cd .. && node server.js
```

**Windows (PowerShell - use separate terminals):**
```powershell
# Terminal 1
cd ml-service
python app.py

# Terminal 2 (new window)
cd CarbonWise
node server.js
```

### Option C: One-Liner Start (macOS/Linux only)

```bash
(cd ml-service && python3 app.py &) && sleep 2 && node server.js
```

---

## Stopping the Application

### macOS/Linux

```bash
# Kill Node.js
pkill -9 node

# Kill Python ML service
pkill -9 -f "python.*app.py"

# Kill Ollama (if running)
pkill -9 ollama
```

### Windows (PowerShell)

```powershell
# Find and kill processes
Get-Process node | Stop-Process -Force
Get-Process python | Stop-Process -Force

# Or kill by port
netstat -ano | findstr :3000
taskkill /PID <PID> /F

netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

### Stop Specific Ports (macOS/Linux)

```bash
# Kill process on port 3000 (Node.js)
lsof -ti:3000 | xargs kill -9

# Kill process on port 5001 (ML service)
lsof -ti:5001 | xargs kill -9

# Kill process on port 11434 (Ollama)
lsof -ti:11434 | xargs kill -9
```

---

## Restart Commands

### Quick Restart - macOS/Linux

```bash
# Kill everything and restart
pkill -9 node; pkill -9 -f "python.*app.py"; sleep 1
cd ml-service && python3 app.py &
cd .. && node server.js
```

### Restart ML Service Only

**macOS/Linux:**
```bash
lsof -ti:5001 | xargs kill -9 2>/dev/null
cd ml-service && python3 app.py &
```

**Windows:**
```powershell
netstat -ano | findstr :5001
taskkill /PID <PID> /F
cd ml-service
python app.py
```

### Restart Node.js Only

**macOS/Linux:**
```bash
pkill -9 node
node server.js
```

**Windows:**
```powershell
Get-Process node | Stop-Process -Force
node server.js
```

---

## Health Checks

### Check All Services

**All Platforms:**
```bash
# Node.js Backend
curl http://localhost:3000/health

# ML Service
curl http://localhost:5001/health

# Ollama
curl http://localhost:11434/api/tags
```

**Windows (if curl not available):**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/health
Invoke-WebRequest -Uri http://localhost:5001/health
```

### Expected Responses

**Node.js:**
```json
{"status":"ok","timestamp":"2026-03-09T..."}
```

**ML Service:**
```json
{
    "status": "healthy",
    "models_loaded": 6,
    "available_endpoints": ["/classify", "/predict", "/anomaly", "/recommend"]
}
```

**Ollama:**
```json
{"models":[{"name":"llama3.2",...}]}
```

---

## Troubleshooting

### Port Already in Use

**macOS/Linux:**
```bash
# Check what's using the port
lsof -i :3000
lsof -i :5001

# Kill the process
lsof -ti:3000 | xargs kill -9
```

**Windows:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### ML Models Not Found

**macOS/Linux:**
```bash
# Check if models exist
ls -la ml-service/models/

# Regenerate if missing
cd ml-service
python3 generate_data.py
python3 train_models.py
```

**Windows:**
```powershell
# Check if models exist
dir ml-service\models\

# Regenerate if missing
cd ml-service
python generate_data.py
python train_models.py
```

### Node.js Module Errors

**All Platforms:**
```bash
# Reinstall dependencies
rm -rf node_modules   # macOS/Linux
rmdir /s node_modules # Windows
npm install
```

### Python Import Errors

**macOS/Linux:**
```bash
cd ml-service
pip3 install -r requirements.txt --force-reinstall
```

**Windows:**
```powershell
cd ml-service
pip install -r requirements.txt --force-reinstall
```

### Database Issues

**macOS/Linux:**
```bash
# Delete and recreate database
rm database/carbonwise.db
# Database auto-creates on server start
node server.js
```

**Windows:**
```powershell
del database\carbonwise.db
node server.js
```

---

## Service Ports Summary

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Node.js Backend | 3000 | http://localhost:3000 | Main application |
| ML Microservice | 5001 | http://localhost:5001 | Machine learning |
| Ollama LLM | 11434 | http://localhost:11434 | Language model |

---

## Directory Structure

```
CarbonWise/
├── server.js           # Main entry point
├── package.json        # Node.js dependencies
├── seed-users.js       # Demo user generator
│
├── database/           # Database files
│   ├── db.js           # Database module
│   └── carbonwise.db   # SQLite database (auto-created)
│
├── public/             # Frontend files
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── routes/             # API routes
│   ├── activities.js
│   ├── auth.js
│   ├── insights.js
│   └── ...
│
├── utils/              # Utility modules
│   ├── ml-client.js    # ML service client
│   ├── ollama-client.js # LLM client
│   └── ...
│
├── ml-service/         # Python ML microservice
│   ├── app.py          # Flask API
│   ├── generate_data.py
│   ├── train_models.py
│   ├── requirements.txt
│   ├── data/           # Training data
│   └── models/         # Trained models
│
└── docs/               # Documentation
    ├── ML-LLM-ARCHITECTURE.md
    └── STARTUP-GUIDE.md
```

---

## Quick Reference Card

### Start Everything

**macOS/Linux:**
```bash
cd ml-service && python3 app.py &
cd .. && node server.js
```

**Windows (2 terminals):**
```powershell
# Terminal 1
cd ml-service && python app.py

# Terminal 2
node server.js
```

### Stop Everything

**macOS/Linux:**
```bash
pkill -9 node; pkill -9 -f "python.*app.py"
```

**Windows:**
```powershell
Get-Process node, python | Stop-Process -Force
```

### Check Everything

```bash
curl localhost:3000/health && curl localhost:5001/health
```

### Open Application

```
http://localhost:3000
```

---

## Development Mode

### Watch for Changes (Node.js)

**All Platforms:**
```bash
# Install nodemon globally
npm install -g nodemon

# Run with auto-restart
nodemon server.js
```

### Debug Mode

**macOS/Linux:**
```bash
DEBUG=* node server.js
python3 app.py --debug
```

**Windows:**
```powershell
$env:DEBUG="*"
node server.js
```

---

## Production Considerations

For production deployment, consider:

1. **Environment Variables**
   
   **macOS/Linux:**
   ```bash
   export NODE_ENV=production
   export JWT_SECRET=your-secure-secret
   ```
   
   **Windows:**
   ```powershell
   $env:NODE_ENV="production"
   $env:JWT_SECRET="your-secure-secret"
   ```

2. **Process Manager (PM2)**
   ```bash
   npm install -g pm2
   pm2 start server.js
   pm2 start ml-service/app.py --interpreter python3
   ```

3. **Reverse Proxy (nginx)**
   - Route both services through nginx
   - Enable HTTPS
   - Add rate limiting

4. **Database**
   - Consider PostgreSQL or MySQL for production
   - Implement proper backups
