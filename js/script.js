// ================================================================
// SCRIPTFLOW PRO - COMPLETE JAVASCRIPT
// ================================================================

// ---- GLOBAL STATE ----
let userName = 'Flynn';
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

let dashboardDatePreset = 'today';
let dashboardDateRange = { start: getTodayStr(), end: getTodayStr() };
let currentView = 'calendar';
let currentStatusFilter = 'all';
let currentTagFilter = 'all';
let currentListSearchTerm = '';
let currentSort = 'time';
let currentAnalyticsTab = 'insights';

let toolsOpen = localStorage.getItem('toolsMenuOpen') === 'true';
let featureChartInstance = null;
let draggedItem = null;

// Updated STATUS_OPTIONS with "Held"
const STATUS_OPTIONS = ['Warm Call Booked', 'Meeting Booked', 'Canceled', 'Rescheduled', 'Held'];

const TAG_OPTIONS = [
    { id: 'qualified_warm_call', name: 'Qualified Warm Call', color: 'var(--tag-qualified-warm-call)', colorClass: 'tag-qualified-warm-call-bg' },
    { id: 'unqualified_warm_callback', name: 'Unqualified Warm Callback', color: 'var(--tag-unqualified-warm-callback)', colorClass: 'tag-unqualified-warm-callback-bg' },
    { id: 'vip', name: 'VIP', color: 'var(--tag-vip)', colorClass: 'tag-vip-bg' },
    { id: 'negligent_warm_callback', name: 'Negligent Warm Callback', color: 'var(--tag-negligent-warm-callback)', colorClass: 'tag-negligent-warm-callback-bg' }
];

// ---- HELPERS ----
function getStatus(appt) {
    if (!appt || !appt.status) return 'Warm Call Booked';
    if (appt.status === 'Booked') return 'Warm Call Booked';
    if (appt.status === 'Warm-Booked') return 'Warm Call Booked';
    if (appt.status === 'Called') return 'Meeting Booked';
    return appt.status;
}

function getStatusClassSmall(status) {
    switch (status) {
        case 'Warm Call Booked': return 'status-warm-call-booked-sm';
        case 'Meeting Booked': return 'status-meeting-booked-sm';
        case 'Canceled': return 'status-canceled-sm';
        case 'Rescheduled': return 'status-rescheduled-sm';
        case 'Held': return 'status-held-sm';
        default: return 'status-warm-call-booked-sm';
    }
}

function getTagDisplay(tags) {
    if (!tags || !Array.isArray(tags) || tags.length === 0) return '';
    return tags.map(tagId => {
        const tag = TAG_OPTIONS.find(t => t.id === tagId);
        if (!tag) return '';
        return `<span class="tag-pill ${tag.colorClass}"><i class="fas fa-tag"></i> ${tag.name}</span>`;
    }).join('');
}

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function formatDate(dateStr) {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
    return s ? String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : '';
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : (type === 'info' ? 'info' : '')}`;
    t.innerHTML = `${type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️')} ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function copyToClipboard(text) {
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied!');
    });
}

// ---- CSV IMPORT ----
function importCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                showToast('CSV must contain headers and at least one row', 'error');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const headerMap = {};
            headers.forEach((h, idx) => {
                const lower = h.toLowerCase();
                if (lower.includes('date')) headerMap.date = idx;
                else if (lower.includes('business') || lower.includes('company')) headerMap.business = idx;
                else if (lower.includes('contact') || lower.includes('name')) headerMap.contact = idx;
                else if (lower.includes('role') || lower.includes('position')) headerMap.role = idx;
                else if (lower.includes('phone') || lower.includes('tel')) headerMap.phone = idx;
                else if (lower.includes('time')) headerMap.time = idx;
                else if (lower.includes('status')) headerMap.status = idx;
                else if (lower.includes('tag')) headerMap.tags = idx;
                else if (lower.includes('crm') || lower.includes('link')) headerMap.crm = idx;
                else if (lower.includes('note')) headerMap.notes = idx;
                else if (lower.includes('assigned')) headerMap.assigned = idx;
            });

            if (headerMap.date === undefined || headerMap.business === undefined || headerMap.contact === undefined) {
                showToast('CSV must contain Date, Business, and Contact columns', 'error');
                return;
            }

            let importedCount = 0;
            let errorCount = 0;

            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = parseCSVRow(lines[i]);
                    if (values.length < Math.max(headerMap.date, headerMap.business, headerMap.contact) + 1) continue;

                    const date = values[headerMap.date]?.trim() || '';
                    const business = values[headerMap.business]?.trim() || '';
                    const contact = values[headerMap.contact]?.trim() || '';

                    if (!date || !business || !contact) {
                        errorCount++;
                        continue;
                    }

                    const dateObj = new Date(date);
                    if (isNaN(dateObj.getTime())) {
                        errorCount++;
                        continue;
                    }
                    const formattedDate = dateObj.toISOString().split('T')[0];

                    const role = values[headerMap.role]?.trim() || 'Owner';
                    const phone = values[headerMap.phone]?.trim() || '';
                    const time = values[headerMap.time]?.trim() || '';
                    let status = values[headerMap.status]?.trim() || 'Warm Call Booked';
                    if (!STATUS_OPTIONS.includes(status)) {
                        status = 'Warm Call Booked';
                    }
                    const tagsStr = values[headerMap.tags]?.trim() || '';
                    const crmLink = values[headerMap.crm]?.trim() || '';
                    const notes = values[headerMap.notes]?.trim() || '';
                    const assigned = values[headerMap.assigned]?.trim() || 'Daniel';

                    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => {
                        return TAG_OPTIONS.some(opt => opt.name.toLowerCase() === t.toLowerCase() || opt.id === t);
                    }).map(t => {
                        const match = TAG_OPTIONS.find(opt => opt.name.toLowerCase() === t.toLowerCase() || opt.id === t);
                        return match ? match.id : t;
                    }) : [];

                    addAppointment(formattedDate, business, contact, role, phone, time, notes, assigned, null, status, crmLink, tags);
                    importedCount++;
                } catch (err) {
                    errorCount++;
                    console.warn('Error importing row:', err);
                }
            }

            saveAppointments();
            refreshCurrentView();
            updateStats();

            if (errorCount > 0) {
                showToast(`Imported ${importedCount} appointments (${errorCount} rows skipped)`, 'info');
            } else {
                showToast(`Successfully imported ${importedCount} appointments!`, 'success');
            }
        } catch (err) {
            console.error('CSV Import Error:', err);
            showToast('Error reading CSV file. Please check the format.', 'error');
        }
    };
    reader.readAsText(file);
}

