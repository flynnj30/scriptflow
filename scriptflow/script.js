// =============================================
// SCRIPTFLOW PRO - COMPLETE APPLICATION
// Google Authentication + Full Features
// =============================================

// ==================== GOOGLE AUTH ====================
const CLIENT_ID = "389117008163-cbjcmgsitsmbmltg9mb9h99aukeb54p0.apps.googleusercontent.com";

let currentUser = null;
let featuresUnlocked = false;

// Global app variables
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
let currentCalDate = new Date();
let selectedCalDate = new Date().toISOString().split('T')[0];
let calendarModal = null;

// Helper Functions
function showToast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.background = isError ? 'var(--danger)' : 'var(--success)';
    t.innerHTML = `${isError ? '⚠️ ' : '✓ '}${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
}

function escapeHtml(s) {
    return s ? String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : '';
}

function isAuth() {
    return featuresUnlocked && currentUser !== null;
}

function checkAuthAndRun(callback, ...args) {
    if (isAuth()) {
        callback(...args);
    } else {
        showToast('Please sign in first', true);
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
}

function saveGoals() {
    localStorage.setItem('scriptflow_goals_main', JSON.stringify(goals));
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
        if (date >= start && date <= end && appointments[d].reports) {
            total += appointments[d].reports.length;
        }
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
        if (date >= start && date <= end && appointments[d].reports) {
            total += appointments[d].reports.length;
        }
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
    if (!isAuth()) return null;
    if (!appointments[dateStr]) {
        appointments[dateStr] = { count: 0, note: '', reports: [] };
    }
    if (!appointments[dateStr].reports) appointments[dateStr].reports = [];
    
    const reportText = `Business: ${business}\nContact: ${contactName}\nRole: ${role}\nPhone: ${phone}\nTime: ${time}\nNotes: ${notes}\nAssigned to: ${assigned}\nDate: ${dateStr}`;
    const newAppointment = {
        id: editId || Date.now(),
        business,
        contactName,
        role,
        phone,
        time,
        notes,
        assigned,
        createdAt: new Date().toISOString(),
        fullText: reportText
    };
    
    if (editId) {
        const index = appointments[dateStr].reports.findIndex(r => r.id === editId);
        if (index !== -1) {
            appointments[dateStr].reports[index] = newAppointment;
        } else {
            appointments[dateStr].reports.unshift(newAppointment);
        }
    } else {
        appointments[dateStr].reports.unshift(newAppointment);
    }
    
    appointments[dateStr].reports.sort((a, b) => b.id - a.id);
    appointments[dateStr].count = appointments[dateStr].reports.length;
    appointments[dateStr].note = appointments[dateStr].note || `${appointments[dateStr].reports.length} appointment(s)`;
    saveAppointments();
    return reportText;
}

function deleteAppointment(dateStr, id) {
    if (!isAuth()) return false;
    if (appointments[dateStr] && appointments[dateStr].reports) {
        appointments[dateStr].reports = appointments[dateStr].reports.filter(r => r.id !== id);
        appointments[dateStr].count = appointments[dateStr].reports.length;
        if (appointments[dateStr].reports.length === 0) {
            delete appointments[dateStr];
        } else {
            appointments[dateStr].note = `${appointments[dateStr].reports.length} appointment(s)`;
        }
        saveAppointments();
        return true;
    }
    return false;
}

function copyToClipboard(text) {
    if (!text) {
        showToast('Nothing to copy', true);
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied!');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied!');
    });
}

function exportToCSV() {
    if (!isAuth()) return;
    let csvRows = [];
    csvRows.push(['Date', 'Business', 'Contact Name', 'Role', 'Phone', 'Time', 'Notes', 'Assigned To', 'Created At']);
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(appt => {
                csvRows.push([
                    date, appt.business, appt.contactName, appt.role,
                    appt.phone, appt.time, appt.notes, appt.assigned, appt.createdAt
                ]);
            });
        }
    }
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `appointments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${csvRows.length - 1} appointments to CSV`);
}

// ==================== CALENDAR MODAL ====================
function getAppointmentDots(count) {
    if (count === 0) return '<div class="appointment-dots"></div>';
    let dots = '<div class="appointment-dots">';
    const dotCount = Math.min(count, 5);
    for (let i = 0; i < dotCount; i++) {
        let dotClass = 'appointment-dot';
        if (count >= 5) dotClass += ' many';
        else if (count >= 3) dotClass += ' multiple';
        dots += `<div class="${dotClass}"></div>`;
    }
    if (count > 5) dots += `<span style="font-size:0.65rem; margin-left:2px;">+${count - 5}</span>`;
    dots += '</div>';
    return dots;
}

function renderCalendarModal() {
    const inner = document.getElementById('calModalInner');
    if (!inner) return;
    
    const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const apptData = appointments[selectedCalDate] || { count: 0, note: '', reports: [] };
    
    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) daysHtml += `<div class="cal-day"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const apptCount = appointments[dateStr]?.reports?.length || 0;
        const isSelected = (selectedCalDate === dateStr);
        daysHtml += `<div class="cal-day ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
            <div class="cal-day-number">${d}</div>
            ${getAppointmentDots(apptCount)}
        </div>`;
    }
    
    let reportsHtml = '<div style="margin-top:16px;"><strong>📋 Appointments</strong><button class="copy-btn-sm" id="copyAllReportsBtn" style="float:right;">Copy All</button><div style="clear:both;"></div>';
    if (apptData.reports && apptData.reports.length) {
        apptData.reports.forEach(r => {
            reportsHtml += `<div class="appointment-card">
                <div><strong>${escapeHtml(r.business)}</strong> - ${escapeHtml(r.contactName)} (${escapeHtml(r.role)})</div>
                <div style="font-size:0.8rem;">📞 ${escapeHtml(r.phone)} | ⏰ ${escapeHtml(r.time || 'TBD')}</div>
                <div style="font-size:0.8rem;">📝 ${escapeHtml(r.notes?.substring(0, 100))}</div>
                <div style="font-size:0.7rem;">👤 Assigned: ${escapeHtml(r.assigned)} • ${new Date(r.createdAt).toLocaleString()}</div>
                <div class="appointment-actions">
                    <button class="edit-appt-btn" data-id="${r.id}" data-date="${selectedCalDate}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="delete-appt-btn" data-id="${r.id}" data-date="${selectedCalDate}"><i class="fas fa-trash"></i> Delete</button>
                    <button class="copy-btn-sm copy-single-btn" data-id="${r.id}">Copy</button>
                </div>
            </div>`;
        });
    } else {
        reportsHtml += '<div style="padding:20px; text-align:center; color:var(--text-secondary);">No appointments for this date</div>';
    }
    reportsHtml += `</div>`;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    inner.innerHTML = `
        <div class="cal-header">
            <div class="cal-month-year">${monthNames[month]} ${year}</div>
            <div class="cal-nav">
                <button id="calPrevBtn">◀ Prev</button>
                <button id="calNextBtn">Next ▶</button>
                <button id="calTodayBtn">Today</button>
            </div>
        </div>
        <div class="cal-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        <div class="cal-days" id="calDaysGrid">${daysHtml}</div>
        <div class="date-changer">
            <i class="fas fa-calendar-day"></i><span style="font-weight:700;">Selected Date:</span>
            <input type="date" id="quickDatePicker" value="${selectedCalDate}">
        </div>
        <div>
            <label><strong>📝 General Note</strong></label>
            <textarea id="apptNoteInput" style="width:100%; padding:12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary); margin-top:8px;" rows="2">${escapeHtml(apptData.note || '')}</textarea>
            <button class="icon-btn" id="quickAddForDate" style="background:var(--secondary); color:white; margin-top:8px; width:100%;"><i class="fas fa-plus"></i> + Quick Add Appointment for ${selectedCalDate}</button>
            ${reportsHtml}
            <div class="goal-input-group">
                <div><label>Daily Goal</label><input type="number" id="goalDailyInput" value="${goals.daily}"></div>
                <div><label>Weekly Goal</label><input type="number" id="goalWeeklyInput" value="${goals.weekly}"></div>
                <div><label>Monthly Goal</label><input type="number" id="goalMonthlyInput" value="${goals.monthly}"></div>
            </div>
        </div>
        <div class="modal-buttons" style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;">
            <button class="icon-btn" id="saveNoteBtn" style="background:var(--success); color:white;">Save Note</button>
            <button class="icon-btn" id="closeCalBtn">Close</button>
        </div>
    `;
    
    // Attach event listeners
    document.querySelectorAll('.cal-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
            selectedCalDate = el.getAttribute('data-date');
            renderCalendarModal();
        });
    });
    
    document.getElementById('quickDatePicker')?.addEventListener('change', (e) => {
        selectedCalDate = e.target.value;
        renderCalendarModal();
    });
    
    document.querySelectorAll('.delete-appt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            const date = btn.getAttribute('data-date');
            if (confirm('Delete this appointment?')) {
                deleteAppointment(date, id);
                renderCalendarModal();
                showToast('Appointment deleted');
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
            for (let date in appointments) {
                const report = appointments[date]?.reports?.find(r => r.id === id);
                if (report) {
                    copyToClipboard(report.fullText);
                    break;
                }
            }
        });
    });
    
    document.getElementById('calPrevBtn')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendarModal();
    });
    
    document.getElementById('calNextBtn')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendarModal();
    });
    
    document.getElementById('calTodayBtn')?.addEventListener('click', () => {
        currentCalDate = new Date();
        selectedCalDate = getTodayStr();
        renderCalendarModal();
    });
    
    document.getElementById('saveNoteBtn')?.addEventListener('click', () => {
        if (!appointments[selectedCalDate]) {
            appointments[selectedCalDate] = { count: 0, note: '', reports: [] };
        }
        appointments[selectedCalDate].note = document.getElementById('apptNoteInput').value;
        saveAppointments();
        showToast('Note saved');
    });
    
    document.getElementById('quickAddForDate')?.addEventListener('click', () => {
        closeCalendarModal();
        setTimeout(() => openQuickReportWithDate(selectedCalDate), 100);
    });
    
    document.getElementById('closeCalBtn')?.addEventListener('click', closeCalendarModal);
    
    document.getElementById('copyAllReportsBtn')?.addEventListener('click', () => {
        if (apptData.reports?.length) {
            copyToClipboard(apptData.reports.map(r => r.fullText).join('\n\n---\n\n'));
        } else {
            showToast('No appointments', true);
        }
    });
    
    ['goalDailyInput', 'goalWeeklyInput', 'goalMonthlyInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                const map = { goalDailyInput: 'daily', goalWeeklyInput: 'weekly', goalMonthlyInput: 'monthly' };
                goals[map[id]] = parseInt(el.value) || (id === 'goalDailyInput' ? 3 : id === 'goalWeeklyInput' ? 15 : 60);
                saveGoals();
                renderCalendarModal();
            });
        }
    });
}

