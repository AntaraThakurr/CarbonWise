// CarbonWise - Full Stack Application
// API Integration & Frontend Logic

// ==================== API HELPER ====================
const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Handle auth errors (401 & 403) on non-auth endpoints
            // Auth endpoints (login/register) should show their own error messages
            if ((response.status === 401 || response.status === 403) && !endpoint.startsWith('/auth/')) {
                logout();
                throw new Error('Session expired. Please login again.');
            }
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ==================== DATE HELPERS ====================
// Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
function formatLocalDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==================== UNIT CONVERSION ====================
function convertEmissions(valueKg) {
    return parseFloat(valueKg).toFixed(1);
}

function getEmissionUnit() {
    return 'kg';
}

function formatEmissions(valueKg, includeUnit = true) {
    const converted = convertEmissions(valueKg);
    if (includeUnit) {
        return `${converted} ${getEmissionUnit()} CO₂`;
    }
    return converted;
}

// ==================== AUTH STATE ====================
function isLoggedIn() {
    return !!localStorage.getItem('token');
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function setAuthState(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    updateAuthUI();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    resetAllDisplays(); // Reset all stats and visualizations
    showSection('dashboard');
    showToast('Logged out successfully');
}

function resetAllDisplays() {
    // Reset dashboard stats
    const statElements = {
        'today-emissions': '0',
        'weekly-average': '0',
        'monthly-total': '0',
        'total-emissions': '0',
        'annual-emissions': '0.00',
        'streak-count': '0',
        'nav-streak': '0',
        'level-number': 'Level 1',
        'level-title': 'Eco Beginner',
        'total-xp': '0',
        'badge-count': '0',
        'dropdown-level': '1',
        'dropdown-xp': '0'
    };
    
    Object.entries(statElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    
    // Reset progress bars
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => bar.style.width = '0%');
    
    // Reset XP progress text
    const xpText = document.getElementById('level-progress-text');
    if (xpText) xpText.textContent = '0 / 100 XP to Level 2';
    
    // Clear charts
    if (typeof chartInstances !== 'undefined') {
        Object.keys(chartInstances).forEach(key => {
            if (chartInstances[key]) {
                chartInstances[key].destroy();
                delete chartInstances[key];
            }
        });
    }
    
    // Clear activity log
    const activityList = document.getElementById('activity-list');
    if (activityList) {
        activityList.innerHTML = '<div class="empty-state"><p>Please login to view your activity log.</p></div>';
    }
    
    // Clear goals
    const goalsGrid = document.getElementById('goals-grid');
    if (goalsGrid) {
        goalsGrid.innerHTML = '<div class="empty-state"><p>Please login to set and track goals.</p></div>';
    }
    
    // Clear badges
    const badgesGrid = document.getElementById('badges-grid');
    if (badgesGrid) {
        badgesGrid.innerHTML = '<div class="empty-state"><p>Please login to view achievements.</p></div>';
    }
    
    // Clear leaderboard
    const leaderboard = document.getElementById('leaderboard-list');
    if (leaderboard) {
        leaderboard.innerHTML = '<div class="empty-state"><p>Please login to view leaderboard.</p></div>';
    }
}

function updateAuthUI() {
    const loggedIn = isLoggedIn();
    const user = getUser();
    
    const loggedOutState = document.getElementById('nav-user-logged-out');
    const loggedInState = document.getElementById('nav-user-logged-in');
    
    if (loggedOutState) loggedOutState.style.display = loggedIn ? 'none' : 'flex';
    if (loggedInState) loggedInState.style.display = loggedIn ? 'flex' : 'none';
    
    if (loggedIn && user) {
        const navUsername = document.getElementById('nav-username');
        const dropdownLevel = document.getElementById('dropdown-level');
        const dropdownXP = document.getElementById('dropdown-xp');
        const streakCount = document.getElementById('streak-count');
        
        if (navUsername) navUsername.textContent = user.name || user.username || 'User';
        if (dropdownLevel) dropdownLevel.textContent = user.level || 1;
        if (dropdownXP) dropdownXP.textContent = user.xp || 0;
        if (streakCount) streakCount.textContent = user.streak || 0;
    }
}

// ==================== AUTH MODAL ====================
function openAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('active');
        switchAuthTab(tab);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    
    if (loginForm) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    }
    if (registerForm) {
        document.getElementById('register-username').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-confirm').value = '';
    }
    
    // Clear error messages
    if (loginError) {
        loginError.textContent = '';
        loginError.classList.remove('show');
    }
    if (registerError) {
        registerError.textContent = '';
        registerError.classList.remove('show');
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    const tabBtn = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
    const form = document.getElementById(`${tab}-form`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (form) form.classList.add('active');
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    // Clear previous error
    errorEl.textContent = '';
    errorEl.classList.remove('show');
    
    if (!email || !password) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.add('show');
        return;
    }
    
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        setAuthState(data.token, data.user);
        closeAuthModal();
        loadDashboard();
        showToast('Welcome back!', 'success');
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('show');
    }
}

async function handleRegister() {
    const name = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    const errorEl = document.getElementById('register-error');
    
    // Clear previous error
    errorEl.textContent = '';
    errorEl.classList.remove('show');
    
    if (!name || !email || !password || !confirmPassword) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.add('show');
        return;
    }
    
    if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.add('show');
        return;
    }
    
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.add('show');
        return;
    }
    
    try {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        
        setAuthState(data.token, data.user);
        closeAuthModal();
        loadDashboard();
        showToast('Welcome to CarbonWise!', 'success');
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('show');
    }
}

// ==================== NAVIGATION ====================
function showSection(sectionId) {
    // Check if section requires auth
    const protectedSections = ['goals', 'insights'];
    if (protectedSections.includes(sectionId) && !isLoggedIn()) {
        openAuthModal('login');
        return;
    }
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    
    const section = document.getElementById(sectionId);
    const navLink = document.querySelector(`.nav-links a[data-section="${sectionId}"]`);
    
    if (section) section.classList.add('active');
    if (navLink) navLink.classList.add('active');
    
    // Load section data
    switch(sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'log':
            loadActivityLog();
            break;
        case 'insights':
            // Show placeholder - user must click Generate AI Analysis button
            showInsightsPlaceholder();
            break;
        case 'goals':
            loadGoals();
            loadUserProfile();
            loadLeaderboard();
            // Always refresh XP history data when switching to goals
            xpHistoryOffset = 0;
            loadXPHistory();
            break;
    }
}

// ==================== DASHBOARD ====================
let emissionsChart = null;
let categoryChart = null;

async function loadDashboard() {
    console.log('loadDashboard called, isLoggedIn:', isLoggedIn());
    if (!isLoggedIn()) {
        showDemoData();
        return;
    }
    
    try {
        const stats = await apiRequest('/stats/dashboard');
        console.log('Dashboard stats received:', stats);
        updateDashboardStats(stats);
        await loadChartData();
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showDemoData();
    }
}

function showDemoData() {
    document.getElementById('today-emissions').textContent = '0.0';
    document.getElementById('week-emissions').textContent = '0.0';
    document.getElementById('month-emissions').textContent = '0.0';
    document.getElementById('global-comparison').textContent = '--%';
    
    // Reset trend indicators
    ['today-trend', 'week-trend', 'month-trend', 'global-trend'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = 'stat-trend';
            el.innerHTML = '<i class="fas fa-minus"></i> <span>--</span>';
        }
    });
}

function updateTrendIndicator(elementId, change, trend, label) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const isDown = trend === 'down' || change <= 0;
    const absChange = Math.abs(change || 0);
    
    el.className = `stat-trend ${isDown ? 'down' : 'up'}`;
    el.innerHTML = `
        <i class="fas fa-arrow-${isDown ? 'down' : 'up'}"></i> 
        <span>${absChange}% ${label}</span>
    `;
}

function updateDashboardStats(stats) {
    console.log('updateDashboardStats called with:', stats);
    const todayEl = document.getElementById('today-emissions');
    const weekEl = document.getElementById('week-emissions');
    const monthEl = document.getElementById('month-emissions');
    const globalEl = document.getElementById('global-comparison');
    
    console.log('Elements found:', { todayEl: !!todayEl, weekEl: !!weekEl, monthEl: !!monthEl, globalEl: !!globalEl });
    
    // Update values with unit conversion
    if (todayEl) {
        todayEl.textContent = convertEmissions(stats.today?.emissions || 0);
        console.log('Set today-emissions to:', todayEl.textContent);
    }
    if (weekEl) {
        weekEl.textContent = convertEmissions(stats.week?.emissions || 0);
        console.log('Set week-emissions to:', weekEl.textContent);
    }
    if (monthEl) {
        monthEl.textContent = convertEmissions(stats.month?.emissions || 0);
        console.log('Set month-emissions to:', monthEl.textContent);
    }
    if (globalEl) {
        const comparison = stats.comparison?.global || 0;
        globalEl.textContent = `${comparison > 0 ? '+' : ''}${comparison}%`;
    }
    
    // Update unit labels
    const unitLabel = `${getEmissionUnit()} CO₂`;
    ['today-unit', 'week-unit', 'month-unit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = unitLabel;
    });
    
    // Update trend indicators
    updateTrendIndicator('today-trend', stats.today?.change, stats.today?.trend, 'vs yesterday');
    updateTrendIndicator('week-trend', stats.week?.change, stats.week?.trend, 'vs last week');
    updateTrendIndicator('month-trend', stats.month?.change, stats.month?.trend, 'vs last month');
    
    // Update global trend
    const globalTrend = document.getElementById('global-trend');
    if (globalTrend && stats.comparison) {
        const isBelow = stats.comparison.global < 0;
        globalTrend.className = `stat-trend ${isBelow ? 'down' : 'up'}`;
        globalTrend.innerHTML = isBelow 
            ? '<i class="fas fa-leaf"></i> <span>Great job!</span>'
            : '<i class="fas fa-exclamation-triangle"></i> <span>Above average</span>';
    }
    
    // Update user stats
    if (stats.user) {
        const user = getUser();
        if (user) {
            user.xp = stats.user.xp;
            user.level = stats.user.level;
            user.streak = stats.user.streak;
            localStorage.setItem('user', JSON.stringify(user));
            updateAuthUI();
        }
    }
    
    // Update comparison section
    updateUserComparison(stats);
}

function updateUserComparison(stats) {
    const userEmissionsBar = document.getElementById('user-emissions-bar');
    const userEmissionsValue = document.getElementById('user-emissions-value');
    const comparisonMessage = document.getElementById('comparison-message');
    
    if (!userEmissionsBar || !userEmissionsValue) return;
    
    // Calculate annual emissions based on month data (multiply by 12 to estimate yearly)
    const monthEmissions = parseFloat(stats.month?.emissions) || 0;
    const yearlyEstimate = (monthEmissions * 12 / 1000).toFixed(1); // Convert kg to tons
    
    // Target is 2 tons/year, max reference is 8 tons
    const maxReference = 8; // 8 tons as max for scale
    const barWidth = Math.min((yearlyEstimate / maxReference) * 100, 100);
    
    userEmissionsBar.style.width = `${barWidth}%`;
    userEmissionsValue.textContent = `${yearlyEstimate} tons/year`;
    
    if (comparisonMessage) {
        const target = 2.0; // 2030 target in tons
        if (yearlyEstimate <= target) {
            comparisonMessage.textContent = '🎉 Great job! You\'re meeting the 2030 climate target!';
            comparisonMessage.style.color = 'var(--success-color)';
        } else {
            const reduction = ((yearlyEstimate - target) / yearlyEstimate * 100).toFixed(0);
            comparisonMessage.textContent = `Reduce emissions by ${reduction}% to meet the 2030 target.`;
            comparisonMessage.style.color = 'var(--warning-color)';
        }
    }
}

// Chart navigation state
let currentChartRange = 'week';
let currentChartOffset = 0; // 0 = current period, 1 = previous period, etc.

async function loadChartData(range = currentChartRange, offset = currentChartOffset) {
    currentChartRange = range;
    currentChartOffset = offset;
    
    try {
        const chartData = await apiRequest(`/stats/charts?range=${range}&offset=${offset}`);
        updateEmissionsChart(chartData.timeline || chartData);
        updateCategoryChart(chartData.categories || []);
        updateChartPeriodLabel(range, offset, chartData.periodLabel);
        updateChartNavButtons();
    } catch (error) {
        console.error('Failed to load chart data:', error);
    }
}

