// Global State
let userName = localStorage.getItem('scriptflow_user_name') || 'Flynn';
let appointments = {};
let goals = { daily: 3, weekly: 15, monthly: 60 };
let scripts = {};
let currentScriptId = "opening";
let isEditing = false;
let searchTerm = "";
let customOrder = [];
let versionHistory = {};
let currentVersionIndex = {};

// Dashboard State
let dashboardDateRange = { start: getTodayStr(), end: getTodayStr() };
let dashboardChart = null;

// Calendar Modal State
let currentCalDate = new Date();
let selectedCalDate = new Date().toISOString().split('T')[0];
let calendarModal = null;

let toolsOpen = localStorage.getItem('toolsMenuOpen') === 'true';

// ==================== HELPER FUNCTIONS ====================
function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : (type === 'info' ? 'info' : '')}`;
    t.innerHTML = `${type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️')} ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function copyToClipboard(text) {
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!')).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied!');
    });
}

function escapeHtml(s) {
    return s ? String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : '';
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function replaceNameInScript(content) {
    return content.replace(/\[Your Name\]/gi, userName);
}

// ==================== INSIGHTS DASHBOARD FUNCTIONS ====================
function getAppointmentsInRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const results = [];
    for (let date in appointments) {
        const dateObj = new Date(date);
        if (dateObj >= start && dateObj <= end && appointments[date].reports) {
            appointments[date].reports.forEach(appt => {
                results.push({
                    ...appt,
                    date: date
                });
            });
        }
    }
    return results;
}

function getDailyAppointmentCounts(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const counts = {};
    const current = new Date(start);
    
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        counts[dateStr] = appointments[dateStr]?.reports?.length || 0;
        current.setDate(current.getDate() + 1);
    }
    
    return counts;
}

function calculateInsights(startDate, endDate) {
    const appointmentsInRange = getAppointmentsInRange(startDate, endDate);
    const totalAppointments = appointmentsInRange.length;
    
    // Unique businesses count
    const uniqueBusinesses = new Set(appointmentsInRange.map(a => a.business)).size;
    
    // Assigned to stats
    const assignedStats = {};
    appointmentsInRange.forEach(a => {
        const assigned = a.assigned || 'Unassigned';
        assignedStats[assigned] = (assignedStats[assigned] || 0) + 1;
    });
    
    // Role distribution
    const roleStats = {};
    appointmentsInRange.forEach(a => {
        const role = a.role || 'Other';
        roleStats[role] = (roleStats[role] || 0) + 1;
    });
    
    // Most active days
    const dayStats = {};
    appointmentsInRange.forEach(a => {
        const day = new Date(a.date).toLocaleDateString('en-US', { weekday: 'long' });
        dayStats[day] = (dayStats[day] || 0) + 1;
    });
    
    // Completion rate vs goals
    const todayCount = getTodayCount();
    const weekCount = getWeekCount();
    const monthCount = getMonthCount();
    
    return {
        totalAppointments,
        uniqueBusinesses,
        assignedStats,
        roleStats,
        dayStats,
        todayCount,
        weekCount,
        monthCount,
        todayGoal: goals.daily,
        weekGoal: goals.weekly,
        monthGoal: goals.monthly,
        todayProgress: Math.min(100, Math.round((todayCount / goals.daily) * 100)),
        weekProgress: Math.min(100, Math.round((weekCount / goals.weekly) * 100)),
        monthProgress: Math.min(100, Math.round((monthCount / goals.monthly) * 100))
    };
}

