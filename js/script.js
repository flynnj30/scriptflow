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

// Calendar Modal State
let currentCalDate = new Date();
let selectedCalDate = new Date().toISOString().split('T')[0];
let calendarModal = null;

let toolsOpen = localStorage.getItem('toolsMenuOpen') === 'true';
let currentActiveTool = null;
let insightsChartInstance = null;

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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function replaceNameInScript(content) {
    return content.replace(/\[Your Name\]/gi, userName);
}

// ==================== FEATURE PANEL TOGGLE ====================
function showFeaturePanel(toolId, title) {
    const scriptsSection = document.getElementById('scriptsSection');
    const featurePanel = document.getElementById('featurePanel');
    const featureTitle = document.getElementById('featureTitle');
    const featureContent = document.getElementById('featureContent');
    
    if (!scriptsSection || !featurePanel) return;
    
    currentActiveTool = toolId;
    featureTitle.textContent = title;
    
    // Render the appropriate feature content
    switch(toolId) {
        case 'insights':
            renderInsightsFeature(featureContent);
            break;
        case 'calendar':
            renderCalendarFeature(featureContent);
            break;
        case 'priority':
            renderPriorityFeature(featureContent);
            break;
        case 'export':
            renderExportFeature(featureContent);
            break;
        case 'username':
            renderUsernameFeature(featureContent);
            break;
        case 'theme':
            renderThemeFeature(featureContent);
            break;
        case 'help':
            renderHelpFeature(featureContent);
            break;
        case 'reset':
            renderResetFeature(featureContent);
            break;
        default:
            featureContent.innerHTML = '<p>Feature coming soon...</p>';
    }
    
    // Hide scripts section, show feature panel
    scriptsSection.style.display = 'none';
    featurePanel.style.display = 'block';
}

function hideFeaturePanel() {
    const scriptsSection = document.getElementById('scriptsSection');
    const featurePanel = document.getElementById('featurePanel');
    
    if (scriptsSection && featurePanel) {
        scriptsSection.style.display = 'block';
        featurePanel.style.display = 'none';
        currentActiveTool = null;
    }
}

// ==================== FEATURE RENDERERS ====================
function renderInsightsFeature(container) {
    // Get data for insights
    const appointmentsList = [];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => {
                appointmentsList.push({ ...a, date });
            });
        }
    }
    
    const totalAppointments = appointmentsList.length;
    const uniqueBusinesses = new Set(appointmentsList.map(a => a.business)).size;
    const todayCount = appointments[getTodayStr()]?.reports?.length || 0;
    const todayProgress = Math.min(100, Math.round((todayCount / goals.daily) * 100));
    
    // Group by day for chart
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }
    const chartData = last7Days.map(date => appointments[date]?.reports?.length || 0);
    const chartLabels = last7Days.map(d => formatDate(d));
    
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div class="insights-summary">
                <div class="insight-stat">
                    <div class="insight-stat-value">${totalAppointments}</div>
                    <div class="insight-stat-label">Total Appointments</div>
                </div>
                <div class="insight-stat">
                    <div class="insight-stat-value">${uniqueBusinesses}</div>
                    <div class="insight-stat-label">Unique Businesses</div>
                </div>
                <div class="insight-stat">
                    <div class="insight-stat-value">${todayCount}/${goals.daily}</div>
                    <div class="insight-stat-label">Today's Progress</div>
                    <div style="background:var(--bg-primary); border-radius:10px; height:4px; margin-top:8px; overflow:hidden;">
                        <div style="width:${todayProgress}%; background:var(--success); height:100%;"></div>
                    </div>
                </div>
                <div class="insight-stat">
                    <div class="insight-stat-value">${Math.round(totalAppointments / Math.max(1, appointmentsList.length)) || 0}</div>
                    <div class="insight-stat-label">Avg per Appointment</div>
                </div>
            </div>
            <div class="feature-card">
                <h4><i class="fas fa-chart-line"></i> Last 7 Days Trend</h4>
                <canvas id="featureInsightsChart" style="width:100%; max-height:200px;"></canvas>
            </div>
            <div class="feature-card">
                <h4><i class="fas fa-users"></i> Assignment Distribution</h4>
                <div id="assignmentList"></div>
            </div>
            <div class="feature-card">
                <h4><i class="fas fa-bullseye"></i> Goal Progress</h4>
                <div>Daily: ${getTodayCount()}/${goals.daily} (${Math.round((getTodayCount()/goals.daily)*100)}%)</div>
                <div style="background:var(--bg-primary); border-radius:10px; height:6px; margin:8px 0; overflow:hidden;">
                    <div style="width:${Math.min(100, (getTodayCount()/goals.daily)*100)}%; background:var(--primary); height:100%;"></div>
                </div>
                <div>Weekly: ${getWeekCount()}/${goals.weekly} (${Math.round((getWeekCount()/goals.weekly)*100)}%)</div>
                <div style="background:var(--bg-primary); border-radius:10px; height:6px; margin:8px 0; overflow:hidden;">
                    <div style="width:${Math.min(100, (getWeekCount()/goals.weekly)*100)}%; background:var(--success); height:100%;"></div>
                </div>
                <div>Monthly: ${getMonthCount()}/${goals.monthly} (${Math.round((getMonthCount()/goals.monthly)*100)}%)</div>
                <div style="background:var(--bg-primary); border-radius:10px; height:6px; margin:8px 0; overflow:hidden;">
                    <div style="width:${Math.min(100, (getMonthCount()/goals.monthly)*100)}%; background:var(--secondary); height:100%;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Create chart
    const ctx = document.getElementById('featureInsightsChart');
    if (ctx) {
        if (window.featureChartInstance) window.featureChartInstance.destroy();
        window.featureChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: chartLabels, datasets: [{ label: 'Appointments', data: chartData, backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
        });
    }
    
    // Render assignment distribution
    const assignedStats = {};
    appointmentsList.forEach(a => {
        const assigned = a.assigned || 'Unassigned';
        assignedStats[assigned] = (assignedStats[assigned] || 0) + 1;
    });
    const assignmentHtml = Object.entries(assignedStats).map(([name, count]) => 
        `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span>${escapeHtml(name)}</span><span><strong>${count}</strong></span>
        </div>`
    ).join('');
    document.getElementById('assignmentList').innerHTML = assignmentHtml || '<div>No data</div>';
}