function updateChartPeriodLabel(range, offset, serverLabel) {
    const labelEl = document.getElementById('chart-period-label');
    if (!labelEl) return;
    
    if (serverLabel) {
        labelEl.textContent = serverLabel;
        return;
    }
    
    const now = new Date();
    let label = '';
    
    if (range === 'week') {
        if (offset === 0) {
            label = 'This Week';
        } else if (offset === 1) {
            label = 'Last Week';
        } else {
            label = `${offset} Weeks Ago`;
        }
    } else if (range === 'month') {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        if (offset === 0) {
            label = 'This Month';
        } else {
            label = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
    } else if (range === 'year') {
        const targetYear = now.getFullYear() - offset;
        if (offset === 0) {
            label = 'This Year';
        } else {
            label = `${targetYear}`;
        }
    }
    
    labelEl.textContent = label;
}

function updateChartNavButtons() {
    const prevBtn = document.getElementById('chart-prev');
    const nextBtn = document.getElementById('chart-next');
    
    // Disable next if we're at current period
    if (nextBtn) {
        nextBtn.disabled = currentChartOffset === 0;
    }
    
    // Could add a max offset limit (e.g., don't go back more than 5 years)
    if (prevBtn) {
        const maxOffset = currentChartRange === 'year' ? 5 : (currentChartRange === 'month' ? 24 : 52);
        prevBtn.disabled = currentChartOffset >= maxOffset;
    }
}

function navigateChart(direction) {
    if (direction === 'prev') {
        currentChartOffset++;
    } else if (direction === 'next' && currentChartOffset > 0) {
        currentChartOffset--;
    }
    loadChartData(currentChartRange, currentChartOffset);
}

function updateEmissionsChart(chartData) {
    const ctx = document.getElementById('emissions-chart')?.getContext('2d');
    if (!ctx) return;
    
    if (emissionsChart) {
        emissionsChart.destroy();
    }
    
    emissionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Carbon Emissions (kg CO₂)',
                data: chartData.data || [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function updateCategoryChart(categories) {
    const ctx = document.getElementById('category-chart')?.getContext('2d');
    if (!ctx) return;
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const categoryColors = {
        transport: '#3b82f6',
        energy: '#f59e0b',
        electricity: '#f59e0b',
        diet: '#ef4444',
        food: '#ef4444',
        heating: '#8b5cf6',
        waste: '#10b981',
        other: '#6b7280'
    };
    
    const labels = categories.map(c => c.category?.charAt(0).toUpperCase() + c.category?.slice(1) || 'Other');
    const data = categories.map(c => parseFloat(c.total) || 0);
    const colors = categories.map(c => categoryColors[c.category] || categoryColors.other);
    
    if (labels.length === 0) {
        labels.push('No Data');
        data.push(1);
        colors.push('#e5e7eb');
    }
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// ==================== CALCULATOR ====================
const EMISSION_FACTORS = {
    electricity: {
        coal: 0.91,
        'natural-gas': 0.42,
        mixed: 0.48,
        renewable: 0.02,
        nuclear: 0.012
    },
    transport: {
        car: { petrol: 0.21, diesel: 0.27, hybrid: 0.12, electric: 0.05 },
        bus: 0.089,
        train: 0.041,
        bike: 0,
        walk: 0,
        motorcycle: 0.103,
        plane: 0.255
    },
    heating: {
        'natural-gas': 0.20,
        oil: 0.27,
        electric: 0.12,
        'heat-pump': 0.03,
        wood: 0.05
    },
    diet: {
        'meat-heavy': 7.2,
        'average': 5.6,
        'low-meat': 4.7,
        'pescatarian': 3.9,
        'vegetarian': 3.8,
        'vegan': 2.9
    },
    waste: {
        base_per_bag: 2.5
    }
};

// Period conversion factors to convert to daily values
const PERIOD_TO_DAILY = {
    'daily': 1,
    'weekly': 1 / 7,
    'monthly': 1 / 30,
    'annually': 1 / 365
};

// Period conversion factors to convert to monthly values (for display)
const PERIOD_TO_MONTHLY = {
    'daily': 30,
    'weekly': 4.33,
    'monthly': 1,
    'annually': 1 / 12
};

// Convert a value from a given period to daily
function convertToDaily(value, period) {
    return value * (PERIOD_TO_DAILY[period] || 1);
}

// Convert a value from a given period to monthly (for display)
function convertToMonthly(value, period) {
    return value * (PERIOD_TO_MONTHLY[period] || 1);
}

// Calculator state - track selected options
let calculatorState = {
    transport: { type: null, distance: 0, period: 'weekly' },
    diet: { type: null },
    electricity: { usage: 0, source: 'mixed', period: 'monthly' },
    heating: { type: 'natural-gas', size: 0, hours: 8 },
    waste: { bags: 0, period: 'weekly' }
};

function initCalculator() {
    // Electricity calculator
    const electricityUsage = document.getElementById('electricity-usage');
    const energySource = document.getElementById('energy-source');
    const electricityPeriod = document.getElementById('electricity-period');
    
    if (electricityUsage && energySource) {
        const calcElectricity = () => {
            const usage = parseFloat(electricityUsage.value) || 0;
            const source = energySource.value;
            const period = electricityPeriod?.value || 'monthly';
            calculatorState.electricity = { usage, source, period };
            const factor = EMISSION_FACTORS.electricity[source] || 0.48;
            // Convert to monthly for display
            const monthlyUsage = convertToMonthly(usage, period);
            const result = (monthlyUsage * factor).toFixed(1);
            document.getElementById('electricity-result').textContent = result;
            updateTotalEmissions();
        };
        electricityUsage.addEventListener('input', calcElectricity);
        energySource.addEventListener('change', calcElectricity);
        electricityPeriod?.addEventListener('change', calcElectricity);
    }
    
    // Transport calculator - using .transport-card with data-type
    const transportCards = document.querySelectorAll('.transport-card');
    const transportDistance = document.getElementById('transport-distance');
    const transportPeriod = document.getElementById('transport-period');
    const fuelType = document.getElementById('fuel-type');
    const carOptions = document.getElementById('car-options');
    
    transportCards.forEach(card => {
        card.addEventListener('click', () => {
            transportCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            calculatorState.transport.type = card.dataset.type;
            
            if (carOptions) {
                carOptions.style.display = card.dataset.type === 'car' ? 'block' : 'none';
            }
            calcTransport();
        });
    });
    
    const calcTransport = () => {
        const distance = parseFloat(transportDistance?.value) || 0;
        const period = transportPeriod?.value || 'weekly';
        calculatorState.transport.distance = distance;
        calculatorState.transport.period = period;
        calculatorState.transport.fuelType = fuelType?.value || 'petrol';
        let factor = 0;
        
        if (calculatorState.transport.type === 'car') {
            factor = EMISSION_FACTORS.transport.car[calculatorState.transport.fuelType] || 0.21;
        } else if (calculatorState.transport.type) {
            factor = EMISSION_FACTORS.transport[calculatorState.transport.type] || 0;
        }
        
        // Convert to monthly for display
        const monthlyDistance = convertToMonthly(distance, period);
        const monthlyResult = (monthlyDistance * factor).toFixed(1);
        const resultEl = document.getElementById('transport-result');
        if (resultEl) resultEl.textContent = monthlyResult;
        updateTotalEmissions();
    };
    
    if (transportDistance) transportDistance.addEventListener('input', calcTransport);
    if (transportPeriod) transportPeriod.addEventListener('change', calcTransport);
    if (fuelType) fuelType.addEventListener('change', calcTransport);
    
    // Heating calculator
    const heatingType = document.getElementById('heating-type');
    const homeSize = document.getElementById('home-size');
    const heatingHours = document.getElementById('heating-hours');
    const heatingHoursValue = document.getElementById('heating-hours-value');
    
    const calcHeating = () => {
        const type = heatingType?.value || 'natural_gas';
        const size = parseFloat(homeSize?.value) || 0;
        const hours = parseFloat(heatingHours?.value) || 8;
        
        if (heatingHoursValue) heatingHoursValue.textContent = hours;
        
        const factor = EMISSION_FACTORS.heating[type] || 0.20;
        const result = ((size / 1000) * factor * hours / 8).toFixed(1);
        
        const resultEl = document.getElementById('heating-result');
        if (resultEl) resultEl.textContent = result;
        updateTotalEmissions();
    };
    
    if (heatingType) heatingType.addEventListener('change', calcHeating);
    if (homeSize) homeSize.addEventListener('input', calcHeating);
    if (heatingHours) heatingHours.addEventListener('input', calcHeating);
    
    // Diet calculator - using .diet-card with data-type
    const dietCards = document.querySelectorAll('.diet-card');
    
    dietCards.forEach(card => {
        card.addEventListener('click', () => {
            dietCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            calculatorState.diet.type = card.dataset.type;
            calcDiet();
        });
    });
    
    const calcDiet = () => {
        // Diet emission factors are per DAY - convert to monthly (multiply by 30)
        const dailyEmissions = calculatorState.diet.type ? EMISSION_FACTORS.diet[calculatorState.diet.type] : 5.6;
        let multiplier = 1;
        
        if (document.getElementById('local-food')?.checked) multiplier -= 0.1;
        if (document.getElementById('organic-food')?.checked) multiplier -= 0.05;
        if (document.getElementById('food-waste')?.checked) multiplier -= 0.15;
        
        const monthlyResult = (dailyEmissions * 30 * multiplier).toFixed(1);
        const resultEl = document.getElementById('diet-result');
        if (resultEl) resultEl.textContent = monthlyResult;
        updateTotalEmissions();
    };
    
    document.getElementById('local-food')?.addEventListener('change', calcDiet);
    document.getElementById('organic-food')?.addEventListener('change', calcDiet);
    document.getElementById('food-waste')?.addEventListener('change', calcDiet);
    
    // Waste calculator
    const wasteBags = document.getElementById('waste-bags');
    const wastePeriod = document.getElementById('waste-period');
    const singleUse = document.getElementById('single-use');
    
    const calcWaste = () => {
        const bags = parseFloat(wasteBags?.value) || 0;
        const period = wastePeriod?.value || 'weekly';
        calculatorState.waste = { bags, period };
        
        let recycleBonus = 0;
        
        if (document.getElementById('recycle-paper')?.checked) recycleBonus += 0.1;
        if (document.getElementById('recycle-plastic')?.checked) recycleBonus += 0.15;
        if (document.getElementById('recycle-glass')?.checked) recycleBonus += 0.05;
        if (document.getElementById('recycle-metal')?.checked) recycleBonus += 0.1;
        if (document.getElementById('compost')?.checked) recycleBonus += 0.2;
        
        let singleUseMultiplier = 1;
        const singleUseVal = singleUse?.value;
        if (singleUseVal === 'low') singleUseMultiplier = 0.7;
        else if (singleUseVal === 'minimal') singleUseMultiplier = 0.4;
        
        // Convert to monthly for display
        const monthlyBags = convertToMonthly(bags, period);
        const baseMonthly = monthlyBags * EMISSION_FACTORS.waste.base_per_bag;
        const monthlyResult = (baseMonthly * (1 - recycleBonus) * singleUseMultiplier).toFixed(1);
        
        const resultEl = document.getElementById('waste-result');
        if (resultEl) resultEl.textContent = monthlyResult;
        updateTotalEmissions();
    };
    
    if (wasteBags) wasteBags.addEventListener('input', calcWaste);
    if (wastePeriod) wastePeriod.addEventListener('change', calcWaste);
    if (singleUse) singleUse.addEventListener('change', calcWaste);
    
    ['recycle-paper', 'recycle-plastic', 'recycle-glass', 'recycle-metal', 'compost'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', calcWaste);
    });
    
    // Calculator tabs - using data-tab attribute
    document.querySelectorAll('.calc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.calc-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const content = document.getElementById(`calc-${tab.dataset.tab}`);
            if (content) content.classList.add('active');
        });
    });
    
    // Save calculation button
    document.getElementById('save-calculation')?.addEventListener('click', saveCalculation);
}

function updateTotalEmissions() {
    const electricity = parseFloat(document.getElementById('electricity-result')?.textContent) || 0;
    const transport = parseFloat(document.getElementById('transport-result')?.textContent) || 0;
    const heating = parseFloat(document.getElementById('heating-result')?.textContent) || 0;
    const diet = parseFloat(document.getElementById('diet-result')?.textContent) || 0;
    const waste = parseFloat(document.getElementById('waste-result')?.textContent) || 0;
    
    // All values are now monthly (each input converts to monthly via its own period selector)
    const totalMonthly = electricity + transport + heating + diet + waste;
    
    const totalEl = document.getElementById('total-emissions');
    const annualEl = document.getElementById('annual-emissions');
    const periodSelect = document.getElementById('total-period');
    const selectedPeriod = periodSelect?.value || 'monthly';
    
    // Convert monthly to selected period
    let displayValue;
    switch (selectedPeriod) {
        case 'daily':
            displayValue = totalMonthly / 30;
            break;
        case 'weekly':
            displayValue = totalMonthly / 4.33;
            break;
        case 'yearly':
            displayValue = totalMonthly * 12;
            break;
        case 'monthly':
        default:
            displayValue = totalMonthly;
            break;
    }
    
    if (totalEl) totalEl.textContent = displayValue.toFixed(1);
    // Annual = monthly * 12 months / 1000 to convert to tons
    if (annualEl) annualEl.textContent = ((totalMonthly * 12) / 1000).toFixed(2);
}

// Initialize total period selector
document.getElementById('total-period')?.addEventListener('change', updateTotalEmissions);

async function saveCalculation() {
    if (!isLoggedIn()) {
        openAuthModal('login');
        return;
    }
    
    // Get raw input values (not emissions)
    const electricityUsage = parseFloat(document.getElementById('electricity-usage')?.value) || 0;
    const electricitySource = document.getElementById('energy-source')?.value || 'mixed';
    const electricityPeriod = document.getElementById('electricity-period')?.value || 'monthly';
    const electricityEmissions = parseFloat(document.getElementById('electricity-result')?.textContent) || 0;
    
    const transportDistance = calculatorState.transport.distance || 0;
    const transportPeriod = calculatorState.transport.period || 'weekly';
    const transportType = calculatorState.transport.type;
    const transportFuelType = calculatorState.transport.fuelType || 'petrol';
    const transportEmissions = parseFloat(document.getElementById('transport-result')?.textContent) || 0;
    
    const homeSize = parseFloat(document.getElementById('home-size')?.value) || 0;
    const heatingType = document.getElementById('heating-type')?.value || 'natural-gas';
    const heatingHours = parseFloat(document.getElementById('heating-hours')?.value) || 8;
    const heatingEmissions = parseFloat(document.getElementById('heating-result')?.textContent) || 0;
    
    const dietType = calculatorState.diet.type;
    const dietEmissions = parseFloat(document.getElementById('diet-result')?.textContent) || 0;
    
    const wasteBags = parseFloat(document.getElementById('waste-bags')?.value) || 0;
    const wastePeriod = document.getElementById('waste-period')?.value || 'weekly';
    const wasteEmissions = parseFloat(document.getElementById('waste-result')?.textContent) || 0;

    // Get the display period is always monthly now
    const selectedPeriod = 'monthly';
    
    // IMPORTANT: All emissions displayed in calculator are MONTHLY values
    // We need to convert them to DAILY for consistent storage
    const convertMonthlyToDaily = (monthlyEmissions) => {
        return monthlyEmissions / 30;
    };
    
    // Format period for display
    const periodLabels = {
        'daily': '/day',
        'weekly': '/week',
        'monthly': '/month',
        'annually': '/year'
    };
    
    const activities = [];
    
    // Electricity - store daily emissions
    if (electricityUsage > 0) {
        const dailyEmissions = convertMonthlyToDaily(electricityEmissions);
        activities.push({ 
            category: 'energy', 
            activity_type: 'electricity',
            description: `Electricity - ${electricityUsage} kWh${periodLabels[electricityPeriod]}`,
            amount: electricityUsage,
            unit: 'kWh',
            emissions: dailyEmissions,
            subType: electricitySource,
            inputPeriod: electricityPeriod
        });
    }
    
    // Transport - store daily emissions
    if (transportDistance > 0 && transportType) {
        const dailyEmissions = convertMonthlyToDaily(transportEmissions);
        const dailyDistance = convertToDaily(transportDistance, transportPeriod);
        
        activities.push({ 
            category: 'transport', 
            activity_type: transportType,
            description: `${formatActivityType(transportType)} - ${transportDistance} km${periodLabels[transportPeriod]}`,
            amount: dailyDistance,
            unit: 'km',
            emissions: dailyEmissions,
            subType: transportType,
            fuelType: transportFuelType,
            inputPeriod: transportPeriod
        });
    }
    
    // Heating - store daily emissions
    if (homeSize > 0) {
        const dailyEmissions = convertMonthlyToDaily(heatingEmissions);
        activities.push({ 
            category: 'energy', 
            activity_type: 'heating',
            description: `Heating (${heatingType}) - ${homeSize} sqft`,
            amount: homeSize,
            unit: 'sqft',
            emissions: dailyEmissions,
            subType: heatingType,
            heatingHours: heatingHours,
            inputPeriod: 'daily'
        });
    }
    
    // Diet - store daily emissions (already per day in calculator logic)
    if (dietType) {
        const dailyEmissions = convertMonthlyToDaily(dietEmissions);
        activities.push({ 
            category: 'food', 
            activity_type: dietType,
            description: `Diet - ${formatActivityType(dietType)}`,
            amount: 1,
            unit: 'day',
            emissions: dailyEmissions,
            subType: dietType,
            inputPeriod: 'daily'
        });
    }
    
    // Waste - store daily emissions
    if (wasteBags > 0) {
        const dailyEmissions = convertMonthlyToDaily(wasteEmissions);
        const dailyBags = convertToDaily(wasteBags, wastePeriod);
        
        activities.push({ 
            category: 'waste', 
            activity_type: 'household_waste',
            description: `Waste - ${wasteBags} bags${periodLabels[wastePeriod]}`,
            amount: dailyBags,
            unit: 'bags',
            emissions: dailyEmissions,
            inputPeriod: wastePeriod
        });
    }
    
    if (activities.length === 0) {
        showToast('Please enter some data first', 'warning');
        return;
    }
    
    // Add today's local date to all activities
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    activities.forEach(a => a.date = localDate);
    
    try {
        let totalXP = 0;
        for (const activity of activities) {
            const result = await apiRequest('/activities', {
                method: 'POST',
                body: JSON.stringify(activity)
            });
            totalXP += result.xpEarned || 0;
        }
        
        showToast(`Saved! +${totalXP} XP earned`, 'success');
        loadDashboard();
        loadGoals();
        resetCalculator();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function resetCalculator() {
    // Reset all input fields
    const inputsToReset = [
        'electricity-usage',
        'transport-distance',
        'home-size',
        'heating-hours',
        'waste-bags'
    ];
    
    inputsToReset.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    // Reset dropdowns to defaults
    const energySource = document.getElementById('energy-source');
    if (energySource) energySource.value = 'mixed';
    
    const fuelType = document.getElementById('fuel-type');
    if (fuelType) fuelType.value = 'petrol';
    
    const heatingType = document.getElementById('heating-type');
    if (heatingType) heatingType.value = 'natural-gas';
    
    const singleUse = document.getElementById('single-use');
    if (singleUse) singleUse.value = 'sometimes';
    
    // Reset heating hours slider
    const heatingHoursValue = document.getElementById('heating-hours-value');
    if (heatingHoursValue) heatingHoursValue.textContent = '8';
    
    // Reset checkboxes
    ['local-food', 'organic-food', 'food-waste', 'recycle-paper', 'recycle-plastic', 
     'recycle-glass', 'recycle-metal', 'compost'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    
    // Remove active class from transport and diet cards
    document.querySelectorAll('.transport-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.diet-card').forEach(c => c.classList.remove('active'));
    
    // Hide car options
    const carOptions = document.getElementById('car-options');
    if (carOptions) carOptions.style.display = 'none';
    
    // Reset result displays to 0
    ['electricity-result', 'transport-result', 'heating-result', 'diet-result', 'waste-result'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
    
    // Reset totals
    const totalEl = document.getElementById('total-emissions');
    const annualEl = document.getElementById('annual-emissions');
    if (totalEl) totalEl.textContent = '0';
    if (annualEl) annualEl.textContent = '0.00';
    
    // Reset calculator state
    calculatorState = {
        transport: { type: null, distance: 0 },
        diet: { type: null },
        electricity: { usage: 0, source: 'mixed' },
        heating: { type: 'natural-gas', size: 0, hours: 8 },
        waste: { bags: 0 }
    };
}

// ==================== ACTIVITY LOG ====================
let currentLogDate = new Date();
let currentPeriod = 'daily';

async function loadActivityLog() {
    updateCurrentDateDisplay();
    
    if (!isLoggedIn()) {
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            activityList.innerHTML = '<div class="empty-state"><p>Please login to view your activity log.</p></div>';
        }
        return;
    }
    
    try {
        let url;
        if (currentPeriod === 'daily') {
            const dateStr = formatLocalDate(currentLogDate);
            url = `/activities?date=${dateStr}`;
        } else if (currentPeriod === 'weekly') {
            // Use Monday-Sunday calendar week
            const startDate = new Date(currentLogDate);
            const dayOfWeek = startDate.getDay();
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6 days from Monday
            startDate.setDate(startDate.getDate() - daysFromMonday); // Set to Monday
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6); // End of week (Sunday)
            url = `/activities?startDate=${formatLocalDate(startDate)}&endDate=${formatLocalDate(endDate)}`;
        } else if (currentPeriod === 'monthly') {
            const startDate = new Date(currentLogDate.getFullYear(), currentLogDate.getMonth(), 1);
            const endDate = new Date(currentLogDate.getFullYear(), currentLogDate.getMonth() + 1, 0);
            url = `/activities?startDate=${formatLocalDate(startDate)}&endDate=${formatLocalDate(endDate)}`;
        }
        const data = await apiRequest(url);
        renderActivityList(data.activities || []);
        updateLogSummary(data.activities || []);
    } catch (error) {
        console.error('Failed to load activities:', error);
    }
}

function updateCurrentDateDisplay() {
    const dateEl = document.getElementById('current-date');
    if (!dateEl) return;
    
    if (currentPeriod === 'daily') {
        dateEl.textContent = currentLogDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else if (currentPeriod === 'weekly') {
        // Use Monday-Sunday calendar week
        const startDate = new Date(currentLogDate);
        const dayOfWeek = startDate.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysFromMonday); // Monday
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); // Sunday
        dateEl.textContent = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (currentPeriod === 'monthly') {
        dateEl.textContent = currentLogDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
        });
    }
}