function openCalendarModal() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    if (calendarModal) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card calendar-modal" id="calModalInner"></div>`;
    document.body.appendChild(modal);
    calendarModal = modal;
    renderCalendarModal();
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCalendarModal();
    });
}

function closeCalendarModal() {
    if (calendarModal) {
        calendarModal.remove();
        calendarModal = null;
    }
}

function openEditAppointmentModal(oldDateStr, appt) {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `
        <div class="modal-card">
            <h3>✏️ Edit Appointment</h3>
            <div class="form-group"><label>Date</label><input type="date" id="editDate" value="${oldDateStr}"></div>
            <div class="form-group"><label>Business *</label><input id="editBusiness" value="${escapeHtml(appt.business)}"></div>
            <div class="form-group"><label>Contact Name *</label><input id="editName" value="${escapeHtml(appt.contactName)}"></div>
            <div class="form-group"><label>Role</label><input id="editRole" value="${escapeHtml(appt.role)}"></div>
            <div class="form-group"><label>Phone</label><input id="editPhone" value="${escapeHtml(appt.phone)}"></div>
            <div class="form-group"><label>Time</label><input id="editTime" value="${escapeHtml(appt.time)}"></div>
            <div class="form-group"><label>Notes</label><textarea id="editNotes" rows="2">${escapeHtml(appt.notes)}</textarea></div>
            <div class="form-group"><label>Assigned To</label><input id="editAssigned" value="${escapeHtml(appt.assigned)}"></div>
            <div class="modal-buttons" style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px;">
                <button class="icon-btn" id="saveEditBtn" style="background:var(--success);">Save Changes</button>
                <button class="icon-btn" id="cancelEditModalBtn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    
    document.getElementById('saveEditBtn').addEventListener('click', () => {
        const newDate = document.getElementById('editDate').value;
        const updatedBusiness = document.getElementById('editBusiness').value;
        const updatedName = document.getElementById('editName').value;
        const updatedRole = document.getElementById('editRole').value;
        const updatedPhone = document.getElementById('editPhone').value;
        const updatedTime = document.getElementById('editTime').value;
        const updatedNotes = document.getElementById('editNotes').value;
        const updatedAssigned = document.getElementById('editAssigned').value;
        
        if (!updatedBusiness || !updatedName) {
            showToast('Business and Name required', true);
            return;
        }
        
        deleteAppointment(oldDateStr, appt.id);
        addAppointment(newDate, updatedBusiness, updatedName, updatedRole, updatedPhone, updatedTime, updatedNotes, updatedAssigned, appt.id);
        
        if (newDate !== oldDateStr) {
            selectedCalDate = newDate;
            showToast(`Appointment moved from ${oldDateStr} to ${newDate}`);
        } else {
            showToast('Appointment updated successfully');
        }
        
        modalDiv.remove();
        closeCalendarModal();
        openCalendarModal();
    });
    
    document.getElementById('cancelEditModalBtn').addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('click', (e) => {
        if (e.target === modalDiv) modalDiv.remove();
    });
}

function openQuickReport() {
    openQuickReportWithDate(getTodayStr());
}

function openQuickReportWithDate(defaultDate) {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card report-modal">
            <h3><i class="fas fa-plus-circle"></i> Quick Add Appointment for ${defaultDate}</h3>
            <div class="form-group"><label>Date</label><input type="date" id="reportDate" value="${defaultDate}"></div>
            <div class="form-group"><label>Business Name *</label><input type="text" id="reportBusiness" placeholder="e.g., Flynn Group"></div>
            <div class="form-group"><label>Contact Name *</label><input type="text" id="reportName" placeholder="Full name"></div>
            <div class="form-group"><label>Role</label><select id="reportRole"><option>Owner</option><option>Manager</option><option>Director</option><option>Marketing</option><option>Admin</option></select></div>
            <div class="form-group"><label>Phone Number</label><input type="text" id="reportPhone" placeholder="+1 207 592 2257"></div>
            <div class="form-group"><label>Time</label><input type="text" id="reportTime" placeholder="e.g., Monday 3pm ET"></div>
            <div class="form-group"><label>Notes</label><textarea id="reportNotes" rows="3" placeholder="Appointment details..."></textarea></div>
            <div class="form-group"><label>Assigned To</label><input type="text" id="reportAssigned" value="Daniel"></div>
            <div class="modal-buttons" style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px;">
                <button class="icon-btn" id="submitReportBtn" style="background:var(--success); color:white;">Save & Copy</button>
                <button class="icon-btn" id="closeReportBtn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('submitReportBtn').addEventListener('click', () => {
        const date = document.getElementById('reportDate').value;
        const business = document.getElementById('reportBusiness').value;
        const name = document.getElementById('reportName').value;
        if (!business || !name) {
            showToast('Fill business and contact name', true);
            return;
        }
        const reportText = addAppointment(date, business, name, document.getElementById('reportRole').value, document.getElementById('reportPhone').value, document.getElementById('reportTime').value, document.getElementById('reportNotes').value, document.getElementById('reportAssigned').value);
        copyToClipboard(reportText);
        modal.remove();
        openCalendarModal();
    });
    
    document.getElementById('closeReportBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ==================== PRIORITY PREDICTOR ====================
function openPriorityModal() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const now = new Date();
    const timeZones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
    const zoneNames = ['Eastern (ET)', 'Central (CT)', 'Mountain (MT)', 'Pacific (PT)'];
    let zonesHtml = '';
    for (let i = 0; i < timeZones.length; i++) {
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: timeZones[i] }));
        const hour = tzTime.getHours();
        const isPrime = (hour >= 10 && hour <= 11) || (hour >= 14 && hour <= 16);
        zonesHtml += `<div class="timezone-card ${isPrime ? 'recommended' : ''}">
            <div class="timezone-name">${zoneNames[i]}</div>
            <div class="timezone-time">${tzTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="best-time-badge ${isPrime ? 'best-time-high' : 'best-time-good'}">${isPrime ? '🔥 PRIME TIME' : 'Call during 10-11:30 AM or 2-4 PM'}</div>
        </div>`;
    }
    modal.innerHTML = `
        <div class="modal-card priority-modal">
            <div class="priority-header">
                <h2><i class="fas fa-chart-line"></i> REAL-TIME CALL PRIORITY</h2>
                <div>Best times to reach US business owners</div>
            </div>
            <div class="recommendation-card">
                <strong>🎯 SMART RECOMMENDATION:</strong><br>Call Tuesday-Thursday between 10-11:30 AM or 2-4 PM local time for 85-95% connection rates
            </div>
            <div class="timezone-grid">${zonesHtml}</div>
            <div style="padding:12px; background:var(--bg-primary); border-radius:16px;">
                <strong>💡 PRO TIPS:</strong><br>• Best days: Tuesday, Wednesday, Thursday<br>• Avoid: Monday mornings & Friday afternoons<br>• Lunch hour (12-1 PM) has <30% answer rate
            </div>
            <div class="modal-buttons" style="margin-top:20px;">
                <button class="icon-btn" id="closePriorityBtn" style="background:var(--primary); width:100%;">Start Calling</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closePriorityBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ==================== SCRIPT MANAGEMENT SYSTEM ====================
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

function initVersionHistory(id, content) {
    if (!versionHistory[id]) {
        versionHistory[id] = [{ content, timestamp: new Date().toISOString() }];
        currentVersionIndex[id] = 0;
    }
}

function saveVersion(id, newContent) {
    if (!versionHistory[id]) {
        initVersionHistory(id, newContent);
        return;
    }
    if (currentVersionIndex[id] < versionHistory[id].length - 1) {
        versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
    }
    versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
    currentVersionIndex[id] = versionHistory[id].length - 1;
    if (versionHistory[id].length > 50) versionHistory[id].shift();
    localStorage.setItem('scriptflow_version_history', JSON.stringify(versionHistory));
}

function undoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] <= 0) {
        showToast('No earlier version', true);
        return;
    }
    currentVersionIndex[id]--;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id) document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Undo');
}

function redoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) {
        showToast('No newer version', true);
        return;
    }
    currentVersionIndex[id]++;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id) document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Redo');
}

function loadScripts() {
    const saved = localStorage.getItem('scriptflow_pro_scripts_main');
    if (saved) {
        scripts = JSON.parse(saved);
        for (let k of Object.keys(defaultScripts)) {
            if (!scripts[k]) scripts[k] = { ...defaultScripts[k] };
        }
    } else {
        scripts = JSON.parse(JSON.stringify(defaultScripts));
    }
    const savedOrder = localStorage.getItem('scriptflow_order_main');
    if (savedOrder) {
        customOrder = JSON.parse(savedOrder);
    } else {
        customOrder = ["opening", "owner_yes", "owner_no", "objection_website", "objection_webguy", "objection_cost", "objection_busy", "objection_not_interested", "objection_info", "objection_found_me", "objection_who_are_you", "closing"];
    }
    const savedHistory = localStorage.getItem('scriptflow_version_history');
    if (savedHistory) versionHistory = JSON.parse(savedHistory);
    for (let id in scripts) {
        if (!versionHistory[id]) {
            initVersionHistory(id, scripts[id].content);
        } else {
            currentVersionIndex[id] = versionHistory[id].length - 1;
        }
    }
    document.getElementById('scriptCount').innerText = Object.keys(scripts).length;
}