function renderInsightsDashboard() {
    const insightsPanel = document.getElementById('insightsPanel');
    if (!insightsPanel) return;
    
    const insights = calculateInsights(dashboardDateRange.start, dashboardDateRange.end);
    const dailyCounts = getDailyAppointmentCounts(dashboardDateRange.start, dashboardDateRange.end);
    const dateLabels = Object.keys(dailyCounts);
    const chartData = Object.values(dailyCounts);
    
    // Build assigned to list HTML
    let assignedHtml = '';
    Object.entries(insights.assignedStats).forEach(([name, count]) => {
        const percentage = insights.totalAppointments ? Math.round((count / insights.totalAppointments) * 100) : 0;
        assignedHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-color);">
                <span style="font-size:0.8rem;"><i class="fas fa-user"></i> ${escapeHtml(name)}</span>
                <span><strong>${count}</strong> <span style="color:var(--text-muted);">(${percentage}%)</span></span>
            </div>
        `;
    });
    
    // Build role distribution HTML
    let roleHtml = '';
    Object.entries(insights.roleStats).forEach(([role, count]) => {
        const percentage = insights.totalAppointments ? Math.round((count / insights.totalAppointments) * 100) : 0;
        roleHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-color);">
                <span style="font-size:0.8rem;"><i class="fas fa-briefcase"></i> ${escapeHtml(role)}</span>
                <span><strong>${count}</strong> <span style="color:var(--text-muted);">(${percentage}%)</span></span>
            </div>
        `;
    });
    
    // Build day stats HTML
    let dayHtml = '';
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    dayOrder.forEach(day => {
        const count = insights.dayStats[day] || 0;
        if (count > 0 || true) {
            dayHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-color);">
                    <span style="font-size:0.8rem;">${day}</span>
                    <span><strong>${count}</strong> appts</span>
                </div>
            `;
        }
    });
    
    insightsPanel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <i class="fas fa-chart-line" style="color:var(--primary); font-size:1.3rem;"></i>
                <h3 style="font-weight:600;">My Insights</h3>
            </div>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <span style="font-size:0.7rem; color:var(--text-muted);">Range</span>
                <input type="date" id="insightStartDate" value="${dashboardDateRange.start}" style="padding:8px 12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary); font-size:0.8rem;">
                <span>to</span>
                <input type="date" id="insightEndDate" value="${dashboardDateRange.end}" style="padding:8px 12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary); font-size:0.8rem;">
                <button id="applyInsightRange" class="btn-icon" style="padding:6px 16px;"><i class="fas fa-check"></i> Apply</button>
                <button id="resetInsightRange" class="btn-icon" style="padding:6px 16px; background:var(--bg-primary);"><i class="fas fa-calendar-day"></i> Today</button>
                <div style="display:flex; align-items:center; gap:6px; padding:4px 12px; background:var(--bg-primary); border-radius:40px;">
                    <i class="fas fa-globe"></i>
                    <span style="font-size:0.7rem;">Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                </div>
            </div>
        </div>
        
        <!-- Header Summary Cards -->
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px;">
            <div style="background:var(--bg-card); border-radius:20px; padding:16px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <div style="width:40px; height:40px; background:rgba(59,130,246,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-calendar-check" style="color:var(--primary); font-size:1.2rem;"></i>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Total Appointments</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--primary);">${insights.totalAppointments}</div>
                    </div>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted);">in selected date range</div>
            </div>
            
            <div style="background:var(--bg-card); border-radius:20px; padding:16px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <div style="width:40px; height:40px; background:rgba(16,185,129,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-building" style="color:var(--success); font-size:1.2rem;"></i>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Unique Businesses</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--success);">${insights.uniqueBusinesses}</div>
                    </div>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted);">distinct companies contacted</div>
            </div>
            
            <div style="background:var(--bg-card); border-radius:20px; padding:16px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <div style="width:40px; height:40px; background:rgba(245,158,11,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-chart-simple" style="color:var(--warning); font-size:1.2rem;"></i>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Avg Daily</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--warning);">${Math.round(insights.totalAppointments / Math.max(1, dateLabels.length))}</div>
                    </div>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted);">appointments per day</div>
            </div>
            
            <div style="background:var(--bg-card); border-radius:20px; padding:16px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <div style="width:40px; height:40px; background:rgba(139,92,246,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-percent" style="color:var(--secondary); font-size:1.2rem;"></i>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Goal Progress</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--secondary);">${insights.todayProgress}%</div>
                    </div>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted);">of daily goal achieved</div>
            </div>
        </div>
        
        <!-- Chart Section -->
        <div style="background:var(--bg-card); border-radius:24px; padding:20px; margin-bottom:24px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                <div><i class="fas fa-chart-column"></i> <strong>Appointment Trend</strong></div>
                <div style="display:flex; gap:8px;">
                    <button class="chart-view-btn" data-view="bar" style="padding:4px 12px; border-radius:20px; background:var(--primary); color:white; border:none; cursor:pointer;">Bar</button>
                    <button class="chart-view-btn" data-view="line" style="padding:4px 12px; border-radius:20px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer;">Line</button>
                </div>
            </div>
            <canvas id="insightsChart" style="width:100%; max-height:300px;"></canvas>
        </div>
        
        <!-- Two Column Layout for Detailed Stats -->
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:24px;">
            <!-- Left Column: Assignment & Role Distribution -->
            <div style="background:var(--bg-card); border-radius:24px; padding:20px; border:1px solid var(--border-color);">
                <h4 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-users"></i> Assignment Distribution</h4>
                <div style="max-height:200px; overflow-y:auto;">
                    ${assignedHtml || '<div style="padding:20px; text-align:center; color:var(--text-muted);">No data available</div>'}
                </div>
            </div>
            
            <div style="background:var(--bg-card); border-radius:24px; padding:20px; border:1px solid var(--border-color);">
                <h4 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-briefcase"></i> Role Distribution</h4>
                <div style="max-height:200px; overflow-y:auto;">
                    ${roleHtml || '<div style="padding:20px; text-align:center; color:var(--text-muted);">No data available</div>'}
                </div>
            </div>
            
            <!-- Goal Progress Section -->
            <div style="background:var(--bg-card); border-radius:24px; padding:20px; border:1px solid var(--border-color);">
                <h4 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-bullseye"></i> Goal Progress</h4>
                <div style="margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="font-size:0.8rem;">Daily Goal: ${insights.todayCount}/${insights.todayGoal}</span>
                        <span style="font-size:0.8rem;">${insights.todayProgress}%</span>
                    </div>
                    <div style="background:var(--bg-primary); border-radius:20px; height:8px; overflow:hidden;">
                        <div style="width:${insights.todayProgress}%; background:var(--primary); height:100%; border-radius:20px;"></div>
                    </div>
                </div>
                <div style="margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="font-size:0.8rem;">Weekly Goal: ${insights.weekCount}/${insights.weekGoal}</span>
                        <span style="font-size:0.8rem;">${insights.weekProgress}%</span>
                    </div>
                    <div style="background:var(--bg-primary); border-radius:20px; height:8px; overflow:hidden;">
                        <div style="width:${insights.weekProgress}%; background:var(--success); height:100%; border-radius:20px;"></div>
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="font-size:0.8rem;">Monthly Goal: ${insights.monthCount}/${insights.monthGoal}</span>
                        <span style="font-size:0.8rem;">${insights.monthProgress}%</span>
                    </div>
                    <div style="background:var(--bg-primary); border-radius:20px; height:8px; overflow:hidden;">
                        <div style="width:${insights.monthProgress}%; background:var(--secondary); height:100%; border-radius:20px;"></div>
                    </div>
                </div>
            </div>
            
            <div style="background:var(--bg-card); border-radius:24px; padding:20px; border:1px solid var(--border-color);">
                <h4 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-calendar-week"></i> Most Active Days</h4>
                <div style="max-height:200px; overflow-y:auto;">
                    ${dayHtml || '<div style="padding:20px; text-align:center; color:var(--text-muted);">No data available</div>'}
                </div>
            </div>
        </div>
    `;
    
    // Initialize or update chart
    const ctx = document.getElementById('insightsChart');
    if (ctx) {
        if (window.insightsChartInstance) {
            window.insightsChartInstance.destroy();
        }
        window.insightsChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dateLabels.map(d => formatDate(d)),
                datasets: [{
                    label: 'Appointments',
                    data: chartData,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} appointments` } }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Number of Appointments' }, grid: { color: 'var(--border-color)' } },
                    x: { title: { display: true, text: 'Date' }, grid: { display: false } }
                }
            }
        });
        
        // Chart view toggle
        document.querySelectorAll('.chart-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                if (window.insightsChartInstance) {
                    window.insightsChartInstance.config.type = view;
                    window.insightsChartInstance.update();
                }
                document.querySelectorAll('.chart-view-btn').forEach(b => {
                    if (b.getAttribute('data-view') === view) {
                        b.style.background = 'var(--primary)';
                        b.style.color = 'white';
                        b.style.border = 'none';
                    } else {
                        b.style.background = 'var(--bg-primary)';
                        b.style.color = 'var(--text-primary)';
                        b.style.border = '1px solid var(--border-color)';
                    }
                });
            });
        });
    }
    
    // Bind insight controls
    const startInput = document.getElementById('insightStartDate');
    const endInput = document.getElementById('insightEndDate');
    const applyBtn = document.getElementById('applyInsightRange');
    const resetBtn = document.getElementById('resetInsightRange');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (startInput && endInput) {
                dashboardDateRange.start = startInput.value;
                dashboardDateRange.end = endInput.value;
                renderInsightsDashboard();
                showToast('Insights updated', 'info');
            }
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            dashboardDateRange.start = getTodayStr();
            dashboardDateRange.end = getTodayStr();
            if (startInput) startInput.value = dashboardDateRange.start;
            if (endInput) endInput.value = dashboardDateRange.end;
            renderInsightsDashboard();
            showToast('Reset to today\'s range', 'info');
        });
    }
}

// ==================== REAL-TIME PRIORITY DASHBOARD ====================
function updateRealTimePriorityDashboard() {
    const now = new Date();
    const timeZones = [
        { name: 'Eastern (ET)', zone: 'America/New_York', priority: 1, label: '★ PRIORITY', color: '#10b981' },
        { name: 'Central (CT)', zone: 'America/Chicago', priority: 2, label: 'HIGH', color: '#3b82f6' },
        { name: 'Mountain (MT)', zone: 'America/Denver', priority: 3, label: 'MEDIUM', color: '#f59e0b' },
        { name: 'Pacific (PT)', zone: 'America/Los_Angeles', priority: 4, label: 'LOWER', color: '#8b5cf6' }
    ];
    
    let anyPrimeTime = false;
    let bestZone = '';
    let bestTimeStr = '';
    
    for (let tz of timeZones) {
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz.zone }));
        const hour = tzTime.getHours();
        const minute = tzTime.getMinutes();
        const isWeekday = tzTime.getDay() >= 1 && tzTime.getDay() <= 5;
        const isPrimeMorning = (hour === 10) || (hour === 11 && minute <= 30);
        const isPrimeAfternoon = (hour >= 14 && hour <= 15) || (hour === 16 && minute === 0);
        const isPrimeTime = (isPrimeMorning || isPrimeAfternoon) && isWeekday;
        const timeStr = tzTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        if (isPrimeTime) {
            anyPrimeTime = true;
            if (!bestZone) {
                bestZone = tz.name;
                bestTimeStr = timeStr;
            }
        }
    }
    
    const priorityText = document.getElementById('priorityTimeText');
    const tooltipStatus = document.getElementById('tooltipPrimeStatus');
    
    if (priorityText) {
        if (anyPrimeTime && bestZone) {
            priorityText.innerHTML = `<i class="fas fa-fire" style="color:#ff6b6b;"></i> ${bestZone} PRIME (${bestTimeStr})`;
            if (tooltipStatus) tooltipStatus.innerHTML = `🔥 ACTIVE PRIME WINDOW in ${bestZone} - Best time to call NOW!`;
        } else {
            const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const hour = etTime.getHours();
            let nextInfo = '';
            if (hour < 10) nextInfo = 'Next prime window: 10-11:30 AM ET';
            else if (hour < 14) nextInfo = 'Next prime window: 2-4 PM ET';
            else if (hour >= 16) nextInfo = 'Tomorrow 10-11:30 AM ET';
            else nextInfo = 'Check back during 10-11:30 AM or 2-4 PM ET';
            priorityText.innerHTML = `<i class="fas fa-clock"></i> ${nextInfo}`;
            if (tooltipStatus) tooltipStatus.innerHTML = `⏳ No active prime window · ${nextInfo}`;
        }
    }
}

// ==================== APPOINTMENT SYSTEM ====================
function loadAppointmentData() {
    const saved = localStorage.getItem('scriptflow_appointments_main');
    if (saved) appointments = JSON.parse(saved);
    const savedGoals = localStorage.getItem('scriptflow_goals_main');
    if (savedGoals) goals = JSON.parse(savedGoals);
    updateStats();
}

function saveAppointments() {
    localStorage.setItem('scriptflow_appointments_main', JSON.stringify(appointments));
    updateStats();
    // Refresh insights if panel is visible
    const insightsPanel = document.getElementById('insightsPanel');
    if (insightsPanel && insightsPanel.style.display !== 'none') {
        renderInsightsDashboard();
    }
}

function saveGoals() {
    localStorage.setItem('scriptflow_goals_main', JSON.stringify(goals));
    updateStats();
    const insightsPanel = document.getElementById('insightsPanel');
    if (insightsPanel && insightsPanel.style.display !== 'none') {
        renderInsightsDashboard();
    }
}

function getTodayCount() { return appointments[getTodayStr()]?.reports?.length || 0; }

function getWeekCount() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    let total = 0;
    for (let d in appointments) {
        const date = new Date(d);
        if (date >= start && date <= new Date(start.getTime() + 6 * 86400000) && appointments[d].reports)
            total += appointments[d].reports.length;
    }
    return total;
}

function getMonthCount() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let total = 0;
    for (let d in appointments) {
        const date = new Date(d);
        if (date >= start && date <= end && appointments[d].reports)
            total += appointments[d].reports.length;
    }
    return total;
}

function updateStats() {
    const todayEl = document.getElementById('statToday');
    const weekEl = document.getElementById('statWeek');
    const monthEl = document.getElementById('statMonth');
    if (todayEl) todayEl.innerText = getTodayCount();
    if (weekEl) weekEl.innerText = getWeekCount();
    if (monthEl) monthEl.innerText = getMonthCount();
    const goalDaily = document.getElementById('goalDaily');
    const goalWeekly = document.getElementById('goalWeekly');
    const goalMonthly = document.getElementById('goalMonthly');
    if (goalDaily) goalDaily.innerText = goals.daily;
    if (goalWeekly) goalWeekly.innerText = goals.weekly;
    if (goalMonthly) goalMonthly.innerText = goals.monthly;
}

function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned, editId = null) {
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    const newAppt = {
        id: editId || Date.now(),
        business, contactName, role, phone, time, notes, assigned,
        createdAt: new Date().toISOString(),
        fullText: `Business: ${business}\nContact: ${contactName}\nRole: ${role}\nPhone: ${phone}\nTime: ${time}\nNotes: ${notes}\nAssigned: ${assigned}\nDate: ${dateStr}`
    };
    if (editId) {
        const idx = appointments[dateStr].reports.findIndex(r => r.id === editId);
        if (idx !== -1) appointments[dateStr].reports[idx] = newAppt;
        else appointments[dateStr].reports.unshift(newAppt);
    } else {
        appointments[dateStr].reports.unshift(newAppt);
    }
    appointments[dateStr].count = appointments[dateStr].reports.length;
    saveAppointments();
    return newAppt.fullText;
}

function deleteAppointment(dateStr, id) {
    if (appointments[dateStr]?.reports) {
        appointments[dateStr].reports = appointments[dateStr].reports.filter(r => r.id !== id);
        if (appointments[dateStr].reports.length === 0) delete appointments[dateStr];
        else appointments[dateStr].count = appointments[dateStr].reports.length;
        saveAppointments();
        return true;
    }
    return false;
}

// ==================== DEFAULT SCRIPTS ====================
const defaultScripts = {
    "opening": { name: "🎯 Opening Script", content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is [Your Name]. I work with a web design company that helps companies like yours stand out online. We actually created a free, modern preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\"" },
    "owner_yes": { name: "👑 Owner - Yes", content: "✅ Perfect! I'll have my manager Daniel give you a quick call later today to show you the preview. Is this the best number to reach you at? Appreciate your time!" },
    "owner_no": { name: "👤 Not Owner", content: "❌ Got it — do you usually help with marketing or sales? What's the best time to reach the owner today? I'll have Daniel give them a quick call." },
    "objection_website": { name: "⚠️ Already have a website", content: "Totally understandable. Most businesses we speak with do. This isn't about replacing it immediately — just showing a fresh perspective. Worst case, you get some good ideas." },
    "objection_webguy": { name: "⚠️ Have a web guy", content: "That's great! Many of our clients already have developers. They just like getting a second opinion. No commitment — just worth comparing." },
    "objection_cost": { name: "💰 How much does it cost?", content: "The preview itself is completely free. Daniel would only go over pricing if you actually like what you see. Right now it's just about showing you the concept first." },
    "objection_busy": { name: "⏰ I'm busy", content: "Totally understand — that's why I'm not trying to go through everything now. What's easier for you — later today or tomorrow for a quick 5–10 minute look?" },
    "objection_not_interested": { name: "❌ Not interested", content: "No worries. Just so you know, we already built the preview, so there's nothing to buy. Would it hurt to at least take a quick look?" },
    "objection_info": { name: "📧 Send me info", content: "I definitely can. The only reason I prefer a quick walkthrough is because the preview makes more sense visually. It honestly takes about 5 minutes. What's better — later today or tomorrow?" },
    "objection_found_me": { name: "🔍 How did you find me?", content: "I came across your Google listing while looking at businesses in your area. Your business stood out, so we created a sample concept using public info." },
    "closing": { name: "🏁 Closing Script", content: "Awesome, we're excited to show you the preview! I'll have Daniel give you a quick call [later/tomorrow]. Appreciate your time, [Your Name]! Talk soon!" }
};

// ==================== SCRIPT MANAGEMENT ====================
function initVersionHistory(id, content) {
    if (!versionHistory[id]) {
        versionHistory[id] = [{ content, timestamp: new Date().toISOString() }];
        currentVersionIndex[id] = 0;
    }
}

function saveVersion(id, newContent) {
    if (!versionHistory[id]) initVersionHistory(id, newContent);
    if (currentVersionIndex[id] < versionHistory[id].length - 1)
        versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
    versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
    currentVersionIndex[id] = versionHistory[id].length - 1;
    localStorage.setItem('scriptflow_version_history', JSON.stringify(versionHistory));
}

function undoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] <= 0) {
        showToast('No earlier version', 'error');
        return;
    }
    currentVersionIndex[id]--;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) 
        document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Undo successful', 'info');
}

function redoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) {
        showToast('No newer version', 'error');
        return;
    }
    currentVersionIndex[id]++;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) 
        document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Redo successful', 'info');
}

function loadScripts() {
    const saved = localStorage.getItem('scriptflow_pro_scripts_main');
    if (saved) scripts = JSON.parse(saved);
    else scripts = JSON.parse(JSON.stringify(defaultScripts));
    const savedOrder = localStorage.getItem('scriptflow_order_main');
    if (savedOrder) customOrder = JSON.parse(savedOrder);
    else customOrder = ["opening", "owner_yes", "owner_no", "objection_website", "objection_webguy", "objection_cost", "objection_busy", "objection_not_interested", "objection_info", "objection_found_me", "closing"];
    const savedHistory = localStorage.getItem('scriptflow_version_history');
    if (savedHistory) versionHistory = JSON.parse(savedHistory);
    for (let id in scripts) {
        if (!versionHistory[id]) initVersionHistory(id, scripts[id].content);
        else currentVersionIndex[id] = versionHistory[id].length - 1;
    }
}

function saveAllScripts() {
    localStorage.setItem('scriptflow_pro_scripts_main', JSON.stringify(scripts));
    localStorage.setItem('scriptflow_order_main', JSON.stringify(customOrder));
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
        saveStatus.innerHTML = '<i class="fas fa-check"></i> Saved';
        setTimeout(() => {
            if (!isEditing && saveStatus) saveStatus.innerHTML = '<i class="fas fa-save"></i> Auto';
        }, 1500);
    }
}

function getOrderedVisible() {
    let ids = [...customOrder.filter(id => scripts[id]), ...Object.keys(scripts).filter(id => !customOrder.includes(id))];
    if (searchTerm) ids = ids.filter(id => scripts[id].name.toLowerCase().includes(searchTerm.toLowerCase()));
    return ids;
}

function getKeyMapping() {
    const vis = getOrderedVisible();
    const map = new Map();
    vis.slice(0, 9).forEach((id, i) => map.set((i + 1).toString(), id));
    return map;
}

function renderSidebar() {
    const container = document.getElementById('scriptListContainer');
    if (!container) return;
    const visible = getOrderedVisible();
    if (!visible.length) {
        container.innerHTML = '<div style="padding:20px; color: var(--sidebar-text-secondary);">No scripts</div>';
        return;
    }
    let html = '';
    visible.forEach((id, idx) => {
        const s = scripts[id];
        const active = currentScriptId === id;
        html += `<div class="script-item ${active ? 'active' : ''}" data-id="${id}">
            <span class="script-name">${escapeHtml(s.name)}</span>
            <div class="script-actions">
                <button class="script-action-btn rename-script" data-id="${id}"><i class="fas fa-pencil-alt"></i></button>
                <button class="script-action-btn delete-script" data-id="${id}" ${id === 'opening' ? 'disabled style="opacity:0.4;"' : ''}><i class="fas fa-trash"></i></button>
            </div>
            <span class="key-hint">${idx < 9 ? idx + 1 : ''}</span>
        </div>`;
    });
    container.innerHTML = html;
    attachScriptEvents();
    const idxCur = visible.indexOf(currentScriptId);
    const shortcutHint = document.getElementById('activeShortcutHint');
    if (shortcutHint) shortcutHint.innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur + 1}` : `Key: —`;
    const versionNum = document.getElementById('versionNumber');
    if (versionNum && versionHistory[currentScriptId]) 
        versionNum.innerText = `${currentVersionIndex[currentScriptId] + 1}/${versionHistory[currentScriptId].length}`;
}

function attachScriptEvents() {
    document.querySelectorAll('.script-item').forEach(el => {
        const id = el.getAttribute('data-id');
        el.addEventListener('click', (e) => {
            if (e.target.closest('.rename-script') || e.target.closest('.delete-script')) return;
            if (isEditing && confirm('Cancel editing?')) cancelEdit();
            if (!isEditing && id) loadScript(id);
        });
    });
    document.querySelectorAll('.rename-script').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const newName = prompt('New script name:', scripts[id].name);
            if (newName?.trim()) {
                scripts[id].name = newName.trim();
                saveAllScripts();
                renderSidebar();
                if (currentScriptId === id) {
                    const nameEl = document.getElementById('currentScriptName');
                    if (nameEl) nameEl.innerHTML = scripts[id].name;
                }
                showToast('Script renamed', 'success');
            }
        });
    });
    document.querySelectorAll('.delete-script').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (id === 'opening') {
                showToast('Cannot delete opening script', 'error');
                return;
            }
            if (confirm('Delete this script?')) {
                delete scripts[id];
                delete versionHistory[id];
                customOrder = customOrder.filter(i => i !== id);
                if (currentScriptId === id) loadScript('opening');
                saveAllScripts();
                renderSidebar();
                showToast('Script deleted', 'info');
            }
        });
    });
}