function renderActivityList(activities) {
    const container = document.getElementById('activity-list');
    if (!container) return;
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-leaf"></i>
                <p>No activities logged for this ${currentPeriod || 'day'}. Use the Calculator to log activities.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activities.map(a => {
        // Format timestamp
        const timestamp = a.created_at ? formatTimestamp(a.created_at) : '';
        // Format the display value - use description if it has details, otherwise construct from activity_type
        const displayTitle = a.description || formatActivityType(a.activity_type);
        const displayAmount = formatActivityAmount(a.amount, a.unit, a.activity_type);
        
        return `
        <div class="activity-item" data-id="${a.id}">
            <div class="activity-icon ${a.category}">
                <i class="fas ${getCategoryIcon(a.category)}"></i>
            </div>
            <div class="activity-details">
                <h4>${displayTitle}</h4>
                <p>${displayAmount}</p>
                ${timestamp ? `<span class="activity-timestamp"><i class="fas fa-clock"></i> ${timestamp}</span>` : ''}
            </div>
            <div class="activity-emissions">
                <span class="emissions-value">${convertEmissions(a.emissions)}</span>
                <span class="emissions-unit">${getEmissionUnit()} CO₂/day</span>
            </div>
            <div class="activity-actions">
                <button class="edit-btn" onclick="editActivity(${a.id}, '${a.category}', '${(a.description || a.activity_type || '').replace(/'/g, "\\'")}', ${a.amount || a.value}, '${a.unit}', '${a.date}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteActivity(${a.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `}).join('');
}

// Format timestamp for display - shows actual date and time
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        // Check if timestamp is in UTC and needs timezone adjustment
        // SQLite stores CURRENT_TIMESTAMP in UTC
        
        // Format: "Mar 9, 2026 at 2:30 PM"
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        
        return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
    } catch (e) {
        return '';
    }
}

// Format activity amount for display
function formatActivityAmount(amount, unit, activityType) {
    if (!amount && amount !== 0) return '';
    
    // For diet activities, don't show "1 day" - just show the diet type
    if (unit === 'day' && amount === 1) {
        return 'Daily diet';
    }
    
    // Round to 1 decimal place for cleaner display
    const formattedAmount = Number.isInteger(amount) ? amount : parseFloat(amount).toFixed(1);
    return `${formattedAmount} ${unit}`;
}

function updateLogSummary(activities) {
    const totalActivities = document.getElementById('total-activities');
    const totalEmissions = document.getElementById('log-total-emissions');
    
    if (totalActivities) totalActivities.textContent = activities.length;
    if (totalEmissions) {
        const total = activities.reduce((sum, a) => sum + a.emissions, 0);
        totalEmissions.textContent = `${convertEmissions(total)} ${getEmissionUnit()}`;
    }
}

// Show/hide dynamic options based on category selection
function updateActivityModalOptions() {
    const category = document.getElementById('activity-category').value;
    
    // Hide all dynamic options
    document.querySelectorAll('.dynamic-options').forEach(el => el.style.display = 'none');
    
    // Show relevant options
    if (category === 'transport') {
        document.getElementById('activity-transport-options').style.display = 'block';
        updateTransportOptions();
    } else if (category === 'energy') {
        document.getElementById('activity-energy-options').style.display = 'block';
        updateEnergyOptions();
    } else if (category === 'food') {
        document.getElementById('activity-diet-options').style.display = 'block';
    } else if (category === 'waste') {
        document.getElementById('activity-waste-options').style.display = 'block';
    }
}

// Show/hide fuel type based on transport selection
function updateTransportOptions() {
    const transportType = document.getElementById('activity-transport-type').value;
    const fuelOptions = document.getElementById('activity-fuel-options');
    if (fuelOptions) {
        fuelOptions.style.display = transportType === 'car' ? 'block' : 'none';
    }
}

// Show/hide energy source based on energy type selection
function updateEnergyOptions() {
    const energyType = document.getElementById('activity-energy-type').value;
    const elecSourceGroup = document.getElementById('activity-elec-source-group');
    const heatingSourceGroup = document.getElementById('activity-heating-source-group');
    const kwhGroup = document.getElementById('activity-kwh-group');
    const sqftGroup = document.getElementById('activity-sqft-group');
    
    if (energyType === 'electricity') {
        elecSourceGroup.style.display = 'block';
        heatingSourceGroup.style.display = 'none';
        kwhGroup.style.display = 'block';
        sqftGroup.style.display = 'none';
    } else {
        elecSourceGroup.style.display = 'none';
        heatingSourceGroup.style.display = 'block';
        kwhGroup.style.display = 'none';
        sqftGroup.style.display = 'block';
    }
}

function resetActivityModal() {
    // Reset category
    document.getElementById('activity-category').value = '';
    
    // Reset transport options
    const transportType = document.getElementById('activity-transport-type');
    if (transportType) transportType.value = 'car';
    const fuelType = document.getElementById('activity-fuel-type');
    if (fuelType) fuelType.value = 'petrol';
    const distance = document.getElementById('activity-distance');
    if (distance) distance.value = '';
    const transportPeriod = document.getElementById('activity-transport-period');
    if (transportPeriod) transportPeriod.value = 'weekly';
    
    // Reset energy options
    const energyType = document.getElementById('activity-energy-type');
    if (energyType) energyType.value = 'electricity';
    const elecSource = document.getElementById('activity-elec-source');
    if (elecSource) elecSource.value = 'mixed';
    const heatingSource = document.getElementById('activity-heating-source');
    if (heatingSource) heatingSource.value = 'natural-gas';
    const kwh = document.getElementById('activity-kwh');
    if (kwh) kwh.value = '';
    const elecPeriod = document.getElementById('activity-elec-period');
    if (elecPeriod) elecPeriod.value = 'monthly';
    const sqft = document.getElementById('activity-sqft');
    if (sqft) sqft.value = '';
    
    // Reset diet options
    const dietType = document.getElementById('activity-diet-type');
    if (dietType) dietType.value = 'average';
    
    // Reset waste options
    const wasteBags = document.getElementById('activity-waste-bags');
    if (wasteBags) wasteBags.value = '';
    const wastePeriod = document.getElementById('activity-waste-period');
    if (wastePeriod) wastePeriod.value = 'weekly';
    
    // Reset hidden fields
    document.getElementById('activity-description').value = '';
    document.getElementById('activity-value').value = '';
    document.getElementById('activity-unit').value = 'km';
    
    // Use local date to avoid timezone issues
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    document.getElementById('activity-date').value = localDate;
    
    // Hide all dynamic options
    document.querySelectorAll('.dynamic-options').forEach(el => el.style.display = 'none');
}

function openAddActivityModal() {
    if (!isLoggedIn()) {
        openAuthModal('login');
        return;
    }
    
    const modal = document.getElementById('add-activity-modal');
    if (modal) {
        // Reset to add mode
        editingActivityId = null;
        const title = modal.querySelector('.modal-header h3');
        if (title) title.textContent = 'Log Activity';
        
        // Reset form
        resetActivityModal();
        
        modal.classList.add('active');
    }
}

function closeAddActivityModal() {
    const modal = document.getElementById('add-activity-modal');
    if (modal) {
        modal.classList.remove('active');
        editingActivityId = null;
        const title = modal.querySelector('.modal-header h3');
        if (title) title.textContent = 'Log Activity';
    }
}