function renderCalendarFeature(container) {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) daysHtml += `<div class="calendar-feature-day"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const apptCount = appointments[dateStr]?.reports?.length || 0;
        daysHtml += `<div class="calendar-feature-day" data-date="${dateStr}">
            <div>${d}</div>
            ${apptCount > 0 ? `<span style="font-size:0.6rem; background:var(--success); padding:2px 4px; border-radius:10px;">${apptCount}</span>` : ''}
        </div>`;
    }
    
    container.innerHTML = `
        <div class="feature-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h4>${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</h4>
                <div>
                    <button id="calFeaturePrev" class="back-btn" style="padding:4px 12px;">◀</button>
                    <button id="calFeatureNext" class="back-btn" style="padding:4px 12px;">▶</button>
                    <button id="calFeatureToday" class="back-btn" style="padding:4px 12px;">Today</button>
                </div>
            </div>
            <div class="calendar-feature-grid">${daysHtml}</div>
            <div style="margin-top:16px;">
                <strong>Quick Add:</strong>
                <input type="date" id="calFeatureDate" value="${getTodayStr()}" style="margin-left:12px; padding:6px 12px; border-radius:20px; background:var(--bg-primary); border:1px solid var(--border-color);">
                <button id="calFeatureAddBtn" class="back-btn" style="margin-left:12px;"><i class="fas fa-plus"></i> Add</button>
            </div>
            <div id="calFeatureAppointments" style="margin-top:16px; max-height:200px; overflow-y:auto;">
                <strong>Appointments for ${selectedCalDate}:</strong>
                ${renderAppointmentsForDate(selectedCalDate)}
            </div>
        </div>
    `;
    
    // Bind calendar events
    document.querySelectorAll('.calendar-feature-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
            selectedCalDate = el.getAttribute('data-date');
            renderCalendarFeature(container);
        });
    });
    
    document.getElementById('calFeaturePrev')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendarFeature(container);
    });
    document.getElementById('calFeatureNext')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendarFeature(container);
    });
    document.getElementById('calFeatureToday')?.addEventListener('click', () => {
        currentCalDate = new Date();
        selectedCalDate = getTodayStr();
        renderCalendarFeature(container);
    });
    document.getElementById('calFeatureAddBtn')?.addEventListener('click', () => {
        const date = document.getElementById('calFeatureDate').value;
        hideFeaturePanel();
        setTimeout(() => openQuickReportWithDate(date), 100);
    });
}

function renderAppointmentsForDate(dateStr) {
    const apptData = appointments[dateStr]?.reports || [];
    if (!apptData.length) return '<div style="color:var(--text-muted); padding:12px;">No appointments</div>';
    return apptData.map(r => `
        <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
            <strong>${escapeHtml(r.business)}</strong> - ${escapeHtml(r.contactName)}
            <div style="font-size:0.7rem; color:var(--text-muted);">${escapeHtml(r.time || 'No time')}</div>
        </div>
    `).join('');
}

function renderPriorityFeature(container) {
    const now = new Date();
    const timeZones = [
        { name: 'Eastern (ET) ★', zone: 'America/New_York', priority: 1 },
        { name: 'Central (CT)', zone: 'America/Chicago', priority: 2 },
        { name: 'Mountain (MT)', zone: 'America/Denver', priority: 3 },
        { name: 'Pacific (PT)', zone: 'America/Los_Angeles', priority: 4 }
    ];
    
    let zonesHtml = '';
    for (let tz of timeZones) {
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz.zone }));
        const hour = tzTime.getHours();
        const minute = tzTime.getMinutes();
        const isPrime = (hour >= 10 && hour <= 11) || (hour >= 14 && hour <= 16);
        zonesHtml += `
            <div class="priority-feature-timezone ${isPrime ? 'prime' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${tz.name}</strong>
                    <span style="font-size:1.2rem; font-weight:700;">${tzTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="font-size:0.75rem; margin-top:8px;">
                    ${isPrime ? '🔥 PRIME TIME - Best time to call now!' : 'Best hours: 10-11:30 AM or 2-4 PM local'}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="feature-card">
            <h4><i class="fas fa-chart-line"></i> Real-Time Call Priority</h4>
            <p style="margin-bottom:16px;">Best times to reach US business owners based on their local time:</p>
            ${zonesHtml}
            <div style="margin-top:16px; padding:12px; background:rgba(16,185,129,0.1); border-radius:12px;">
                <strong>💡 Pro Tips:</strong><br>
                • Best days: Tuesday, Wednesday, Thursday<br>
                • Avoid: Monday mornings & Friday afternoons<br>
                • Lunch hour (12-1 PM) has <30% answer rate
            </div>
        </div>
    `;
}

function renderExportFeature(container) {
    container.innerHTML = `
        <div class="feature-card">
            <h4><i class="fas fa-file-csv"></i> Export Data</h4>
            <p>Export all your appointments to a CSV file that can be opened in Excel, Google Sheets, or any spreadsheet application.</p>
            <button id="doExportBtn" class="back-btn" style="margin-top:16px; width:100%; justify-content:center;"><i class="fas fa-download"></i> Export to CSV</button>
        </div>
    `;
    document.getElementById('doExportBtn')?.addEventListener('click', exportToCSV);
}

function renderUsernameFeature(container) {
    container.innerHTML = `
        <div class="feature-card">
            <h4><i class="fas fa-user-circle"></i> Set Your Name</h4>
            <p>Your name replaces <strong>[Your Name]</strong> in all scripts. Current name: <strong>${escapeHtml(userName)}</strong></p>
            <input type="text" id="newUserName" value="${escapeHtml(userName)}" placeholder="Enter your name" style="width:100%; padding:10px; border-radius:20px; background:var(--bg-primary); border:1px solid var(--border-color); margin:16px 0;">
            <button id="saveUserNameBtn" class="back-btn" style="width:100%; justify-content:center;"><i class="fas fa-save"></i> Save Name</button>
        </div>
    `;
    document.getElementById('saveUserNameBtn')?.addEventListener('click', () => {
        const newName = document.getElementById('newUserName').value;
        if (newName.trim()) {
            userName = newName.trim();
            localStorage.setItem('scriptflow_user_name', userName);
            showToast(`Name set to: ${userName}`, 'success');
            if (!isEditing) loadScript(currentScriptId);
            hideFeaturePanel();
        }
    });
}

function renderThemeFeature(container) {
    const isDark = document.body.classList.contains('dark');
    container.innerHTML = `
        <div class="feature-card">
            <h4><i class="fas fa-palette"></i> Theme Settings</h4>
            <p>Choose your preferred appearance for the application.</p>
            <div style="display:flex; gap:16px; margin-top:16px;">
                <button id="setLightTheme" class="back-btn" style="flex:1; justify-content:center;"><i class="fas fa-sun"></i> Light Mode</button>
                <button id="setDarkTheme" class="back-btn" style="flex:1; justify-content:center;"><i class="fas fa-moon"></i> Dark Mode</button>
            </div>
            <div style="margin-top:16px; padding:12px; background:rgba(59,130,246,0.1); border-radius:12px;">
                Current: <strong>${isDark ? 'Dark Mode' : 'Light Mode'}</strong>
            </div>
        </div>
    `;
    document.getElementById('setLightTheme')?.addEventListener('click', () => {
        if (document.body.classList.contains('dark')) toggleTheme();
        hideFeaturePanel();
    });
    document.getElementById('setDarkTheme')?.addEventListener('click', () => {
        if (!document.body.classList.contains('dark')) toggleTheme();
        hideFeaturePanel();
    });
}

function renderHelpFeature(container) {
    container.innerHTML = `
        <div class="feature-card">
            <h4><i class="fas fa-question-circle"></i> ScriptFlow Pro Guide</h4>
            <div style="margin:16px 0;"><strong>📊 Insights Dashboard</strong><br>View analytics about your appointments and progress.</div>
            <div style="margin:16px 0;"><strong>📅 Appointment Calendar</strong><br>Manage appointments, view by date, edit or delete.</div>
            <div style="margin:16px 0;"><strong>🎯 Call Priority Predictor</strong><br>Real-time US time zones - shows best calling windows.</div>
            <div style="margin:16px 0;"><strong>📝 Script Management</strong><br>11 scripts, edit with undo/redo, press 1-9 to switch.</div>
            <div style="margin:16px 0;"><strong>⚙️ Tools</strong><br>Export CSV, set name, theme toggle, factory reset.</div>
            <button id="closeHelpFeatureBtn" class="back-btn" style="width:100%; justify-content:center; margin-top:16px;">Got it</button>
        </div>
    `;
    document.getElementById('closeHelpFeatureBtn')?.addEventListener('click', () => hideFeaturePanel());
}

function renderResetFeature(container) {
    container.innerHTML = `
        <div class="feature-card">
            <h4><i class="fas fa-exclamation-triangle"></i> Factory Reset</h4>
            <p style="color:var(--danger);"><strong>⚠️ Warning: This action cannot be undone!</strong></p>
            <p>Factory reset will erase ALL of the following:</p>
            <ul style="margin:16px 0; padding-left:20px;">
                <li>All call scripts and custom scripts</li>
                <li>All appointments and notes</li>
                <li>All goals and settings</li>
                <li>Version history</li>
            </ul>
            <button id="confirmResetBtn" class="back-btn" style="background:var(--danger); color:white; width:100%; justify-content:center;"><i class="fas fa-trash"></i> Reset Everything</button>
        </div>
    `;
    document.getElementById('confirmResetBtn')?.addEventListener('click', () => {
        if (confirm('⚠️ ARE YOU ABSOLUTELY SURE? This will erase ALL data and cannot be undone.')) {
            localStorage.clear();
            location.reload();
        }
    });
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
}

function saveGoals() {
    localStorage.setItem('scriptflow_goals_main', JSON.stringify(goals));
    updateStats();
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
        showToast('Appointment saved!', 'success');
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function openQuickReport() {
    openQuickReportWithDate(getTodayStr());
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

// ==================== REAL-TIME PRIORITY ====================
function updateRealTimePriorityDashboard() {
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = etTime.getHours();
    const minute = etTime.getMinutes();
    const isWeekday = etTime.getDay() >= 1 && etTime.getDay() <= 5;
    const isPrimeMorning = (hour === 10) || (hour === 11 && minute <= 30);
    const isPrimeAfternoon = (hour >= 14 && hour <= 15) || (hour === 16 && minute === 0);
    const isPrimeTime = (isPrimeMorning || isPrimeAfternoon) && isWeekday;
    const timeStr = etTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dayName = etTime.toLocaleDateString('en-US', { weekday: 'short' });
    
    const priorityText = document.getElementById('priorityTimeText');
    const tooltipStatus = document.getElementById('tooltipPrimeStatus');
    
    if (priorityText) {
        if (isPrimeTime) {
            priorityText.innerHTML = `<i class="fas fa-fire" style="color:#ff6b6b;"></i> PRIME TIME (${dayName} ${timeStr} ET)`;
            if (tooltipStatus) tooltipStatus.innerHTML = '🔥 ACTIVE PRIME WINDOW - Best time to call NOW!';
        } else {
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
    
    // Setup tool item click handlers (show feature panel)
    document.querySelectorAll('.tool-item[data-tool]').forEach(item => {
        item.addEventListener('click', () => {
            const tool = item.getAttribute('data-tool');
            const title = item.querySelector('span')?.innerText || item.innerText.replace(/[^\w\s]/g, '').trim();
            showFeaturePanel(tool, title);
        });
    });
    
    // Back button handler
    const backBtn = document.getElementById('backToScriptsBtn');
    if (backBtn) backBtn.addEventListener('click', hideFeaturePanel);
    
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
    const scriptSearch = document.getElementById('scriptSearch');
    if (scriptSearch) {
        scriptSearch.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderSidebar();
        });
    }
    
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9' && !isEditing && !e.target.matches('textarea,input') && !currentActiveTool) {
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
        if (e.key === 'Escape' && currentActiveTool) {
            hideFeaturePanel();
        }
    });
    
    // Start real-time priority updates
    updateRealTimePriorityDashboard();
    setInterval(updateRealTimePriorityDashboard, 1000);
    setInterval(() => updateStats(), 5000);
});