function loadScript(id) {
    if (!scripts[id] || isEditing) return;
    currentScriptId = id;
    const nameEl = document.getElementById('currentScriptName');
    if (nameEl) nameEl.innerHTML = scripts[id].name;
    const displayContent = replaceNameInScript(scripts[id].content);
    const contentEl = document.getElementById('scriptContent');
    if (contentEl) contentEl.innerHTML = `<div class="script-display">${escapeHtml(displayContent).replace(/\n/g, '<br>')}</div>`;
    renderSidebar();
}

function enterEdit() {
    isEditing = true;
    const editBtn = document.getElementById('editScriptBtn');
    const saveBtn = document.getElementById('saveScriptBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    const contentEl = document.getElementById('scriptContent');
    if (contentEl) {
        contentEl.innerHTML = `<textarea id="editTextarea" class="edit-textarea">${escapeHtml(scripts[currentScriptId].content)}</textarea>`;
        const textarea = document.getElementById('editTextarea');
        if (textarea) textarea.focus();
    }
    showToast('Edit mode enabled', 'info');
}

function saveEdit() {
    const textarea = document.getElementById('editTextarea');
    if (!textarea) return;
    const newContent = textarea.value;
    scripts[currentScriptId].content = newContent;
    saveVersion(currentScriptId, newContent);
    saveAllScripts();
    cancelEdit();
    showToast('Script saved!', 'success');
}

function cancelEdit() {
    isEditing = false;
    const editBtn = document.getElementById('editScriptBtn');
    const saveBtn = document.getElementById('saveScriptBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (editBtn) editBtn.style.display = 'inline-flex';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    loadScript(currentScriptId);
}

function copyScript() {
    copyToClipboard(replaceNameInScript(scripts[currentScriptId].content));
}

function resetScript() {
    if (defaultScripts[currentScriptId]) {
        if (confirm('Reset to original content?')) {
            scripts[currentScriptId] = { ...defaultScripts[currentScriptId] };
            saveVersion(currentScriptId, scripts[currentScriptId].content);
            saveAllScripts();
            loadScript(currentScriptId);
            showToast('Script reset to default', 'success');
        }
    } else showToast('No default version', 'error');
}

function addNewScript() {
    if (isEditing) {
        showToast('Finish editing first', 'error');
        return;
    }
    const name = prompt('Enter script name:');
    if (!name) return;
    const id = 'custom_' + Date.now();
    scripts[id] = { name, content: 'Write your custom script here...' };
    initVersionHistory(id, scripts[id].content);
    customOrder.push(id);
    saveAllScripts();
    renderSidebar();
    loadScript(id);
    showToast(`Added: ${name}`, 'success');
}

function showVersionHistoryModal() {
    if (!versionHistory[currentScriptId]) {
        showToast('No history available', 'error');
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    let html = `<div class="modal-card"><h3>📜 Version History: ${scripts[currentScriptId].name}</h3>`;
    versionHistory[currentScriptId].forEach((v, idx) => {
        html += `<div style="padding:12px; border-bottom:1px solid var(--border-color); cursor:pointer;" data-index="${idx}">${new Date(v.timestamp).toLocaleString()} ${idx === currentVersionIndex[currentScriptId] ? '✓ Current' : 'Restore'}</div>`;
    });
    html += `<button class="btn-icon" id="closeHistBtn" style="margin-top:16px;">Close</button></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-index]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'));
            currentVersionIndex[currentScriptId] = idx;
            scripts[currentScriptId].content = versionHistory[currentScriptId][idx].content;
            saveAllScripts();
            if (!isEditing) loadScript(currentScriptId);
            else if (isEditing && document.getElementById('editTextarea')) 
                document.getElementById('editTextarea').value = scripts[currentScriptId].content;
            showToast('Version restored', 'success');
            modal.remove();
        });
    });
    document.getElementById('closeHistBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ==================== CALENDAR MODAL ====================
function openCalendarModal() {
    if (calendarModal) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card" id="calModalInner" style="width:800px; max-width:95%;"></div>`;
    document.body.appendChild(modal);
    calendarModal = modal;
    renderCalendarModal();
    modal.addEventListener('click', (e) => { if (e.target === modal) closeCalendarModal(); });
}

function closeCalendarModal() {
    if (calendarModal) {
        calendarModal.remove();
        calendarModal = null;
    }
}

function getAppointmentDots(count) {
    if (count === 0) return '<div class="appointment-dots"></div>';
    let dots = '<div class="appointment-dots">';
    for (let i = 0; i < Math.min(count, 3); i++) dots += `<div class="appointment-dot"></div>`;
    if (count > 3) dots += `<span style="font-size:0.65rem; margin-left:2px;">+${count - 3}</span>`;
    dots += '</div>';
    return dots;
}

function renderCalendarModal() {
    const inner = document.getElementById('calModalInner');
    if (!inner) return;
    
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) daysHtml += `<div class="cal-day"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const apptCount = appointments[dateStr]?.reports?.length || 0;
        daysHtml += `<div class="cal-day ${selectedCalDate === dateStr ? 'selected' : ''}" data-date="${dateStr}">
            <div>${d}</div>${getAppointmentDots(apptCount)}
        </div>`;
    }
    
    const apptData = appointments[selectedCalDate] || { reports: [], note: '' };
    let reportsHtml = '<div style="margin-top:16px;"><strong>📋 Appointments for ' + selectedCalDate + '</strong><button id="copyAllReportsBtn" style="float:right; background:var(--bg-primary); border:none; padding:4px 12px; border-radius:20px; cursor:pointer;">Copy All</button><div style="clear:both;"></div>';
    
    if (apptData.reports && apptData.reports.length > 0) {
        apptData.reports.forEach(r => {
            reportsHtml += `<div class="appointment-card" data-appt-id="${r.id}">
                <strong>${escapeHtml(r.business)}</strong> - ${escapeHtml(r.contactName)}
                <div>📞 ${escapeHtml(r.phone || 'N/A')} | ⏰ ${escapeHtml(r.time || 'TBD')} | 👤 ${escapeHtml(r.role || 'N/A')}</div>
                <div>📝 ${escapeHtml(r.notes || 'No notes')}</div>
                <div class="appointment-actions">
                    <button class="edit-appt-btn" data-id="${r.id}" data-date="${selectedCalDate}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="delete-appt-btn" data-id="${r.id}" data-date="${selectedCalDate}"><i class="fas fa-trash"></i> Delete</button>
                    <button class="copy-single-btn" data-id="${r.id}" style="background:transparent; border:none; cursor:pointer; padding:4px 12px;"><i class="fas fa-copy"></i> Copy</button>
                </div>
            </div>`;
        });
    } else {
        reportsHtml += '<div style="padding:20px; text-align:center; color:var(--text-muted);">No appointments for this date</div>';
    }
    reportsHtml += '</div>';
    
    inner.innerHTML = `
        <div class="cal-header">
            <div><strong>${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</strong></div>
            <div>
                <button class="btn-icon" id="calPrevBtn" style="padding:6px 12px;">◀ Prev</button>
                <button class="btn-icon" id="calNextBtn" style="padding:6px 12px;">Next ▶</button>
                <button class="btn-icon" id="calTodayBtn" style="padding:6px 12px;">Today</button>
            </div>
        </div>
        <div class="cal-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-days" id="calendarDaysGrid">${daysHtml}</div>
        <div style="margin: 16px 0;">
            <label style="font-size:0.8rem; font-weight:600;">Quick jump:</label>
            <input type="date" id="quickDatePicker" value="${selectedCalDate}" style="margin-left:12px; padding:8px 12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary);">
        </div>
        <textarea id="apptNoteInput" rows="2" placeholder="Add a general note for this date..." style="width:100%; padding:12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary); margin-bottom:8px;">${escapeHtml(apptData.note || '')}</textarea>
        <button id="quickAddForDate" class="btn-icon" style="margin:8px 0; background:var(--secondary); color:white; width:100%;"><i class="fas fa-plus"></i> + Add Appointment for ${selectedCalDate}</button>
        ${reportsHtml}
        <div class="goal-input-group" style="margin-top:20px; display:flex; gap:12px;">
            <div style="flex:1;"><label style="font-size:0.7rem;">Daily Goal</label><input type="number" id="goalDailyInput" value="${goals.daily}" style="width:100%; padding:8px; border-radius:16px;"></div>
            <div style="flex:1;"><label style="font-size:0.7rem;">Weekly Goal</label><input type="number" id="goalWeeklyInput" value="${goals.weekly}" style="width:100%; padding:8px; border-radius:16px;"></div>
            <div style="flex:1;"><label style="font-size:0.7rem;">Monthly Goal</label><input type="number" id="goalMonthlyInput" value="${goals.monthly}" style="width:100%; padding:8px; border-radius:16px;"></div>
        </div>
        <div style="display:flex; gap:12px; margin-top:20px; justify-content:flex-end;">
            <button id="saveNoteBtn" class="btn-icon">Save Note</button>
            <button id="closeCalBtn" class="btn-icon">Close</button>
        </div>
    `;
    
    attachCalendarEvents();
}

function attachCalendarEvents() {
    document.querySelectorAll('.cal-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
            selectedCalDate = el.getAttribute('data-date');
            renderCalendarModal();
        });
    });
    
    const datePicker = document.getElementById('quickDatePicker');
    if (datePicker) {
        datePicker.addEventListener('change', (e) => {
            selectedCalDate = e.target.value;
            renderCalendarModal();
        });
    }
    
    document.querySelectorAll('.delete-appt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            const date = btn.getAttribute('data-date');
            if (confirm('Delete this appointment? This cannot be undone.')) {
                deleteAppointment(date, id);
                renderCalendarModal();
                showToast('Appointment deleted', 'info');
            }
        });
    });
    
    document.querySelectorAll('.edit-appt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            const date = btn.getAttribute('data-date');
            const appt = appointments[date]?.reports?.find(r => r.id === id);
            if (appt) openEditAppointmentModal(date, appt);
        });
    });
    
    document.querySelectorAll('.copy-single-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            for (let d in appointments) {
                const rep = appointments[d]?.reports?.find(r => r.id === id);
                if (rep) {
                    copyToClipboard(rep.fullText);
                    break;
                }
            }
        });
    });
    
    const prevBtn = document.getElementById('calPrevBtn');
    const nextBtn = document.getElementById('calNextBtn');
    const todayBtn = document.getElementById('calTodayBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderCalendarModal(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderCalendarModal(); });
    if (todayBtn) todayBtn.addEventListener('click', () => { currentCalDate = new Date(); selectedCalDate = getTodayStr(); renderCalendarModal(); });
    
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            if (!appointments[selectedCalDate]) appointments[selectedCalDate] = { count: 0, note: '', reports: [] };
            const noteInput = document.getElementById('apptNoteInput');
            if (noteInput) appointments[selectedCalDate].note = noteInput.value;
            saveAppointments();
            showToast('Note saved');
        });
    }
    
    const quickAddBtn = document.getElementById('quickAddForDate');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            closeCalendarModal();
            setTimeout(() => openQuickReportWithDate(selectedCalDate), 100);
        });
    }
    
    const closeBtn = document.getElementById('closeCalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeCalendarModal);
    
    const copyAllBtn = document.getElementById('copyAllReportsBtn');
    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', () => {
            const data = appointments[selectedCalDate];
            if (data?.reports && data.reports.length > 0) {
                copyToClipboard(data.reports.map(r => r.fullText).join('\n\n---\n\n'));
            } else {
                showToast('No appointments to copy', 'error');
            }
        });
    }
    
    ['goalDailyInput', 'goalWeeklyInput', 'goalMonthlyInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                const map = { goalDailyInput: 'daily', goalWeeklyInput: 'weekly', goalMonthlyInput: 'monthly' };
                goals[map[id]] = parseInt(el.value) || (id === 'goalDailyInput' ? 3 : id === 'goalWeeklyInput' ? 15 : 60);
                saveGoals();
                const goalDailySpan = document.getElementById('goalDaily');
                const goalWeeklySpan = document.getElementById('goalWeekly');
                const goalMonthlySpan = document.getElementById('goalMonthly');
                if (goalDailySpan) goalDailySpan.innerText = goals.daily;
                if (goalWeeklySpan) goalWeeklySpan.innerText = goals.weekly;
                if (goalMonthlySpan) goalMonthlySpan.innerText = goals.monthly;
                showToast('Goals updated');
                renderInsightsDashboard();
            });
        }
    });
}

function openEditAppointmentModal(oldDateStr, appt) {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `<div class="modal-card" style="width:500px;"><h3><i class="fas fa-edit"></i> Edit Appointment</h3>
        <div class="form-group"><label>Date</label><input type="date" id="editDate" value="${oldDateStr}"></div>
        <div class="form-group"><label>Business *</label><input id="editBusiness" value="${escapeHtml(appt.business)}" placeholder="Business name"></div>
        <div class="form-group"><label>Contact Name *</label><input id="editName" value="${escapeHtml(appt.contactName)}" placeholder="Contact name"></div>
        <div class="form-group"><label>Role</label><input id="editRole" value="${escapeHtml(appt.role)}" placeholder="Role (Owner/Manager/etc)"></div>
        <div class="form-group"><label>Phone</label><input id="editPhone" value="${escapeHtml(appt.phone)}" placeholder="Phone number"></div>
        <div class="form-group"><label>Time</label><input id="editTime" value="${escapeHtml(appt.time)}" placeholder="e.g., 2pm ET"></div>
        <div class="form-group"><label>Notes</label><textarea id="editNotes" rows="2" placeholder="Additional notes">${escapeHtml(appt.notes)}</textarea></div>
        <div class="form-group"><label>Assigned To</label><input id="editAssigned" value="${escapeHtml(appt.assigned)}" placeholder="Assigned team member"></div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px;">
            <button id="saveEditBtn" class="btn-icon" style="background:var(--success); color:white;"><i class="fas fa-save"></i> Save Changes</button>
            <button id="cancelEditModalBtn" class="btn-icon"><i class="fas fa-times"></i> Cancel</button>
        </div>
    </div>`;
    document.body.appendChild(modalDiv);
    
    document.getElementById('saveEditBtn').addEventListener('click', () => {
        const newDate = document.getElementById('editDate').value;
        const updatedBusiness = document.getElementById('editBusiness').value;
        const updatedName = document.getElementById('editName').value;
        
        if (!updatedBusiness || !updatedName) {
            showToast('Business and Contact name are required', 'error');
            return;
        }
        
        deleteAppointment(oldDateStr, appt.id);
        addAppointment(
            newDate, updatedBusiness, updatedName,
            document.getElementById('editRole').value,
            document.getElementById('editPhone').value,
            document.getElementById('editTime').value,
            document.getElementById('editNotes').value,
            document.getElementById('editAssigned').value,
            appt.id
        );
        
        selectedCalDate = newDate;
        modalDiv.remove();
        closeCalendarModal();
        openCalendarModal();
        showToast('Appointment updated and moved to ' + newDate, 'success');
        renderInsightsDashboard();
    });
    
    document.getElementById('cancelEditModalBtn').addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });
}

// ==================== MODAL FUNCTIONS ====================
function openQuickReportWithDate(defaultDate) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-plus-circle"></i> Quick Add Appointment</h3>
        <div class="form-group"><label>Date</label><input type="date" id="reportDate" value="${defaultDate}"></div>
        <div class="form-group"><label>Business Name *</label><input id="reportBusiness" placeholder="Company name"></div>
        <div class="form-group"><label>Contact Name *</label><input id="reportName" placeholder="Full name"></div>
        <div class="form-group"><label>Role</label><select id="reportRole"><option>Owner</option><option>Manager</option><option>Director</option><option>Marketing</option><option>Admin</option></select></div>
        <div class="form-group"><label>Phone Number</label><input id="reportPhone" placeholder="Phone number"></div>
        <div class="form-group"><label>Time</label><input id="reportTime" placeholder="e.g., Monday 3pm ET"></div>
        <div class="form-group"><label>Notes</label><textarea id="reportNotes" rows="2" placeholder="Appointment details..."></textarea></div>
        <div class="form-group"><label>Assigned To</label><input id="reportAssigned" value="Daniel"></div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px;">
            <button id="submitReportBtn" class="btn-icon" style="background:var(--success); color:white;"><i class="fas fa-save"></i> Save & Copy</button>
            <button id="closeReportBtn" class="btn-icon"><i class="fas fa-times"></i> Cancel</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    
    document.getElementById('submitReportBtn').addEventListener('click', () => {
        const bus = document.getElementById('reportBusiness').value;
        const name = document.getElementById('reportName').value;
        if (!bus || !name) {
            showToast('Business and Contact name are required', 'error');
            return;
        }
        const text = addAppointment(
            document.getElementById('reportDate').value, bus, name,
            document.getElementById('reportRole').value,
            document.getElementById('reportPhone').value,
            document.getElementById('reportTime').value,
            document.getElementById('reportNotes').value,
            document.getElementById('reportAssigned').value
        );
        copyToClipboard(text);
        modal.remove();
        if (calendarModal) openCalendarModal();
        showToast('Appointment saved!', 'success');
        renderInsightsDashboard();
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function openQuickReport() {
    openQuickReportWithDate(getTodayStr());
}

function openPriorityModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const now = new Date();
    const timeZones = [
        { name: 'Eastern (ET) ★ PRIORITY', zone: 'America/New_York', priority: 1, recommendation: 'Call NOW if within 10-11:30 AM or 2-4 PM' },
        { name: 'Central (CT)', zone: 'America/Chicago', priority: 2, recommendation: 'Second priority - good connection rates' },
        { name: 'Mountain (MT)', zone: 'America/Denver', priority: 3, recommendation: 'Medium priority - best in late morning' },
        { name: 'Pacific (PT)', zone: 'America/Los_Angeles', priority: 4, recommendation: 'Lower priority - call later in day' }
    ];
    
    let zonesHtml = '';
    let activePrimeZones = [];
    
    for (let tz of timeZones) {
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz.zone }));
        const hour = tzTime.getHours();
        const minute = tzTime.getMinutes();
        const isWeekday = tzTime.getDay() >= 1 && tzTime.getDay() <= 5;
        const isPrimeMorning = (hour === 10) || (hour === 11 && minute <= 30);
        const isPrimeAfternoon = (hour >= 14 && hour <= 15) || (hour === 16 && minute === 0);
        const isPrimeTime = (isPrimeMorning || isPrimeAfternoon) && isWeekday;
        const timeStr = tzTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        if (isPrimeTime) {
            activePrimeZones.push(tz.name);
        }
        
        const priorityLevel = tz.priority === 1 ? 'HIGHEST' : (tz.priority === 2 ? 'HIGH' : (tz.priority === 3 ? 'MEDIUM' : 'LOWER'));
        const priorityColor = tz.priority === 1 ? '#10b981' : (tz.priority === 2 ? '#3b82f6' : (tz.priority === 3 ? '#f59e0b' : '#8b5cf6'));
        
        zonesHtml += `
            <div class="timezone-card ${isPrimeTime ? 'recommended' : ''}" style="border-left:4px solid ${priorityColor};">
                <div class="timezone-name" style="font-weight:700; font-size:1rem;">${tz.name}</div>
                <div style="font-size:1.5rem; font-weight:800; margin:8px 0; color:var(--primary);">${timeStr}</div>
                <div class="best-time-badge ${isPrimeTime ? 'best-time-high' : ''}" style="${!isPrimeTime ? 'background:var(--primary); color:white;' : ''}">
                    ${isPrimeTime ? '🔥 PRIME TIME - CALL NOW' : 'Awaiting Prime Window'}
                </div>
                <div style="font-size:0.7rem; margin-top:8px; color:var(--text-muted);">Priority: ${priorityLevel}</div>
                <div style="font-size:0.7rem; margin-top:4px;">${tz.recommendation}</div>
            </div>
        `;
    }
    
    const primeMessage = activePrimeZones.length > 0 
        ? `<div style="background:#10b981; color:white; padding:12px; border-radius:16px; margin-bottom:16px; text-align:center;">
            <strong><i class="fas fa-bell"></i> ACTIVE PRIME WINDOWS NOW:</strong> ${activePrimeZones.join(', ')}
           </div>`
        : `<div style="background:var(--warning); color:#1e293b; padding:12px; border-radius:16px; margin-bottom:16px; text-align:center;">
            <strong><i class="fas fa-clock"></i> No Active Prime Windows</strong><br>Next prime window: 10-11:30 AM or 2-4 PM local time
           </div>`;
    
    modal.innerHTML = `<div class="modal-card priority-modal" style="width:700px; max-width:95%;">
        <div style="background: linear-gradient(135deg, var(--primary), var(--secondary)); color:white; padding:20px; border-radius:24px; margin-bottom:20px; text-align:center;">
            <h2><i class="fas fa-chart-line"></i> REAL-TIME CALL PRIORITY DASHBOARD</h2>
            <div style="margin-top:8px;">All US Time Zones - Call When Green</div>
        </div>
        ${primeMessage}
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:20px;">
            ${zonesHtml}
        </div>
        <div style="padding:16px; background:var(--bg-primary); border-radius:20px; margin-top:8px;">
            <strong>🎯 CALL PRIORITY ORDER (Highest to Lowest):</strong><br>
            1. <span style="color:#10b981;">Eastern (ET)</span> - Most business owners, best connection rates<br>
            2. <span style="color:#3b82f6;">Central (CT)</span> - Strong second priority<br>
            3. <span style="color:#f59e0b;">Mountain (MT)</span> - Medium priority<br>
            4. <span style="color:#8b5cf6;">Pacific (PT)</span> - Call later in their day
        </div>
        <div style="padding:16px; background:var(--bg-primary); border-radius:20px; margin-top:12px;">
            <strong>💡 BEST PRACTICES:</strong><br>
            • Best days: Tuesday, Wednesday, Thursday<br>
            • Best hours: 10-11:30 AM or 2-4 PM local time<br>
            • Avoid: Monday mornings & Friday afternoons<br>
            • Lunch hour (12-1 PM) has <30% answer rate
        </div>
        <div style="margin-top:20px;"><button id="closePriorityBtn" class="btn-icon" style="background:var(--primary); width:100%;"><i class="fas fa-phone"></i> Start Calling</button></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('closePriorityBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function setUserName() {
    const newName = prompt('Enter your name (replaces [Your Name] in scripts):', userName);
    if (newName?.trim()) {
        userName = newName.trim();
        localStorage.setItem('scriptflow_user_name', userName);
        showToast(`Name set to: ${userName}`, 'success');
        if (!isEditing) loadScript(currentScriptId);
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('scriptflow_theme_main', document.body.classList.contains('dark') ? 'dark' : 'light');
    showToast(`${document.body.classList.contains('dark') ? 'Dark' : 'Light'} mode enabled`, 'info');
    renderInsightsDashboard();
}

function openHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-question-circle"></i> ScriptFlow Pro Guide</h3>
        <div style="margin:16px 0;"><strong>📊 Insights Dashboard</strong><br>• View total appointments, unique businesses, and goal progress<br>• Select date range to filter insights<br>• Toggle between bar/line chart views<br>• See assignment and role distribution</div>
        <div style="margin:16px 0;"><strong>🎯 Real-Time Priority Dashboard</strong><br>• Shows all 4 US time zones with real-time status<br>• Green border = PRIME TIME - Best time to call NOW</div>
        <div style="margin:16px 0;"><strong>📅 Appointment Calendar</strong><br>• Click "Appointment Calendar" in Tools menu<br>• Edit/Delete appointments, change dates</div>
        <button id="closeHelp" class="btn-icon" style="margin-top:16px; width:100%;"><i class="fas fa-check"></i> Got it</button></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeHelp').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function exportToCSV() {
    let csvRows = [['Date', 'Business', 'Contact', 'Role', 'Phone', 'Time', 'Notes', 'Assigned', 'Created']];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => {
                csvRows.push([date, a.business, a.contactName, a.role || '', a.phone || '', a.time || '', a.notes || '', a.assigned || '', a.createdAt || '']);
            });
        }
    }
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `scriptflow_appointments_${getTodayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${csvRows.length - 1} appointments to CSV`, 'success');
}

