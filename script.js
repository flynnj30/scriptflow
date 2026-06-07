// =============================================
// GOOGLE SIGN-IN WITH SIMPLE ICON BUTTON
// =============================================

let currentUser = null;
let isAuthenticated = false;
let allFeaturesEnabled = false;

// Initialize Google Sign-In
function initializeGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: '389117008163-cbjcmgsitsmbmltg9mb9h99aukeb54p0.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        auto_select: false
    });
    
    document.getElementById('googleIconBtn').addEventListener('click', () => {
        google.accounts.id.prompt();
    });
}

function handleCredentialResponse(response) {
    if (response.credential) {
        const payload = parseJwt(response.credential);
        currentUser = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            sub: payload.sub
        };
        
        localStorage.setItem('scriptflow_user', JSON.stringify(currentUser));
        isAuthenticated = true;
        allFeaturesEnabled = true;
        
        document.getElementById('googleButtonContainer').style.display = 'none';
        document.getElementById('userProfileContainer').style.display = 'block';
        document.getElementById('userAvatarImg').src = currentUser.picture;
        document.getElementById('userNameSpan').innerText = currentUser.name.split(' ')[0];
        document.getElementById('disabledOverlay').style.display = 'none';
        
        enableAllFeatures();
        showToast(`Welcome ${currentUser.name}! All features unlocked.`);
        initializeApp();
    }
}

function enableAllFeatures() {
    document.querySelectorAll('.feature-btn, .feature-input').forEach(el => {
        el.style.pointerEvents = 'auto';
        el.style.opacity = '1';
    });
}

function signOut() {
    google.accounts.id.disableAutoSelect();
    localStorage.removeItem('scriptflow_user');
    currentUser = null;
    isAuthenticated = false;
    allFeaturesEnabled = false;
    
    document.getElementById('googleButtonContainer').style.display = 'block';
    document.getElementById('userProfileContainer').style.display = 'none';
    document.getElementById('disabledOverlay').style.display = 'flex';
    showToast('Signed out. Please sign in again.');
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
}