async function saveActivity() {
    const category = document.getElementById('activity-category').value;
    const date = document.getElementById('activity-date').value;
    
    if (!category) {
        showToast('Please select a category', 'warning');
        return;
    }
    
    let description = '';
    let value = 0;
    let unit = '';
    let emissions = 0;
    
    // Period labels for descriptions
    const periodLabels = {
        'daily': '/day',
        'weekly': '/week',
        'monthly': '/month',
        'annually': '/year'
    };
    
    // Get values based on category
    switch (category) {
        case 'transport': {
            const transportType = document.getElementById('activity-transport-type').value;
            const fuelType = document.getElementById('activity-fuel-type').value;
            const distance = parseFloat(document.getElementById('activity-distance').value);
            const period = document.getElementById('activity-transport-period')?.value || 'weekly';
            
            if (isNaN(distance) || distance <= 0) {
                showToast('Please enter a valid distance', 'warning');
                return;
            }
            
            // Format description like calculator
            const transportNames = {
                'car': 'Car', 'bus': 'Bus', 'train': 'Train', 
                'plane': 'Plane', 'bike': 'Bike', 'walk': 'Walking'
            };
            const fuelNames = {
                'petrol': 'Petrol', 'diesel': 'Diesel', 
                'hybrid': 'Hybrid', 'electric': 'Electric'
            };
            
            description = transportType === 'car' 
                ? `${transportNames[transportType]} (${fuelNames[fuelType]}) - ${distance} km${periodLabels[period]}`
                : `${transportNames[transportType]} - ${distance} km${periodLabels[period]}`;
            
            value = distance;
            unit = 'km';
            
            // Calculate emissions - convert to daily
            const transportFactors = {
                'car': { 'petrol': 0.21, 'diesel': 0.18, 'hybrid': 0.12, 'electric': 0.05 },
                'bus': 0.089, 'train': 0.041, 'plane': 0.255, 'bike': 0, 'walk': 0
            };
            
            let factor = transportType === 'car' 
                ? transportFactors.car[fuelType] || 0.21
                : transportFactors[transportType] || 0;
            
            // Convert to daily emissions
            const dailyDistance = convertToDaily(distance, period);
            emissions = dailyDistance * factor;
            break;
        }
        
        case 'energy': {
            const energyType = document.getElementById('activity-energy-type').value;
            
            if (energyType === 'electricity') {
                const elecSource = document.getElementById('activity-elec-source').value;
                const kwh = parseFloat(document.getElementById('activity-kwh').value);
                const period = document.getElementById('activity-elec-period')?.value || 'monthly';
                
                if (isNaN(kwh) || kwh <= 0) {
                    showToast('Please enter a valid kWh value', 'warning');
                    return;
                }
                
                const sourceNames = {
                    'mixed': 'Mixed Grid', 'coal': 'Coal', 'natural-gas': 'Natural Gas',
                    'nuclear': 'Nuclear', 'renewable': 'Renewable'
                };
                
                description = `Electricity (${sourceNames[elecSource]}) - ${kwh} kWh${periodLabels[period]}`;
                value = kwh;
                unit = 'kWh';
                
                const elecFactors = {
                    'mixed': 0.48, 'coal': 0.91, 'natural-gas': 0.42,
                    'nuclear': 0.012, 'renewable': 0.02
                };
                
                // Convert to daily emissions
                const dailyKwh = convertToDaily(kwh, period);
                emissions = dailyKwh * (elecFactors[elecSource] || 0.48);
            } else {
                const heatingSource = document.getElementById('activity-heating-source').value;
                const sqft = parseFloat(document.getElementById('activity-sqft').value);
                
                if (isNaN(sqft) || sqft <= 0) {
                    showToast('Please enter a valid home size', 'warning');
                    return;
                }
                
                const heatingNames = {
                    'natural-gas': 'Natural Gas', 'oil': 'Oil', 'electric': 'Electric',
                    'wood': 'Wood/Biomass', 'heat-pump': 'Heat Pump'
                };
                
                description = `Heating (${heatingNames[heatingSource]}) - ${sqft} sqft`;
                value = sqft;
                unit = 'sqft';
                
                const heatingFactors = {
                    'natural-gas': 0.20, 'oil': 0.27, 'electric': 0.12,
                    'wood': 0.05, 'heat-pump': 0.03
                };
                
                emissions = (sqft / 1000) * (heatingFactors[heatingSource] || 0.20);
            }
            break;
        }
        
        case 'food': {
            const dietType = document.getElementById('activity-diet-type').value;
            
            const dietNames = {
                'meat-heavy': 'Meat Heavy', 'average': 'Average', 'low-meat': 'Low Meat',
                'vegetarian': 'Vegetarian', 'vegan': 'Vegan'
            };
            
            description = `${dietNames[dietType]} Diet`;
            value = 1;
            unit = 'day';
            
            const dietFactors = {
                'meat-heavy': 7.2, 'average': 5.6, 'low-meat': 4.7,
                'vegetarian': 3.8, 'vegan': 2.9
            };
            
            emissions = dietFactors[dietType] || 5.6; // Daily emissions
            break;
        }
        
        case 'waste': {
            const bags = parseFloat(document.getElementById('activity-waste-bags').value);
            const period = document.getElementById('activity-waste-period')?.value || 'weekly';
            
            if (isNaN(bags) || bags < 0) {
                showToast('Please enter a valid number of bags', 'warning');
                return;
            }
            
            description = `Waste - ${bags} bags${periodLabels[period]}`;
            value = bags;
            unit = 'bags';
            
            // Convert to daily emissions
            const dailyBags = convertToDaily(bags, period);
            emissions = dailyBags * 2.5;
            break;
        }
        
        default:
            showToast('Please select a valid category', 'warning');
            return;
    }
    
    try {
        const isEditing = editingActivityId !== null;
        const url = isEditing ? `/activities/${editingActivityId}` : '/activities';
        const method = isEditing ? 'PUT' : 'POST';
        
        const result = await apiRequest(url, {
            method,
            body: JSON.stringify({
                category,
                description,
                activity_type: description,
                value,
                amount: value,
                unit,
                date,
                emissions
            })
        });
        
        closeAddActivityModal();
        loadActivityLog();
        loadDashboard();
        
        // Show XP earned notification with details
        const xpMsg = result.xpDetails?.leveledUp 
            ? `Activity logged! +10 XP - Level Up to ${result.xpDetails.newLevel}!`
            : `Activity logged! +10 XP`;
        showToast(isEditing ? 'Activity updated!' : xpMsg, 'success');
        
        // Always refresh XP history data (reset offset to show new entry at top)
        xpHistoryOffset = 0;
        loadXPHistory();
        
        editingActivityId = null;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteActivity(id) {
    if (!confirm('Delete this activity? This will also remove the XP earned from it.')) return;
    
    try {
        const result = await apiRequest(`/activities/${id}`, { method: 'DELETE' });
        loadActivityLog();
        loadDashboard(); // Refresh dashboard stats
        loadUserProfile(); // Refresh XP display in goals section
        
        // Refresh XP history to remove the deleted entry
        xpHistoryOffset = 0;
        loadXPHistory();
        
        // Show toast with XP deduction info
        const xpMsg = result.xpDeducted > 0 
            ? `Activity deleted. -${result.xpDeducted} XP`
            : 'Activity deleted';
        showToast(xpMsg, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

let editingActivityId = null;

// Helper to parse period from description
function parsePeriodFromDescription(description) {
    const desc = description.toLowerCase();
    if (desc.includes('/day')) return 'daily';
    if (desc.includes('/week')) return 'weekly';
    if (desc.includes('/month')) return 'monthly';
    if (desc.includes('/year')) return 'annually';
    return 'weekly'; // default
}

function editActivity(id, category, description, value, unit, date) {
    editingActivityId = id;
    
    const modal = document.getElementById('add-activity-modal');
    if (!modal) return;
    
    // Update modal title
    const title = modal.querySelector('.modal-header h3');
    if (title) title.textContent = 'Edit Activity';
    
    // Reset form first
    resetActivityModal();
    
    // Set category and trigger options display
    document.getElementById('activity-category').value = category || '';
    updateActivityModalOptions();
    
    // Parse description to populate specific fields based on category
    const descLower = (description || '').toLowerCase();
    const period = parsePeriodFromDescription(description);
    
    if (category === 'transport') {
        // Parse transport type and fuel type from description
        let transportType = 'car';
        let fuelType = 'petrol';
        
        if (descLower.includes('bus')) transportType = 'bus';
        else if (descLower.includes('train')) transportType = 'train';
        else if (descLower.includes('plane')) transportType = 'plane';
        else if (descLower.includes('bike') || descLower.includes('cycling')) transportType = 'bike';
        else if (descLower.includes('walk')) transportType = 'walk';
        
        if (descLower.includes('diesel')) fuelType = 'diesel';
        else if (descLower.includes('hybrid')) fuelType = 'hybrid';
        else if (descLower.includes('electric')) fuelType = 'electric';
        
        document.getElementById('activity-transport-type').value = transportType;
        document.getElementById('activity-fuel-type').value = fuelType;
        document.getElementById('activity-distance').value = value || '';
        const periodSelect = document.getElementById('activity-transport-period');
        if (periodSelect) periodSelect.value = period;
        updateTransportOptions();
        
    } else if (category === 'energy') {
        if (unit === 'kWh' || descLower.includes('electricity')) {
            document.getElementById('activity-energy-type').value = 'electricity';
            document.getElementById('activity-kwh').value = value || '';
            
            let elecSource = 'mixed';
            if (descLower.includes('coal')) elecSource = 'coal';
            else if (descLower.includes('natural gas') || descLower.includes('natural-gas')) elecSource = 'natural-gas';
            else if (descLower.includes('nuclear')) elecSource = 'nuclear';
            else if (descLower.includes('renewable') || descLower.includes('solar') || descLower.includes('wind')) elecSource = 'renewable';
            document.getElementById('activity-elec-source').value = elecSource;
            const periodSelect = document.getElementById('activity-elec-period');
            if (periodSelect) periodSelect.value = period;
        } else {
            document.getElementById('activity-energy-type').value = 'heating';
            document.getElementById('activity-sqft').value = value || '';
            
            let heatingSource = 'natural-gas';
            if (descLower.includes('oil')) heatingSource = 'oil';
            else if (descLower.includes('electric')) heatingSource = 'electric';
            else if (descLower.includes('wood') || descLower.includes('biomass')) heatingSource = 'wood';
            else if (descLower.includes('heat pump') || descLower.includes('heat-pump')) heatingSource = 'heat-pump';
            document.getElementById('activity-heating-source').value = heatingSource;
        }
        updateEnergyOptions();
        
    } else if (category === 'food') {
        let dietType = 'average';
        if (descLower.includes('meat heavy') || descLower.includes('meat-heavy')) dietType = 'meat-heavy';
        else if (descLower.includes('low meat') || descLower.includes('low-meat')) dietType = 'low-meat';
        else if (descLower.includes('vegetarian')) dietType = 'vegetarian';
        else if (descLower.includes('vegan')) dietType = 'vegan';
        document.getElementById('activity-diet-type').value = dietType;
        
    } else if (category === 'waste') {
        document.getElementById('activity-waste-bags').value = value || '';
        const periodSelect = document.getElementById('activity-waste-period');
        if (periodSelect) periodSelect.value = period;
    }
    
    // Set date
    document.getElementById('activity-date').value = date || '';
    
    modal.classList.add('active');
}

// ==================== INSIGHTS ====================
const aiLoadingMessages = [
    'Gathering your activity history',
    'Analyzing emission patterns',
    'Identifying optimization areas',
    'Generating personalized recommendations',
    'Preparing your insights summary'
];

let aiLoadingInterval = null;

function showAILoading(show = true) {
    const overlay = document.getElementById('ai-loading-overlay');
    const refreshBtn = document.querySelector('.refresh-insights-btn');
    const statusEl = document.getElementById('ai-loading-status');
    
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    if (refreshBtn) {
        if (show) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        } else {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    }
    
    // Cycle through loading messages
    if (show && statusEl) {
        let messageIndex = 0;
        statusEl.textContent = aiLoadingMessages[0];
        
        aiLoadingInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % aiLoadingMessages.length;
            statusEl.textContent = aiLoadingMessages[messageIndex];
        }, 3000);
    } else if (aiLoadingInterval) {
        clearInterval(aiLoadingInterval);
        aiLoadingInterval = null;
    }
}

// Show placeholder state before user clicks Generate
function showInsightsPlaceholder() {
    const container = document.querySelector('#insights .insights-grid');
    if (!container) return;
    
    if (!isLoggedIn()) {
        container.innerHTML = '<div class="empty-state"><p>Please login to view personalized insights.</p></div>';
        return;
    }
    
    // Show instruction to generate insights
    container.innerHTML = `
        <div class="empty-state insights-placeholder">
            <i class="fas fa-robot" style="font-size: 3rem; color: #9b59b6; margin-bottom: 1rem;"></i>
            <h3>AI Analysis Ready</h3>
            <p>Select a date range above and click <strong>"Generate AI Analysis"</strong> to get personalized insights for your carbon footprint.</p>
            <p class="placeholder-hint"><i class="fas fa-info-circle"></i> The analysis will consider only activities logged within your selected dates.</p>
        </div>
    `;
    
    // Reset stats to placeholder values
    resetInsightStats();
}

// Reset insight stats to placeholder state
function resetInsightStats() {
    const monthlyValue = document.getElementById('monthly-emissions-value');
    if (monthlyValue) monthlyValue.textContent = '--';
    
    const daysActive = document.getElementById('days-active');
    if (daysActive) daysActive.textContent = '--';
    
    const activityCount = document.getElementById('activity-count');
    if (activityCount) activityCount.textContent = 'Select dates & generate';
    
    const vsGlobalValue = document.getElementById('vs-global-value');
    if (vsGlobalValue) vsGlobalValue.textContent = '--%';
    
    const vsGlobalText = document.getElementById('vs-global-text');
    if (vsGlobalText) vsGlobalText.textContent = 'Generate to compare';
    
    const weeklyChange = document.getElementById('weekly-change');
    if (weeklyChange) weeklyChange.textContent = '-- vs last week';
    
    // Reset AI summary
    const summaryEl = document.querySelector('.ai-summary-text');
    if (summaryEl) summaryEl.innerHTML = 'Click "Generate AI Analysis" to get personalized insights for your selected date range.';
}

async function loadInsights(forceRefresh = false, startDate = null, endDate = null) {
    const container = document.querySelector('#insights .insights-grid');
    if (!container) return;
    
    if (!isLoggedIn()) {
        container.innerHTML = '<div class="empty-state"><p>Please login to view personalized insights.</p></div>';
        return;
    }
    
    // Show the AI loading overlay
    showAILoading(true);
    container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Generating AI analysis...</div>';
    
    try {
        // Build URL with optional date parameters
        let url = '/insights';
        const params = [];
        if (forceRefresh) params.push('refresh=true');
        if (startDate) params.push(`startDate=${startDate}`);
        if (endDate) params.push(`endDate=${endDate}`);
        if (params.length > 0) url += '?' + params.join('&');
        
        const data = await apiRequest(url);
        showAILoading(false);
        
        // Ensure data is valid before rendering
        if (data && typeof data === 'object') {
            renderInsights(data);
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('Failed to load insights:', error);
        showAILoading(false);
        container.innerHTML = '<div class="empty-state"><p>Failed to load insights. Please try again.</p></div>';
    }
}

function renderInsights(data) {
    // Render statistics first
    if (data.stats) {
        renderInsightStats(data.stats);
    }

    // Update AI summary section
    const summaryEl = document.querySelector('.ai-summary-text');
    if (summaryEl && data.aiSummary) {
        let summaryHtml = data.aiSummary.summary || 'Log more activities to get personalized insights!';
        
        // Add AI badge if insights are AI-generated
        if (data.source === 'ai') {
            summaryHtml = `<span class="ai-badge"><i class="fas fa-robot"></i> AI</span> ${summaryHtml}`;
        }
        
        summaryEl.innerHTML = summaryHtml;
    }
    
    // Update encouragement if available
    const encouragementEl = document.querySelector('.ai-encouragement');
    if (encouragementEl && data.encouragement) {
        encouragementEl.innerHTML = data.encouragement;
        encouragementEl.style.display = 'block';
    }
    
    // Update top insight highlight
    if (data.topInsight) {
        const topInsightEl = document.querySelector('.top-insight');
        if (topInsightEl) {
            const topText = typeof data.topInsight === 'string' ? data.topInsight : data.topInsight.title || data.topInsight.description;
            topInsightEl.innerHTML = `<i class="fas fa-star"></i> <strong>Top Recommendation:</strong> ${topText}`;
            topInsightEl.style.display = 'block';
        }
    }
    
    // Update insights grid with enhanced cards
    const container = document.querySelector('#insights .insights-grid');
    if (!container) return;
    
    // Combine topInsight with insights array to show all recommendations
    let allInsights = [...(data.insights || [])];
    
    // Add topInsight as first card if it exists and has category
    if (data.topInsight && typeof data.topInsight === 'object' && data.topInsight.category) {
        // Check if topInsight category is already in insights
        const topCategory = data.topInsight.category.toLowerCase();
        const alreadyHasCategory = allInsights.some(i => i.category?.toLowerCase() === topCategory);
        
        if (!alreadyHasCategory) {
            allInsights.unshift({
                ...data.topInsight,
                isTop: true
            });
        }
    }
    
    if (allInsights.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Log more activities to get personalized insights!</p></div>';
        return;
    }

    // Calculate max savings for visual scaling
    const maxSavings = Math.max(...allInsights.map(i => i.potentialSavings || 0), 50);
    
    container.innerHTML = allInsights.map((insight, index) => {
        const category = insight.category || 'general';
        const title = insight.title || 'Reduce your footprint';
        const description = insight.description || 'Take action to lower your carbon emissions.';
        const savingsPercent = insight.potentialSavings ? Math.min((insight.potentialSavings / maxSavings) * 100, 100) : 0;
        const categoryData = data.stats?.breakdown?.find(b => b.category === category);
        const isTopPriority = insight.isTop || index === 0;
        
        return `
        <div class="insight-card ${category} ${isTopPriority ? 'top-priority' : ''}" data-insight-id="${insight.id || index}">
            <div class="insight-header">
                <div class="insight-icon">
                    <i class="fas ${getInsightIcon(category)}"></i>
                </div>
                <span class="insight-category">${capitalizeFirst(category)}</span>
                ${isTopPriority ? '<span class="priority-badge"><i class="fas fa-star"></i> #1 Priority</span>' : ''}
                ${!isTopPriority && insight.potentialSavings >= 20 ? '<span class="high-impact-badge"><i class="fas fa-bolt"></i> High Impact</span>' : ''}
            </div>
            <h4>${title}</h4>
            <p class="insight-description">${description}</p>
            
            ${categoryData ? `
            <div class="insight-stats">
                <div class="insight-stat">
                    <div class="insight-stat-value">${categoryData.emissions.toFixed(1)}</div>
                    <div class="insight-stat-label">kg CO₂ this month</div>
                </div>
                <div class="insight-stat">
                    <div class="insight-stat-value">${categoryData.percentage}%</div>
                    <div class="insight-stat-label">of your footprint</div>
                </div>
            </div>
            ` : ''}
            
            ${insight.potentialSavings ? `
                <div class="insight-savings-row">
                    <div class="insight-savings">
                        <i class="fas fa-leaf"></i>
                        <span>Save <strong>${insight.potentialSavings} kg</strong> CO₂</span>
                    </div>
                </div>
                <div class="savings-bar">
                    <div class="savings-bar-fill" style="width: ${savingsPercent}%"></div>
                </div>
            ` : ''}
            
            <div class="insight-actions">
                ${getActionChips(category)}
                <button class="action-chip goal-chip" onclick='addInsightAsGoal(${JSON.stringify({category: category, title: title, potentialSavings: insight.potentialSavings || 0}).replace(/'/g, "&#39;")})'>
                    <i class="fas fa-bullseye"></i> Set as Goal
                </button>
            </div>
        </div>
    `}).join('');
    
    // Render trends
    renderTrends(data.trends || []);
    
    // Add refresh button handler
    const refreshBtn = document.querySelector('.refresh-insights-btn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            // Get current date range from pickers if available
            const startDateInput = document.getElementById('report-start-date');
            const endDateInput = document.getElementById('report-end-date');
            const startDate = startDateInput?.value || null;
            const endDate = endDateInput?.value || null;
            loadInsights(true, startDate, endDate);
        };
    }
}

function renderInsightStats(stats) {
    // Monthly emissions ring
    const monthlyValue = document.getElementById('monthly-emissions-value');
    if (monthlyValue) {
        monthlyValue.textContent = stats.totals?.monthly?.toFixed(1) || '0';
    }
    
    // Animate ring progress (max 100kg for full ring)
    const ringFill = document.querySelector('#monthly-ring .ring-fill');
    if (ringFill) {
        const percentage = Math.min((stats.totals?.monthly || 0) / 100 * 100, 100);
        ringFill.setAttribute('stroke-dasharray', `${percentage}, 100`);
    }
    
    // Weekly change
    const weeklyChange = document.getElementById('weekly-change');
    if (weeklyChange && stats.comparison) {
        const change = stats.comparison.weeklyChange;
        const isPositive = change <= 0;
        weeklyChange.textContent = `${change > 0 ? '+' : ''}${change}% vs last week`;
        weeklyChange.className = `stat-comparison ${isPositive ? 'positive' : 'negative'}`;
    }
    
    // Days active
    const daysActive = document.getElementById('days-active');
    if (daysActive) {
        daysActive.textContent = stats.totals?.daysActive || 0;
    }
    
    const activityCount = document.getElementById('activity-count');
    if (activityCount) {
        activityCount.textContent = `${stats.totals?.activityCount || 0} activities logged`;
    }
    
    // vs Global
    const vsGlobalValue = document.getElementById('vs-global-value');
    const vsGlobalText = document.getElementById('vs-global-text');
    const vsGlobalIcon = document.getElementById('vs-global-icon');
    
    if (vsGlobalValue && stats.comparison) {
        const vsGlobal = stats.comparison.vsGlobal;
        vsGlobalValue.textContent = `${vsGlobal > 0 ? '+' : ''}${vsGlobal}%`;
        
        if (vsGlobalText) {
            vsGlobalText.textContent = stats.comparison.isAboveAverage 
                ? 'Above global average' 
                : 'Below global average! 🎉';
        }
        
        if (vsGlobalIcon) {
            vsGlobalIcon.className = stats.comparison.isAboveAverage 
                ? 'stat-icon-large red' 
                : 'stat-icon-large green';
        }
    }
    
    // Category breakdown chart
    renderCategoryBreakdown(stats.breakdown || []);
}

let categoryPieChart = null;
const CATEGORY_COLORS = {
    transport: '#3498db',
    electricity: '#f39c12',
    energy: '#f39c12',
    diet: '#27ae60',
    food: '#27ae60',
    heating: '#e74c3c',
    waste: '#9b59b6'
};

function renderCategoryBreakdown(breakdown) {
    const chartCanvas = document.getElementById('category-pie-chart');
    const legendContainer = document.querySelector('#insights .breakdown-legend');
    
    if (!chartCanvas) return;
    
    if (breakdown.length === 0) {
        if (legendContainer) legendContainer.innerHTML = '<p class="empty-state">No data yet</p>';
        return;
    }
    
    // Prepare chart data
    const labels = breakdown.map(b => capitalizeFirst(b.category));
    const values = breakdown.map(b => b.emissions);
    const colors = breakdown.map(b => CATEGORY_COLORS[b.category] || '#95a5a6');
    
    // Destroy existing chart
    if (categoryPieChart) {
        categoryPieChart.destroy();
    }
    
    // Create doughnut chart
    categoryPieChart = new Chart(chartCanvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.raw.toFixed(1)} kg CO₂`
                    }
                }
            }
        }
    });
    
    // Render legend with progress bars
    if (legendContainer) {
        legendContainer.innerHTML = breakdown.map(b => `
            <div class="legend-item">
                <div class="legend-color" style="background: ${CATEGORY_COLORS[b.category] || '#95a5a6'}"></div>
                <div class="legend-info">
                    <span class="legend-label">${capitalizeFirst(b.category)}</span>
                    <div class="legend-bar">
                        <div class="legend-bar-fill" style="width: ${b.percentage}%; background: ${CATEGORY_COLORS[b.category] || '#95a5a6'}"></div>
                    </div>
                    <span class="legend-value">${b.emissions.toFixed(1)} kg (${b.percentage}%)</span>
                </div>
            </div>
    `).join('');
    }
}

function getActionChips(category) {
    const actions = {
        transport: [
            { icon: 'fa-bicycle', label: 'Try cycling' },
            { icon: 'fa-train', label: 'Use transit' },
            { icon: 'fa-users', label: 'Carpool' }
        ],
        electricity: [
            { icon: 'fa-solar-panel', label: 'Go solar' },
            { icon: 'fa-lightbulb', label: 'Use LEDs' },
            { icon: 'fa-power-off', label: 'Unplug devices' }
        ],
        energy: [
            { icon: 'fa-solar-panel', label: 'Go solar' },
            { icon: 'fa-lightbulb', label: 'Use LEDs' },
            { icon: 'fa-power-off', label: 'Unplug devices' }
        ],
        diet: [
            { icon: 'fa-leaf', label: 'Try meatless' },
            { icon: 'fa-store', label: 'Buy local' },
            { icon: 'fa-recycle', label: 'Reduce waste' }
        ],
        food: [
            { icon: 'fa-leaf', label: 'Try meatless' },
            { icon: 'fa-store', label: 'Buy local' },
            { icon: 'fa-recycle', label: 'Reduce waste' }
        ],
        waste: [
            { icon: 'fa-recycle', label: 'Recycle more' },
            { icon: 'fa-seedling', label: 'Compost' },
            { icon: 'fa-shopping-bag', label: 'Reusable bags' }
        ]
    };
    
    const categoryActions = actions[category] || actions.transport;
    return categoryActions.map(a => 
        `<button class="action-chip" onclick="showActionTip('${a.label}')">
            <i class="fas ${a.icon}"></i> ${a.label}
        </button>`
    ).join('');
}

function showActionTip(action) {
    showToast(`💡 Tip: ${action} can help reduce your carbon footprint!`, 'info');
}

// Track in-progress goal creation to prevent duplicates
let isCreatingGoal = false;

// Add insight recommendation as a goal
async function addInsightAsGoal(insight) {
    if (!isLoggedIn()) {
        openAuthModal('login');
        return;
    }
    
    // Prevent multiple clicks
    if (isCreatingGoal) {
        showToast('Please wait, creating goal...', 'info');
        return;
    }
    
    // Map insight categories to goal types
    const categoryToGoalType = {
        'transport': 'reduce-transport',
        'energy': 'reduce-energy',
        'electricity': 'reduce-energy',
        'diet': 'diet-change',
        'food': 'diet-change',
        'waste': 'zero-waste'
    };
    
    const goalType = categoryToGoalType[insight.category] || 'reduce-transport';
    const targetValue = insight.potentialSavings || 10; // Default to 10 if no savings specified
    
    const goalTitles = {
        'reduce-transport': 'Green Transport Challenge',
        'reduce-energy': 'Clean Energy Challenge',
        'diet-change': 'Plant-Based Diet Challenge',
        'zero-waste': 'Zero Waste Challenge'
    };
    
    const goalTitle = insight.title || goalTitles[goalType];
    const durationDays = 30; // Default to 1 month
    
    // Check for existing active goal with same type
    try {
        const existingGoals = await apiRequest('/goals');
        const duplicateGoal = (existingGoals.goals || []).find(
            g => g.type === goalType && g.status === 'active'
        );
        
        if (duplicateGoal) {
            showToast(`You already have an active "${goalTitles[goalType] || goalType}" goal!`, 'warning');
            showSection('goals');
            return;
        }
    } catch (error) {
        console.error('Failed to check existing goals:', error);
    }
    
    // Calculate XP reward
    const baseXP = 50;
    const difficultyMultiplier = Math.min(3, 1 + (targetValue / 20));
    const xpReward = Math.round(baseXP * difficultyMultiplier);
    
    isCreatingGoal = true;
    
    try {
        await apiRequest('/goals', {
            method: 'POST',
            body: JSON.stringify({
                title: goalTitle,
                target_value: targetValue,
                duration_days: durationDays,
                type: goalType,
                xp_reward: xpReward
            })
        });
        
        showToast(`Goal "${goalTitle}" created! Target: ${targetValue} kg CO₂`, 'success');
        
        // Switch to goals section
        showSection('goals');
        loadGoals();
    } catch (error) {
        showToast(error.message || 'Failed to create goal', 'error');
    } finally {
        isCreatingGoal = false;
    }
}

function renderTrends(trends) {
    const container = document.getElementById('trend-cards');
    if (!container) return;
    
    if (trends.length === 0) {
        container.innerHTML = '<p class="empty-state">Log more activities to see your trends!</p>';
        return;
    }
    
    container.innerHTML = trends.map(trend => {
        const trendClass = trend.trend === 'positive' ? 'positive' : 
                          trend.trend === 'negative' ? 'negative' : 'neutral';
        const trendIcon = trend.trend === 'positive' ? 'fa-arrow-down' :
                         trend.trend === 'negative' ? 'fa-arrow-up' : 'fa-minus';
        
        return `
            <div class="trend-card ${trendClass}">
                <i class="fas ${trendIcon}"></i>
                <div class="trend-info">
                    <h4>${capitalizeFirst(trend.category)} ${trend.changePercent > 0 ? 'up' : trend.changePercent < 0 ? 'down' : 'stable'} ${Math.abs(trend.changePercent)}%</h4>
                    <p>${trend.message}</p>
                </div>
            </div>
        `;
    }).join('');
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getInsightIcon(category) {
    if (!category) return 'fa-lightbulb';
    const icons = {
        transport: 'fa-car',
        energy: 'fa-bolt',
        food: 'fa-utensils',
        diet: 'fa-utensils',
        waste: 'fa-recycle',
        shopping: 'fa-shopping-bag'
    };
    return icons[category] || 'fa-lightbulb';
}

// ==================== DETAILED REPORT ====================
let currentReportData = null;

function openReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function generateDetailedReport() {
    if (!isLoggedIn()) {
        openAuthModal('login');
        return;
    }
    
    // Get date range
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    
    const startDate = startDateInput?.value || '';
    const endDate = endDateInput?.value || '';
    
    // Validate dates if provided
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            alert('Start date must be before end date');
            return;
        }
        
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (daysDiff > 31) {
            alert('Date range cannot exceed 31 days');
            return;
        }
    }
    
    openReportModal();
    
    const loadingEl = document.getElementById('report-loading');
    const contentEl = document.getElementById('report-content');
    const statusEl = document.getElementById('report-loading-status');
    
    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
    
    const loadingMessages = [
        'Analyzing your carbon footprint data...',
        'Calculating category breakdowns...',
        'Identifying optimization opportunities...',
        'Generating personalized recommendations...',
        'Comparing current vs optimized usage...',
        'Finalizing your detailed report...'
    ];
    
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
        if (statusEl && messageIndex < loadingMessages.length) {
            statusEl.textContent = loadingMessages[messageIndex];
            messageIndex++;
        }
    }, 1500);
    
    try {
        // Build query string with date parameters
        let url = '/insights/report/detailed';
        const params = [];
        if (startDate) params.push(`startDate=${startDate}`);
        if (endDate) params.push(`endDate=${endDate}`);
        if (params.length > 0) url += '?' + params.join('&');
        
        const data = await apiRequest(url);
        currentReportData = data;
        
        clearInterval(messageInterval);
        if (statusEl) statusEl.textContent = 'Report ready!';
        
        setTimeout(() => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            renderDetailedReport(data);
        }, 500);
        
    } catch (error) {
        clearInterval(messageInterval);
        console.error('Failed to generate report:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) {
            contentEl.style.display = 'block';
            contentEl.innerHTML = `
                <div class="report-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Generate Report</h3>
                    <p>${error.message || 'Please log some activities first to generate a report.'}</p>
                    <button class="btn-primary" onclick="closeReportModal()">Close</button>
                </div>
            `;
        }
    }
}

function renderDetailedReport(data) {
    // Set report date
    const dateEl = document.getElementById('report-date');
    if (dateEl) {
        dateEl.textContent = new Date(data.generatedAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Render executive summary
    renderSummarySection(data);
    
    // Render ML insights (if available)
    renderMLInsights(data);
    
    // Render comparison chart
    renderComparisonSection(data);
    
    // Render category breakdown
    renderReportCategories(data);
    
    // Render fixes
    renderFixesSection(data);
    
    // Render trends
    renderTrendsAnalysis(data);
    
    // Render action plan
    renderActionPlan(data);
}

function renderMLInsights(data) {
    const section = document.getElementById('ml-insights-section');
    const content = document.getElementById('ml-insights-content');
    
    if (!section || !content) return;
    
    const ml = data.mlAnalysis;
    
    // Hide section if ML not available
    if (!ml || !ml.available) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    // Build ML insights display
    let html = '<div class="ml-insights-grid">';
    
    // User Profile Classification
    if (ml.userProfile) {
        const clusterName = ml.userProfile.cluster || 'balanced';
        const clusterDisplay = clusterName.replace('_', '-').split('-').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
        const confidence = (ml.userProfile.confidence * 100).toFixed(0);
        
        html += `
            <div class="ml-card profile-card">
                <div class="ml-card-icon"><i class="fas fa-user-tag"></i></div>
                <div class="ml-card-content">
                    <h4>Your Profile</h4>
                    <p class="ml-value">${clusterDisplay}</p>
                    <p class="ml-confidence">Confidence: ${confidence}%</p>
                    <p class="ml-description">${ml.userProfile.description || ''}</p>
                </div>
            </div>
        `;
    }
    
    // Emission Prediction
    if (ml.prediction) {
        html += `
            <div class="ml-card prediction-card">
                <div class="ml-card-icon"><i class="fas fa-chart-line"></i></div>
                <div class="ml-card-content">
                    <h4>AI Predictions</h4>
                    <table class="ml-prediction-table">
                        <tr>
                            <td>Daily</td>
                            <td class="ml-value">${ml.prediction.daily?.toFixed(1) || '—'} kg</td>
                        </tr>
                        <tr>
                            <td>Weekly</td>
                            <td class="ml-value">${ml.prediction.weekly?.toFixed(1) || '—'} kg</td>
                        </tr>
                        <tr>
                            <td>Monthly</td>
                            <td class="ml-value">${ml.prediction.monthly?.toFixed(1) || '—'} kg</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Anomaly Detection
    if (ml.anomaly) {
        const anomalyClass = ml.anomaly.isAnomaly ? 'warning' : 'normal';
        const anomalyIcon = ml.anomaly.isAnomaly ? 'exclamation-triangle' : 'check-circle';
        const anomalyText = ml.anomaly.isAnomaly ? 'Unusual Pattern Detected' : 'Normal Patterns';
        
        html += `
            <div class="ml-card anomaly-card ${anomalyClass}">
                <div class="ml-card-icon"><i class="fas fa-${anomalyIcon}"></i></div>
                <div class="ml-card-content">
                    <h4>Pattern Analysis</h4>
                    <p class="ml-value ${anomalyClass}">${anomalyText}</p>
                    ${ml.anomaly.reason ? `<p class="ml-reason">${ml.anomaly.reason}</p>` : ''}
                    ${ml.anomaly.recommendation ? `<p class="ml-recommendation">${ml.anomaly.recommendation}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    
    // ML Recommendations
    if (ml.recommendations && ml.recommendations.items && ml.recommendations.items.length > 0) {
        html += `
            <div class="ml-recommendations">
                <h4><i class="fas fa-robot"></i> AI-Powered Recommendations</h4>
                <p class="ml-potential">Total potential reduction: <strong>${ml.recommendations.totalPotentialReduction || 0}%</strong></p>
                <div class="ml-rec-list">
        `;
        
        for (const rec of ml.recommendations.items.slice(0, 4)) {
            const priorityClass = rec.priority === 'high' ? 'high' : rec.priority === 'medium' ? 'medium' : 'low';
            html += `
                <div class="ml-rec-item ${priorityClass}">
                    <div class="ml-rec-action">${rec.action}</div>
                    <div class="ml-rec-meta">
                        <span class="ml-rec-reduction">−${rec.potential_reduction}</span>
                        <span class="ml-rec-priority priority-${priorityClass}">${rec.priority}</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div></div>';
    }
    
    content.innerHTML = html;
}

function renderSummarySection(data) {
    const statsEl = document.getElementById('report-summary-stats');
    const textEl = document.getElementById('report-summary-text');
    
    const summary = data.summary;
    const daysCovered = summary.dateRange?.daysCovered || 0;
    const vsGlobalClass = summary.vsGlobalPercent > 0 ? 'negative' : 'positive';
    const vsGlobalText = summary.vsGlobalPercent > 0 ? 'above' : 'below';
    const trendText = summary.trendDirection === 'improving' ? '↓ Improving' : 
                      summary.trendDirection === 'worsening' ? '↑ Worsening' : '— Stable';
    const trendClass = summary.trendDirection === 'improving' ? 'positive' : 
                       summary.trendDirection === 'worsening' ? 'negative' : 'neutral';
    
    // Format date range
    const startDate = summary.dateRange?.start ? new Date(summary.dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const endDate = summary.dateRange?.end ? new Date(summary.dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    
    if (statsEl) {
        statsEl.innerHTML = `
            <table class="summary-table">
                <tbody>
                    <tr>
                        <td class="label">Tracking Period</td>
                        <td class="value">${startDate} — ${endDate}</td>
                        <td class="label">Days Tracked</td>
                        <td class="value">${daysCovered}</td>
                    </tr>
                    <tr>
                        <td class="label">Activities Logged</td>
                        <td class="value">${summary.totalActivities}</td>
                        <td class="label">Total Emissions</td>
                        <td class="value highlight">${summary.totalEmissions.toFixed(1)} kg CO₂</td>
                    </tr>
                    <tr>
                        <td class="label">Daily Average</td>
                        <td class="value">${summary.dailyAverage.toFixed(1)} kg/day</td>
                        <td class="label">Monthly Projection</td>
                        <td class="value">${summary.monthlyProjection.toFixed(1)} kg/month</td>
                    </tr>
                    <tr>
                        <td class="label">vs Global Average</td>
                        <td class="value ${vsGlobalClass}">${Math.abs(summary.vsGlobalPercent)}% ${vsGlobalText}</td>
                        <td class="label">Trend</td>
                        <td class="value ${trendClass}">${trendText}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }
    
    if (textEl) {
        const fallbackSummary = `Based on ${daysCovered} days of tracking (${summary.totalActivities} activities), your emissions total ${summary.totalEmissions.toFixed(1)} kg CO₂. ` +
            `Daily average: ${summary.dailyAverage.toFixed(1)} kg (${Math.abs(summary.vsGlobalPercent)}% ${vsGlobalText} global average). ` +
            `Trend: ${summary.trendDirection}.`;
        
        const aiSummary = data.aiAnalysis?.executiveSummary || fallbackSummary;
        
        textEl.innerHTML = `<p class="executive-text">${aiSummary}</p>`;
    }
}

function renderComparisonSection(data) {
    const chartEl = document.getElementById('comparison-chart');
    const detailsEl = document.getElementById('comparison-details');
    
    const current = data.comparison.current;
    const optimized = data.comparison.optimized;
    const savings = data.comparison.savings;
    
    // Calculate percentages for visual bars
    const maxValue = Math.max(current.monthly, 100);
    const currentWidth = Math.min((current.monthly / maxValue) * 100, 100);
    const optimizedWidth = Math.min((optimized.monthly / maxValue) * 100, 100);
    
    if (chartEl) {
        chartEl.innerHTML = `
            <div class="comparison-visual">
                <div class="comparison-row">
                    <span class="comparison-label">Current</span>
                    <div class="comparison-bar-track">
                        <div class="comparison-bar-fill current" style="width: ${currentWidth}%"></div>
                    </div>
                    <span class="comparison-value">${current.monthly.toFixed(0)} kg</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">Optimized</span>
                    <div class="comparison-bar-track">
                        <div class="comparison-bar-fill optimized" style="width: ${optimizedWidth}%"></div>
                    </div>
                    <span class="comparison-value">${optimized.monthly.toFixed(0)} kg</span>
                </div>
                <div class="savings-summary">
                    Potential reduction: <strong>${savings.monthly.toFixed(0)} kg/month</strong> (${savings.percent}%)
                </div>
            </div>
        `;
    }
    
    if (detailsEl) {
        detailsEl.innerHTML = `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Current</th>
                        <th>After Optimization</th>
                        <th>Savings</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Monthly Emissions</td>
                        <td>${current.monthly.toFixed(1)} kg CO₂</td>
                        <td>${optimized.monthly.toFixed(1)} kg CO₂</td>
                        <td class="positive">−${savings.monthly.toFixed(1)} kg</td>
                    </tr>
                    <tr>
                        <td>Yearly Emissions</td>
                        <td>${current.yearly.toFixed(2)} tons CO₂</td>
                        <td>${optimized.yearly.toFixed(2)} tons CO₂</td>
                        <td class="positive">−${savings.yearly.toFixed(2)} tons</td>
                    </tr>
                    <tr class="highlight-row">
                        <td>Reduction</td>
                        <td colspan="2" style="text-align: center;">—</td>
                        <td class="positive"><strong>${savings.percent}%</strong></td>
                    </tr>
                </tbody>
            </table>
        `;
    }
}

function renderReportCategories(data) {
    const container = document.getElementById('category-breakdown-report');
    if (!container) return;
    
    const categories = data.categoryBreakdown;
    
    if (!categories || categories.length === 0) {
        container.innerHTML = '<p class="empty-state">No category data available.</p>';
        return;
    }
    
    // Build category summary table
    let html = `
        <table class="category-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Emissions</th>
                    <th>Share</th>
                    <th>Activities</th>
                    <th>Avg/Activity</th>
                </tr>
            </thead>
            <tbody>
                ${categories.map(cat => `
                    <tr>
                        <td><strong>${capitalizeFirst(cat.category || 'Other')}</strong></td>
                        <td>${cat.emissions.toFixed(1)} kg</td>
                        <td>${cat.percentage}%</td>
                        <td>${cat.activitiesCount}</td>
                        <td>${cat.avgPerActivity.toFixed(1)} kg</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Add top sources for each category
    categories.forEach(cat => {
        if (cat.topActivities && cat.topActivities.length > 0) {
            html += `
                <div class="category-sources">
                    <h4>${capitalizeFirst(cat.category || 'Other')} — Top Sources</h4>
                    <table class="sources-table">
                        <tbody>
                            ${cat.topActivities.slice(0, 5).map((a, idx) => `
                                <tr>
                                    <td class="rank">${idx + 1}.</td>
                                    <td class="desc">${a.description || 'Activity'}</td>
                                    <td class="emissions">${a.emissions.toFixed(1)} kg</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
}

function renderFixesSection(data) {
    const container = document.getElementById('fixes-list');
    if (!container) return;
    
    const fixes = data.fixes;
    
    if (!fixes || fixes.length === 0) {
        container.innerHTML = '<p class="empty-state">No specific recommendations at this time. Keep up the good work!</p>';
        return;
    }
    
    // Summary table of all fixes
    let html = `
        <table class="fixes-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Recommendation</th>
                    <th>Category</th>
                    <th>Potential Savings</th>
                    <th>Difficulty</th>
                    <th>Timeframe</th>
                </tr>
            </thead>
            <tbody>
                ${fixes.map((fix, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${fix.title || 'Recommendation'}</strong></td>
                        <td>${capitalizeFirst(fix.category || 'general')}</td>
                        <td class="positive">−${fix.potentialSavings.toFixed(1)} kg/mo</td>
                        <td>${fix.feasibility || 'Moderate'}</td>
                        <td>${fix.timeframe || '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Detailed breakdown for top fixes
    html += '<div class="fixes-details">';
    fixes.slice(0, 5).forEach((fix, idx) => {
        html += `
            <div class="fix-detail">
                <div class="fix-detail-header">
                    <span class="fix-number">${idx + 1}</span>
                    <div class="fix-detail-title">
                        <strong>${fix.title || 'Recommendation'}</strong>
                        <span class="fix-meta">${capitalizeFirst(fix.category || '')} · ${fix.feasibility || 'Moderate'} · ${fix.timeframe || ''}</span>
                    </div>
                    <span class="fix-savings">−${fix.potentialSavings.toFixed(1)} kg/mo (${fix.savingsPercent || 0}%)</span>
                </div>
                <p class="fix-description">${fix.description || ''}</p>
                ${fix.specificActions && fix.specificActions.length > 0 ? `
                    <div class="fix-steps">
                        <strong>Steps:</strong>
                        <ol>
                            ${fix.specificActions.map(action => `<li>${action}</li>`).join('')}
                        </ol>
                    </div>
                ` : ''}
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderTrendsAnalysis(data) {
    const container = document.getElementById('trends-analysis');
    if (!container) return;
    
    const trends = data.weeklyTrends;
    
    if (!trends || trends.length < 2) {
        container.innerHTML = '<p class="empty-state">Log activities over multiple weeks to see trend analysis.</p>';
        return;
    }
    
    const maxEmissions = Math.max(...trends.map(t => t.emissions));
    const avgEmissions = trends.reduce((sum, t) => sum + t.emissions, 0) / trends.length;
    const trendDirection = data.summary?.trendDirection || 'stable';
    
    // Week-by-week table
    let html = `
        <table class="trends-table">
            <thead>
                <tr>
                    <th>Week Starting</th>
                    <th>Emissions</th>
                    <th>Change</th>
                    <th>vs Avg</th>
                </tr>
            </thead>
            <tbody>
                ${trends.map((t, idx) => {
                    const weekDate = new Date(t.week);
                    const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const prevEmissions = idx > 0 ? trends[idx - 1].emissions : t.emissions;
                    const change = t.emissions - prevEmissions;
                    const changeStr = idx === 0 ? '—' : (change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1));
                    const changeClass = idx === 0 ? '' : (change > 0 ? 'negative' : change < 0 ? 'positive' : '');
                    const vsAvg = t.emissions - avgEmissions;
                    const vsAvgStr = vsAvg >= 0 ? `+${vsAvg.toFixed(1)}` : vsAvg.toFixed(1);
                    const vsAvgClass = vsAvg > 0 ? 'negative' : vsAvg < 0 ? 'positive' : '';
                    
                    return `
                        <tr>
                            <td>${weekLabel}</td>
                            <td>${t.emissions.toFixed(1)} kg</td>
                            <td class="${changeClass}">${changeStr} kg</td>
                            <td class="${vsAvgClass}">${vsAvgStr} kg</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        
        <div class="trends-summary">
            <table class="summary-mini">
                <tr>
                    <td>Trend:</td>
                    <td class="${trendDirection === 'improving' ? 'positive' : trendDirection === 'worsening' ? 'negative' : ''}">${trendDirection === 'improving' ? '↓ Improving' : trendDirection === 'worsening' ? '↑ Worsening' : '— Stable'}</td>
                </tr>
                <tr>
                    <td>Weeks Analyzed:</td>
                    <td>${trends.length}</td>
                </tr>
                <tr>
                    <td>Weekly Average:</td>
                    <td>${avgEmissions.toFixed(1)} kg CO₂</td>
                </tr>
                <tr>
                    <td>Peak Week:</td>
                    <td>${maxEmissions.toFixed(1)} kg CO₂</td>
                </tr>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderActionPlan(data) {
    const container = document.getElementById('action-plan-content');
    if (!container) return;
    
    const fixes = data.fixes || [];
    const aiPlan = data.aiAnalysis?.actionPlan;
    const encouragement = data.aiAnalysis?.encouragement;
    
    // Group fixes by timeframe
    const immediate = fixes.filter(f => f.timeframe === 'Immediate');
    const shortTerm = fixes.filter(f => f.timeframe === '1-3 months');
    const mediumTerm = fixes.filter(f => f.timeframe === '3-6 months');
    
    let html = '';
    
    // AI plan if available
    if (aiPlan && aiPlan.length > 0) {
        html += `
            <div class="ai-plan">
                <strong>AI Recommendations:</strong>
                <ol>
                    ${aiPlan.map(item => `<li>${item}</li>`).join('')}
                </ol>
            </div>
        `;
    }
    
    // Action table
    html += `
        <table class="action-table">
            <thead>
                <tr>
                    <th>Timeline</th>
                    <th>Action</th>
                    <th>Expected Savings</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Immediate actions
    if (immediate.length > 0) {
        immediate.slice(0, 3).forEach((f, idx) => {
            html += `
                <tr${idx === 0 ? ' class="timeline-start"' : ''}>
                    ${idx === 0 ? `<td rowspan="${immediate.length}" class="timeline-cell immediate">Today</td>` : ''}
                    <td>${f.title || 'Action'}</td>
                    <td class="positive">−${f.potentialSavings.toFixed(0)} kg/mo</td>
                </tr>
            `;
        });
    } else {
        html += `
            <tr class="timeline-start">
                <td class="timeline-cell immediate">Today</td>
                <td colspan="2" class="muted">No immediate actions needed</td>
            </tr>
        `;
    }
    
    // Short-term actions
    if (shortTerm.length > 0) {
        shortTerm.slice(0, 3).forEach((f, idx) => {
            html += `
                <tr${idx === 0 ? ' class="timeline-start"' : ''}>
                    ${idx === 0 ? `<td rowspan="${Math.min(shortTerm.length, 3)}" class="timeline-cell short-term">1-3 Months</td>` : ''}
                    <td>${f.title || 'Action'}</td>
                    <td class="positive">−${f.potentialSavings.toFixed(0)} kg/mo</td>
                </tr>
            `;
        });
    } else {
        html += `
            <tr class="timeline-start">
                <td class="timeline-cell short-term">1-3 Months</td>
                <td colspan="2" class="muted">No short-term actions identified</td>
            </tr>
        `;
    }
    
    // Medium-term actions
    if (mediumTerm.length > 0) {
        mediumTerm.slice(0, 3).forEach((f, idx) => {
            html += `
                <tr${idx === 0 ? ' class="timeline-start"' : ''}>
                    ${idx === 0 ? `<td rowspan="${Math.min(mediumTerm.length, 3)}" class="timeline-cell medium-term">3-6 Months</td>` : ''}
                    <td>${f.title || 'Action'}</td>
                    <td class="positive">−${f.potentialSavings.toFixed(0)} kg/mo</td>
                </tr>
            `;
        });
    } else {
        html += `
            <tr class="timeline-start">
                <td class="timeline-cell medium-term">3-6 Months</td>
                <td colspan="2" class="muted">No long-term actions identified</td>
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    // Encouragement
    if (encouragement) {
        html += `<p class="encouragement">${encouragement}</p>`;
    } else {
        html += `<p class="encouragement">Every small change adds up. Start with the easiest fixes and build momentum.</p>`;
    }
    
    container.innerHTML = html;
}

function printReport() {
    window.print();
}

// ==================== GOALS ====================
async function loadGoals() {
    const container = document.getElementById('goals-grid');
    if (!container) return;
    
    if (!isLoggedIn()) {
        container.innerHTML = '<div class="empty-state"><p>Please login to set and track goals.</p></div>';
        return;
    }
    
    try {
        const data = await apiRequest('/goals');
        renderGoals(data.goals || []);
    } catch (error) {
        console.error('Failed to load goals:', error);
    }
}

function renderGoals(goals) {
    const container = document.getElementById('goals-grid');
    const pastContainer = document.getElementById('past-goals-grid');
    if (!container) return;
    
    // Separate active and completed goals
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    
    if (activeGoals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>No active goals. Create a new goal!</p>
                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    Goals track your CO₂ savings from eco-friendly choices.
                </p>
                <button class="btn-primary" onclick="openAddGoalModal()">Set a Goal</button>
            </div>
        `;
    } else {
        // Goal type info with XP rewards
        const goalTypeInfo = {
            'reduce-transport': { unit: 'kg CO₂ saved', tip: 'Bike, walk, bus, train trips', icon: 'fa-car-side' },
            'reduce-energy': { unit: 'kg CO₂ saved', tip: 'Renewable energy usage', icon: 'fa-bolt' },
            'diet-change': { unit: 'kg CO₂ saved', tip: 'Vegetarian or vegan meals', icon: 'fa-utensils' },
            'zero-waste': { unit: 'recycling points', tip: 'Recycling activities', icon: 'fa-recycle' },
            'streak': { unit: 'days', tip: 'Consecutive logging days', icon: 'fa-fire' }
        };
        
        container.innerHTML = activeGoals.map(goal => {
            const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);
            const daysLeft = Math.ceil((new Date(goal.end_date) - new Date()) / (1000 * 60 * 60 * 24));
            const typeInfo = goalTypeInfo[goal.type] || { unit: 'kg CO₂', tip: 'Eco activities', icon: 'fa-leaf' };
            
            const statusBadge = daysLeft > 0 
                ? `<span class="badge">${daysLeft}d left</span>` 
                : '<span class="badge warning">Expired</span>';
            
            return `
                <div class="goal-card active" data-id="${goal.id}">
                    <div class="goal-header">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas ${typeInfo.icon}" style="color: var(--primary-green);"></i>
                            <h4>${goal.title || goal.type}</h4>
                        </div>
                        <div class="goal-actions">
                            ${statusBadge}
                            <button class="icon-btn" onclick="editGoal(${goal.id})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="icon-btn danger" onclick="deleteGoal(${goal.id})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="goal-tip"><i class="fas fa-lightbulb"></i> ${typeInfo.tip}</p>
                    <div class="goal-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-stats">
                            <span>${goal.current_value.toFixed(1)} / ${goal.target_value} ${typeInfo.unit}</span>
                            <span>${progress.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div class="goal-reward">
                        <i class="fas fa-star" style="color: gold;"></i> 
                        <span>${goal.xp_reward || 100} XP on completion</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Render completed goals in past section
    if (pastContainer) {
        if (completedGoals.length === 0) {
            pastContainer.innerHTML = '<div class="empty-state"><p>No completed goals yet. Keep working!</p></div>';
        } else {
            pastContainer.innerHTML = completedGoals.map(goal => `
                <div class="goal-card completed" data-id="${goal.id}">
                    <div class="goal-header">
                        <h4><i class="fas fa-check-circle" style="color: var(--success-green);"></i> ${goal.title || goal.type}</h4>
                        <span class="badge success">+${goal.xp_reward || 100} XP</span>
                    </div>
                    <div class="goal-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 100%; background: var(--primary-green);"></div>
                        </div>
                        <div class="progress-stats">
                            <span>${goal.target_value} ${goal.type.includes('streak') ? 'days' : 'kg CO₂'} - Completed!</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

async function deleteGoal(id) {
    if (!confirm('Delete this goal? This will deduct any XP earned from creating it.')) return;
    
    try {
        const result = await apiRequest(`/goals/${id}`, { method: 'DELETE' });
        loadGoals();
        loadUserProfile(); // Refresh XP display
        
        // Refresh XP history list to remove deleted entry
        xpHistoryOffset = 0;
        loadXPHistory();
        
        // Show toast with XP deduction info
        const xpMsg = result.xpDeducted > 0 
            ? `Goal deleted. -${result.xpDeducted} XP`
            : 'Goal deleted';
        showToast(xpMsg, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function editGoal(id) {
    try {
        const data = await apiRequest('/goals');
        const goal = (data.goals || []).find(g => g.id === id);
        if (!goal) return;
        
        // Populate edit modal
        document.getElementById('goal-type').value = goal.type;
        document.getElementById('goal-title').value = goal.title || '';
        document.getElementById('goal-target').value = goal.target_value;
        document.getElementById('goal-duration').value = goal.duration || 'month';
        
        // Store id for update
        document.getElementById('goal-form').dataset.editId = id;
        
        openAddGoalModal();
    } catch (error) {
        showToast('Failed to load goal', 'error');
    }
}

// ==================== GAMIFICATION ====================
const LEVEL_TITLES = {
    1: 'Seedling',
    2: 'Sprout',
    3: 'Green Thumb',
    4: 'Eco Enthusiast',
    5: 'Eco Warrior',
    6: 'Carbon Cutter',
    7: 'Earth Defender',
    8: 'Climate Champion',
    9: 'Sustainability Star',
    10: 'Eco Legend',
    11: 'Planet Protector',
    12: 'Green Guardian',
    13: 'Earth Ambassador',
    14: 'Climate Hero',
    15: 'Eco Master'
};

const LEVEL_ICONS = {
    1: 'fa-seedling',
    2: 'fa-leaf',
    3: 'fa-tree',
    4: 'fa-wind',
    5: 'fa-solar-panel',
    6: 'fa-globe-americas',
    7: 'fa-star',
    8: 'fa-crown',
    9: 'fa-gem',
    10: 'fa-trophy',
    11: 'fa-shield-alt',
    12: 'fa-medal',
    13: 'fa-certificate',
    14: 'fa-award',
    15: 'fa-dragon'
};

// XP thresholds for each level (must match backend!)
const XP_THRESHOLDS = [
    0,      // Level 1
    200,    // Level 2
    500,    // Level 3
    1000,   // Level 4
    1800,   // Level 5
    2800,   // Level 6
    4000,   // Level 7
    5500,   // Level 8
    7500,   // Level 9
    10000,  // Level 10
    13000,  // Level 11
    16500,  // Level 12
    20500,  // Level 13
    25000,  // Level 14
    30000   // Level 15
];

function getXPForLevel(level) {
    // XP required to reach a specific level
    return XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] || (level * 100);
}

function getLevelFromXP(totalXP) {
    // Calculate level from total XP
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXP >= XP_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
}

function getXPProgressInLevel(totalXP, level) {
    // Calculate XP progress within current level
    const xpForCurrentLevel = XP_THRESHOLDS[level - 1] || 0;
    const xpForNextLevel = XP_THRESHOLDS[level] || (xpForCurrentLevel + 100);
    const xpInLevel = totalXP - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    return {
        current: Math.max(0, xpInLevel),
        needed: xpNeeded,
        percent: Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100))
    };
}

async function loadUserProfile() {
    if (!isLoggedIn()) {
        updateLevelDisplay({ level: 1, xp: 0 }, []);
        return;
    }
    
    try {
        const data = await apiRequest('/auth/me');
        updateLevelDisplay(data, data.badges || []);
        renderBadges(data.badges || []);
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

function updateLevelDisplay(user, badges) {
    const xp = user.xp || 0;
    // Always recalculate level from XP to ensure accuracy
    const level = getLevelFromXP(xp);
    
    // Update level number and title
    const levelNumber = document.getElementById('level-number');
    const levelTitle = document.getElementById('level-title');
    const levelIcon = document.getElementById('level-icon');
    
    if (levelNumber) levelNumber.textContent = `Level ${level}`;
    if (levelTitle) levelTitle.textContent = LEVEL_TITLES[level] || LEVEL_TITLES[15];
    if (levelIcon) {
        levelIcon.className = `fas ${LEVEL_ICONS[level] || LEVEL_ICONS[15]}`;
    }
    
    // Update progress bar using proper XP thresholds
    const progress = getXPProgressInLevel(xp, level);
    
    const progressBar = document.getElementById('level-progress-bar');
    const progressText = document.getElementById('level-progress-text');
    
    if (progressBar) progressBar.style.width = `${progress.percent}%`;
    if (progressText) progressText.textContent = `${progress.current} / ${progress.needed} XP to Level ${level + 1}`;
    
    // Update total XP and badge count
    const totalXPEl = document.getElementById('total-xp');
    const badgeCount = document.getElementById('badge-count');
    
    if (totalXPEl) totalXPEl.textContent = xp.toLocaleString();
    if (badgeCount) badgeCount.textContent = badges.length;
    
    // Also update dropdown XP
    const dropdownXP = document.getElementById('dropdown-xp');
    if (dropdownXP) dropdownXP.textContent = xp.toLocaleString();
}

async function loadAllBadges() {
    // Fetch all available badges and user's earned badges
    try {
        const data = await apiRequest('/auth/me');
        const earnedBadgeIds = (data.badges || []).map(b => b.id);
        
        // Define all available badges
        const allBadges = [
            { id: 1, name: 'First Steps', description: 'Log your first activity', icon: 'fa-seedling' },
            { id: 2, name: 'Week Warrior', description: '7-day logging streak', icon: 'fa-fire' },
            { id: 3, name: 'Green Commuter', description: '10 bike trips logged', icon: 'fa-bicycle' },
            { id: 4, name: 'Veggie Lover', description: '5 meat-free days', icon: 'fa-leaf' },
            { id: 5, name: 'Carbon Champion', description: 'Reduce emissions 50%', icon: 'fa-trophy' },
            { id: 6, name: 'Planet Protector', description: 'Below global average', icon: 'fa-globe' },
            { id: 7, name: 'Eco Legend', description: 'Reach Level 10', icon: 'fa-crown' },
            { id: 8, name: 'Renewable Hero', description: '100% green energy', icon: 'fa-solar-panel' }
        ];
        
        renderBadges(allBadges.map(badge => ({
            ...badge,
            earned: earnedBadgeIds.includes(badge.id)
        })));
    } catch (error) {
        console.error('Failed to load badges:', error);
    }
}

function renderBadges(badges) {
    const container = document.getElementById('badges-grid');
    if (!container) return;
    
    if (!isLoggedIn()) {
        container.innerHTML = '<div class="empty-state"><p>Please login to view achievements.</p></div>';
        return;
    }
    
    // Define all available badges with their status
    const allBadges = [
        { name: 'First Steps', description: 'Log your first activity', icon: 'fa-seedling' },
        { name: 'Week Warrior', description: '7-day logging streak', icon: 'fa-fire' },
        { name: 'Green Commuter', description: '10 bike trips logged', icon: 'fa-bicycle' },
        { name: 'Veggie Lover', description: '5 meat-free days', icon: 'fa-leaf' },
        { name: 'Carbon Champion', description: 'Reduce emissions 50%', icon: 'fa-trophy' },
        { name: 'Planet Protector', description: 'Below global average', icon: 'fa-globe' },
        { name: 'Eco Legend', description: 'Reach Level 10', icon: 'fa-crown' },
        { name: 'Renewable Hero', description: '100% green energy', icon: 'fa-solar-panel' }
    ];
    
    const earnedNames = badges.map(b => b.name);
    
    container.innerHTML = allBadges.map(badge => {
        const isEarned = earnedNames.includes(badge.name);
        return `
            <div class="badge-card ${isEarned ? 'earned' : ''}">
                <div class="badge-icon">
                    <i class="fas ${badge.icon}"></i>
                </div>
                <span class="badge-name">${badge.name}</span>
                <span class="badge-desc">${badge.description}</span>
            </div>
        `;
    }).join('');
}

let currentLeaderboardType = 'global';

async function loadLeaderboard(type = 'global') {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    
    currentLeaderboardType = type;
    
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    
    try {
        let endpoint = '/leaderboard';
        if (type === 'weekly') endpoint = '/leaderboard/weekly';
        else if (type === 'streak') endpoint = '/leaderboard/streaks';
        
        const data = await apiRequest(endpoint);
        renderLeaderboard(data.leaderboard || [], data.userRank, type);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        container.innerHTML = '<div class="empty-state"><p>Failed to load leaderboard.</p></div>';
    }
}

function renderLeaderboard(leaderboard, userRank, type = 'global') {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    
    if (leaderboard.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No users on the leaderboard yet. Be the first!</p></div>';
        return;
    }
    
    const getRankClass = (rank) => {
        if (rank === 1) return 'gold';
        if (rank === 2) return 'silver';
        if (rank === 3) return 'bronze';
        return '';
    };
    
    container.innerHTML = leaderboard.map(user => {
        // Recalculate level from XP for accuracy
        const userLevel = getLevelFromXP(user.xp || 0);
        
        // Different display for streak leaderboard
        const scoreDisplay = type === 'streak' 
            ? `<span class="lb-score"><i class="fas fa-fire" style="color: #e67e22;"></i> ${user.streak} days</span>`
            : `<span class="lb-score">${user.xp.toLocaleString()} XP</span>`;
            
        const reductionDisplay = type === 'streak'
            ? `<span class="lb-reduction">${user.xp.toLocaleString()} XP</span>`
            : `<span class="lb-reduction">Lvl ${userLevel}</span>`;
        
        return `
            <div class="leaderboard-item ${getRankClass(user.rank)} ${user.isCurrentUser ? 'you' : ''}">
                <span class="lb-rank">${user.rank}</span>
                <div class="lb-avatar"><i class="fas fa-user-circle"></i></div>
                <span class="lb-name">${user.isCurrentUser ? 'You' : user.username}</span>
                ${scoreDisplay}
                ${reductionDisplay}
            </div>
        `;
    }).join('');
    
    // Add current user if not in top list
    if (userRank && !leaderboard.some(u => u.isCurrentUser)) {
        const userLevel = getLevelFromXP(userRank.xp || 0);
        container.innerHTML += `
            <div class="leaderboard-item you" style="margin-top: 1rem; border-top: 2px solid var(--border-color); padding-top: 1rem;">
                <span class="lb-rank">${userRank.rank}</span>
                <div class="lb-avatar"><i class="fas fa-user-circle"></i></div>
                <span class="lb-name">You</span>
                <span class="lb-score">${userRank.xp.toLocaleString()} XP</span>
                <span class="lb-reduction">Lvl ${userLevel}</span>
            </div>
        `;
    }
}

function openAddGoalModal() {
    if (!isLoggedIn()) {
        openAuthModal('login');
        return;
    }
    
    const modal = document.getElementById('add-goal-modal');
    if (modal) modal.classList.add('active');
}

function closeAddGoalModal() {
    const modal = document.getElementById('add-goal-modal');
    if (modal) modal.classList.remove('active');
}

// ==================== PROFILE & SETTINGS ====================
function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    
    const user = getUser();
    if (user) {
        const usernameEl = document.getElementById('profile-username');
        const emailEl = document.getElementById('profile-email');
        const levelEl = document.getElementById('profile-level');
        const xpEl = document.getElementById('profile-xp');
        const streakEl = document.getElementById('profile-streak');
        
        if (usernameEl) usernameEl.value = user.name || user.username || 'User';
        if (emailEl) emailEl.value = user.email || '';
        if (levelEl) levelEl.textContent = user.level || 1;
        if (xpEl) xpEl.textContent = user.xp || 0;
        if (streakEl) streakEl.textContent = user.streak || 0;
    }
    
    modal.classList.add('active');
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
}

// Save profile changes
async function saveProfile() {
    const usernameEl = document.getElementById('profile-username');
    const emailEl = document.getElementById('profile-email');
    
    const username = usernameEl?.value?.trim();
    const email = emailEl?.value?.trim();
    
    if (!username || !email) {
        showToast('Username and email are required', 'error');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/me', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ username, email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showToast(data.error || 'Failed to update profile', 'error');
            return;
        }
        
        // Update stored user data
        const currentUser = getUser();
        if (currentUser) {
            currentUser.username = data.user.username;
            currentUser.name = data.user.username;
            currentUser.email = data.user.email;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
        
        // Update navbar username display
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) {
            usernameDisplay.textContent = data.user.username;
        }
        
        showToast('Profile updated successfully', 'success');
        closeProfileModal();
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save profile: ' + error.message, 'error');
    }
}

// Theme toggle functionality
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    const iconOut = document.getElementById('theme-icon-out');
    const iconClass = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (icon) icon.className = iconClass;
    if (iconOut) iconOut.className = iconClass;
}

function loadSettings() {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

// Initialize theme toggle button
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleOut = document.getElementById('theme-toggle-out');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    if (themeToggleOut) {
        themeToggleOut.addEventListener('click', toggleTheme);
    }
});

async function saveGoal() {
    const type = document.getElementById('goal-type').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const duration = document.getElementById('goal-duration').value;
    const title = document.getElementById('goal-title')?.value || '';
    const editId = document.getElementById('goal-form')?.dataset.editId;
    
    if (!type || !target) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    const goalTitles = {
        'reduce-transport': 'Green Transport Challenge',
        'reduce-energy': 'Clean Energy Challenge',
        'diet-change': 'Plant-Based Diet Challenge',
        'zero-waste': 'Zero Waste Challenge',
        'streak': 'Logging Streak Challenge'
    };
    
    // Calculate XP reward based on difficulty (target value and duration)
    const durationDays = parseInt(duration) || 30;
    const baseXP = 50;
    const difficultyMultiplier = Math.min(3, 1 + (target / 20)); // More difficult = more XP
    const durationMultiplier = durationDays <= 7 ? 1.5 : durationDays <= 14 ? 1.2 : 1; // Shorter = harder
    const xpReward = Math.round(baseXP * difficultyMultiplier * durationMultiplier);
    
    try {
        if (editId) {
            // Update existing goal
            await apiRequest(`/goals/${editId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: title || goalTitles[type] || 'Custom Goal',
                    target_value: target,
                    duration_days: durationDays,
                    type: type,
                    xp_reward: xpReward
                })
            });
            delete document.getElementById('goal-form').dataset.editId;
            showToast('Goal updated!', 'success');
        } else {
            // Create new goal
            const result = await apiRequest('/goals', {
                method: 'POST',
                body: JSON.stringify({
                    title: title || goalTitles[type] || 'Custom Goal',
                    target_value: target,
                    duration_days: durationDays,
                    type: type,
                    xp_reward: xpReward
                })
            });
            showToast(`Goal created! +${result.xpAwarded || 15} XP`, 'success');
            
            // Refresh XP history if visible
            const xpContent = document.getElementById('xp-history-content');
            if (xpContent && xpContent.style.display !== 'none') {
                loadXPHistory();
            }
        }
        
        closeAddGoalModal();
        loadGoals();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Goal type hints
const GOAL_HINTS = {
    'reduce-transport': {
        hint: 'Progress by logging bike rides, walks, public transport, or carpooling instead of driving alone.',
        targetHint: 'Each km by eco-transport saves ~0.1-0.2 kg CO₂'
    },
    'reduce-energy': {
        hint: 'Progress by logging renewable or nuclear energy usage instead of fossil fuels.',
        targetHint: 'Each kWh of green energy saves ~0.4-0.9 kg CO₂'
    },
    'diet-change': {
        hint: 'Progress by logging vegetarian or vegan meals instead of meat-heavy meals.',
        targetHint: 'Each plant-based meal saves ~3-4 kg CO₂'
    },
    'zero-waste': {
        hint: 'Progress by logging recycling and composting activities.',
        targetHint: 'Each recycling action counts toward your goal'
    },
    'streak': {
        hint: 'Progress by maintaining consecutive days of logging any activity.',
        targetHint: 'Enter the number of days you want to maintain'
    }
};

function updateGoalHints(goalType) {
    const goalHint = document.getElementById('goal-hint');
    const targetHint = document.getElementById('target-hint');
    const targetLabel = document.querySelector('label[for="goal-target"]');
    
    const hints = GOAL_HINTS[goalType];
    
    if (hints) {
        if (goalHint) goalHint.textContent = hints.hint;
        if (targetHint) targetHint.textContent = hints.targetHint;
        if (targetLabel) {
            targetLabel.textContent = goalType === 'streak' ? 'Target (days)' : 'Target (kg CO₂ to save)';
        }
    } else {
        if (goalHint) goalHint.textContent = 'Select a goal type to see how it works';
        if (targetHint) targetHint.textContent = 'How much CO₂ you aim to save';
    }
}

// ==================== UTILITIES ====================
function getCategoryIcon(category) {
    const icons = {
        transport: 'fa-car',
        energy: 'fa-bolt',
        food: 'fa-utensils',
        waste: 'fa-recycle',
        shopping: 'fa-shopping-bag'
    };
    return icons[category] || 'fa-leaf';
}

function formatActivityType(type) {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (toast && toastMessage) {
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth UI
    updateAuthUI();
    
    // Navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) showSection(section);
        });
    });
    
    // Auth modal
    document.getElementById('show-auth-btn')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Profile and Settings links
    document.getElementById('profile-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('user-dropdown-menu')?.classList.remove('show');
        openProfileModal();
    });
    
    // Profile modal backdrop close
    document.getElementById('profile-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'profile-modal') closeProfileModal();
    });
    
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });
    
    // Login/Register buttons
    document.getElementById('login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('register-btn')?.addEventListener('click', handleRegister);
    
    // Close modal on backdrop click
    document.getElementById('auth-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'auth-modal') closeAuthModal();
    });
    
    // User dropdown
    document.getElementById('user-dropdown-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('user-dropdown-menu')?.classList.toggle('show');
    });
    
    document.addEventListener('click', () => {
        document.getElementById('user-dropdown-menu')?.classList.remove('show');
    });
    
    // Activity log date navigation
    document.getElementById('prev-date')?.addEventListener('click', () => {
        if (currentPeriod === 'daily') {
            currentLogDate.setDate(currentLogDate.getDate() - 1);
        } else if (currentPeriod === 'weekly') {
            currentLogDate.setDate(currentLogDate.getDate() - 7);
        } else if (currentPeriod === 'monthly') {
            currentLogDate.setMonth(currentLogDate.getMonth() - 1);
        }
        loadActivityLog();
    });
    
    document.getElementById('next-date')?.addEventListener('click', () => {
        if (currentPeriod === 'daily') {
            currentLogDate.setDate(currentLogDate.getDate() + 1);
        } else if (currentPeriod === 'weekly') {
            currentLogDate.setDate(currentLogDate.getDate() + 7);
        } else if (currentPeriod === 'monthly') {
            currentLogDate.setMonth(currentLogDate.getMonth() + 1);
        }
        loadActivityLog();
    });
    
    // Period selector buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            loadActivityLog();
        });
    });
    
    // Activity modal
    document.getElementById('add-activity-btn')?.addEventListener('click', openAddActivityModal);
    document.getElementById('cancel-activity')?.addEventListener('click', closeAddActivityModal);
    document.getElementById('save-activity')?.addEventListener('click', saveActivity);
    
    // Activity modal dynamic options
    document.getElementById('activity-category')?.addEventListener('change', updateActivityModalOptions);
    document.getElementById('activity-transport-type')?.addEventListener('change', updateTransportOptions);
    document.getElementById('activity-energy-type')?.addEventListener('change', updateEnergyOptions);
    
    document.getElementById('add-activity-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'add-activity-modal') closeAddActivityModal();
    });
    
    // Goal modal
    document.getElementById('add-goal-btn')?.addEventListener('click', openAddGoalModal);
    document.getElementById('cancel-goal')?.addEventListener('click', closeAddGoalModal);
    document.getElementById('save-goal')?.addEventListener('click', saveGoal);
    
    // Goal type hint updates
    document.getElementById('goal-type')?.addEventListener('change', (e) => {
        updateGoalHints(e.target.value);
    });
    
    document.getElementById('add-goal-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'add-goal-modal') closeAddGoalModal();
    });
    
    // Leaderboard tabs
    document.querySelectorAll('.lb-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadLeaderboard(btn.dataset.lb);
        });
    });
    
    // Chart range buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (isLoggedIn()) {
                // Reset offset when changing range
                currentChartOffset = 0;
                loadChartData(btn.dataset.range, 0);
            }
        });
    });
    
    // Chart navigation buttons
    document.getElementById('chart-prev')?.addEventListener('click', () => navigateChart('prev'));
    document.getElementById('chart-next')?.addEventListener('click', () => navigateChart('next'));
    
    // Initialize report date pickers with defaults (last 30 days)
    initReportDatePickers();
    
    // Initialize calculator
    initCalculator();
    
    // Load settings
    loadSettings();
    
    // Load initial dashboard
    loadDashboard();
});