function saveAllScripts() {
    localStorage.setItem('scriptflow_pro_scripts_main', JSON.stringify(scripts));
    localStorage.setItem('scriptflow_order_main', JSON.stringify(customOrder));
    document.getElementById('saveStatus').innerHTML = '✓ Saved';
    setTimeout(() => {
        if (!isEditing) document.getElementById('saveStatus').innerHTML = 'Auto';
    }, 1500);
}

function getOrderedVisible() {
    let ids = [...customOrder.filter(id => scripts[id]), ...Object.keys(scripts).filter(id => !customOrder.includes(id))];
    if (searchTerm) {
        ids = ids.filter(id => scripts[id].name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return ids;
}

function getKeyMapping() {
    const vis = getOrderedVisible();
    const map = new Map();
    vis.slice(0, 9).forEach((id, i) => map.set((i + 1).toString(), id));
    return map;
}

function replaceNameInScript(content) {
    return content.replace(/\[Your Name\]/gi, userName);
}

function renderNavigation() {
    if (!isAuth()) return;
    const container = document.getElementById('scriptNavList');
    const visible = getOrderedVisible();
    if (!visible.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;">No scripts found</div>';
        return;
    }
    let html = '';
    visible.forEach((id, idx) => {
        const s = scripts[id];
        const active = currentScriptId === id;
        const shortcut = idx < 9 ? `${idx + 1}` : null;
        html += `<div class="nav-item ${active ? 'active' : ''}" data-id="${id}">
            <i class="fas fa-scroll"></i>
            <span>${escapeHtml(s.name)}</span>
            ${shortcut ? `<span class="key-hint">${shortcut}</span>` : ''}
            <div class="nav-actions">
                <button class="nav-icon-btn rename-btn" data-id="${id}"><i class="fas fa-pencil-alt"></i></button>
                <button class="nav-icon-btn delete-btn" data-id="${id}" ${id === 'opening' ? 'disabled style="opacity:0.4;"' : ''}><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
    
    document.querySelectorAll('.nav-item').forEach(el => {
        const sid = el.getAttribute('data-id');
        el.addEventListener('click', (e) => {
            if (e.target.closest('.rename-btn') || e.target.closest('.delete-btn')) return;
            if (isEditing && confirm('Cancel editing?')) cancelEdit();
            if (!isEditing && sid) loadScript(sid);
        });
    });
    
    document.querySelectorAll('.rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const newName = prompt('New name:', scripts[id].name);
            if (newName?.trim()) {
                scripts[id].name = newName.trim();
                saveAllScripts();
                renderNavigation();
                if (currentScriptId === id) document.getElementById('currentScriptName').innerHTML = scripts[id].name;
                showToast('Renamed');
            }
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (id === 'opening') {
                showToast('Cannot delete opening script', true);
                return;
            }
            if (confirm('Delete this script?')) {
                delete scripts[id];
                delete versionHistory[id];
                customOrder = customOrder.filter(i => i !== id);
                if (currentScriptId === id) loadScript('opening');
                saveAllScripts();
                renderNavigation();
                document.getElementById('scriptCount').innerText = Object.keys(scripts).length;
                showToast('Script deleted');
            }
        });
    });
    
    const visibleIds = getOrderedVisible();
    const idxCur = visibleIds.indexOf(currentScriptId);
    document.getElementById('activeShortcutHint').innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur + 1}` : `Key: —`;
    if (versionHistory[currentScriptId]) {
        document.getElementById('versionNumber').innerText = `${currentVersionIndex[currentScriptId] + 1}/${versionHistory[currentScriptId].length}`;
    }
}

function loadScript(id) {
    if (!isAuth()) return;
    if (!scripts[id] || isEditing) return;
    currentScriptId = id;
    document.getElementById('currentScriptName').innerHTML = scripts[id].name;
    const displayContent = replaceNameInScript(scripts[id].content);
    document.getElementById('scriptContent').innerHTML = `<div class="script-display">${escapeHtml(displayContent).replace(/\n/g, '<br>')}</div>`;
    renderNavigation();
}

function enterEdit() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    isEditing = true;
    document.getElementById('editScriptBtn').style.display = 'none';
    document.getElementById('saveScriptBtn').style.display = 'inline-flex';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('scriptContent').innerHTML = `<textarea id="editTextarea" class="edit-textarea">${escapeHtml(scripts[currentScriptId].content)}</textarea>`;
    document.getElementById('editTextarea').focus();
    document.getElementById('saveStatus').innerHTML = 'Editing';
}

function saveEdit() {
    const newContent = document.getElementById('editTextarea').value;
    scripts[currentScriptId].content = newContent;
    saveVersion(currentScriptId, newContent);
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
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    const content = replaceNameInScript(scripts[currentScriptId].content);
    copyToClipboard(content);
}

function resetScript() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    if (defaultScripts[currentScriptId]) {
        if (confirm('Reset to original content?')) {
            scripts[currentScriptId] = { ...defaultScripts[currentScriptId] };
            saveVersion(currentScriptId, scripts[currentScriptId].content);
            saveAllScripts();
            loadScript(currentScriptId);
            showToast('Reset complete');
        }
    } else {
        showToast('No default version', true);
    }
}

function addScript() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    if (isEditing) {
        showToast('Finish editing first', true);
        return;
    }
    const name = prompt('Enter script name:');
    if (!name) return;
    const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    scripts[id] = { name, content: 'Write your custom script here...' };
    initVersionHistory(id, scripts[id].content);
    customOrder.push(id);
    saveAllScripts();
    renderNavigation();
    loadScript(id);
    showToast(`Added: ${name}`);
}

function showVersionHistoryModal(id) {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    if (!versionHistory[id]) {
        showToast('No history', true);
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    let html = `<div class="modal-card"><h3>Version History: ${escapeHtml(scripts[id].name)}</h3>`;
    versionHistory[id].forEach((v, idx) => {
        html += `<div class="version-item" data-index="${idx}" style="padding:12px; cursor:pointer; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between;">
            <span>${new Date(v.timestamp).toLocaleString()}</span>
            <span>${idx === currentVersionIndex[id] ? '✓ Current' : 'Restore'}</span>
        </div>`;
    });
    html += `<div class="modal-buttons" style="margin-top:16px;"><button class="icon-btn" id="closeHistoryBtn">Close</button></div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    document.querySelectorAll('.version-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'));
            currentVersionIndex[id] = idx;
            scripts[id].content = versionHistory[id][idx].content;
            saveAllScripts();
            if (!isEditing) loadScript(id);
            else if (isEditing && currentScriptId === id) document.getElementById('editTextarea').value = scripts[id].content;
            document.getElementById('versionNumber').innerText = `${idx + 1}/${versionHistory[id].length}`;
            showToast('Version restored');
            modal.remove();
        });
    });
    
    document.getElementById('closeHistoryBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function setUserName() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    const newName = prompt('Enter your name:', userName);
    if (newName?.trim()) {
        userName = newName.trim();
        localStorage.setItem('scriptflow_user_name', userName);
        showToast(`Name set to: ${userName}`);
        if (!isEditing) loadScript(currentScriptId);
    }
}

function openHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card help-modal">
            <h3>📖 ScriptFlow Pro Guide</h3>
            <div class="help-step"><h4>📅 Appointment Calendar</h4><p>Click calendar icon → Color dots show appointment count. Edit any appointment and change its date to move it.</p></div>
            <div class="help-step"><h4>📊 CSV Export</h4><p>Click CSV icon to export all appointments.</p></div>
            <div class="help-step"><h4>✏️ Edit/Delete Appointments</h4><p>Each appointment has Edit (change date too) and Delete buttons.</p></div>
            <div class="help-step"><h4>💾 Local Storage</h4><p>All data saves automatically to your browser.</p></div>
            <div class="modal-buttons"><button class="icon-btn" id="closeHelpBtn" style="background:var(--primary);">Got it!</button></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeHelpBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function factoryReset() {
    if (!isAuth()) {
        showToast('Please sign in first', true);
        return;
    }
    if (confirm('FACTORY RESET: This will erase ALL data. Cannot be undone.')) {
        localStorage.clear();
        location.reload();
    }
}

// ==================== THEME ====================
function initTheme() {
    const saved = localStorage.getItem('scriptflow_theme_main');
    if (saved === 'dark') document.body.classList.add('dark');
    document.getElementById('themeToggle').innerHTML = document.body.classList.contains('dark') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('scriptflow_theme_main', isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    showToast(`${isDark ? 'Dark mode' : 'Light mode'} enabled`);
}

function initSearch() {
    document.getElementById('scriptSearch').addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderNavigation();
    });
}

// ==================== GOOGLE AUTH UI ====================
function updateAuthUI() {
    const btn = document.getElementById('googleSignInBtn');
    const statusDiv = document.getElementById('userStatusArea');
    const emailSpan = document.getElementById('userEmailDisplay');
    const btnText = document.getElementById('googleBtnText');
    
    if (currentUser && featuresUnlocked) {
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Logged in';
        statusDiv.className = 'status-indicator status-logged-in';
        emailSpan.innerHTML = `<i class="fas fa-envelope"></i> ${currentUser.email}`;
        btnText.innerText = currentUser.email.split('@')[0];
        
        const lockOverlay = document.getElementById('authLockOverlay');
        if (lockOverlay) lockOverlay.remove();
        document.getElementById('appContainer').classList.remove('blur-active');
        
        // Load all data after successful login
        loadAppointmentData();
        loadScripts();
        renderNavigation();
        loadScript('opening');
        initSearch();
    } else {
        statusDiv.innerHTML = '<i class="fas fa-lock"></i> Logged out';
        statusDiv.className = 'status-indicator status-logged-out';
        emailSpan.innerHTML = '';
        btnText.innerText = 'Sign in with Google';
        
        if (!document.getElementById('authLockOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'authLockOverlay';
            overlay.className = 'auth-lock-overlay';
            overlay.innerHTML = `
                <div class="lock-card">
                    <i class="fab fa-google"></i>
                    <h2>Authentication Required</h2>
                    <p>Please sign in with your Google account to access ScriptFlow Pro features.</p>
                    <button id="lockSignInBtn" class="gsi-material-button" style="margin:0 auto;">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="google" />
                        Sign in with Google
                    </button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('lockSignInBtn').addEventListener('click', () => {
                triggerGoogleLogin();
            });
            document.getElementById('appContainer').classList.add('blur-active');
        }
    }
}