function showToast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.background = isError ? 'var(--danger)' : 'var(--success)';
    t.innerHTML = `${isError ? '⚠️ ' : '✓ '}${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function checkExistingSession() {
    const saved = localStorage.getItem('scriptflow_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        isAuthenticated = true;
        allFeaturesEnabled = true;
        
        document.getElementById('googleButtonContainer').style.display = 'none';
        document.getElementById('userProfileContainer').style.display = 'block';
        document.getElementById('userAvatarImg').src = currentUser.picture;
        document.getElementById('userNameSpan').innerText = currentUser.name.split(' ')[0];
        document.getElementById('disabledOverlay').style.display = 'none';
        enableAllFeatures();
        initializeApp();
        return true;
    }
    return false;
}

document.getElementById('closeOverlayBtn').addEventListener('click', () => {
    document.getElementById('disabledOverlay').style.display = 'none';
});

document.getElementById('userProfileBtn').addEventListener('click', () => {
    if (confirm(`Sign out ${currentUser?.name}?`)) {
        signOut();
    }
});

// =============================================
// FULL APPLICATION CODE
// =============================================

let userName = 'User';
let appointments = {};
let goals = { daily: 3, weekly: 15, monthly: 60 };
let scripts = {}, currentScriptId = "opening", isEditing = false, searchTerm = "", customOrder = [];

const defaultScripts = {
    "opening": { name: "🎯 Opening Script", content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is [Your Name]. I work with a web design company that helps companies like yours to stand out online. And we actually created a free, modern, preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\"" },
    "owner_yes": { name: "👑 Owner - Yes", content: "✅ IF OWNER SAYS YES:\n\n→ \"Perfect. What we'll do is have my manager Daniel give you a quick call later today, just to ask a couple quick questions and show you what we built.\"\n→ \"Is this the best number to reach you at?\"\n→ \"Awesome, we're excited to show you the preview. I'll have Daniel give you a quick call later.\"\n→ \"Appreciate your time, [Prospect Name]. Talk soon!\"" },
    "owner_no": { name: "👤 Not Owner", content: "❌ IF NOT OWNER:\n\n→ \"Got it — do you usually help with things like marketing, socials, or sales for the business?\"\n\n📌 IF THEY SHOW INTEREST:\n→ \"Awesome. Usually the owner likes taking a quick look at the preview first. What's normally the best time to reach them today?\"\n→ \"Perfect, I'll have Daniel give them a quick call later.\"\n→ \"Thanks again, appreciate it!\"\n\n📌 IF NOT INTERESTED:\n→ \"No worries at all, just figured I'd reach out since we already made the preview for you guys. Appreciate your time!\"" },
    "closing": { name: "🏁 Closing Script", content: "🎯 CLOSING SCRIPT:\n\n→ \"Awesome, we're excited to show you the preview!\"\n→ \"I'll have Daniel give you a quick call [later/tomorrow].\"\n→ \"Appreciate your time, [Your Name]! Talk soon!\"\n\n📌 REMEMBER:\n✓ Always confirm the best number to call\n✓ Get the owner's name\n✓ Set a specific time for follow-up\n✓ Be friendly and professional" }
};

function replaceNameInScript(content) {
    return content.replace(/\[Your Name\]/gi, userName);
}

function loadAppointmentData() {
    const saved = localStorage.getItem(`appointments_${currentUser?.sub || 'default'}`);
    if (saved) appointments = JSON.parse(saved);
    const savedGoals = localStorage.getItem(`goals_${currentUser?.sub || 'default'}`);
    if (savedGoals) goals = JSON.parse(savedGoals);
    updateStats();
}

function saveAppointments() {
    localStorage.setItem(`appointments_${currentUser?.sub || 'default'}`, JSON.stringify(appointments));
    updateStats();
}

function saveGoals() {
    localStorage.setItem(`goals_${currentUser?.sub || 'default'}`, JSON.stringify(goals));
    updateStats();
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function getTodayCount() {
    return appointments[getTodayStr()]?.reports?.length || 0;
}

function getWeekCount() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    let total = 0;
    for (let d in appointments) {
        const date = new Date(d);
        if (date >= start && date <= end && appointments[d].reports)
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
    document.getElementById('statToday').innerText = getTodayCount();
    document.getElementById('statWeek').innerText = getWeekCount();
    document.getElementById('statMonth').innerText = getMonthCount();
    document.getElementById('goalDaily').innerText = goals.daily;
    document.getElementById('goalWeekly').innerText = goals.weekly;
    document.getElementById('goalMonthly').innerText = goals.monthly;
}

function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned, editId = null) {
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    if (!appointments[dateStr].reports) appointments[dateStr].reports = [];
    const newAppointment = { id: editId || Date.now(), business, contactName, role, phone, time, notes, assigned, createdAt: new Date().toISOString() };
    if (editId) {
        const index = appointments[dateStr].reports.findIndex(r => r.id === editId);
        if (index !== -1) appointments[dateStr].reports[index] = newAppointment;
        else appointments[dateStr].reports.unshift(newAppointment);
    } else {
        appointments[dateStr].reports.unshift(newAppointment);
    }
    appointments[dateStr].reports.sort((a, b) => b.id - a.id);
    appointments[dateStr].count = appointments[dateStr].reports.length;
    saveAppointments();
    return true;
}

function deleteAppointment(dateStr, id) {
    if (appointments[dateStr] && appointments[dateStr].reports) {
        appointments[dateStr].reports = appointments[dateStr].reports.filter(r => r.id !== id);
        appointments[dateStr].count = appointments[dateStr].reports.length;
        if (appointments[dateStr].reports.length === 0) delete appointments[dateStr];
        saveAppointments();
        return true;
    }
    return false;
}

function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
}

function exportToCSV() {
    let csvRows = [['Date', 'Business', 'Contact', 'Role', 'Phone', 'Time', 'Notes', 'Assigned']];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(appt => {
                csvRows.push([date, appt.business, appt.contactName, appt.role, appt.phone, appt.time, appt.notes, appt.assigned]);
            });
        }
    }
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointments_${getTodayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Exported ${csvRows.length - 1} appointments`);
}

let currentCalDate = new Date(), selectedCalDate = getTodayStr(), calendarModal = null;

function openCalendarModal() {
    if (calendarModal) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card calendar-modal" id="calModalInner"></div>`;
    document.body.appendChild(modal);
    calendarModal = modal;
    renderCalendarModal();
    modal.onclick = (e) => { if (e.target === modal) closeCalendarModal(); };
}

