#!/bin/bash
# Test ML Integration

echo "=== Testing ML Integration ==="

# Test ML service directly
echo "Testing ML service..."
CLASSIFY=$(curl -s http://localhost:5001/classify -X POST -H 'Content-Type: application/json' -d '{"transport_pct": 70, "electricity_pct": 15, "food_pct": 10, "waste_pct": 5}')
echo "Classification result:"
echo "$CLASSIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  Cluster: {d['cluster_name']} (confidence: {d['confidence']*100:.0f}%)\")"

# Register test user
echo ""
echo "Registering test user..."
REGISTER=$(curl -s http://localhost:3000/api/auth/register -X POST -H 'Content-Type: application/json' -d '{"username":"mlfinaltest","email":"mlfinaltest@test.com","password":"test123"}')
TOKEN=$(echo "$REGISTER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
echo "Got token: ${TOKEN:0:50}..."

# Add activities
echo ""
echo "Adding test activities..."
curl -s -X POST http://localhost:3000/api/activities -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"category":"transport","type":"car","amount":100,"unit":"km","date":"2026-03-01","description":"Long commute"}' > /dev/null
curl -s -X POST http://localhost:3000/api/activities -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"category":"transport","type":"car","amount":75,"unit":"km","date":"2026-03-02","description":"Weekend drive"}' > /dev/null
curl -s -X POST http://localhost:3000/api/activities -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"category":"electricity","type":"electricity","amount":20,"unit":"kWh","date":"2026-03-03","description":"Home energy"}' > /dev/null
curl -s -X POST http://localhost:3000/api/activities -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"category":"food","type":"beef","amount":0.8,"unit":"kg","date":"2026-03-04","description":"Steak dinner"}' > /dev/null
echo "Added 4 activities"

# Get detailed report with ML analysis
echo ""
echo "Getting detailed report with ML analysis..."
REPORT=$(curl -s "http://localhost:3000/api/insights/report/detailed" -H "Authorization: Bearer $TOKEN")

# Parse and display ML results
echo ""
echo "=== ML Analysis Results ==="
echo "$REPORT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ml = d.get('mlAnalysis', {})

if not ml:
    print('ML analysis not in response')
    sys.exit(1)

if not ml.get('available'):
    print(f\"ML not available: {ml.get('reason', 'unknown')}\")
    sys.exit(1)

print('ML Analysis Available!')

profile = ml.get('userProfile', {})
if profile:
    print(f\"\\nUser Profile: {profile.get('cluster', 'N/A')}\")
    print(f\"  Confidence: {profile.get('confidence', 0)*100:.0f}%\")
    print(f\"  Description: {profile.get('description', 'N/A')}\")

pred = ml.get('prediction', {})
if pred:
    print(f\"\\nEmission Predictions:\")
    print(f\"  Daily: {pred.get('daily', 0):.2f} kg CO2\")
    print(f\"  Weekly: {pred.get('weekly', 0):.2f} kg CO2\")
    print(f\"  Monthly: {pred.get('monthly', 0):.2f} kg CO2\")

anom = ml.get('anomaly', {})
if anom:
    print(f\"\\nAnomaly Detection: {'Yes' if anom.get('isAnomaly') else 'No'}\")
    if anom.get('reason'):
        print(f\"  Reason: {anom.get('reason')}\")

recs = ml.get('recommendations', {})
if recs and recs.get('items'):
    print(f\"\\nML Recommendations ({recs.get('cluster', 'N/A')} cluster):\")
    for r in recs['items'][:3]:
        print(f\"  - {r.get('action', 'N/A')} ({r.get('potential_reduction', 'N/A')} reduction)\")
    print(f\"\\nTotal potential reduction: {recs.get('totalPotentialReduction', 0)}%\")

print('\\n=== Test Complete ===')
"