// Initialize report date pickers
function initReportDatePickers() {
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    
    if (!startDateInput || !endDateInput) return;
    
    // Set defaults: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const todayStr = formatLocalDate(today);
    endDateInput.value = todayStr;
    startDateInput.value = formatLocalDate(thirtyDaysAgo);
    
    // Set max to today
    endDateInput.max = todayStr;
    startDateInput.max = todayStr;
    
    // Add validation listeners
    startDateInput.addEventListener('change', () => validateReportDateRange());
    endDateInput.addEventListener('change', () => validateReportDateRange());
    
    // Don't auto-load - show placeholder instead
    // User must click "Generate AI Analysis" button
}

function validateReportDateRange() {
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    const noteEl = document.querySelector('.date-limit-note');
    
    if (!startDateInput?.value || !endDateInput?.value) return;
    
    const start = new Date(startDateInput.value);
    const end = new Date(endDateInput.value);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (noteEl) {
        if (daysDiff > 31) {
            noteEl.textContent = 'Exceeds 31 days!';
            noteEl.classList.add('error');
        } else if (daysDiff < 0) {
            noteEl.textContent = 'Invalid range';
            noteEl.classList.add('error');
        } else {
            noteEl.textContent = `${daysDiff + 1} days selected`;
            noteEl.classList.remove('error');
        }
    }
}