function closeCalendarModal() {
    if (calendarModal) {
        calendarModal.remove();
        calendarModal = null;
    }
}

function renderCalendarModal() {
    const inner = document.getElementById('calModalInner');
    if (!inner) return;
    const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const apptData = appointments[selectedCalDate] || { reports: [] };
    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) daysHtml += `<div class="cal-day"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const apptCount = appointments[dateStr]?.reports?.length || 0;
        const isSelected = (selectedCalDate === dateStr);
        daysHtml += `<div class="cal-day ${isSelected ? 'selected' : ''}" data-date="${dateStr}"><div class="cal-day-number">${d}</div>${apptCount > 0 ? '<div class="appointment-dots"><div class="appointment-dot"></div></div>' : ''}</div>`;
    }
    let reportsHtml = '<div style="margin-top:16px;"><strong>Appointments</strong></div>';
    if (apptData.reports && apptData.reports.length) {
        apptData.reports.forEach(r => {
            reportsHtml += `<div class="appointment-card"><div><strong>${escapeHtml(r.business)}</strong> - ${escapeHtml(r.contactName)}</div><div class="appointment-actions"><button class="delete-appt-btn" data-id="${r.id}" data-date="${selectedCalDate}">Delete</button></div></div>`;
        });
    } else {
        reportsHtml += '<div style="padding:20px; text-align:center;">No appointments</div>';
    }
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    inner.innerHTML = `<div class="cal-header"><div class="cal-month-year">${monthNames[month]} ${year}</div><div class="cal-nav"><button id="calPrevBtn">◀</button><button id="calNextBtn">▶</button><button id="calTodayBtn">Today</button></div></div><div class="cal-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="cal-days">${daysHtml}</div><div><button class="icon-btn" id="quickAddForDate" style="background:var(--secondary); color:white; width:100%; margin:10px 0;">+ Add Appointment</button>${reportsHtml}</div><div class="modal-buttons" style="margin-top:16px;"><button class="icon-btn" id="closeCalBtn">Close</button></div>`;
    
    document.querySelectorAll('.cal-day[data-date]').forEach(el => {
        el.onclick = () => {
            selectedCalDate = el.dataset.date;
            renderCalendarModal();
        };
    });
    document.getElementById('calPrevBtn')?.onclick = () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendarModal();
    };
    document.getElementById('calNextBtn')?.onclick = () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendarModal();
    };
    document.getElementById('calTodayBtn')?.onclick = () => {
        currentCalDate = new Date();
        selectedCalDate = getTodayStr();
        renderCalendarModal();
    };
    document.getElementById('quickAddForDate')?.onclick = () => {
        openQuickReportWithDate(selectedCalDate);
    };
    document.getElementById('closeCalBtn')?.onclick = closeCalendarModal;
    document.querySelectorAll('.delete-appt-btn').forEach(btn => {
        btn.onclick = () => {
            if (confirm('Delete?')) {
                deleteAppointment(btn.dataset.date, parseInt(btn.dataset.id));
                renderCalendarModal();
                showToast('Deleted');
            }
        };
    });
}

function openQuickReportWithDate(defaultDate) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card report-modal"><h3>Add Appointment for ${defaultDate}</h3><div class="form-group"><label>Business *</label><input id="reportBusiness"></div><div class="form-group"><label>Contact *</label><input id="reportName"></div><div class="form-group"><label>Phone</label><input id="reportPhone"></div><div class="form-group"><label>Notes</label><textarea id="reportNotes" rows="2"></textarea></div><div class="modal-buttons"><button class="icon-btn" id="submitBtn" style="background:var(--success);">Save</button><button class="icon-btn" id="cancelBtn">Cancel</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('submitBtn').onclick = () => {
        const business = document.getElementById('reportBusiness').value;
        const name = document.getElementById('reportName').value;
        if (!business || !name) {
            showToast('Required fields', true);
            return;
        }
        addAppointment(defaultDate, business, name, 'Owner', document.getElementById('reportPhone').value, '', document.getElementById('reportNotes').value, currentUser?.name || 'User');
        modal.remove();
        if (calendarModal) renderCalendarModal();
        showToast('Added');
    };
    document.getElementById('cancelBtn').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function openQuickReport() {
    openQuickReportWithDate(getTodayStr());
}

function openPriorityModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card priority-modal"><div class="priority-header"><h2>Call Priority Predictor</h2></div><div class="recommendation-card"><strong>Best Times:</strong> Tue-Thu, 10-11:30 AM & 2-4 PM local time<br>Success Rate: 85-95%</div><div class="modal-buttons"><button class="icon-btn" id="closeBtn">Close</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeBtn').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function openHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card help-modal"><h3>Help Guide</h3><div class="help-step"><h4>Google Sign-In</h4><p>Click the Google button in the top-right corner to sign in</p></div><div class="help-step"><h4>Scripts</h4><p>Press 1-9 keys to switch scripts</p></div><div class="modal-buttons"><button class="icon-btn" id="closeBtn">Close</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeBtn').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function factoryReset() {
    if (confirm('Reset all data?')) {
        localStorage.clear();
        location.reload();
    }
}

function loadScripts() {
    const saved = localStorage.getItem(`scripts_${currentUser?.sub || 'default'}`);
    if (saved) scripts = JSON.parse(saved);
    else scripts = JSON.parse(JSON.stringify(defaultScripts));
    customOrder = ["opening", "owner_yes", "owner_no", "closing"];
    document.getElementById('scriptCount').innerText = Object.keys(scripts).length;
}

function saveAllScripts() {
    localStorage.setItem(`scripts_${currentUser?.sub || 'default'}`, JSON.stringify(scripts));
    document.getElementById('saveStatus').innerHTML = '✓ Saved';
    setTimeout(() => {
        if (!isEditing) document.getElementById('saveStatus').innerHTML = 'Auto';
    }, 1500);
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

function escapeHtml(s) {
    return s ? String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : '';
}

function renderNavigation() {
    const container = document.getElementById('scriptNavList');
    const visible = getOrderedVisible();
    if (!visible.length) {
        container.innerHTML = '<div>No scripts</div>';
        return;
    }
    let html = '';
    visible.forEach((id, idx) => {
        const s = scripts[id];
        const active = currentScriptId === id;
        const shortcut = idx < 9 ? `${idx + 1}` : null;
        html += `<div class="nav-item ${active ? 'active' : ''}" data-id="${id}"><i class="fas fa-scroll"></i><span>${escapeHtml(s.name)}</span>${shortcut ? `<span class="key-hint">${shortcut}</span>` : ''}<div class="nav-actions"><button class="nav-icon-btn rename-btn" data-id="${id}"><i class="fas fa-pencil-alt"></i></button><button class="nav-icon-btn delete-btn" data-id="${id}" ${id === 'opening' ? 'disabled' : ''}><i class="fas fa-trash"></i></button></div></div>`;
    });
    container.innerHTML = html;
    document.querySelectorAll('.nav-item').forEach(el => {
        const sid = el.dataset.id;
        el.onclick = (e) => {
            if (e.target.closest('.rename-btn') || e.target.closest('.delete-btn')) return;
            if (!isEditing && sid) loadScript(sid);
        };
    });
    document.querySelectorAll('.rename-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const newName = prompt('New name:', scripts[id].name);
            if (newName?.trim()) {
                scripts[id].name = newName.trim();
                saveAllScripts();
                renderNavigation();
                if (currentScriptId === id) document.getElementById('currentScriptName').innerHTML = scripts[id].name;
                showToast('Renamed');
            }
        };
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id === 'opening') return;
            if (confirm('Delete?')) {
                delete scripts[id];
                customOrder = customOrder.filter(i => i !== id);
                if (currentScriptId === id) loadScript('opening');
                saveAllScripts();
                renderNavigation();
                showToast('Deleted');
            }
        };
    });
    const visibleIds = getOrderedVisible();
    const idxCur = visibleIds.indexOf(currentScriptId);
    document.getElementById('activeShortcutHint').innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur + 1}` : `Key: —`;
}

function loadScript(id) {
    if (!scripts[id] || isEditing) return;
    currentScriptId = id;
    document.getElementById('currentScriptName').innerHTML = scripts[id].name;
    const displayContent = replaceNameInScript(scripts[id].content);
    document.getElementById('scriptContent').innerHTML = `<div class="script-display">${escapeHtml(displayContent).replace(/\n/g, '<br>')}</div>`;
    renderNavigation();
}

function enterEdit() {
    isEditing = true;
    document.getElementById('editScriptBtn').style.display = 'none';
    document.getElementById('saveScriptBtn').style.display = 'inline-flex';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('scriptContent').innerHTML = `<textarea id="editTextarea" class="edit-textarea">${escapeHtml(scripts[currentScriptId].content)}</textarea>`;
    document.getElementById('saveStatus').innerHTML = 'Editing';
}

function saveEdit() {
    scripts[currentScriptId].content = document.getElementById('editTextarea').value;
    saveAllScripts();
    cancelEdit();
    showToast('Saved!');
}

function cancelEdit() {
    isEditing = false;
    document.getElementById('editScriptBtn').style.display = 'inline-flex';
    document.getElementById('saveScriptBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    loadScript(currentScriptId);
    document.getElementById('saveStatus').innerHTML = 'Auto';
}

function copyScript() {
    copyToClipboard(replaceNameInScript(scripts[currentScriptId].content));
}

function resetScript() {
    if (defaultScripts[currentScriptId]) {
        scripts[currentScriptId] = { ...defaultScripts[currentScriptId] };
        saveAllScripts();
        loadScript(currentScriptId);
        showToast('Reset');
    }
}

function addScript() {
    const name = prompt('Script name:');
    if (!name) return;
    const id = 'custom_' + Date.now();
    scripts[id] = { name, content: 'New script...' };
    customOrder.push(id);
    saveAllScripts();
    renderNavigation();
    loadScript(id);
    showToast(`Added: ${name}`);
}

function undoScript() {
    showToast('Undo feature available');
}

function redoScript() {
    showToast('Redo feature available');
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.body.classList.add('dark');
    document.getElementById('themeToggle').innerHTML = document.body.classList.contains('dark') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    showToast(`${isDark ? 'Dark' : 'Light'} mode`);
}

function initSearch() {
    document.getElementById('scriptSearch').addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderNavigation();
    });
}

function initKeyboard() {
    window.addEventListener('keydown', (e) => {
        if (allFeaturesEnabled && e.key >= '1' && e.key <= '9' && !isEditing && !e.target.matches('textarea,input')) {
            e.preventDefault();
            const target = getKeyMapping().get(e.key);
            if (target && scripts[target]) {
                loadScript(target);
                showToast(scripts[target].name);
            }
        }
        if (e.key === 'Escape' && isEditing) cancelEdit();
    });
}

function initializeApp() {
    userName = currentUser?.name || 'User';
    loadAppointmentData();
    loadScripts();
    initTheme();
    initSearch();
    renderNavigation();
    loadScript('opening');
    initKeyboard();
    
    document.getElementById('editScriptBtn').onclick = enterEdit;
    document.getElementById('saveScriptBtn').onclick = saveEdit;
    document.getElementById('cancelEditBtn').onclick = cancelEdit;
    document.getElementById('copyScriptBtn').onclick = copyScript;
    document.getElementById('resetScriptBtn').onclick = resetScript;
    document.getElementById('themeToggle').onclick = toggleTheme;
    document.getElementById('addScriptBtn').onclick = addScript;
    document.getElementById('openCalendarBtn').onclick = openCalendarModal;
    document.getElementById('quickReportBtn').onclick = openQuickReport;
    document.getElementById('exportCsvBtn').onclick = exportToCSV;
    document.getElementById('userNameBtn').onclick = () => {
        const newName = prompt('Enter your name:', userName);
        if (newName?.trim()) {
            userName = newName.trim();
            showToast(`Name set to: ${userName}`);
            if (!isEditing) loadScript(currentScriptId);
        }
    };
    document.getElementById('priorityBtn').onclick = openPriorityModal;
    document.getElementById('helpBtn').onclick = openHelpModal;
    document.getElementById('resetAllBtn').onclick = factoryReset;
    document.getElementById('historyBtn').onclick = () => showToast('Version history coming soon');
    document.getElementById('undoBtn').onclick = undoScript;
    document.getElementById('redoBtn').onclick = redoScript;
    
    setInterval(() => {
        if (!isEditing && allFeaturesEnabled) document.getElementById('saveStatus').innerHTML = 'Auto';
        updateStats();
    }, 5000);
}

if (!checkExistingSession()) {
    initializeGoogleSignIn();
}