function parseCSVRow(row) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// ---- APPOINTMENT CRUD ----
function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned, editId = null, status = 'Warm Call Booked', crmLink = '', tags = []) {
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    if (!STATUS_OPTIONS.includes(status)) {
        status = 'Warm Call Booked';
    }
    const newAppt = {
        id: editId || Date.now(),
        business,
        contactName,
        role,
        phone,
        time,
        notes,
        assigned,
        status: status || 'Warm Call Booked',
        crmLink: crmLink || '',
        tags: tags || [],
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

function saveAppointments() {
    localStorage.setItem('scriptflow_appointments_main', JSON.stringify(appointments));
    updateStats();
}

function saveGoals() {
    localStorage.setItem('scriptflow_goals_main', JSON.stringify(goals));
    updateStats();
}

function loadAppointmentData() {
    const saved = localStorage.getItem('scriptflow_appointments_main');
    if (saved) appointments = JSON.parse(saved);
    const savedGoals = localStorage.getItem('scriptflow_goals_main');
    if (savedGoals) goals = JSON.parse(savedGoals);
    let needsSave = false;
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(appt => {
                if (!appt.status) { appt.status = 'Warm Call Booked'; needsSave = true; }
                else if (appt.status === 'Booked') { appt.status = 'Warm Call Booked'; needsSave = true; }
                else if (appt.status === 'Warm-Booked') { appt.status = 'Warm Call Booked'; needsSave = true; }
                else if (appt.status === 'Called') { appt.status = 'Meeting Booked'; needsSave = true; }
                if (appt.status && !STATUS_OPTIONS.includes(appt.status)) {
                    appt.status = 'Warm Call Booked';
                    needsSave = true;
                }
                if (!appt.crmLink) appt.crmLink = '';
                if (!appt.tags) appt.tags = [];
            });
        }
    }
    if (needsSave) saveAppointments();
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
        if (date >= start && date <= new Date(start.getTime() + 6 * 86400000) && appointments[d].reports) total += appointments[d].reports.length;
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
        if (date >= start && date <= end && appointments[d].reports) total += appointments[d].reports.length;
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

// ---- SMART IMPORT ----
function parseAppointmentFromText(text, defaultDate) {
    const result = { business: '', contactName: '', role: 'Owner', phone: '', time: '', notes: '', assigned: 'Daniel', status: 'Warm Call Booked', parsedDate: null, tags: [] };
    const businessMatch = text.match(/(?:Business name|Business)[:\s]+([^\n]+)/i) || text.match(/^([A-Z][A-Z\s&]+(?:ELECTRIC|SERVICES|SOLUTIONS|INC|LLC|CORP|COMPANY))/im);
    if (businessMatch) result.business = businessMatch[1].trim();
    const nameMatch = text.match(/(?:Name|Contact)[:\s]+([^\n]+)/i) || text.match(/Name:\s*([^\n]+)/i);
    if (nameMatch) result.contactName = nameMatch[1].trim();
    const roleMatch = text.match(/(?:Role|Position)[:\s]+([^\n]+)/i);
    if (roleMatch) result.role = roleMatch[1].trim();
    const phoneMatch = text.match(/(?:P\.?Number|Phone|Tel)[:\s]+([+\d\s\-\(\)]+)/i) || text.match(/[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}/);
    if (phoneMatch) result.phone = phoneMatch[1] || phoneMatch[0];
    const timeMatch = text.match(/(?:Time|Call back|Callback)[:\s]+([^\n]+)/i) || text.match(/(?:tomorrow|today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^.\n]*?(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
    if (timeMatch) result.time = timeMatch[1] || timeMatch[0];
    if (result.time) {
        if (result.time.toLowerCase().includes('tomorrow')) { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); result.parsedDate = tomorrow.toISOString().split('T')[0]; }
        else if (result.time.toLowerCase().includes('today')) { result.parsedDate = getTodayStr(); }
    }
    const noteMatch = text.match(/(?:Note|Notes)[:\s]+([^\n]+)/i);
    if (noteMatch) result.notes = noteMatch[1].trim();
    else { result.notes = text.replace(/[@Daniel]/g, '').trim(); }
    const assignedMatch = text.match(/@(\w+)/);
    if (assignedMatch) result.assigned = assignedMatch[1];
    const finalDate = result.parsedDate || defaultDate;
    return { ...result, finalDate };
}

function openSmartAddModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const tagOptionsHtml = TAG_OPTIONS.map(tag => `
        <label class="tag-option" style="border-color: ${tag.color};">
            <input type="checkbox" value="${tag.id}" class="tag-checkbox">
            <span class="tag-color-indicator" style="background: ${tag.color};"></span>
            <span>${tag.name}</span>
        </label>
    `).join('');
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-magic"></i> Smart Appointment Import</h3><p style="margin:12px 0; font-size:0.8rem; color:var(--text-muted);">Fill in the CRM link below, select tags, then paste appointment details.</p>
        <div class="form-group"><label>🔗 CRM Link (Optional)</label><input type="url" id="crmLinkInput" class="crm-link-input" placeholder="https://yourcrm.com/lead/..."></div>
        <div class="form-group"><label>🏷️ Select Tags (Optional)</label><div class="tag-selector" id="tagSelector">${tagOptionsHtml}</div></div>
        <div class="form-group"><label>📅 Date</label><input type="date" id="smartDate" value="${getTodayStr()}"></div>
        <div class="form-group"><label>📝 Paste Details</label><textarea id="smartText" rows="5" placeholder="Example:\nBusiness name: FINAL TOUCH ELECTRIC\nName: Constance\nRole: Owner\nPhone: +18775965698\nTime: Tomorrow at 9am CT\nNote: No website yet.\n@Daniel"></textarea></div>
        <div id="smartPreview" style="background:var(--bg-primary); border-radius:16px; padding:16px; margin:16px 0; display:none;"><strong><i class="fas fa-eye"></i> Preview:</strong><div id="smartPreviewContent"></div></div>
        <div style="display:flex; gap:12px; justify-content:flex-end;"><button id="smartParseBtn" class="btn-icon"><i class="fas fa-search"></i> Parse</button><button id="smartSaveBtn" class="btn-icon" style="background:var(--success); color:white;"><i class="fas fa-save"></i> Save</button><button id="smartCancelBtn" class="btn-icon"><i class="fas fa-times"></i> Cancel</button></div></div>`;
    document.body.appendChild(modal);
    let currentParsed = null;

    document.getElementById('smartParseBtn').addEventListener('click', () => {
        const text = document.getElementById('smartText').value;
        const date = document.getElementById('smartDate').value;
        if (!text.trim()) { showToast('Enter details', 'error'); return; }
        currentParsed = parseAppointmentFromText(text, date);
        const crmLink = document.getElementById('crmLinkInput').value;
        const selectedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.value);
        document.getElementById('smartPreviewContent').innerHTML = `<div style="margin-top:8px;"><div><strong>📅 Date:</strong> ${currentParsed.finalDate}</div><div><strong>🏢 Business:</strong> ${escapeHtml(currentParsed.business || '—')}</div><div><strong>👤 Contact:</strong> ${escapeHtml(currentParsed.contactName || '—')}</div><div><strong>💼 Role:</strong> ${escapeHtml(currentParsed.role || '—')}</div><div><strong>📞 Phone:</strong> ${escapeHtml(currentParsed.phone || '—')}</div><div><strong>🕐 Time:</strong> ${escapeHtml(currentParsed.time || '—')}</div><div><strong>🔗 CRM Link:</strong> ${crmLink ? `<a href="${crmLink}" target="_blank" style="color:var(--primary);">${escapeHtml(crmLink)}</a>` : '—'}</div><div><strong>🏷️ Tags:</strong> ${selectedTags.map(t => TAG_OPTIONS.find(opt => opt.id === t)?.name || t).join(', ') || '—'}</div><div><strong>👨‍💼 Assigned:</strong> ${escapeHtml(currentParsed.assigned || 'Daniel')}</div><div><strong>📝 Notes:</strong> ${escapeHtml(currentParsed.notes || '—')}</div></div>`;
        document.getElementById('smartPreview').style.display = 'block';
        if (!currentParsed.business || !currentParsed.contactName) showToast('Warning: Business or Contact not detected', 'error');
        else showToast('Ready to save!', 'success');
    });

    document.getElementById('smartSaveBtn').addEventListener('click', () => {
        if (!currentParsed) { showToast('Parse first', 'error'); return; }
        if (!currentParsed.business || !currentParsed.contactName) { showToast('Business and Contact required', 'error'); return; }
        const crmLink = document.getElementById('crmLinkInput').value;
        const selectedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.value);
        addAppointment(currentParsed.finalDate, currentParsed.business, currentParsed.contactName,
            currentParsed.role, currentParsed.phone, currentParsed.time, currentParsed.notes,
            currentParsed.assigned, null, 'Warm Call Booked', crmLink, selectedTags);
        modal.remove();
        showToast(`Saved for ${currentParsed.finalDate}!`, 'success');
        refreshCurrentView();
    });
    document.getElementById('smartCancelBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ---- CALENDAR & LIST VIEW ----
function renderCalendarPanel(container) {
    const year = currentCalDate.getFullYear(),
        month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let daysHtml = '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(d => daysHtml += `<div class="day-name">${d}</div>`);

    for (let i = 0; i < firstDay; i++) {
        daysHtml += `<div class="calendar-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const appts = appointments[dateStr]?.reports || [];
        const count = appts.length;
        const isSelected = dateStr === selectedCalDate;
        let indicatorHtml = '';
        if (count > 0) {
            const statuses = new Set(appts.map(a => getStatus(a)));
            const dots = Array.from(statuses).slice(0, 3).map(s => {
                let color = 'var(--primary)';
                if (s === 'Warm Call Booked') color = 'var(--status-warm-call-booked)';
                else if (s === 'Meeting Booked') color = 'var(--status-meeting-booked)';
                else if (s === 'Canceled') color = 'var(--status-canceled)';
                else if (s === 'Rescheduled') color = 'var(--status-rescheduled)';
                else if (s === 'Held') color = 'var(--status-held)';
                return `<span class="appt-dot" style="background:${color};"></span>`;
            }).join('');
            indicatorHtml = `<div class="appt-indicator">${dots}</div>`;
            if (count > 3) indicatorHtml += `<span class="appt-badge">+${count - 3}</span>`;
        }
        const dayClass = `calendar-day ${isSelected ? 'selected' : ''}`;
        daysHtml += `<div class="${dayClass}" data-date="${dateStr}">
                    <span class="day-number">${d}</span>
                    ${indicatorHtml}
                </div>`;
    }

    const selectedAppts = appointments[selectedCalDate]?.reports || [];
    const total = selectedAppts.length;
    const statusCounts = {};
    selectedAppts.forEach(a => {
        const s = getStatus(a);
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const kpiHtml = `
                <div class="kpi-row">
                    <div class="kpi-card"><div class="kpi-value">${total}</div><div class="kpi-label">Total</div></div>
                    <div class="kpi-card"><div class="kpi-value">${statusCounts['Warm Call Booked'] || 0}</div><div class="kpi-label">Warm Call</div></div>
                    <div class="kpi-card"><div class="kpi-value">${statusCounts['Meeting Booked'] || 0}</div><div class="kpi-label">Meeting</div></div>
                    <div class="kpi-card"><div class="kpi-value">${statusCounts['Canceled'] || 0}</div><div class="kpi-label">Canceled</div></div>
                    <div class="kpi-card"><div class="kpi-value">${statusCounts['Rescheduled'] || 0}</div><div class="kpi-label">Rescheduled</div></div>
                    <div class="kpi-card"><div class="kpi-value">${statusCounts['Held'] || 0}</div><div class="kpi-label">Held</div></div>
                </div>
            `;

    const filtered = filterAndSortAppointments(selectedAppts);
    const listHtml = renderAppointmentsList(filtered, selectedCalDate);

    const toolbarHtml = `
                <div class="appointments-toolbar">
                    <div class="search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" id="appointmentSearchInput" placeholder="Search appointments..." value="${escapeHtml(currentListSearchTerm)}" />
                    </div>
                    <select id="statusFilterSelect">
                        <option value="all" ${currentStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
                        ${STATUS_OPTIONS.map(s => `<option value="${s}" ${currentStatusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <select id="tagFilterSelect">
                        <option value="all" ${currentTagFilter === 'all' ? 'selected' : ''}>All Tags</option>
                        ${TAG_OPTIONS.map(t => `<option value="${t.id}" ${currentTagFilter === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                    <select id="sortSelect">
                        <option value="time" ${currentSort === 'time' ? 'selected' : ''}>Sort by Time</option>
                        <option value="status" ${currentSort === 'status' ? 'selected' : ''}>Sort by Status</option>
                        <option value="name" ${currentSort === 'name' ? 'selected' : ''}>Sort by Name</option>
                    </select>
                    <button class="action-icon-btn" id="quickAddFromCalendar"><i class="fas fa-plus"></i> Add</button>
                    <button class="action-icon-btn" id="smartAddFromCalendar"><i class="fas fa-magic"></i> Import</button>
                </div>
            `;

    container.innerHTML = `
                <div class="calendar-section">
                    <div class="calendar-nav">
                        <h3><i class="fas fa-calendar-alt"></i> ${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</h3>
                        <div class="calendar-nav-actions">
                            <button id="calPrevBtn"><i class="fas fa-chevron-left"></i> Prev</button>
                            <button id="calTodayBtn">Today</button>
                            <button id="calNextBtn">Next <i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <div class="calendar-grid">${daysHtml}</div>
                </div>
                <div class="appointments-section">
                    <h4 style="display:flex; align-items:center; gap:8px; margin:0;">
                        <i class="fas fa-calendar-day"></i> ${formatDate(selectedCalDate)}
                        <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">${total} appointment${total !== 1 ? 's' : ''}</span>
                    </h4>
                    ${kpiHtml}
                    ${toolbarHtml}
                    <div class="appointments-list" id="appointmentsListContainer">
                        ${listHtml}
                    </div>
                </div>
            `;

    // Event bindings - Calendar day clicks
    document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
            selectedCalDate = el.getAttribute('data-date');
            renderCalendarPanel(container);
        });
    });

    document.getElementById('calPrevBtn')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendarPanel(container);
    });
    document.getElementById('calNextBtn')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendarPanel(container);
    });
    document.getElementById('calTodayBtn')?.addEventListener('click', () => {
        currentCalDate = new Date();
        selectedCalDate = getTodayStr();
        renderCalendarPanel(container);
    });

    document.getElementById('quickAddFromCalendar')?.addEventListener('click', () => {
        hideFeaturePanel();
        setTimeout(() => openQuickReportWithDate(selectedCalDate), 100);
    });
    document.getElementById('smartAddFromCalendar')?.addEventListener('click', () => {
        hideFeaturePanel();
        setTimeout(() => openSmartAddModal(), 100);
    });

    document.getElementById('appointmentSearchInput')?.addEventListener('input', (e) => {
        currentListSearchTerm = e.target.value;
        renderCalendarPanel(container);
    });
    document.getElementById('statusFilterSelect')?.addEventListener('change', (e) => {
        currentStatusFilter = e.target.value;
        renderCalendarPanel(container);
    });
    document.getElementById('tagFilterSelect')?.addEventListener('change', (e) => {
        currentTagFilter = e.target.value;
        renderCalendarPanel(container);
    });
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderCalendarPanel(container);
    });

    setupDragAndDrop();
    setupDelegatedEventListeners();
}

