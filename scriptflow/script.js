// =============================================
// Google Sign-In Authentication
// =============================================
let currentUser = null;

function initGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: '1080625617272-6a6f8vp0vsjf3r3q3q3q3q3q3q3q3q3.apps.googleusercontent.com',
        callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        { theme: 'outline', size: 'large', width: '100%' }
    );
}

function handleCredentialResponse(response) {
    const data = jwt_decode(response.credential);
    currentUser = {
        name: data.name,
        email: data.email,
        picture: data.picture
    };
    localStorage.setItem('scriptflow_user', JSON.stringify(currentUser));
    showAuthenticatedUI();
}

function jwt_decode(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
}

function showAuthenticatedUI() {
    document.getElementById('loginContainer').style.display = 'none';
    document.body.classList.add('authenticated');
    initializeApp();
}

function showLoginScreen() {
    document.body.classList.remove('authenticated');
    const loginContainer = document.getElementById('loginContainer');
    loginContainer.innerHTML = `
        <div class="login-overlay">
            <div class="login-card">
                <div class="login-icon"><i class="fas fa-phone-alt"></i></div>
                <h2>ScriptFlow Pro</h2>
                <p>Secure call script management with Google Sign-In</p>
                <div id="googleSignInButton"></div>
                <p style="margin-top: 20px; font-size: 0.7rem;">Sign in with your Google account to access your scripts</p>
            </div>
        </div>
    `;
    loginContainer.style.display = 'flex';
    initGoogleSignIn();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('scriptflow_user');
    google.accounts.id.disableAutoSelect();
    showLoginScreen();
}

// Check for existing session
const savedUser = localStorage.getItem('scriptflow_user');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showAuthenticatedUI();
} else {
    showLoginScreen();
}

// =============================================
// Main Application (only runs after auth)
// =============================================
let scripts = {}, currentScriptId = "opening", isEditing = false, searchTerm = "", customOrder = [];
let versionHistory = {}, currentVersionIndex = {};
let appointments = {};
let goals = { daily: 3, weekly: 15, monthly: 60 };
let userName = localStorage.getItem('scriptflow_user_name') || (currentUser ? currentUser.name.split(' ')[0] : 'User');

function initializeApp() {
    if (!currentUser) return;
    userName = localStorage.getItem('scriptflow_user_name') || currentUser.name.split(' ')[0];
    loadAppointmentData();
    loadScripts();
    initTheme();
    initSearch();
    renderNavigation();
    loadScript('opening');
    initKeyboard();
    attachEventListeners();
    setInterval(() => { if(!isEditing) document.getElementById('saveStatus').innerHTML = 'Auto'; updateStats(); }, 5000);
}

function attachEventListeners() {
    document.getElementById('editScriptBtn').onclick = enterEdit;
    document.getElementById('saveScriptBtn').onclick = saveEdit;
    document.getElementById('cancelEditBtn').onclick = cancelEdit;
    document.getElementById('copyScriptBtn').onclick = copyScript;
    document.getElementById('resetScriptBtn').onclick = resetScript;
    document.getElementById('themeToggle').onclick = toggleTheme;
    document.getElementById('addScriptBtn').onclick = addScript;
    document.getElementById('openCalendarBtn').onclick = openCalendarModal;
    document.getElementById('quickReportBtn').onclick = openQuickReport;
    document.getElementById('userNameBtn').onclick = setUserName;
    document.getElementById('helpBtn').onclick = openHelpModal;
    document.getElementById('priorityBtn').onclick = openPriorityModal;
    document.getElementById('historyBtn').onclick = () => showVersionHistoryModal(currentScriptId);
    document.getElementById('resetAllBtn').onclick = factoryReset;
    document.getElementById('undoBtn').onclick = () => undoScript(currentScriptId);
    document.getElementById('redoBtn').onclick = () => redoScript(currentScriptId);
    document.getElementById('logoutBtn').onclick = logout;
}

function setUserName() {
    const newName = prompt('Enter your name:', userName);
    if (newName?.trim()) { userName = newName.trim(); localStorage.setItem('scriptflow_user_name', userName); showToast(`Name set to: ${userName}`); if (!isEditing) loadScript(currentScriptId); }
}

function replaceNameInScript(content) { return content.replace(/\[Your Name\]/gi, userName); }

function loadAppointmentData() {
    const saved = localStorage.getItem(`scriptflow_appointments_${currentUser.email}`);
    if (saved) appointments = JSON.parse(saved);
    const savedGoals = localStorage.getItem(`scriptflow_goals_${currentUser.email}`);
    if (savedGoals) goals = JSON.parse(savedGoals);
    updateStats();
}