// Generate AI Analysis for selected date range
function generateAIAnalysis() {
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    
    if (!startDateInput?.value || !endDateInput?.value) {
        alert('Please select a date range first');
        return;
    }
    
    const start = new Date(startDateInput.value);
    const end = new Date(endDateInput.value);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 31) {
        alert('Date range cannot exceed 31 days');
        return;
    }
    
    if (daysDiff < 0) {
        alert('Start date must be before end date');
        return;
    }
    
    // Load insights for the selected date range
    loadInsights(true, startDateInput.value, endDateInput.value);
}

// ===== XP History Functions =====
let xpHistoryOffset = 0;
const XP_HISTORY_LIMIT = 20;

async function loadXPHistory(append = false) {
    if (!isLoggedIn()) return;
    
    const container = document.getElementById('xp-history-list');
    const loadMoreBtn = document.getElementById('load-more-xp');
    if (!container) return;
    
    if (!append) {
        xpHistoryOffset = 0;
        container.innerHTML = '<div class="xp-history-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    }
    
    try {
        const data = await apiRequest(`/stats/xp-history?limit=${XP_HISTORY_LIMIT}&offset=${xpHistoryOffset}`);
        
        if (!append) {
            container.innerHTML = '';
        }
        
        if (data.history.length === 0 && xpHistoryOffset === 0) {
            container.innerHTML = '<div class="xp-history-empty"><i class="fas fa-history"></i><p>No XP history yet. Start logging activities to earn XP!</p></div>';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        const html = data.history.map(entry => {
            const date = new Date(entry.date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            const iconMap = {
                'activity': 'fa-plus-circle',
                'badge': 'fa-medal',
                'goal': 'fa-bullseye'
            };
            const icon = iconMap[entry.source] || 'fa-star';
            
            // Build description with linked data for integrity
            let desc = entry.description || entry.source;
            let subInfo = '';
            
            if (entry.activity && entry.activityId) {
                // Show linked activity details
                subInfo = `${entry.activity.category}: ${entry.activity.description}`;
                if (entry.activity.emissions) {
                    subInfo += ` (${parseFloat(entry.activity.emissions).toFixed(1)} kg CO₂)`;
                }
            } else if (entry.goalId && entry.goal && entry.goal.title) {
                subInfo = `Goal: ${entry.goal.title}`;
            } else if (entry.badgeId && entry.badge && entry.badge.name) {
                subInfo = `Badge: ${entry.badge.name}`;
            }
            
            return `
                <div class="xp-history-item" data-activity-id="${entry.activityId || ''}" data-goal-id="${entry.goalId || ''}" data-badge-id="${entry.badgeId || ''}">
                    <div class="xp-history-info">
                        <div class="xp-history-icon ${entry.source}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="xp-history-details">
                            <span class="xp-history-desc">${desc}</span>
                            ${subInfo ? `<span class="xp-history-subinfo">${subInfo}</span>` : ''}
                            <span class="xp-history-date">${dateStr} at ${timeStr}</span>
                        </div>
                    </div>
                    <span class="xp-history-amount">+${entry.amount} XP</span>
                </div>
            `;
        }).join('');
        
        container.insertAdjacentHTML('beforeend', html);
        xpHistoryOffset += data.history.length;
        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = data.pagination.hasMore ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Failed to load XP history:', error);
        if (!append) {
            container.innerHTML = '<div class="xp-history-empty"><i class="fas fa-exclamation-circle"></i><p>Failed to load XP history</p></div>';
        }
    }
}

function initXPHistoryListeners() {
    const toggleBtn = document.getElementById('toggle-xp-history');
    const content = document.getElementById('xp-history-content');
    const loadMoreBtn = document.getElementById('load-more-xp');
    
    if (toggleBtn && content) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible 
                ? '<i class="fas fa-chevron-down"></i> Show'
                : '<i class="fas fa-chevron-up"></i> Hide';
            
            if (!isVisible) {
                // Refresh data when expanding
                xpHistoryOffset = 0;
                loadXPHistory();
            }
        });
    }
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => loadXPHistory(true));
    }
}

function initCompletedGoalsListeners() {
    const toggleBtn = document.getElementById('toggle-completed-goals');
    const content = document.getElementById('past-goals-grid');
    
    if (toggleBtn && content) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'grid';
            toggleBtn.innerHTML = isVisible 
                ? '<i class="fas fa-chevron-down"></i> Show'
                : '<i class="fas fa-chevron-up"></i> Hide';
        });
    }
}

// Initialize XP history listeners on page load
document.addEventListener('DOMContentLoaded', initXPHistoryListeners);
document.addEventListener('DOMContentLoaded', initCompletedGoalsListeners);