function filterAndSortAppointments(appts) {
    let filtered = appts.filter(a => {
        if (currentStatusFilter !== 'all' && getStatus(a) !== currentStatusFilter) return false;
        if (currentTagFilter !== 'all') {
            const tags = a.tags || [];
            if (!tags.includes(currentTagFilter)) return false;
        }
        if (currentListSearchTerm) {
            const t = currentListSearchTerm.toLowerCase();
            return (a.business && a.business.toLowerCase().includes(t)) ||
                (a.contactName && a.contactName.toLowerCase().includes(t)) ||
                (a.phone && a.phone.toLowerCase().includes(t)) ||
                (a.notes && a.notes.toLowerCase().includes(t));
        }
        return true;
    });
    switch (currentSort) {
        case 'time':
            filtered.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            break;
        case 'status':
            filtered.sort((a, b) => getStatus(a).localeCompare(getStatus(b)));
            break;
        case 'name':
            filtered.sort((a, b) => a.business.localeCompare(b.business));
            break;
    }
    return filtered;
}

function renderAppointmentsList(appts, dateStr) {
    if (!appts || appts.length === 0) {
        return `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>No appointments for this day</p><button class="btn-icon" id="emptyAddBtn" style="margin-top:12px;"><i class="fas fa-plus"></i> Add Appointment</button></div>`;
    }
    return appts.map(a => {
        const status = getStatus(a);
        const tagsDisplay = getTagDisplay(a.tags);
        const hasCrmLink = a.crmLink && a.crmLink.trim() !== '';
        return `
                    <div class="appointment-card" draggable="true" data-id="${a.id}" data-date="${dateStr}">
                        <div class="card-row">
                            <div class="business-name">
                                <i class="fas fa-building"></i> ${escapeHtml(a.business)}
                                <span class="status-tag ${getStatusClassSmall(status)}">${escapeHtml(status)}</span>
                            </div>
                            <div class="card-actions">
                                <span class="drag-handle"><i class="fas fa-grip-lines"></i></span>
                                <button class="action-icon-btn copy-btn" data-id="${a.id}" title="Copy"><i class="fas fa-copy"></i></button>
                                <button class="action-icon-btn edit-btn" data-id="${a.id}" data-date="${dateStr}" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="action-icon-btn danger delete-btn" data-id="${a.id}" data-date="${dateStr}" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="contact-detail">
                            <span><i class="fas fa-user"></i> ${escapeHtml(a.contactName)}</span>
                            ${a.role ? `<span><i class="fas fa-briefcase"></i> ${escapeHtml(a.role)}</span>` : ''}
                            ${a.phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(a.phone)}</span>` : ''}
                            ${a.time ? `<span><i class="fas fa-clock"></i> ${escapeHtml(a.time)}</span>` : ''}
                            ${a.assigned ? `<span><i class="fas fa-user-tie"></i> ${escapeHtml(a.assigned)}</span>` : ''}
                            ${hasCrmLink ? `<span><i class="fas fa-link"></i> <a href="${escapeHtml(a.crmLink)}" target="_blank" style="color:var(--primary);">CRM</a></span>` : ''}
                        </div>
                        ${a.notes ? `<div style="font-size:0.8rem; color:var(--text-secondary);"><i class="fas fa-sticky-note"></i> ${escapeHtml(a.notes)}</div>` : ''}
                        ${tagsDisplay ? `<div class="tag-pills">${tagsDisplay}</div>` : ''}
                        <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
                            <select class="status-select-calendar" data-id="${a.id}" data-date="${dateStr}" style="padding:4px 8px; border-radius:20px; font-size:0.7rem; background:var(--bg-primary); border:1px solid var(--border-color);">
                                ${STATUS_OPTIONS.map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `;
    }).join('');
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.appointment-card');
    cards.forEach(el => {
        el.setAttribute('draggable', 'true');
        el.addEventListener('dragstart', (e) => {
            draggedItem = el;
            e.dataTransfer.setData('text/plain', JSON.stringify({
                id: el.getAttribute('data-id'),
                oldDate: el.getAttribute('data-date')
            }));
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('dragging');
        });
        el.addEventListener('dragend', () => {
            if (draggedItem) draggedItem.classList.remove('dragging');
            draggedItem = null;
            document.querySelectorAll('.calendar-day').forEach(zone => zone.classList.remove('drag-over'));
        });
    });

    document.querySelectorAll('.calendar-day[data-date]').forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const newDate = zone.getAttribute('data-date');
            if (!newDate) return;
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const apptId = parseInt(data.id), oldDate = data.oldDate;
            if (oldDate === newDate) return;
            const appt = appointments[oldDate]?.reports?.find(r => r.id === apptId);
            if (appt) {
                deleteAppointment(oldDate, apptId);
                addAppointment(newDate, appt.business, appt.contactName, appt.role, appt.phone, appt.time, appt.notes, appt.assigned, appt.id, appt.status, appt.crmLink, appt.tags);
                showToast(`Moved "${appt.business}" to ${newDate}`, 'success');
                refreshCurrentView();
            }
        });
    });
}

// ---- DELEGATED EVENT LISTENERS ----
function setupDelegatedEventListeners() {
    const container = document.getElementById('appointmentsListContainer');
    if (!container) return;

    container.removeEventListener('click', handleDelegatedClick);
    container.removeEventListener('change', handleDelegatedChange);
    
    container.addEventListener('click', handleDelegatedClick);
    container.addEventListener('change', handleDelegatedChange);
}

function handleDelegatedClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.classList.contains('copy-btn')) {
        e.preventDefault();
        const id = parseInt(target.getAttribute('data-id'));
        for (let d in appointments) {
            const appt = appointments[d]?.reports?.find(r => r.id === id);
            if (appt) {
                copyToClipboard(appt.fullText);
                showToast('Copied!', 'success');
                break;
            }
        }
        return;
    }

    if (target.classList.contains('edit-btn')) {
        e.preventDefault();
        const id = parseInt(target.getAttribute('data-id'));
        const date = target.getAttribute('data-date');
        const appt = appointments[date]?.reports?.find(r => r.id === id);
        if (appt) openEditAppointmentModal(date, appt);
        return;
    }

    if (target.classList.contains('delete-btn')) {
        e.preventDefault();
        const id = parseInt(target.getAttribute('data-id'));
        const date = target.getAttribute('data-date');
        if (confirm('Delete this appointment?')) {
            deleteAppointment(date, id);
            showToast('Deleted', 'info');
            refreshCurrentView();
        }
        return;
    }

    if (target.id === 'emptyAddBtn') {
        hideFeaturePanel();
        setTimeout(() => openQuickReportWithDate(selectedCalDate), 100);
    }
}

function handleDelegatedChange(e) {
    const target = e.target;
    if (target.classList.contains('status-select-calendar')) {
        const id = parseInt(target.getAttribute('data-id'));
        const date = target.getAttribute('data-date');
        const newStatus = target.value;
        const idx = appointments[date]?.reports?.findIndex(r => r.id === id);
        if (idx !== -1 && appointments[date]) {
            appointments[date].reports[idx].status = newStatus;
            saveAppointments();
            showToast(`Status updated to ${newStatus}`, 'info');
            refreshCurrentView();
        }
    }
}

// ---- EDIT MODAL ----
function openEditAppointmentModal(dateStr, appt) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const tagOptionsHtml = TAG_OPTIONS.map(tag => `
                <label class="tag-option" style="border-color: ${tag.color};">
                    <input type="checkbox" value="${tag.id}" class="edit-tag-checkbox" ${(appt.tags || []).includes(tag.id) ? 'checked' : ''}>
                    <span class="tag-color-indicator" style="background: ${tag.color};"></span>
                    <span>${tag.name}</span>
                </label>
            `).join('');
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-edit"></i> Edit Appointment</h3>
                <div class="form-group"><label>Date</label><input type="date" id="editDate" value="${dateStr}"></div>
                <div class="form-group"><label>Business *</label><input id="editBusiness" value="${escapeHtml(appt.business)}"></div>
                <div class="form-group"><label>Contact *</label><input id="editName" value="${escapeHtml(appt.contactName)}"></div>
                <div class="form-group"><label>Role</label><input id="editRole" value="${escapeHtml(appt.role || '')}"></div>
                <div class="form-group"><label>Phone</label><input id="editPhone" value="${escapeHtml(appt.phone || '')}"></div>
                <div class="form-group"><label>Time</label><input id="editTime" value="${escapeHtml(appt.time || '')}"></div>
                <div class="form-group"><label>Status</label><select id="editStatus">${STATUS_OPTIONS.map(s => `<option value="${s}" ${getStatus(appt) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                <div class="form-group"><label>🏷️ Tags</label><div class="tag-selector" id="editTagSelector">${tagOptionsHtml}</div></div>
                <div class="form-group"><label>CRM Link</label><input id="editCrmLink" value="${escapeHtml(appt.crmLink || '')}" placeholder="https://..."></div>
                <div class="form-group"><label>Notes</label><textarea id="editNotes" rows="3">${escapeHtml(appt.notes || '')}</textarea></div>
                <div class="form-group"><label>Assigned</label><input id="editAssigned" value="${escapeHtml(appt.assigned || 'Daniel')}"></div>
                <div style="display:flex; gap:12px; justify-content:flex-end;"><button id="saveEditBtn" class="btn-icon" style="background:var(--success); color:white;">Save</button><button id="cancelEditBtn" class="btn-icon">Cancel</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('saveEditBtn').addEventListener('click', () => {
        const newDate = document.getElementById('editDate').value;
        if (!document.getElementById('editBusiness').value || !document.getElementById('editName').value) { showToast('Business and Contact required', 'error'); return; }
        const selectedTags = Array.from(document.querySelectorAll('.edit-tag-checkbox:checked')).map(cb => cb.value);
        deleteAppointment(dateStr, appt.id);
        addAppointment(newDate, document.getElementById('editBusiness').value, document.getElementById('editName').value,
            document.getElementById('editRole').value, document.getElementById('editPhone').value, document.getElementById('editTime').value,
            document.getElementById('editNotes').value, document.getElementById('editAssigned').value, appt.id,
            document.getElementById('editStatus').value, document.getElementById('editCrmLink').value, selectedTags);
        modal.remove();
        showToast(`Updated`, 'success');
        refreshCurrentView();
    });
    document.getElementById('cancelEditBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function openQuickReportWithDate(defaultDate) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const tagOptionsHtml = TAG_OPTIONS.map(tag => `
                <label class="tag-option" style="border-color: ${tag.color};">
                    <input type="checkbox" value="${tag.id}" class="quick-tag-checkbox">
                    <span class="tag-color-indicator" style="background: ${tag.color};"></span>
                    <span>${tag.name}</span>
                </label>
            `).join('');
    modal.innerHTML = `<div class="modal-card"><h3>Quick Add</h3>
                <div class="form-group"><label>Date</label><input type="date" id="reportDate" value="${defaultDate}"></div>
                <div class="form-group"><label>Business *</label><input id="reportBusiness"></div>
                <div class="form-group"><label>Contact *</label><input id="reportName"></div>
                <div class="form-group"><label>Role</label><select id="reportRole"><option>Owner</option><option>Manager</option><option>Director</option></select></div>
                <div class="form-group"><label>Phone</label><input id="reportPhone"></div>
                <div class="form-group"><label>Time</label><input id="reportTime"></div>
                <div class="form-group"><label>Status</label><select id="reportStatus">${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
                <div class="form-group"><label>🏷️ Tags</label><div class="tag-selector" id="quickTagSelector">${tagOptionsHtml}</div></div>
                <div class="form-group"><label>CRM Link</label><input id="reportCrmLink" placeholder="https://..."></div>
                <div class="form-group"><label>Notes</label><textarea id="reportNotes" rows="2"></textarea></div>
                <div class="form-group"><label>Assigned</label><input id="reportAssigned" value="Daniel"></div>
                <div style="display:flex; gap:12px;"><button id="submitReportBtn" class="btn-icon" style="background:var(--success);color:white;">Save</button><button id="closeReportBtn" class="btn-icon">Cancel</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('submitReportBtn').addEventListener('click', () => {
        const bus = document.getElementById('reportBusiness').value, name = document.getElementById('reportName').value;
        if (!bus || !name) { showToast('Required fields', 'error'); return; }
        const selectedTags = Array.from(document.querySelectorAll('.quick-tag-checkbox:checked')).map(cb => cb.value);
        addAppointment(document.getElementById('reportDate').value, bus, name, document.getElementById('reportRole').value,
            document.getElementById('reportPhone').value, document.getElementById('reportTime').value, document.getElementById('reportNotes').value,
            document.getElementById('reportAssigned').value, null, document.getElementById('reportStatus').value,
            document.getElementById('reportCrmLink').value, selectedTags);
        modal.remove();
        showToast('Saved!', 'success');
        refreshCurrentView();
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function refreshCurrentView() {
    const container = document.getElementById('featurePanelBody');
    if (!container) return;
    if (currentView === 'calendar') {
        renderCalendarPanel(container);
    } else {
        renderListView(container);
    }
}

function renderListView(container) {
    let allAppointments = [];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => allAppointments.push({ ...a, date }));
        }
    }
    allAppointments.sort((a, b) => new Date(b.date) - new Date(a.date));

    let filtered = allAppointments.filter(a => {
        if (currentStatusFilter !== 'all' && getStatus(a) !== currentStatusFilter) return false;
        if (currentTagFilter !== 'all') {
            const tags = a.tags || [];
            if (!tags.includes(currentTagFilter)) return false;
        }
        if (currentListSearchTerm) {
            const t = currentListSearchTerm.toLowerCase();
            return (a.business && a.business.toLowerCase().includes(t)) ||
                (a.contactName && a.contactName.toLowerCase().includes(t)) ||
                (a.phone && a.phone.toLowerCase().includes(t)) ||
                (a.notes && a.notes.toLowerCase().includes(t));
        }
        return true;
    });

    container.innerHTML = `
                <div class="appointments-toolbar">
                    <div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="listSearchInput" placeholder="Search all..." value="${escapeHtml(currentListSearchTerm)}" /></div>
                    <select id="listStatusFilter"><option value="all" ${currentStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>${STATUS_OPTIONS.map(s => `<option value="${s}" ${currentStatusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                    <select id="listTagFilter"><option value="all" ${currentTagFilter === 'all' ? 'selected' : ''}>All Tags</option>${TAG_OPTIONS.map(t => `<option value="${t.id}" ${currentTagFilter === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
                    <button class="action-icon-btn" id="listSmartImport"><i class="fas fa-magic"></i> Import</button>
                </div>
                <div class="appointments-list" id="appointmentsListContainer">
                    ${filtered.length === 0 ? `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>No appointments found</p></div>` :
                    filtered.map(a => `
                            <div class="appointment-card">
                                <div class="card-row">
                                    <div class="business-name"><i class="fas fa-building"></i> ${escapeHtml(a.business)} <span class="status-tag ${getStatusClassSmall(getStatus(a))}">${escapeHtml(getStatus(a))}</span></div>
                                    <div class="card-actions">
                                        <button class="action-icon-btn copy-btn" data-id="${a.id}" title="Copy"><i class="fas fa-copy"></i></button>
                                        <button class="action-icon-btn edit-btn" data-id="${a.id}" data-date="${a.date}" title="Edit"><i class="fas fa-edit"></i></button>
                                        <button class="action-icon-btn danger delete-btn" data-id="${a.id}" data-date="${a.date}" title="Delete"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>
                                <div class="contact-detail">
                                    <span><i class="fas fa-user"></i> ${escapeHtml(a.contactName)}</span>
                                    ${a.role ? `<span><i class="fas fa-briefcase"></i> ${escapeHtml(a.role)}</span>` : ''}
                                    ${a.phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(a.phone)}</span>` : ''}
                                    ${a.time ? `<span><i class="fas fa-clock"></i> ${escapeHtml(a.time)}</span>` : ''}
                                    ${a.assigned ? `<span><i class="fas fa-user-tie"></i> ${escapeHtml(a.assigned)}</span>` : ''}
                                    ${a.crmLink ? `<span><i class="fas fa-link"></i> <a href="${escapeHtml(a.crmLink)}" target="_blank" style="color:var(--primary);">CRM</a></span>` : ''}
                                    <span><i class="fas fa-calendar-day"></i> ${escapeHtml(a.date)}</span>
                                </div>
                                ${a.notes ? `<div style="font-size:0.8rem; color:var(--text-secondary);"><i class="fas fa-sticky-note"></i> ${escapeHtml(a.notes)}</div>` : ''}
                                ${a.tags ? `<div class="tag-pills">${getTagDisplay(a.tags)}</div>` : ''}
                            </div>
                        `).join('')}
                </div>
            `;
    
    document.getElementById('listSearchInput')?.addEventListener('input', (e) => { currentListSearchTerm = e.target.value; renderListView(container); });
    document.getElementById('listStatusFilter')?.addEventListener('change', (e) => { currentStatusFilter = e.target.value; renderListView(container); });
    document.getElementById('listTagFilter')?.addEventListener('change', (e) => { currentTagFilter = e.target.value; renderListView(container); });
    document.getElementById('listSmartImport')?.addEventListener('click', () => { hideFeaturePanel(); setTimeout(openSmartAddModal, 100); });
    
    setupDelegatedEventListeners();
}

// ---- PRIORITY MODAL ----
function openPriorityModal() {
    const modal = document.getElementById('priorityModal');
    const body = document.getElementById('priorityModalBody');
    if (!modal || !body) return;

    const now = new Date();
    const zones = [
        { name: 'Eastern (ET) ★', zone: 'America/New_York' },
        { name: 'Central (CT)', zone: 'America/Chicago' },
        { name: 'Mountain (MT)', zone: 'America/Denver' },
        { name: 'Pacific (PT)', zone: 'America/Los_Angeles' }
    ];

    let html = '';
    let activeZones = [];

    zones.forEach(tz => {
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz.zone }));
        const hour = tzTime.getHours();
        const min = tzTime.getMinutes();
        const day = tzTime.getDay();
        
        const isPrime = ((hour === 10) || (hour === 11 && min <= 30) || (hour >= 14 && hour <= 15) || (hour === 16 && min === 0)) && day >= 1 && day <= 5;
        
        if (isPrime) {
            activeZones.push(tz.name);
        }

        const timeStr = tzTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const statusClass = isPrime ? 'status-prime' : 'status-awaiting';
        const statusText = isPrime ? '🔥 PRIME' : '⏳ Awaiting';

        html += `
            <div class="timezone-row">
                <span class="timezone-name">${tz.name}</span>
                <span class="timezone-time">${timeStr}</span>
                <span class="timezone-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });

    let summaryHtml = '';
    if (activeZones.length > 0) {
        summaryHtml = `<div class="active-summary">
            ✅ ACTIVE PRIME WINDOWS: ${activeZones.join(', ')}
        </div>`;
    } else {
        summaryHtml = `<div class="no-active-summary">
            ⏳ No active prime windows currently
        </div>`;
    }

    body.innerHTML = `
        ${summaryHtml}
        <div style="margin-bottom:14px; font-weight:600; font-size:0.95rem;">
            <i class="fas fa-clock"></i> Current Time by Zone
        </div>
        <div class="timezone-grid">
            ${html}
        </div>
        <div class="best-practices">
            <strong>💡 Best Practices for Calling:</strong>
            • Best days: Tuesday, Wednesday, Thursday<br />
            • Avoid: Monday mornings &amp; Friday afternoons<br />
            • Prime windows: 10-11:30 AM &amp; 2-4 PM ET<br />
            • Always confirm the prospect's time zone before scheduling
        </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePriorityModal() {
    const modal = document.getElementById('priorityModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function setupPriorityModal() {
    const modal = document.getElementById('priorityModal');
    const closeBtn = document.getElementById('closePriorityModal');
    const priorityBtn = document.getElementById('priorityBtn');

    if (priorityBtn) {
        priorityBtn.addEventListener('click', openPriorityModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closePriorityModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closePriorityModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closePriorityModal();
            }
        });
    }
}

// ---- ANALYTICS HUB ----
function renderAnalyticsHub(container) {
    const tabHtml = `
                <div class="analytics-container">
                    <div class="analytics-tabs">
                        <button class="analytics-tab ${currentAnalyticsTab === 'insights' ? 'active' : ''}" data-tab="insights">
                            <i class="fas fa-chart-pie"></i> Insights Dashboard
                        </button>
                        <button class="analytics-tab ${currentAnalyticsTab === 'reports' ? 'active' : ''}" data-tab="reports">
                            <i class="fas fa-chart-line"></i> Advanced Reports
                        </button>
                    </div>
                    <div class="analytics-content">
                        <div class="analytics-panel ${currentAnalyticsTab === 'insights' ? 'active' : ''}" id="insightsPanel">
                            <!-- Rendered by renderInsightsPanel -->
                        </div>
                        <div class="analytics-panel ${currentAnalyticsTab === 'reports' ? 'active' : ''}" id="reportsPanel">
                            <!-- Rendered by renderAdvancedReports -->
                        </div>
                    </div>
                </div>
            `;
    container.innerHTML = tabHtml;

    document.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            currentAnalyticsTab = this.getAttribute('data-tab');
            
            document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const insightsPanel = document.getElementById('insightsPanel');
            const reportsPanel = document.getElementById('reportsPanel');
            
            if (currentAnalyticsTab === 'insights') {
                insightsPanel.classList.add('active');
                reportsPanel.classList.remove('active');
                renderInsightsPanel(insightsPanel);
            } else {
                reportsPanel.classList.add('active');
                insightsPanel.classList.remove('active');
                renderAdvancedReports(reportsPanel);
            }
        });
    });

    if (currentAnalyticsTab === 'insights') {
        renderInsightsPanel(document.getElementById('insightsPanel'));
    } else {
        renderAdvancedReports(document.getElementById('reportsPanel'));
    }
}

function getDateRange(preset) {
    const today = new Date();
    const start = new Date();
    const end = new Date();
    switch (preset) {
        case 'today': return { start: getTodayStr(), end: getTodayStr() };
        case 'yesterday': start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
        case 'this_week': start.setDate(today.getDate() - today.getDay()); end.setDate(start.getDate() + 6); return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
        case 'last_week': start.setDate(today.getDate() - today.getDay() - 7); end.setDate(start.getDate() + 6); return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
        case 'this_month': start.setDate(1); end.setMonth(today.getMonth() + 1); end.setDate(0); return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
        case 'last_month': start.setMonth(today.getMonth() - 1); start.setDate(1); end.setMonth(today.getMonth()); end.setDate(0); return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
        default: return { start: getTodayStr(), end: getTodayStr() };
    }
}

function renderInsightsPanel(container) {
    const range = getDateRange(dashboardDatePreset);
    dashboardDateRange = range;
    let appointmentsInRange = [];
    for (let date in appointments) {
        if (date >= dashboardDateRange.start && date <= dashboardDateRange.end && appointments[date].reports) {
            appointments[date].reports.forEach(a => appointmentsInRange.push({ ...a, date }));
        }
    }
    const total = appointmentsInRange.length;
    const unique = new Set(appointmentsInRange.map(a => a.business)).size;
    const todayCount = appointments[getTodayStr()]?.reports?.length || 0;
    const todayProgress = Math.min(100, Math.round((todayCount / goals.daily) * 100));
    const startDate = new Date(dashboardDateRange.start), endDate = new Date(dashboardDateRange.end);
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const chartLabels = [], chartData = [];
    for (let i = 0; i < daysDiff; i++) { const d = new Date(startDate); d.setDate(startDate.getDate() + i); const dateStr = d.toISOString().split('T')[0]; chartLabels.push(formatDateShort(dateStr)); chartData.push(appointments[dateStr]?.reports?.length || 0); }
    const assignedStats = {}, roleStats = {}, statusStats = {}, tagStats = {};
    appointmentsInRange.forEach(a => { const assigned = a.assigned || 'Unassigned'; assignedStats[assigned] = (assignedStats[assigned] || 0) + 1; });
    appointmentsInRange.forEach(a => { const role = a.role || 'Other'; roleStats[role] = (roleStats[role] || 0) + 1; });
    appointmentsInRange.forEach(a => { const s = getStatus(a); statusStats[s] = (statusStats[s] || 0) + 1; });
    appointmentsInRange.forEach(a => { if (a.tags) { a.tags.forEach(tag => { tagStats[tag] = (tagStats[tag] || 0) + 1; }); } });

    container.innerHTML = `
                <div class="insights-header">
                    <div class="date-range-selector">
                        <span>Range</span>
                        <select id="datePresetSelect" class="date-preset">
                            <option value="today" ${dashboardDatePreset === 'today' ? 'selected' : ''}>Today</option>
                            <option value="yesterday" ${dashboardDatePreset === 'yesterday' ? 'selected' : ''}>Yesterday</option>
                            <option value="this_week" ${dashboardDatePreset === 'this_week' ? 'selected' : ''}>This Week</option>
                            <option value="last_week" ${dashboardDatePreset === 'last_week' ? 'selected' : ''}>Last Week</option>
                            <option value="this_month" ${dashboardDatePreset === 'this_month' ? 'selected' : ''}>This Month</option>
                            <option value="last_month" ${dashboardDatePreset === 'last_month' ? 'selected' : ''}>Last Month</option>
                            <option value="custom" ${dashboardDatePreset === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                        <div id="customDateRange" style="display:${dashboardDatePreset === 'custom' ? 'flex' : 'none'}; gap:8px;">
                            <input type="date" id="customStartDate" value="${dashboardDateRange.start}" class="date-input">
                            <span>to</span>
                            <input type="date" id="customEndDate" value="${dashboardDateRange.end}" class="date-input">
                        </div>
                        <button id="applyDateRange" class="btn-icon">Apply</button>
                        <div class="timezone-display"><i class="fas fa-globe"></i><span>Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
                    </div>
                </div>
                <div class="insights-summary">
                    <div class="insight-stat"><div class="insight-stat-value">${total}</div><div class="insight-stat-label">Total Appointments</div></div>
                    <div class="insight-stat"><div class="insight-stat-value">${unique}</div><div class="insight-stat-label">Unique Businesses</div></div>
                    <div class="insight-stat"><div class="insight-stat-value">${todayCount}/${goals.daily}</div><div class="insight-stat-label">Today's Progress</div><div class="progress-mini"><div style="width:${todayProgress}%; background:var(--success); height:100%;"></div></div></div>
                    <div class="insight-stat"><div class="insight-stat-value">${Math.round(total / Math.max(1, daysDiff))}</div><div class="insight-stat-label">Avg per Day</div></div>
                </div>
                <div class="feature-card"><h4><i class="fas fa-chart-line"></i> Appointment Trend</h4><canvas id="insightsChartCanvas" style="width:100%; max-height:300px;"></canvas></div>
                <div class="feature-card"><h4><i class="fas fa-chart-pie"></i> Status Distribution</h4><div class="distribution-list">${Object.entries(statusStats).map(([s, c]) => `<div class="distribution-item"><span><i class="fas fa-tag"></i> ${s}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
                <div class="feature-card"><h4><i class="fas fa-tags"></i> Tag Distribution</h4><div class="distribution-list">${Object.entries(tagStats).map(([t, c]) => `<div class="distribution-item"><span><i class="fas fa-tag"></i> ${TAG_OPTIONS.find(opt => opt.id === t)?.name || t}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
                <div class="feature-card"><h4><i class="fas fa-bullseye"></i> Goal Progress</h4>
                    <div class="goal-progress-item"><div class="goal-progress-label"><span>Daily</span><span>${getTodayCount()}/${goals.daily}</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, (getTodayCount() / goals.daily) * 100)}%; background:var(--primary);"></div></div></div>
                    <div class="goal-progress-item"><div class="goal-progress-label"><span>Weekly</span><span>${getWeekCount()}/${goals.weekly}</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, (getWeekCount() / goals.weekly) * 100)}%; background:var(--success);"></div></div></div>
                    <div class="goal-progress-item"><div class="goal-progress-label"><span>Monthly</span><span>${getMonthCount()}/${goals.monthly}</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, (getMonthCount() / goals.monthly) * 100)}%; background:var(--secondary);"></div></div></div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
                    <div class="feature-card"><h4><i class="fas fa-users"></i> Assignment</h4><div class="distribution-list">${Object.entries(assignedStats).map(([n, c]) => `<div class="distribution-item"><span><i class="fas fa-user"></i> ${escapeHtml(n)}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
                    <div class="feature-card"><h4><i class="fas fa-briefcase"></i> Roles</h4><div class="distribution-list">${Object.entries(roleStats).map(([r, c]) => `<div class="distribution-item"><span><i class="fas fa-tag"></i> ${escapeHtml(r)}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
                </div>
            `;

    const ctx = document.getElementById('insightsChartCanvas');
    if (ctx) {
        if (featureChartInstance) featureChartInstance.destroy();
        featureChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{ label: 'Appointments', data: chartData, backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    const presetSelect = document.getElementById('datePresetSelect'), customDiv = document.getElementById('customDateRange'), applyBtn = document.getElementById('applyDateRange');
    if (presetSelect) presetSelect.addEventListener('change', (e) => {
        dashboardDatePreset = e.target.value;
        if (dashboardDatePreset === 'custom') customDiv.style.display = 'flex';
        else { customDiv.style.display = 'none'; dashboardDateRange = getDateRange(dashboardDatePreset); renderInsightsPanel(container); }
    });
    if (applyBtn) applyBtn.addEventListener('click', () => {
        if (dashboardDatePreset === 'custom') {
            const s = document.getElementById('customStartDate')?.value, e = document.getElementById('customEndDate')?.value;
            if (s && e) { dashboardDateRange = { start: s, end: e }; renderInsightsPanel(container); }
        } else { dashboardDateRange = getDateRange(dashboardDatePreset); renderInsightsPanel(container); }
    });
}

function renderAdvancedReports(container) {
    const endDate = getTodayStr();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    let appointmentsInRange = [];
    for (let date in appointments) {
        if (date >= startDateStr && date <= endDate && appointments[date].reports) {
            appointments[date].reports.forEach(a => appointmentsInRange.push({ ...a, date }));
        }
    }
    const total = appointmentsInRange.length;
    const warmCallBooked = appointmentsInRange.filter(a => getStatus(a) === 'Warm Call Booked').length;
    const meetingBooked = appointmentsInRange.filter(a => getStatus(a) === 'Meeting Booked').length;
    const canceled = appointmentsInRange.filter(a => getStatus(a) === 'Canceled').length;
    const rescheduled = appointmentsInRange.filter(a => getStatus(a) === 'Rescheduled').length;
    const held = appointmentsInRange.filter(a => getStatus(a) === 'Held').length;
    const conversionRate = warmCallBooked > 0 ? Math.round((meetingBooked / warmCallBooked) * 100) : 0;
    const uniqueBusinesses = new Set(appointmentsInRange.map(a => a.business)).size;
    const last7Days = [], trendData = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dateStr = d.toISOString().split('T')[0]; last7Days.push(formatDateShort(dateStr)); trendData.push(appointments[dateStr]?.reports?.length || 0); }

    container.innerHTML = `
                <div class="reports-container">
                    <div class="report-section">
                        <div class="report-header">
                            <h3><i class="fas fa-chart-line"></i> Performance Summary (Last 30 Days)</h3>
                            <button id="exportPDFBtn" class="btn-icon"><i class="fas fa-file-pdf"></i> Export PDF</button>
                        </div>
                        <div class="report-content" id="reportContent">
                            <div class="report-metrics">
                                <div class="metric-card"><div class="metric-value">${total}</div><div class="metric-label">Total Appointments</div></div>
                                <div class="metric-card"><div class="metric-value">${uniqueBusinesses}</div><div class="metric-label">Unique Businesses</div></div>
                                <div class="metric-card"><div class="metric-value">${conversionRate}%</div><div class="metric-label">Conversion Rate</div></div>
                                <div class="metric-card"><div class="metric-value">${Math.round(total / 30)}</div><div class="metric-label">Avg/Day</div></div>
                            </div>
                            <h4 style="margin:20px 0 12px 0;"><i class="fas fa-funnel-dollar"></i> Conversion Funnel</h4>
                            <div class="conversion-funnel">
                                <div class="funnel-step"><div class="count">${warmCallBooked}</div><div class="label">Warm Call Booked</div></div>
                                <div class="funnel-arrow"><i class="fas fa-arrow-right"></i></div>
                                <div class="funnel-step"><div class="count">${meetingBooked}</div><div class="label">Meeting Booked</div></div>
                                <div class="funnel-arrow"><i class="fas fa-arrow-right"></i></div>
                                <div class="funnel-step"><div class="count">${held}</div><div class="label">Held</div></div>
                                <div class="funnel-arrow"><i class="fas fa-arrow-right"></i></div>
                                <div class="funnel-step"><div class="count">${canceled}</div><div class="label">Canceled</div></div>
                                <div class="funnel-arrow"><i class="fas fa-arrow-right"></i></div>
                                <div class="funnel-step"><div class="count">${rescheduled}</div><div class="label">Rescheduled</div></div>
                            </div>
                            <h4 style="margin:20px 0 12px 0;"><i class="fas fa-chart-simple"></i> 7-Day Trend</h4>
                            <canvas id="reportTrendChart" style="width:100%; height:200px;"></canvas>
                            <h4 style="margin:20px 0 12px 0;"><i class="fas fa-chart-pie"></i> Status Distribution</h4>
                            <canvas id="reportStatusChart" style="width:100%; height:200px;"></canvas>
                        </div>
                    </div>
                </div>
            `;

    new Chart(document.getElementById('reportTrendChart'), {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{ label: 'Appointments', data: trendData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
    new Chart(document.getElementById('reportStatusChart'), {
        type: 'pie',
        data: {
            labels: ['Warm Call Booked', 'Meeting Booked', 'Held', 'Canceled', 'Rescheduled'],
            datasets: [{ data: [warmCallBooked, meetingBooked, held, canceled, rescheduled], backgroundColor: ['#3b82f6', '#8b5cf6', '#f97316', '#ef4444', '#f59e0b'] }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });

    document.getElementById('exportPDFBtn')?.addEventListener('click', () => {
        html2pdf().set({
            margin: 0.5,
            filename: `ScriptFlow_Report_${getTodayStr()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).from(document.getElementById('reportContent')).save();
        showToast('Report exported as PDF', 'success');
    });
}

// ---- SHOW/HIDE FEATURE PANEL ----
function showFeaturePanel(featureType, title) {
    const scriptPanel = document.getElementById('scriptPanel');
    const featurePanel = document.getElementById('featurePanel');
    const featureTitle = document.getElementById('featurePanelTitle');
    const featureBody = document.getElementById('featurePanelBody');
    const analyticsTabs = document.getElementById('analyticsTabContainer');
    const calendarTabs = document.getElementById('calendarViewToggle');

    if (!scriptPanel || !featurePanel) return;

    analyticsTabs.style.display = 'none';
    calendarTabs.style.display = 'none';

    featureTitle.innerHTML = `<i class="fas ${featureType === 'analytics' ? 'fa-chart-pie' : (featureType === 'calendar' ? 'fa-calendar-alt' : 'fa-chart-line')}"></i> ${title}`;

    if (featureType === 'analytics') {
        analyticsTabs.style.display = 'flex';
        currentView = 'analytics';
        renderAnalyticsHub(featureBody);
    } else if (featureType === 'calendar') {
        calendarTabs.style.display = 'flex';
        currentView = 'calendar';
        renderCalendarPanel(featureBody);
        document.getElementById('calendarViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        currentListSearchTerm = '';
    }

    scriptPanel.style.display = 'none';
    featurePanel.style.display = 'block';
}

function hideFeaturePanel() {
    const scriptPanel = document.getElementById('scriptPanel');
    const featurePanel = document.getElementById('featurePanel');
    if (scriptPanel && featurePanel) {
        featurePanel.style.display = 'none';
        scriptPanel.style.display = 'block';
        if (featureChartInstance) { featureChartInstance.destroy(); featureChartInstance = null; }
        currentListSearchTerm = '';
    }
}

// ---- SCRIPT MANAGEMENT ----
const defaultScripts = {
    "opening": {
        name: "🎯 Opening Script",
        content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is Flynn. I work with a web design company that helps companies like yours stand out online. We actually created a free, modern preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\""
    },
    "owner_yes": {
        name: "👑 Owner - Yes",
        content: "✅ Perfect! I'll have my manager Daniel give you a quick call later today to show you the preview. Is this the best number to reach you at? Appreciate your time!"
    },
    "owner_no": {
        name: "👤 Not Owner",
        content: "❌ Got it — do you usually help with marketing or sales? What's the best time to reach the owner today? I'll have Daniel give them a quick call."
    },
    "objection_website": {
        name: "⚠️ Already have a website",
        content: "Totally understandable. Most businesses we speak with do. This isn't about replacing it immediately — just showing a fresh perspective. Worst case, you get some good ideas."
    },
    "objection_webguy": {
        name: "⚠️ Have a web guy",
        content: "That's great! Many of our clients already have developers. They just like getting a second opinion. No commitment — just worth comparing."
    },
    "objection_cost": {
        name: "💰 How much does it cost?",
        content: "The preview itself is completely free. Daniel would only go over pricing if you actually like what you see. Right now it's just about showing you the concept first."
    },
    "objection_busy": {
        name: "🕐 I'm busy",
        content: "Totally understand — that's why I'm not trying to go through everything now. What's easier for you — later today or tomorrow for a quick 5–10 minute look?"
    },
    "objection_not_interested": {
        name: "❌ Not interested",
        content: "No worries. Just so you know, we already built the preview, so there's nothing to buy. Would it hurt to at least take a quick look?"
    },
    "objection_info": {
        name: "📧 Send me info",
        content: "I definitely can. The only reason I prefer a quick walkthrough is because the preview makes more sense visually. It honestly takes about 5 minutes. What's better — later today or tomorrow?"
    },
    "objection_found_me": {
        name: "🔍 How did you find me?",
        content: "I came across your Google listing while looking at businesses in your area. Your business stood out, so we created a sample concept using public info."
    },
    "closing": {
        name: "🏁 Closing Script",
        content: "Awesome, we're excited to show you the preview! I'll have Daniel give you a quick call [later/tomorrow]. Appreciate your time, Flynn! Talk soon!"
    }
};

function initVersionHistory(id, c) {
    if (!versionHistory[id]) {
        versionHistory[id] = [{ content: c, timestamp: new Date().toISOString() }];
        currentVersionIndex[id] = 0;
    }
}

function saveVersion(id, newContent) {
    if (!versionHistory[id]) initVersionHistory(id, newContent);
    if (currentVersionIndex[id] < versionHistory[id].length - 1) versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
    versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
    currentVersionIndex[id] = versionHistory[id].length - 1;
    localStorage.setItem('scriptflow_version_history', JSON.stringify(versionHistory));
}

function undoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] <= 0) { showToast('No earlier version', 'error'); return; }
    currentVersionIndex[id]--;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Undo', 'info');
}

function redoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) { showToast('No newer version', 'error'); return; }
    currentVersionIndex[id]++;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Redo', 'info');
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
    document.getElementById('saveStatus').innerHTML = '<i class="fas fa-check"></i> Saved';
    setTimeout(() => {
        if (!isEditing) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-save"></i> Auto';
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

function renderSidebar() {
    const container = document.getElementById('scriptListContainer');
    if (!container) return;
    const visible = getOrderedVisible();
    if (!visible.length) { container.innerHTML = '<div style="padding:20px;">No scripts</div>'; return; }
    let html = '';
    visible.forEach((id, idx) => {
        const s = scripts[id];
        const active = currentScriptId === id;
        html += `<div class="script-item ${active ? 'active' : ''}" data-id="${id}"><span class="script-name">${escapeHtml(s.name)}</span><div class="script-actions"><button class="script-action-btn rename-script" data-id="${id}"><i class="fas fa-pencil-alt"></i></button><button class="script-action-btn delete-script" data-id="${id}" ${id === 'opening' ? 'disabled style="opacity:0.4;"' : ''}><i class="fas fa-trash"></i></button></div><span class="key-hint">${idx < 9 ? idx + 1 : ''}</span></div>`;
    });
    container.innerHTML = html;
    attachScriptEvents();
    const idxCur = visible.indexOf(currentScriptId);
    document.getElementById('activeShortcutHint').innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur + 1}` : `Key: —`;
    if (versionHistory[currentScriptId]) document.getElementById('versionNumber').innerText = `${currentVersionIndex[currentScriptId] + 1}/${versionHistory[currentScriptId].length}`;
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
            const newName = prompt('New name:', scripts[id].name);
            if (newName?.trim()) {
                scripts[id].name = newName.trim();
                saveAllScripts();
                renderSidebar();
                if (currentScriptId === id) document.getElementById('currentScriptName').innerHTML = scripts[id].name;
                showToast('Renamed', 'success');
            }
        });
    });
    document.querySelectorAll('.delete-script').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (id === 'opening') { showToast('Cannot delete opening', 'error'); return; }
            if (confirm('Delete?')) {
                delete scripts[id];
                delete versionHistory[id];
                customOrder = customOrder.filter(i => i !== id);
                if (currentScriptId === id) loadScript('opening');
                saveAllScripts();
                renderSidebar();
                showToast('Deleted', 'info');
            }
        });
    });
}

function loadScript(id) {
    if (!scripts[id] || isEditing) return;
    currentScriptId = id;
    document.getElementById('currentScriptName').innerHTML = scripts[id].name;
    const displayContent = replaceNameInScript(scripts[id].content);
    document.getElementById('scriptContent').innerHTML = `<div class="script-display">${escapeHtml(displayContent).replace(/\n/g, '<br>')}</div>`;
    renderSidebar();
}

function enterEdit() {
    isEditing = true;
    document.getElementById('editScriptBtn').style.display = 'none';
    document.getElementById('saveScriptBtn').style.display = 'inline-flex';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('scriptContent').innerHTML = `<textarea id="editTextarea" class="edit-textarea">${escapeHtml(scripts[currentScriptId].content)}</textarea>`;
    document.getElementById('editTextarea').focus();
    showToast('Edit mode', 'info');
}

function saveEdit() {
    const newContent = document.getElementById('editTextarea').value;
    scripts[currentScriptId].content = newContent;
    saveVersion(currentScriptId, newContent);
    saveAllScripts();
    cancelEdit();
    showToast('Saved!', 'success');
}

function cancelEdit() {
    isEditing = false;
    document.getElementById('editScriptBtn').style.display = 'inline-flex';
    document.getElementById('saveScriptBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    loadScript(currentScriptId);
}

function copyScript() {
    copyToClipboard(replaceNameInScript(scripts[currentScriptId].content));
}

function resetScript() {
    if (defaultScripts[currentScriptId]) {
        if (confirm('Reset?')) {
            scripts[currentScriptId] = { ...defaultScripts[currentScriptId] };
            saveVersion(currentScriptId, scripts[currentScriptId].content);
            saveAllScripts();
            loadScript(currentScriptId);
            showToast('Reset complete', 'success');
        }
    } else showToast('No default', 'error');
}

function addNewScript() {
    if (isEditing) { showToast('Finish editing first', 'error'); return; }
    const name = prompt('Script name:');
    if (!name) return;
    const id = 'custom_' + Date.now();
    scripts[id] = { name, content: 'Write your script here...' };
    initVersionHistory(id, scripts[id].content);
    customOrder.push(id);
    saveAllScripts();
    renderSidebar();
    loadScript(id);
    showToast(`Added: ${name}`, 'success');
}

function showVersionHistoryModal() {
    if (!versionHistory[currentScriptId]) { showToast('No history', 'error'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    let html = `<div class="modal-card"><h3>Version History: ${scripts[currentScriptId].name}</h3>`;
    versionHistory[currentScriptId].forEach((v, idx) => {
        html += `<div style="padding:12px; border-bottom:1px solid var(--border-color); cursor:pointer;" data-index="${idx}">${new Date(v.timestamp).toLocaleString()} ${idx === currentVersionIndex[currentScriptId] ? '✓ Current' : 'Restore'}</div>`;
    });
    html += `<button class="btn-icon" id="closeHistBtn">Close</button></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-index]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'));
            currentVersionIndex[currentScriptId] = idx;
            scripts[currentScriptId].content = versionHistory[currentScriptId][idx].content;
            saveAllScripts();
            if (!isEditing) loadScript(currentScriptId);
            else if (isEditing && document.getElementById('editTextarea')) document.getElementById('editTextarea').value = scripts[currentScriptId].content;
            showToast('Restored', 'success');
            modal.remove();
        });
    });
    document.getElementById('closeHistBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function replaceNameInScript(content) { return content; }

// ---- UTILITIES ----
function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('scriptflow_theme_main', document.body.classList.contains('dark') ? 'dark' : 'light');
    showToast(`${document.body.classList.contains('dark') ? 'Dark' : 'Light'} mode`, 'info');
}