function factoryReset() {
    if (confirm('⚠️ FACTORY RESET: This will erase ALL scripts, appointments, and settings. Cannot be undone.')) {
        localStorage.clear();
        location.reload();
    }
}

// ==================== TOGGLE FUNCTIONS ====================
function toggleToolsMenu() {
    toolsOpen = !toolsOpen;
    const toolsMenuElem = document.getElementById('toolsMenu');
    const toolsChevronElem = document.getElementById('toolsChevron');
    if (toolsOpen) {
        if (toolsMenuElem) toolsMenuElem.classList.add('open');
        if (toolsChevronElem) toolsChevronElem.classList.add('rotated');
    } else {
        if (toolsMenuElem) toolsMenuElem.classList.remove('open');
        if (toolsChevronElem) toolsChevronElem.classList.remove('rotated');
    }
    localStorage.setItem('toolsMenuOpen', toolsOpen);
}

function toggleInsights() {
    const insightsPanel = document.getElementById('insightsPanel');
    const insightsBtn = document.getElementById('insightsNavBtn');
    if (insightsPanel.style.display === 'none') {
        insightsPanel.style.display = 'block';
        if (insightsBtn) insightsBtn.style.background = 'var(--sidebar-active)';
        renderInsightsDashboard();
    } else {
        insightsPanel.style.display = 'none';
        if (insightsBtn) insightsBtn.style.background = 'transparent';
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // Setup tools dropdown
    const toolsHeaderElem = document.getElementById('toolsHeader');
    if (toolsHeaderElem) toolsHeaderElem.addEventListener('click', toggleToolsMenu);
    
    const toolsMenuElem = document.getElementById('toolsMenu');
    const toolsChevronElem = document.getElementById('toolsChevron');
    if (toolsOpen && toolsMenuElem && toolsChevronElem) {
        toolsMenuElem.classList.add('open');
        toolsChevronElem.classList.add('rotated');
    }
    
    // Sidebar toggle
    const menuToggle = document.getElementById('menuToggleBtn');
    const sidebar = document.getElementById('mainSidebar');
    const mainContent = document.getElementById('mainContent');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.toggle('closed');
            if (mainContent) mainContent.classList.toggle('expanded');
            if (sidebar) localStorage.setItem('sidebarClosed', sidebar.classList.contains('closed'));
        });
    }
    if (sidebar && localStorage.getItem('sidebarClosed') === 'true') {
        sidebar.classList.add('closed');
        if (mainContent) mainContent.classList.add('expanded');
    }
    
    // Load data and initialize
    loadAppointmentData();
    loadScripts();
    renderSidebar();
    loadScript('opening');
    
    // Theme
    if (localStorage.getItem('scriptflow_theme_main') === 'dark') document.body.classList.add('dark');
    
    // Set up event listeners
    const addBtn = document.getElementById('addScriptBtnSide');
    if (addBtn) addBtn.addEventListener('click', addNewScript);
    const editBtn = document.getElementById('editScriptBtn');
    if (editBtn) editBtn.addEventListener('click', enterEdit);
    const saveBtn = document.getElementById('saveScriptBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveEdit);
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
    const copyBtn = document.getElementById('copyScriptBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyScript);
    const resetBtn = document.getElementById('resetScriptBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetScript);
    const undo = document.getElementById('undoBtn');
    if (undo) undo.addEventListener('click', () => undoScript(currentScriptId));
    const redo = document.getElementById('redoBtn');
    if (redo) redo.addEventListener('click', () => redoScript(currentScriptId));
    const quickReport = document.getElementById('quickReportBtn');
    if (quickReport) quickReport.addEventListener('click', openQuickReport);
    const history = document.getElementById('historyBtn');
    if (history) history.addEventListener('click', showVersionHistoryModal);
    const calendarNav = document.getElementById('calendarNavBtn');
    if (calendarNav) calendarNav.addEventListener('click', openCalendarModal);
    const priorityNav = document.getElementById('priorityNavBtn');
    if (priorityNav) priorityNav.addEventListener('click', openPriorityModal);
    const exportNav = document.getElementById('exportNavBtn');
    if (exportNav) exportNav.addEventListener('click', exportToCSV);
    const userNav = document.getElementById('userNavBtn');
    if (userNav) userNav.addEventListener('click', setUserName);
    const themeNav = document.getElementById('themeNavBtn');
    if (themeNav) themeNav.addEventListener('click', toggleTheme);
    const helpNav = document.getElementById('helpNavBtn');
    if (helpNav) helpNav.addEventListener('click', openHelpModal);
    const resetNav = document.getElementById('resetNavBtn');
    if (resetNav) resetNav.addEventListener('click', factoryReset);
    const insightsNav = document.getElementById('insightsNavBtn');
    if (insightsNav) insightsNav.addEventListener('click', toggleInsights);
    const scriptSearch = document.getElementById('scriptSearch');
    if (scriptSearch) {
        scriptSearch.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderSidebar();
        });
    }
    
    // Initialize Insights Panel (hidden by default, toggle to show)
    const insightsPanel = document.getElementById('insightsPanel');
    if (insightsPanel) {
        insightsPanel.style.display = 'none';
    }
    
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9' && !isEditing && !e.target.matches('textarea,input')) {
            e.preventDefault();
            const target = getKeyMapping().get(e.key);
            if (target && scripts[target]) {
                loadScript(target);
                showToast(`Switched to: ${scripts[target].name}`, 'info');
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isEditing) {
            e.preventDefault();
            undoScript(currentScriptId);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !isEditing) {
            e.preventDefault();
            redoScript(currentScriptId);
        }
        if (e.key === 'Escape' && isEditing) {
            cancelEdit();
            showToast('Edit cancelled', 'info');
        }
    });
    
    // Start real-time priority updates
    updateRealTimePriorityDashboard();
    setInterval(updateRealTimePriorityDashboard, 1000);
    setInterval(() => updateStats(), 5000);
});