function triggerGoogleLogin() {
    const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'email profile',
        callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
                fetchUserInfo(tokenResponse.access_token);
            }
        }
    });
    client.requestAccessToken();
}

async function fetchUserInfo(accessToken) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const profile = await res.json();
        if (profile && profile.email) {
            currentUser = { email: profile.email, name: profile.name, picture: profile.picture };
            featuresUnlocked = true;
            updateAuthUI();
            showToast(`Welcome ${profile.name || profile.email}! Access granted.`);
        } else {
            showToast('Login failed', true);
        }
    } catch (err) {
        showToast('Authentication error', true);
    }
}

function logoutUser() {
    currentUser = null;
    featuresUnlocked = false;
    updateAuthUI();
    showToast('Signed out. Features locked.');
}

// ==================== KEYBOARD SHORTCUTS ====================
function initKeyboard() {
    window.addEventListener('keydown', (e) => {
        if (!isAuth()) return;
        if (e.key >= '1' && e.key <= '9' && !isEditing && !e.target.matches('textarea, input')) {
            e.preventDefault();
            const target = getKeyMapping().get(e.key);
            if (target && scripts[target]) {
                loadScript(target);
                showToast(scripts[target].name);
            }
        }
        if (e.key === 'Escape' && isEditing) {
            cancelEdit();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isEditing) {
            e.preventDefault();
            undoScript(currentScriptId);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !isEditing) {
            e.preventDefault();
            redoScript(currentScriptId);
        }
    });
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    document.getElementById('googleSignInBtn').addEventListener('click', () => {
        if (currentUser && featuresUnlocked) {
            if (confirm('Sign out?')) logoutUser();
        } else {
            triggerGoogleLogin();
        }
    });
    
    document.getElementById('editScriptBtn').addEventListener('click', enterEdit);
    document.getElementById('saveScriptBtn').addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
    document.getElementById('copyScriptBtn').addEventListener('click', copyScript);
    document.getElementById('resetScriptBtn').addEventListener('click', resetScript);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('addScriptBtn').addEventListener('click', addScript);
    document.getElementById('openCalendarBtn').addEventListener('click', openCalendarModal);
    document.getElementById('quickReportBtn').addEventListener('click', openQuickReport);
    document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);
    document.getElementById('userNameBtn').addEventListener('click', setUserName);
    document.getElementById('helpBtn').addEventListener('click', openHelpModal);
    document.getElementById('priorityBtn').addEventListener('click', openPriorityModal);
    document.getElementById('historyBtn').addEventListener('click', () => showVersionHistoryModal(currentScriptId));
    document.getElementById('resetAllBtn').addEventListener('click', factoryReset);
    document.getElementById('undoBtn').addEventListener('click', () => undoScript(currentScriptId));
    document.getElementById('redoBtn').addEventListener('click', () => redoScript(currentScriptId));
    
    setInterval(() => {
        if (!isEditing && isAuth()) {
            document.getElementById('saveStatus').innerHTML = 'Auto';
            updateStats();
        }
    }, 5000);
}

// ==================== INITIALIZATION ====================
function init() {
    initTheme();
    initEventListeners();
    initKeyboard();
    updateAuthUI();
}

// Start the app
init();