function saveAppointments() { localStorage.setItem(`scriptflow_appointments_${currentUser.email}`, JSON.stringify(appointments)); updateStats(); }
function saveGoals() { localStorage.setItem(`scriptflow_goals_${currentUser.email}`, JSON.stringify(goals)); updateStats(); }

function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function getTodayCount() { return appointments[getTodayStr()]?.count || 0; }
function getWeekCount() {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    let total = 0;
    for (let d in appointments) { const date = new Date(d); if (date >= start && date <= end) total += appointments[d].count || 0; }
    return total;
}
function getMonthCount() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let total = 0;
    for (let d in appointments) { const date = new Date(d); if (date >= start && date <= end) total += appointments[d].count || 0; }
    return total;
}

function updateStats() {
    document.getElementById('statToday').innerText = getTodayCount();
    document.getElementById('statWeek').innerText = getWeekCount();
    document.getElementById('statMonth').innerText = getMonthCount();
    document.getElementById('goalDaily').innerText = goals.daily;
    document.getElementById('goalWeekly').innerText = goals.weekly;
    document.getElementById('goalMonthly').innerText = goals.monthly;
}

function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned) {
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    if (!appointments[dateStr].reports) appointments[dateStr].reports = [];
    const reportText = `Business: ${business}\nContact: ${contactName}\nRole: ${role}\nPhone: ${phone}\nTime: ${time}\nNotes: ${notes}\nAssigned to: ${assigned}`;
    appointments[dateStr].reports.unshift({ id: Date.now(), business, contactName, role, phone, time, notes, assigned, createdAt: new Date().toISOString(), fullText: reportText });
    appointments[dateStr].count = appointments[dateStr].reports.length;
    appointments[dateStr].note = `${appointments[dateStr].reports.length} appointment(s)`;
    saveAppointments();
    return reportText;
}

function showToast(msg, isError = false) { 
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.style.background = isError ? 'var(--danger)' : 'var(--success)'; 
    t.innerHTML = `${isError ? '⚠️ ' : '✓ '}${msg}`; 
    document.body.appendChild(t); 
    setTimeout(() => t.remove(), 2000); 
}

function copyToClipboard(text) { 
    if (!text) { showToast('Nothing to copy', true); return; }
    navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Copied!'); });
}

// Calendar Modal Functions
let currentCalDate = new Date();
let selectedCalDate = getTodayStr();
let calendarModal = null;

function openCalendarModal() {
    if (calendarModal) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card calendar-modal" id="calModalInner"></div>`;
    document.body.appendChild(modal);
    calendarModal = modal;
    renderCalendarModal();
    modal.addEventListener('click', (e) => { if (e.target === modal) closeCalendarModal(); });
}

function closeCalendarModal() { if (calendarModal) { calendarModal.remove(); calendarModal = null; } }

function escapeHtml(s) { return s ? s.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])) : ''; }