function exportToCSV() {
    let rows = [['Date', 'Business', 'Contact', 'Role', 'Phone', 'Time', 'Status', 'Tags', 'CRM Link', 'Notes', 'Assigned']];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => {
                rows.push([date, a.business, a.contactName, a.role, a.phone, a.time, getStatus(a), (a.tags || []).map(t => TAG_OPTIONS.find(opt => opt.id === t)?.name || t).join(', '), a.crmLink || '', a.notes, a.assigned]);
            });
        }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointments_${getTodayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Exported', 'success');
}

function showHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-question-circle"></i> ScriptFlow Pro Guide</h3><div style="margin:16px 0;"><strong>📊 Insights Dashboard</strong><br>Analytics and trends</div><div style="margin:16px 0;"><strong>📋 Advanced Reports</strong><br>PDF export, conversion funnel, performance metrics</div><div style="margin:16px 0;"><strong>📅 Drag & Drop Calendar</strong><br>Drag appointments to reschedule</div><div style="margin:16px 0;"><strong>📋 Clean List View</strong><br>Search, filter by status and tags, hover tooltips, CRM links</div><div style="margin:16px 0;"><strong>✨ Smart Import</strong><br>CRM link field, tag selection, auto-extracts all fields</div><div style="margin:16px 0;"><strong>🏷️ Tags System</strong><br>Qualified Warm Call (Green), Unqualified Warm Callback (Yellow), VIP (Blue), Negligent Warm Callback (Red)</div><div style="margin:16px 0;"><strong>🎯 Priority Predictor</strong><br>Real-time best calling times across US time zones</div><div style="margin:16px 0;"><strong>📌 Status Tracking</strong><br>Warm Call Booked, Meeting Booked, Held, Canceled, Rescheduled</div><button id="closeHelp" class="btn-icon" style="margin-top:16px;">Got it</button></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeHelp').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function toggleToolsMenu() {
    toolsOpen = !toolsOpen;
    const m = document.getElementById('toolsMenu');
    const c = document.getElementById('toolsChevron');
    if (toolsOpen) { if (m) m.classList.add('open'); if (c) c.classList.add('rotated'); }
    else { if (m) m.classList.remove('open'); if (c) c.classList.remove('rotated'); }
    localStorage.setItem('toolsMenuOpen', toolsOpen);
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    // CSV Upload Handler
    const csvFileInput = document.getElementById('csvFileInput');
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    
    if (csvUploadBtn && csvFileInput) {
        csvUploadBtn.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                csvFileInput.click();
            }
        });
        
        csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                    importCSV(file);
                } else {
                    showToast('Please select a CSV file', 'error');
                }
            }
            csvFileInput.value = '';
        });
    }

    // Setup Priority Modal
    setupPriorityModal();

    document.getElementById('toolsHeader')?.addEventListener('click', toggleToolsMenu);
    if (toolsOpen) {
        document.getElementById('toolsMenu')?.classList.add('open');
        document.getElementById('toolsChevron')?.classList.add('rotated');
    }

    document.querySelectorAll('.tool-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = item.querySelector('span')?.innerText || item.innerText;
            if (text.includes('Analytics Hub')) {
                currentAnalyticsTab = 'insights';
                showFeaturePanel('analytics', 'Analytics Hub');
            } else if (text.includes('Appointment Calendar')) {
                showFeaturePanel('calendar', 'Appointment Calendar');
            } else if (text.includes('Call Priority')) {
                openPriorityModal();
            } else if (text.includes('Export')) {
                exportToCSV();
            } else if (text.includes('Dark/Light')) {
                toggleTheme();
            } else if (text.includes('Help')) {
                showHelpModal();
            } else if (text.includes('Factory Reset')) {
                if (confirm('ERASE ALL DATA?')) { localStorage.clear(); location.reload(); }
            }
        });
    });

    document.getElementById('closeFeaturePanelBtn')?.addEventListener('click', hideFeaturePanel);

    document.getElementById('insightsTabBtn')?.addEventListener('click', () => {
        currentAnalyticsTab = 'insights';
        const container = document.getElementById('featurePanelBody');
        if (container) renderAnalyticsHub(container);
    });
    document.getElementById('reportsTabBtn')?.addEventListener('click', () => {
        currentAnalyticsTab = 'reports';
        const container = document.getElementById('featurePanelBody');
        if (container) renderAnalyticsHub(container);
    });

    document.getElementById('calendarViewBtn')?.addEventListener('click', () => {
        currentView = 'calendar';
        refreshCurrentView();
        document.getElementById('calendarViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        currentListSearchTerm = '';
    });
    document.getElementById('listViewBtn')?.addEventListener('click', () => {
        currentView = 'list';
        refreshCurrentView();
        document.getElementById('listViewBtn').classList.add('active');
        document.getElementById('calendarViewBtn').classList.remove('active');
    });

    const menuToggle = document.getElementById('menuToggleBtn'), sidebar = document.getElementById('mainSidebar'), main = document.getElementById('mainContent');
    if (menuToggle) menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('closed');
        main.classList.toggle('expanded');
        localStorage.setItem('sidebarClosed', sidebar.classList.contains('closed'));
    });
    if (sidebar && localStorage.getItem('sidebarClosed') === 'true') {
        sidebar.classList.add('closed');
        main.classList.add('expanded');
    }

    loadAppointmentData();
    loadScripts();
    renderSidebar();
    loadScript('opening');
    if (localStorage.getItem('scriptflow_theme_main') === 'dark') document.body.classList.add('dark');

    document.getElementById('addScriptBtnSide')?.addEventListener('click', addNewScript);
    document.getElementById('editScriptBtn')?.addEventListener('click', enterEdit);
    document.getElementById('saveScriptBtn')?.addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEdit);
    document.getElementById('copyScriptBtn')?.addEventListener('click', copyScript);
    document.getElementById('resetScriptBtn')?.addEventListener('click', resetScript);
    document.getElementById('undoBtn')?.addEventListener('click', () => undoScript(currentScriptId));
    document.getElementById('redoBtn')?.addEventListener('click', () => redoScript(currentScriptId));
    document.getElementById('quickReportBtn')?.addEventListener('click', openSmartAddModal);
    document.getElementById('historyBtn')?.addEventListener('click', showVersionHistoryModal);
    document.getElementById('scriptSearch')?.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderSidebar();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const fp = document.getElementById('featurePanel');
            if (fp && fp.style.display === 'block') { hideFeaturePanel(); e.preventDefault(); }
        }
        if (e.key >= '1' && e.key <= '9' && !isEditing && !e.target.matches('textarea,input')) {
            const fp = document.getElementById('featurePanel');
            if (fp && fp.style.display === 'block') return;
            e.preventDefault();
            const t = getKeyMapping().get(e.key);
            if (t && scripts[t]) { loadScript(t); showToast(`Switched to: ${scripts[t].name}`, 'info'); }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isEditing) { e.preventDefault(); undoScript(currentScriptId); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !isEditing) { e.preventDefault(); redoScript(currentScriptId); }
        if (e.key === 'Escape' && isEditing) { cancelEdit(); showToast('Edit cancelled', 'info'); }
    });

    setInterval(() => updateStats(), 5000);
});