function renderCalendarModal() {
    const inner = document.getElementById('calModalInner');
    if (!inner) return;
    const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const apptData = appointments[selectedCalDate] || { count: 0, note: '', reports: [] };
    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) daysHtml += `<div class="cal-day"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const hasApp = appointments[dateStr] && appointments[dateStr].count > 0;
        const isSelected = (selectedCalDate === dateStr);
        daysHtml += `<div class="cal-day ${isSelected ? 'selected' : ''} ${hasApp ? 'has-appointment' : ''}" data-date="${dateStr}">${d}</div>`;
    }
    let reportsHtml = '';
    if (apptData.reports && apptData.reports.length > 0) {
        reportsHtml = `<div style="margin-top:16px;"><strong>Appointments (${apptData.reports.length}):</strong><button class="copy-btn-sm" id="copyAllReportsBtn" style="float:right;">Copy All</button>`;
        apptData.reports.forEach(r => {
            reportsHtml += `<div class="appointment-card"><div style="display:flex; justify-content:space-between;"><div><strong>${escapeHtml(r.business)}</strong> - ${escapeHtml(r.contactName)} (${escapeHtml(r.role)})</div><button class="copy-btn-sm copy-single-btn" data-id="${r.id}">Copy</button></div><div style="font-size:0.8rem;">Phone: ${escapeHtml(r.phone)} | Time: ${escapeHtml(r.time || 'TBD')}</div><div style="font-size:0.8rem;">Notes: ${escapeHtml(r.notes?.substring(0, 100))}</div><div style="font-size:0.7rem;">Assigned to: ${escapeHtml(r.assigned)}</div></div>`;
        });
        reportsHtml += `</div>`;
    }
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    inner.innerHTML = `<div class="cal-header"><div class="cal-month-year">${monthNames[month]} ${year}</div><div class="cal-nav"><button id="calPrevBtn">◀ Prev</button><button id="calNextBtn">Next ▶</button><button id="calTodayBtn">Today</button></div></div><div class="cal-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="cal-days" id="calDaysGrid">${daysHtml}</div><div><label><strong>${selectedCalDate} - ${apptData.count} appointment(s)</strong></label><textarea id="apptNoteInput" style="width:100%; padding:12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary); margin-top:8px;" rows="2" placeholder="General notes...">${escapeHtml(apptData.note || '')}</textarea><button class="icon-btn" id="quickAddForDate" style="background:var(--secondary); color:white; margin-top:8px; width:100%;">+ Add Appointment</button>${reportsHtml}<div class="goal-input-group"><div><label>Daily Goal</label><input type="number" id="goalDailyInput" value="${goals.daily}"></div><div><label>Weekly Goal</label><input type="number" id="goalWeeklyInput" value="${goals.weekly}"></div><div><label>Monthly Goal</label><input type="number" id="goalMonthlyInput" value="${goals.monthly}"></div></div></div><div class="modal-buttons" style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;"><button class="icon-btn" id="saveNoteBtn" style="background:var(--success); color:white;">Save Note</button><button class="icon-btn" id="closeCalBtn">Close</button></div>`;
    
    document.querySelectorAll('.cal-day[data-date]').forEach(el => { el.addEventListener('click', () => { selectedCalDate = el.getAttribute('data-date'); renderCalendarModal(); }); });
    document.querySelectorAll('.copy-single-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const id = parseInt(btn.getAttribute('data-id')); for (let date in appointments) { const report = appointments[date]?.reports?.find(r => r.id === id); if (report) { copyToClipboard(report.fullText); break; } } }); });
    document.getElementById('calPrevBtn')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderCalendarModal(); });
    document.getElementById('calNextBtn')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderCalendarModal(); });
    document.getElementById('calTodayBtn')?.addEventListener('click', () => { currentCalDate = new Date(); selectedCalDate = getTodayStr(); renderCalendarModal(); });
    document.getElementById('saveNoteBtn')?.addEventListener('click', () => { if (!appointments[selectedCalDate]) appointments[selectedCalDate] = { count: 0, note: '', reports: [] }; appointments[selectedCalDate].note = document.getElementById('apptNoteInput').value; saveAppointments(); showToast('Note saved'); });
    document.getElementById('quickAddForDate')?.addEventListener('click', () => { closeCalendarModal(); setTimeout(() => openQuickReport(), 100); });
    document.getElementById('closeCalBtn')?.addEventListener('click', closeCalendarModal);
    document.getElementById('copyAllReportsBtn')?.addEventListener('click', () => { if (apptData.reports?.length) copyToClipboard(apptData.reports.map(r => r.fullText).join('\n\n---\n\n')); else showToast('No appointments', true); });
    const dInput = document.getElementById('goalDailyInput'); if (dInput) dInput.addEventListener('change', () => { goals.daily = parseInt(dInput.value) || 3; saveGoals(); });
    const wInput = document.getElementById('goalWeeklyInput'); if (wInput) wInput.addEventListener('change', () => { goals.weekly = parseInt(wInput.value) || 15; saveGoals(); });
    const mInput = document.getElementById('goalMonthlyInput'); if (mInput) mInput.addEventListener('change', () => { goals.monthly = parseInt(mInput.value) || 60; saveGoals(); });
}

function openQuickReport() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card report-modal"><h3 style="margin-bottom:16px;">Quick Add Appointment</h3>
        <div class="form-group"><label>Date</label><input type="date" id="reportDate" value="${getTodayStr()}"></div>
        <div class="form-group"><label>Business Name *</label><input type="text" id="reportBusiness" placeholder="e.g., Flynn Group"></div>
        <div class="form-group"><label>Contact Name *</label><input type="text" id="reportName" placeholder="Full name"></div>
        <div class="form-group"><label>Role</label><select id="reportRole"><option>Owner</option><option>Manager</option><option>Director</option><option>Marketing</option><option>Admin</option></select></div>
        <div class="form-group"><label>Phone Number</label><input type="text" id="reportPhone" placeholder="+1 207 592 2257"></div>
        <div class="form-group"><label>Time</label><input type="text" id="reportTime" placeholder="Monday, June 08 around 3pm (ET)"></div>
        <div class="form-group"><label>Notes</label><textarea id="reportNotes" rows="3" placeholder="Appointment details..."></textarea></div>
        <div class="form-group"><label>Assigned To</label><input type="text" id="reportAssigned" placeholder="Daniel" value="Daniel"></div>
        <div class="modal-buttons" style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"><button class="icon-btn" id="submitReportBtn" style="background:var(--success); color:white;">Save & Copy</button><button class="icon-btn" id="closeReportBtn">Cancel</button></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('submitReportBtn').addEventListener('click', () => {
        const date = document.getElementById('reportDate').value;
        const business = document.getElementById('reportBusiness').value;
        const name = document.getElementById('reportName').value;
        const role = document.getElementById('reportRole').value;
        const phone = document.getElementById('reportPhone').value;
        const time = document.getElementById('reportTime').value;
        const notes = document.getElementById('reportNotes').value;
        const assigned = document.getElementById('reportAssigned').value;
        if (!business || !name) { showToast('Fill business and contact name', true); return; }
        const reportText = addAppointment(date, business, name, role, phone, time, notes, assigned);
        copyToClipboard(reportText);
        modal.remove();
        openCalendarModal();
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function getCallPriorityAnalysis() {
    const now = new Date();
    const timeZones = [
        { name: "ET", zone: "America/New_York", label: "Eastern Time", abbreviation: "ET", cities: "NY, Miami, Atlanta" },
        { name: "CT", zone: "America/Chicago", label: "Central Time", abbreviation: "CT", cities: "Chicago, Dallas, Houston" },
        { name: "MT", zone: "America/Denver", label: "Mountain Time", abbreviation: "MT", cities: "Denver, Phoenix, Salt Lake" },
        { name: "PT", zone: "America/Los_Angeles", label: "Pacific Time", abbreviation: "PT", cities: "LA, Seattle, San Francisco" }
    ];
    const getCallScore = (hour, minute) => {
        const totalMinutes = hour * 60 + minute;
        if ((totalMinutes >= 570 && totalMinutes <= 690) || (totalMinutes >= 810 && totalMinutes <= 960)) return 100;
        if (totalMinutes >= 540 && totalMinutes <= 570) return 85;
        if (totalMinutes >= 690 && totalMinutes <= 720) return 60;
        if (totalMinutes >= 720 && totalMinutes <= 780) return 30;
        if (totalMinutes >= 960 && totalMinutes <= 1020) return 75;
        if (totalMinutes >= 480 && totalMinutes <= 540) return 50;
        if (totalMinutes > 1020) return 20;
        if (totalMinutes < 480) return 10;
        return 50;
    };
    const getAvailabilityStatus = (score) => {
        if (score >= 85) return { text: "Excellent Time to Call", class: "best-time-high", emoji: "🎯" };
        if (score >= 70) return { text: "Good Time to Call", class: "best-time-good", emoji: "👍" };
        if (score >= 40) return { text: "Fair Time (May be busy)", class: "best-time-good", emoji: "⚠️" };
        return { text: "Poor Time (Likely Unavailable)", class: "best-time-bad", emoji: "❌" };
    };
    const zones = timeZones.map(tz => {
        const tzTime = new Date(now.toLocaleString("en-US", { timeZone: tz.zone }));
        const hour = tzTime.getHours();
        const minute = tzTime.getMinutes();
        const score = getCallScore(hour, minute);
        const status = getAvailabilityStatus(score);
        return { ...tz, timeStr: tzTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), hour, minute, isBusinessHours: hour >= 9 && hour < 17, callScore: score, availability: status.text, availabilityClass: status.class, emoji: status.emoji };
    });
    const sorted = [...zones].sort((a, b) => b.callScore - a.callScore);
    const bestZone = sorted[0];
    let recommendation = bestZone.callScore >= 85 ? `🎯 OPTIMAL: Call ${bestZone.abbreviation} businesses NOW (${bestZone.timeStr})` : (bestZone.callScore >= 70 ? `✅ GOOD: ${bestZone.abbreviation} at ${bestZone.timeStr}` : `⏰ FAIR: Consider waiting 1-2 hours for better results`);
    return { zones, bestZone, recommendation, bestTimes: ["10:00 AM - 11:30 AM (local) - Peak", "2:00 PM - 4:00 PM (local) - Second window", "Avoid 12-1 PM (lunch hour)"] };
}

function openPriorityModal() {
    const analysis = getCallPriorityAnalysis();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    let zonesHtml = '';
    analysis.zones.forEach(zone => {
        zonesHtml += `<div class="timezone-card"><div class="timezone-name">${zone.label} (${zone.abbreviation})</div><div class="timezone-time">${zone.timeStr}</div><div class="${zone.isBusinessHours ? 'status-open' : 'status-closed'}">${zone.isBusinessHours ? 'Business Hours' : 'After Hours'}</div><div class="best-time-badge ${zone.availabilityClass}">${zone.emoji} ${zone.availability}</div><div style="font-size:0.7rem; margin-top:6px;">${zone.cities}</div></div>`;
    });
    modal.innerHTML = `<div class="modal-card priority-modal"><div class="priority-header"><h3><i class="fas fa-chart-line"></i> REAL-TIME CALL PRIORITY</h3><div style="font-size:0.8rem;">Intelligent US Business Hours Predictor</div></div><div class="recommendation-card"><div style="font-weight:800;">📞 RECOMMENDATION</div><div>${analysis.recommendation}</div></div><div style="font-weight:700;">🌍 US TIME ZONES</div><div class="timezone-grid">${zonesHtml}</div><div style="margin-top:16px;"><div style="font-weight:700;">⏰ BEST TIMES TO CALL</div>${analysis.bestTimes.map(t => `<div style="padding:6px 0; font-size:0.85rem;">• ${t}</div>`).join('')}</div><div style="margin-top:16px; padding:12px; background:var(--bg-primary); border-radius:16px; font-size:0.8rem;"><strong>💡 Pro Tips:</strong><br>• Call ET between 10-11:30 AM for highest answer rates<br>• Avoid 12-1 PM (lunch hour)<br>• Tuesday-Thursday are best days</div><div class="modal-buttons" style="margin-top:20px;"><button class="icon-btn" id="closePriorityBtn" style="background:var(--primary); color:white;">Close</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('closePriorityBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function openHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card help-modal"><h3>ScriptFlow Pro User Guide</h3><div class="help-step"><h4>Quick Navigation</h4><p>Press keys 1-9 to instantly jump to any script.</p></div><div class="help-step"><h4>Script Management</h4><p>Click Edit to modify scripts. Add, rename, delete custom scripts.</p></div><div class="help-step"><h4>Version History</h4><p>Ctrl+Z to undo, Ctrl+Y to redo changes.</p></div><div class="help-step"><h4>Appointment Tracker</h4><p>Click Calendar to manage appointments. Quick Add logs new appointments.</p></div><div class="help-step"><h4>Call Priority</h4><p>Click chart icon for best times to call US business owners.</p></div><div class="modal-buttons"><button class="icon-btn" id="closeHelpBtn" style="background:var(--primary); color:white;">Got it!</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeHelpBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function factoryReset() { if (confirm('FACTORY RESET: This will erase ALL data. Cannot be undone.')) { localStorage.removeItem(`scriptflow_pro_scripts_${currentUser.email}`); localStorage.removeItem(`scriptflow_appointments_${currentUser.email}`); localStorage.removeItem(`scriptflow_goals_${currentUser.email}`); location.reload(); } }

// Scripts Database
const defaultScripts = {
    "opening": { name: "🎯 Opening Script", content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is [Your Name]. I work with a web design company that helps companies like yours to stand out online. And we actually created a free, modern, preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts? see if it could add value to your site?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\"" },
    "owner_yes": { name: "👑 Owner - Yes", content: "✅ IF OWNER SAYS YES:\n\n→ \"Perfect. What we'll do is have my manager Daniel give you a quick call later today, just to ask a couple quick questions and show you what we built.\"\n→ \"Is this the best number to reach you at?\"\n→ \"Awesome, we're excited to show you the preview. I'll have Daniel give you a quick call later.\"\n→ \"Appreciate your time, [Prospect Name]. Talk soon!\"" },
    "owner_no": { name: "👤 Not Owner", content: "❌ IF NOT OWNER:\n\n→ \"Got it — do you usually help with things like marketing, socials, or sales for the business?\"\n\n📌 IF THEY SHOW INTEREST:\n→ \"Awesome. Usually the owner likes taking a quick look at the preview first. What's normally the best time to reach them today?\"\n→ \"Perfect, I'll have Daniel give them a quick call later.\"\n→ \"Thanks again, appreciate it!\"\n\n📌 IF NOT INTERESTED:\n→ \"No worries at all, just figured I'd reach out since we already made the preview for you guys. Appreciate your time!\"" },
    "objection_website": { name: "⚠️ Already have a website", content: "💬 PROSPECT: \"We already have a website.\"\n\n✅ RESPONSE:\n→ \"Totally — honestly, most businesses we speak with do.\"\n→ \"This isn't really about replacing it immediately.\"\n→ \"It's more about showing you what a newer version could look like and seeing if there are opportunities to improve things like credibility, speed, or conversions.\"\n→ \"Worst case, you walk away with a few good ideas.\"" },
    "objection_webguy": { name: "⚠️ Have a web guy", content: "💬 PROSPECT: \"I already have a web guy.\"\n\n✅ RESPONSE:\n→ \"That actually makes things easier.\"\n→ \"A lot of businesses we work with already have someone managing their site.\"\n→ \"They just like getting a second opinion or seeing a different creative direction.\"\n→ \"No commitment at all — just worth comparing.\"" },
    "objection_cost": { name: "💰 How much does it cost?", content: "💬 PROSPECT: \"How much does it cost?\"\n\n✅ RESPONSE:\n→ \"The preview itself is completely free.\"\n→ \"Daniel would only go over pricing if you actually like what you see.\"\n→ \"Right now it's really just about showing you the concept first.\"" },
    "objection_busy": { name: "⏰ I'm busy", content: "💬 PROSPECT: \"I'm busy.\"\n\n✅ RESPONSE:\n→ \"Totally understand — I caught you out of the blue.\"\n→ \"That's why I'm not trying to go through everything right now.\"\n→ \"What's easier for you — later today or sometime tomorrow for a quick 5–10 minute look?\"" },
    "objection_not_interested": { name: "❌ Not interested", content: "💬 PROSPECT: \"Not interested.\"\n\n✅ RESPONSE:\n→ \"No worries.\"\n→ \"Just so you know, we already built the preview, so there's nothing you need to buy or commit to.\"\n→ \"Worst case, you spend a few minutes looking at it and walk away with a few ideas for your online presence.\"\n→ \"Would it hurt to at least take a quick look?\"" },
    "objection_info": { name: "📧 Send me info", content: "💬 PROSPECT: \"Just send me info.\"\n\n✅ RESPONSE:\n→ \"I definitely can.\"\n→ \"The only reason I prefer a quick walkthrough is because the preview makes way more sense visually than through a long text or email.\"\n→ \"It honestly takes about 5 minutes.\"\n→ \"What's usually better for you — later today or tomorrow?\"" },
    "objection_found_me": { name: "🔍 How did you find me?", content: "💬 PROSPECT: \"How did you find me?\"\n\n✅ RESPONSE:\n→ \"I came across your Google listing while looking at businesses in your area and industry.\"\n→ \"Your business stood out, so we decided to create a sample website concept using publicly available information online.\"" },
    "objection_who_are_you": { name: "🏢 Who are you with?", content: "💬 PROSPECT: \"Who are you with?\"\n\n✅ RESPONSE:\n→ \"I'm with Canopy Designs.\"\n→ \"We help local and home service businesses improve their online presence and websites.\"\n→ \"The preview we built for you is completely free to look at.\"" },
    "closing": { name: "🏁 Closing Script", content: "🎯 CLOSING SCRIPT:\n\n→ \"Awesome, we're excited to show you the preview!\"\n→ \"I'll have Daniel give you a quick call [later/tomorrow].\"\n→ \"Appreciate your time, [Your Name]! Talk soon!\"\n\n📌 REMEMBER:\n✓ Always confirm the best number to call\n✓ Get the owner's name\n✓ Set a specific time for follow-up\n✓ Be friendly and professional" }
};

function initVersionHistory(id, content) { if (!versionHistory[id]) { versionHistory[id] = [{ content, timestamp: new Date().toISOString() }]; currentVersionIndex[id] = 0; } }
function saveVersion(id, newContent) {
    if (!versionHistory[id]) { initVersionHistory(id, newContent); return; }
    if (currentVersionIndex[id] < versionHistory[id].length - 1) versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
    versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
    currentVersionIndex[id] = versionHistory[id].length - 1;
    if (versionHistory[id].length > 50) versionHistory[id].shift();
    localStorage.setItem(`scriptflow_version_history_${currentUser.email}`, JSON.stringify(versionHistory));
}
function undoScript(id) { if (!versionHistory[id] || currentVersionIndex[id] <= 0) { showToast('No earlier version', true); return; } currentVersionIndex[id]--; scripts[id].content = versionHistory[id][currentVersionIndex[id]].content; saveAllScripts(); if (!isEditing && currentScriptId === id) loadScript(id); else if (isEditing && currentScriptId === id) document.getElementById('editTextarea').value = scripts[id].content; showToast('Undo successful'); }
function redoScript(id) { if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) { showToast('No newer version', true); return; } currentVersionIndex[id]++; scripts[id].content = versionHistory[id][currentVersionIndex[id]].content; saveAllScripts(); if (!isEditing && currentScriptId === id) loadScript(id); else if (isEditing && currentScriptId === id) document.getElementById('editTextarea').value = scripts[id].content; showToast('Redo successful'); }

function loadScripts() {
    const saved = localStorage.getItem(`scriptflow_pro_scripts_${currentUser.email}`);
    if (saved) { scripts = JSON.parse(saved); for (let k of Object.keys(defaultScripts)) if (!scripts[k]) scripts[k] = {...defaultScripts[k]}; }
    else scripts = JSON.parse(JSON.stringify(defaultScripts));
    const savedOrder = localStorage.getItem(`scriptflow_order_${currentUser.email}`);
    if (savedOrder) customOrder = JSON.parse(savedOrder);
    else customOrder = ["opening", "owner_yes", "owner_no", "objection_website", "objection_webguy", "objection_cost", "objection_busy", "objection_not_interested", "objection_info", "objection_found_me", "objection_who_are_you", "closing"];
    const savedHistory = localStorage.getItem(`scriptflow_version_history_${currentUser.email}`);
    if (savedHistory) versionHistory = JSON.parse(savedHistory);
    for (let id in scripts) { if (!versionHistory[id]) initVersionHistory(id, scripts[id].content); else currentVersionIndex[id] = versionHistory[id].length - 1; }
    document.getElementById('scriptCount').innerText = Object.keys(scripts).length;
}
function saveAllScripts() {
    localStorage.setItem(`scriptflow_pro_scripts_${currentUser.email}`, JSON.stringify(scripts));
    localStorage.setItem(`scriptflow_order_${currentUser.email}`, JSON.stringify(customOrder));
    document.getElementById('saveStatus').innerHTML = '✓ Saved';
    setTimeout(() => { if (!isEditing) document.getElementById('saveStatus').innerHTML = 'Auto'; }, 1500);
}
function getOrderedVisible() {
    let ids = [...customOrder.filter(id=>scripts[id]), ...Object.keys(scripts).filter(id=>!customOrder.includes(id))];
    if (searchTerm) ids = ids.filter(id => scripts[id].name.toLowerCase().includes(searchTerm.toLowerCase()));
    return ids;
}
function getKeyMapping() { const vis = getOrderedVisible(); const map = new Map(); vis.slice(0,9).forEach((id,i)=>map.set((i+1).toString(),id)); return map; }

function renderNavigation() {
    const container = document.getElementById('scriptNavList');
    const visible = getOrderedVisible();
    if (!visible.length) { container.innerHTML='<div style="padding:20px;text-align:center;">No scripts found</div>'; return; }
    let html = '';
    visible.forEach((id, idx) => {
        const s = scripts[id];
        const active = currentScriptId === id;
        const shortcut = idx < 9 ? `${idx+1}` : null;
        html += `<div class="nav-item ${active ? 'active' : ''}" data-id="${id}"><i class="fas fa-scroll"></i><span>${escapeHtml(s.name)}</span>${shortcut ? `<span class="key-hint">${shortcut}</span>` : ''}<div class="nav-actions"><button class="nav-icon-btn rename-btn" data-id="${id}"><i class="fas fa-pencil-alt"></i></button><button class="nav-icon-btn delete-btn" data-id="${id}" ${id==='opening'?'disabled style="opacity:0.4;"':''}><i class="fas fa-trash"></i></button></div></div>`;
    });
    container.innerHTML = html;
    document.querySelectorAll('.nav-item').forEach(el => {
        const sid = el.getAttribute('data-id');
        el.addEventListener('click', (e) => { if(e.target.closest('.rename-btn')||e.target.closest('.delete-btn')) return; if(isEditing && confirm('Cancel editing?')) cancelEdit(); if(!isEditing && sid) loadScript(sid); });
    });
    document.querySelectorAll('.rename-btn').forEach(btn => btn.addEventListener('click',(e)=>{ e.stopPropagation(); const id=btn.getAttribute('data-id'); const newName=prompt('New name:',scripts[id].name); if(newName?.trim()){ scripts[id].name=newName.trim(); saveAllScripts(); renderNavigation(); if(currentScriptId===id) document.getElementById('currentScriptName').innerHTML=scripts[id].name; showToast('Renamed'); } }));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click',(e)=>{ e.stopPropagation(); const id=btn.getAttribute('data-id'); if(id==='opening'){ showToast('Cannot delete opening script', true); return; } if(confirm('Delete?')){ delete scripts[id]; delete versionHistory[id]; customOrder=customOrder.filter(i=>i!==id); if(currentScriptId===id) loadScript('opening'); saveAllScripts(); renderNavigation(); document.getElementById('scriptCount').innerText=Object.keys(scripts).length; showToast('Deleted'); } }));
    const visibleIds = getOrderedVisible();
    const idxCur = visibleIds.indexOf(currentScriptId);
    document.getElementById('activeShortcutHint').innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur+1}` : `Key: —`;
    if (versionHistory[currentScriptId]) document.getElementById('versionNumber').innerText = `${currentVersionIndex[currentScriptId]+1}/${versionHistory[currentScriptId].length}`;
}

function loadScript(id) { if(!scripts[id] || isEditing) return; currentScriptId = id; document.getElementById('currentScriptName').innerHTML = scripts[id].name; const displayContent = replaceNameInScript(scripts[id].content); document.getElementById('scriptContent').innerHTML = `<div class="script-display">${escapeHtml(displayContent).replace(/\n/g,'<br>')}</div>`; renderNavigation(); }
function enterEdit() { if(isEditing) return; isEditing=true; const s=scripts[currentScriptId]; document.getElementById('editScriptBtn').style.display='none'; document.getElementById('saveScriptBtn').style.display='inline-flex'; document.getElementById('cancelEditBtn').style.display='inline-flex'; document.getElementById('scriptContent').innerHTML=`<textarea id="editTextarea" class="edit-textarea">${escapeHtml(s.content)}</textarea>`; document.getElementById('editTextarea').focus(); document.getElementById('saveStatus').innerHTML='Editing'; }
function saveEdit() { const newContent = document.getElementById('editTextarea').value; scripts[currentScriptId].content = newContent; saveVersion(currentScriptId, newContent); saveAllScripts(); cancelEdit(); showToast('Saved!'); }
function cancelEdit() { isEditing=false; document.getElementById('editScriptBtn').style.display='inline-flex'; document.getElementById('saveScriptBtn').style.display='none'; document.getElementById('cancelEditBtn').style.display='none'; loadScript(currentScriptId); document.getElementById('saveStatus').innerHTML='Auto'; }
function copyScript() { const content = replaceNameInScript(scripts[currentScriptId].content); copyToClipboard(content); }
function resetScript() { if(defaultScripts[currentScriptId]){ if(confirm('Reset to original?')){ scripts[currentScriptId]={...defaultScripts[currentScriptId]}; saveVersion(currentScriptId, scripts[currentScriptId].content); saveAllScripts(); loadScript(currentScriptId); showToast('Reset complete'); } } else showToast('No default', true); }
function addScript() { if(isEditing){ showToast('Finish editing first', true); return; } const name=prompt('Script name:'); if(!name) return; const id='custom_'+Date.now()+'_'+Math.random().toString(36).substr(2,6); scripts[id]={name, content:'Write your script here...'}; initVersionHistory(id, scripts[id].content); customOrder.push(id); saveAllScripts(); renderNavigation(); loadScript(id); showToast(`Added: ${name}`); }
function showVersionHistoryModal(id) { if (!versionHistory[id]) { showToast('No history', true); return; } const modal = document.createElement('div'); modal.className = 'modal-overlay'; let html = `<div class="modal-card"><h3>Version History: ${escapeHtml(scripts[id].name)}</h3>`; versionHistory[id].forEach((v, idx) => { html += `<div class="version-item" data-index="${idx}" style="padding:12px; cursor:pointer; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between;"><span>${new Date(v.timestamp).toLocaleString()}</span><span>${idx === currentVersionIndex[id] ? 'Current' : 'Restore'}</span></div>`; }); html += `<div class="modal-buttons"><button class="icon-btn" id="closeHistoryBtn">Close</button></div></div>`; modal.innerHTML = html; document.body.appendChild(modal); document.querySelectorAll('.version-item').forEach(el => { el.addEventListener('click', () => { const idx = parseInt(el.getAttribute('data-index')); currentVersionIndex[id] = idx; scripts[id].content = versionHistory[id][idx].content; saveAllScripts(); if (!isEditing) loadScript(id); else if (isEditing && currentScriptId === id) document.getElementById('editTextarea').value = scripts[id].content; document.getElementById('versionNumber').innerText = `${idx+1}/${versionHistory[id].length}`; showToast('Version restored'); modal.remove(); }); }); document.getElementById('closeHistoryBtn').addEventListener('click', () => modal.remove()); modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); }); }

function initKeyboard() {
    window.addEventListener('keydown',(e)=>{
        if(e.key>='1' && e.key<='9' && !isEditing && !e.target.matches('textarea,input')){ e.preventDefault(); const target=getKeyMapping().get(e.key); if(target && scripts[target]){ loadScript(target); showToast(scripts[target].name); } }
        if(e.key==='Escape' && isEditing){ cancelEdit(); showToast('Edit cancelled'); }
        if((e.ctrlKey || e.metaKey) && e.key === 'z' && !isEditing) { e.preventDefault(); undoScript(currentScriptId); }
        if((e.ctrlKey || e.metaKey) && e.key === 'y' && !isEditing) { e.preventDefault(); redoScript(currentScriptId); }
    });
}
function initTheme() { const saved=localStorage.getItem(`scriptflow_theme_${currentUser.email}`); if(saved==='dark') document.body.classList.add('dark'); document.getElementById('themeToggle').innerHTML=document.body.classList.contains('dark')?'<i class="fas fa-sun"></i>':'<i class="fas fa-moon"></i>'; }
function toggleTheme() { document.body.classList.toggle('dark'); const isDark=document.body.classList.contains('dark'); localStorage.setItem(`scriptflow_theme_${currentUser.email}`,isDark?'dark':'light'); document.getElementById('themeToggle').innerHTML=isDark?'<i class="fas fa-sun"></i>':'<i class="fas fa-moon"></i>'; showToast(`${isDark?'Dark mode':'Light mode'}`); }
function initSearch() { document.getElementById('scriptSearch').addEventListener('input',(e)=>{ searchTerm=e.target.value.toLowerCase(); renderNavigation(); }); }
