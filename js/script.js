// ================================================================
// SCRIPTFLOW PRO - COMPLETE APPLICATION
// ================================================================

// ---- GLOBAL STATE ----
let currentUser = null;
let authModalOpen = false;
let authInProgress = false;
let appointments = {};
let goals = { daily: 3, weekly: 15, monthly: 60 };
let scripts = {};
let scriptOrder = [];
let customOrder = [];
let currentScriptId = "opening";
let isEditing = false;
let searchTerm = "";
let versionHistory = {};
let currentVersionIndex = {};
let tasks = [];
let taskFilter = 'all';
let isAppInitialized = false;
let isRefreshing = false;

let appointmentsUnsubscribe = null;
let tasksUnsubscribe = null;

let currentCalDate = new Date();
let selectedCalDate = getTodayStr();

let dashboardDatePreset = 'today';
let dashboardDateRange = { start: getTodayStr(), end: getTodayStr() };
let currentView = 'calendar';
let currentStatusFilter = 'all';
let currentTagFilter = 'all';
let currentListSearchTerm = '';
let currentSort = 'time';
let currentAnalyticsTab = 'insights';
let selectedAppointments = new Set();

let toolsOpen = localStorage.getItem('toolsMenuOpen') === 'true';
let featureChartInstance = null;
let draggedItem = null;

const STATUS_OPTIONS = ['Warm Call Booked', 'Meeting Booked', 'Canceled', 'Rescheduled', 'Held'];

const TAG_OPTIONS = [
    { id: 'qualified_warm_call', name: 'Qualified Warm Call', color: '#10b981', colorClass: 'tag-qualified-warm-call-bg' },
    { id: 'unqualified_warm_callback', name: 'Unqualified Warm Callback', color: '#f59e0b', colorClass: 'tag-unqualified-warm-callback-bg' },
    { id: 'vip', name: 'VIP', color: '#3b82f6', colorClass: 'tag-vip-bg' },
    { id: 'negligent_warm_callback', name: 'Negligent Warm Callback', color: '#ef4444', colorClass: 'tag-negligent-warm-callback-bg' }
];

// ---- WORKSPACE STATE ----
const WORKSPACE_CONFIG = {
    HOME_URL: 'https://sales.regen-digital.com/campaigns',
    SEARCH_ENGINE: 'https://www.google.com/search?q=',
    MAX_TABS: 20,
    AUTO_SAVE_INTERVAL: 30000,
    SESSION_KEY: 'workspace_session_state'
};

let workspaceState = {
    tabs: [],
    activeTabId: null,
    tabCounter: 0,
    history: {},
    historyIndex: {},
    bookmarks: JSON.parse(localStorage.getItem('workspace_bookmarks') || '[]'),
    clipboardHistory: JSON.parse(localStorage.getItem('workspace_clipboard') || '[]'),
    notes: localStorage.getItem('workspace_notes') || '',
    script: localStorage.getItem('workspace_script') || 'Hi [Name], this is [Your Name] from Regen Digital. I noticed you recently...\n\nI\'m reaching out because we help businesses like yours get more visibility online.\n\nWould you be open to a quick 5-minute chat to see if we can help?',
    quickCopyItems: JSON.parse(localStorage.getItem('workspace_quickcopy') || '[]'),
    sessionState: null,
    splitMode: false,
    splitDirection: 'horizontal',
    panels: {
        notepad: { visible: false, minimized: false, x: 100, y: 100, width: 320, height: 250 },
        callscript: { visible: false, minimized: false, x: 440, y: 100, width: 380, height: 300 },
        calculator: { visible: false, minimized: false, x: 100, y: 400, width: 280, height: 320 },
        timer: { visible: false, minimized: false, x: 400, y: 400, width: 280, height: 200 },
        clipboard: { visible: false, minimized: false, x: 700, y: 100, width: 300, height: 250 }
    }
};

let splitModeActive = false;
let splitRatio = 50;
let commandPaletteOpen = false;

// ---- ERROR HANDLING ----
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    let message = 'An error occurred. Please try again.';
    if (error.code === 'auth/network-request-failed') {
        message = 'Network connection lost. Please check your internet connection.';
        showOfflineIndicator(true);
    } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please wait a moment and try again.';
    } else if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email address.';
    } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
    } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
    } else if (error.message) {
        message = error.message;
    }
    showToast(message, 'error');
    return { success: false, message };
}

function showOfflineIndicator(show) {
    let indicator = document.getElementById('offlineIndicator');
    if (!indicator) {
        const div = document.createElement('div');
        div.id = 'offlineIndicator';
        div.className = 'offline-indicator';
        div.innerHTML = '<i class="fas fa-wifi"></i> You are offline. Changes will sync when you reconnect.';
        document.body.prepend(div);
    }
    const el = document.getElementById('offlineIndicator');
    if (show) {
        el.classList.add('show');
    } else {
        el.classList.remove('show');
    }
}

// ---- HELPERS ----
function generateUniqueId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substring(2, 11);
}

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

function getScoreColor(score) {
    if (score >= 70) return 'score-hot';
    if (score >= 40) return 'score-warm';
    return 'score-cold';
}

function getScoreLabel(score) {
    if (score >= 70) return '🔥 Hot';
    if (score >= 40) return 'Warm';
    return '❄️ Cold';
}

function calculateLeadScore(appt) {
    let score = 0;
    const status = getStatus(appt);
    if (status === 'Held') score += 30;
    else if (status === 'Meeting Booked') score += 25;
    else if (status === 'Warm Call Booked') score += 15;
    else if (status === 'Rescheduled') score += 10;
    else if (status === 'Canceled') score -= 10;
    if (appt.tags) {
        if (appt.tags.includes('vip')) score += 20;
        if (appt.tags.includes('qualified_warm_call')) score += 15;
        if (appt.tags.includes('negligent_warm_callback')) score -= 10;
    }
    if (appt.notes && appt.notes.length > 10) score += 5;
    if (appt.phone) score += 5;
    if (appt.crmLink) score += 5;
    return Math.max(0, Math.min(100, score));
}

function getTodayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(dateStr) {
    if (!dateStr) return 'No date';
    let d;
    if (typeof dateStr === 'object' && dateStr.seconds !== undefined) {
        d = new Date(dateStr.seconds * 1000);
    } else if (typeof dateStr.toDate === 'function') {
        d = dateStr.toDate();
    } else if (typeof dateStr === 'string') {
        d = new Date(dateStr.replace(/-/g, '/'));
    } else {
        d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return 'No date';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    let d;
    if (typeof dateStr === 'object' && dateStr.seconds !== undefined) {
        d = new Date(dateStr.seconds * 1000);
    } else if (typeof dateStr.toDate === 'function') {
        d = dateStr.toDate();
    } else if (typeof dateStr === 'string') {
        d = new Date(dateStr.replace(/-/g, '/'));
    } else {
        d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatToLocalDateStr(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeHtml(s) {
    return s ? String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : '';
}

function showToast(msg, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());
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

// ================================================================
// FIREBASE AUTHENTICATION
// ================================================================

function getUserPhotoURL(user) {
    if (!user) return null;
    if (user.photoURL) return user.photoURL;
    if (user.providerData && user.providerData.length > 0) {
        const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
        if (googleProvider && googleProvider.photoURL) return googleProvider.photoURL;
    }
    return null;
}

function updateSidebarProfile(user) {
    const userInfoContainer = document.getElementById('userInfo');
    if (!userInfoContainer) return;
    if (!user) {
        userInfoContainer.style.display = 'none';
        return;
    }
    userInfoContainer.style.display = 'block';
    let avatarContainer = userInfoContainer.querySelector('.user-profile');
    if (!avatarContainer) {
        avatarContainer = document.createElement('div');
        avatarContainer.className = 'user-profile';
        userInfoContainer.innerHTML = '';
        userInfoContainer.appendChild(avatarContainer);
    }
    const photoURL = getUserPhotoURL(user);
    const displayName = user.displayName || user.email || 'User';
    let avatarHtml = '';
    if (photoURL) {
        avatarHtml = `<img src="${photoURL}" alt="${displayName}" class="user-avatar" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=\\'user-avatar-placeholder\\'>${displayName.charAt(0).toUpperCase()}</div>'" />`;
    } else {
        const initials = displayName.charAt(0).toUpperCase();
        avatarHtml = `<div class="user-avatar-placeholder">${initials}</div>`;
    }
    avatarContainer.innerHTML = `${avatarHtml}<span class="user-email">${user.email || displayName}</span>`;
}

async function signInWithGoogle() {
    if (authInProgress) { showToast('Sign in already in progress...', 'info'); return; }
    authInProgress = true;
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await auth.signInWithPopup(provider);
        if (result.user) {
            currentUser = result.user;
            updateSidebarProfile(currentUser);
            await loadUserData();
            showToast('Welcome back! 👋', 'success');
            closeAuthModal();
            authInProgress = false;
            return true;
        }
    } catch (error) {
        authInProgress = false;
        handleError(error, 'Google Sign-In');
        return false;
    }
}

async function signUp(email, password, username) {
    if (authInProgress) { showToast('Sign in progress...', 'info'); return; }
    authInProgress = true;
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        if (result.user) {
            await result.user.updateProfile({ displayName: username });
            await db.collection('users').doc(result.user.uid).set({
                uid: result.user.uid,
                email: email,
                username: username,
                displayName: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                goals: { daily: 3, weekly: 15, monthly: 60 },
                scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing']
            });
            showToast('Account created! 🎉', 'success');
            currentUser = result.user;
            updateSidebarProfile(currentUser);
            await loadUserData();
            closeAuthModal();
            authInProgress = false;
            return true;
        }
    } catch (error) {
        authInProgress = false;
        handleError(error, 'Sign Up');
        return false;
    }
}

async function signIn(email, password) {
    if (authInProgress) { showToast('Sign in progress...', 'info'); return; }
    authInProgress = true;
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        if (result.user) {
            currentUser = result.user;
            updateSidebarProfile(currentUser);
            await loadUserData();
            showToast('Welcome back! 👋', 'success');
            closeAuthModal();
            authInProgress = false;
            return true;
        }
    } catch (error) {
        authInProgress = false;
        handleError(error, 'Sign In');
        return false;
    }
}

async function signOut() {
    try {
        if (appointmentsUnsubscribe) { appointmentsUnsubscribe(); appointmentsUnsubscribe = null; }
        if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
        currentUser = null;
        appointments = {};
        tasks = [];
        scripts = {};
        scriptOrder = [];
        updateSidebarProfile(null);
        updateStats();
        renderSidebar();
        await auth.signOut();
        showToast('Signed out successfully', 'info');
        setTimeout(() => { showAuthModal(); }, 300);
    } catch (error) {
        handleError(error, 'Sign Out');
    }
}

function showAuthModal() {
    if (authModalOpen) return;
    authModalOpen = true;
    const existingModal = document.getElementById('authModal');
    if (existingModal) { existingModal.remove(); }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'authModal';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 420px;">
            <h2 style="text-align:center; margin-bottom: 20px;">
                <i class="fas fa-microphone-alt" style="color:var(--primary);"></i>
                ScriptFlow Pro
            </h2>
            <p style="text-align:center; color:var(--text-muted); margin-bottom:20px; font-size:0.9rem;">
                Sign in to access your data anywhere
            </p>
            <button id="googleSignInBtn" class="btn-icon" style="width:100%; justify-content:center; background:#ffffff; color:#333; border:1px solid #dadce0; margin-bottom:16px; padding:10px;">
                <svg style="width:18px; height:18px; margin-right:8px; flex-shrink:0;" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span style="font-weight:500;">Sign in with Google</span>
            </button>
            <div class="auth-divider">or continue with email</div>
            <div id="authFormContainer">
                <div style="display:flex; gap:8px; margin-bottom:20px;">
                    <button id="loginTabBtn" class="view-btn active" style="flex:1; justify-content:center;">Sign In</button>
                    <button id="signupTabBtn" class="view-btn" style="flex:1; justify-content:center;">Sign Up</button>
                </div>
                <div id="loginForm">
                    <div class="form-group"><label for="loginEmailInput">Email</label><input type="email" id="loginEmailInput" placeholder="you@example.com" /></div>
                    <div class="form-group"><label for="loginPasswordInput">Password</label><input type="password" id="loginPasswordInput" placeholder="••••••••" /></div>
                    <button id="loginBtn" class="btn-icon" style="width:100%; justify-content:center; background:var(--primary); color:white;"><i class="fas fa-sign-in-alt"></i> Sign In</button>
                </div>
                <div id="signupForm" style="display:none;">
                    <div class="form-group"><label for="signupUsernameInput">Username</label><input type="text" id="signupUsernameInput" placeholder="Choose a username" /></div>
                    <div class="form-group"><label for="signupEmailInput">Email</label><input type="email" id="signupEmailInput" placeholder="you@example.com" /></div>
                    <div class="form-group"><label for="signupPasswordInput">Password</label><input type="password" id="signupPasswordInput" placeholder="•••••••• (min 6 chars)" /></div>
                    <button id="signupBtn" class="btn-icon" style="width:100%; justify-content:center; background:var(--success); color:white;"><i class="fas fa-user-plus"></i> Create Account</button>
                </div>
            </div>
            <div style="margin-top:16px; text-align:center; font-size:0.8rem; color:var(--text-muted);">🔒 Your data is securely stored in the cloud</div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('googleSignInBtn').addEventListener('click', async (e) => { e.preventDefault(); await signInWithGoogle(); });
    document.getElementById('loginTabBtn').addEventListener('click', () => {
        document.getElementById('loginTabBtn').classList.add('active');
        document.getElementById('signupTabBtn').classList.remove('active');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
    });
    document.getElementById('signupTabBtn').addEventListener('click', () => {
        document.getElementById('signupTabBtn').classList.add('active');
        document.getElementById('loginTabBtn').classList.remove('active');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    });
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmailInput').value;
        const password = document.getElementById('loginPasswordInput').value;
        if (!email || !password) { showToast('Please fill in all fields', 'error'); return; }
        await signIn(email, password);
    });
    document.getElementById('signupBtn').addEventListener('click', async () => {
        const username = document.getElementById('signupUsernameInput').value;
        const email = document.getElementById('signupEmailInput').value;
        const password = document.getElementById('signupPasswordInput').value;
        if (!username || !email || !password) { showToast('Please fill in all fields', 'error'); return; }
        if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
        await signUp(email, password, username);
    });
    modal.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const loginBtn = document.getElementById('loginBtn');
                const signupBtn = document.getElementById('signupBtn');
                if (document.getElementById('loginForm').style.display !== 'none') {
                    loginBtn.click();
                } else {
                    signupBtn.click();
                }
            }
        });
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal && !currentUser) {
            showToast('Please sign in to use ScriptFlow Pro', 'info');
        }
    });
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) { modal.remove(); authModalOpen = false; }
}

// ================================================================
// REFRESH FUNCTION
// ================================================================

async function refreshData() {
    if (isRefreshing) return;
    isRefreshing = true;
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }
    try {
        showToast('Refreshing data...', 'info');
        await loadUserData(true);
        refreshCurrentView();
        showToast('Data refreshed successfully!', 'success');
    } catch (error) {
        handleError(error, 'Refresh');
    } finally {
        isRefreshing = false;
        if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
    }
}

// ================================================================
// FIREBASE DATA LOADING & SYNC
// ================================================================

async function loadUserData(showLoading = true) {
    if (!currentUser) return;
    try {
        if (showLoading) {
            document.getElementById('saveStatus').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        if (!userData) {
            await db.collection('users').doc(currentUser.uid).set({
                uid: currentUser.uid,
                email: currentUser.email,
                username: currentUser.displayName || currentUser.email,
                displayName: currentUser.displayName || currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                goals: { daily: 3, weekly: 15, monthly: 60 },
                scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing']
            });
            return loadUserData();
        }
        if (userData.goals) {
            goals = { daily: userData.goals.daily || 3, weekly: userData.goals.weekly || 15, monthly: userData.goals.monthly || 60 };
        }
        scriptOrder = userData.scriptOrder || ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing'];
        
        const appointmentsSnapshot = await db.collection('users').doc(currentUser.uid).collection('appointments').orderBy('createdAt', 'desc').get();
        appointments = {};
        appointmentsSnapshot.forEach(doc => {
            const appt = doc.data();
            if (!appointments[appt.date]) { appointments[appt.date] = { count: 0, note: '', reports: [] }; }
            appointments[appt.date].reports.push({ ...appt, id: doc.id });
            appointments[appt.date].count = appointments[appt.date].reports.length;
        });

        const tasksSnapshot = await db.collection('users').doc(currentUser.uid).collection('tasks').orderBy('createdAt', 'desc').get();
        tasks = [];
        tasksSnapshot.forEach(doc => { tasks.push({ ...doc.data(), id: doc.id }); });

        const scriptsSnapshot = await db.collection('users').doc(currentUser.uid).collection('scripts').get();
        scripts = {};
        scriptsSnapshot.forEach(doc => {
            const data = doc.data();
            scripts[doc.id] = { name: data.name, content: data.content };
        });
        if (Object.keys(scripts).length === 0) {
            await createDefaultScripts();
            return loadUserData();
        }
        const versionsSnapshot = await db.collection('users').doc(currentUser.uid).collection('scriptVersions').orderBy('version', 'asc').get();
        versionHistory = {};
        versionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!versionHistory[data.scriptId]) { versionHistory[data.scriptId] = []; }
            versionHistory[data.scriptId].push({
                content: data.content,
                timestamp: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
            });
        });
        for (const id of Object.keys(scripts)) {
            if (!versionHistory[id]) {
                versionHistory[id] = [{ content: scripts[id].content, timestamp: new Date().toISOString() }];
            }
            currentVersionIndex[id] = versionHistory[id].length - 1;
        }
        updateStats();
        renderSidebar();
        if (Object.keys(scripts).length > 0) { loadScript('opening'); }
        updateTaskStats();
        closeAuthModal();
        document.getElementById('saveStatus').innerHTML = '<i class="fas fa-check"></i> Synced';
        setTimeout(() => {
            if (!isEditing) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-save"></i> Auto';
        }, 1500);
        showOfflineIndicator(false);
    } catch (error) {
        console.error('Error loading user data:', error);
        document.getElementById('saveStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        handleError(error, 'Loading Data');
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
            showOfflineIndicator(true);
        }
    }
}

async function createDefaultScripts() {
    if (!currentUser) return;
    const defaultScripts = {
        "opening": {
            name: "🎯 Opening Script",
            content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is Flynn. I work with a web design company that helps companies like yours stand out online. We actually created a free, modern preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\""
        },
        "owner_yes": { name: "👑 Owner - Yes", content: "✅ Perfect! I'll have my manager Daniel give you a quick call later today to show you the preview. Is this the best number to reach you at? Appreciate your time!" },
        "owner_no": { name: "🤤 Not Owner", content: "❌ Got it — do you usually help with marketing or sales? What's the best time to reach the owner today? I'll have Daniel give them a quick call." },
        "objection_website": { name: "⚠️ Already have a website", content: "Totally understandable. Most businesses we speak with do. This isn't about replacing it immediately — just showing a fresh perspective. Worst case, you get some good ideas." },
        "objection_webguy": { name: "⚠️ Have a web guy", content: "That's great! Many of our clients already have developers. They just like getting a second opinion. No commitment — just worth comparing." },
        "objection_cost": { name: "💰 How much does it cost?", content: "The preview itself is completely free. Daniel would only go over pricing if you actually like what you see. Right now it's just about showing you the concept first." },
        "objection_busy": { name: "🕐 I'm busy", content: "Totally understand — that's why I'm not trying to go through everything now. What's easier for you — later today or tomorrow for a quick 5–10 minute look?" },
        "objection_not_interested": { name: "❌ Not interested", content: "No worries. Just so you know, we already built the preview, so there's nothing to buy. Would it hurt to at least take a quick look?" },
        "objection_info": { name: "📧 Send me info", content: "I definitely can. The only reason I prefer a quick walkthrough is because the preview makes more sense visually. It honestly takes about 5 minutes. What's better — later today or tomorrow?" },
        "objection_found_me": { name: "🔍 How did you find me?", content: "I came across your Google listing while looking at businesses in your area. Your business stood out, so we created a sample concept using public info." },
        "closing": { name: "🏁 Closing Script", content: "Awesome, we're excited to show you the preview! I'll have Daniel give you a quick call [later/tomorrow]. Appreciate your time, Flynn! Talk soon!" }
    };
    const batch = db.batch();
    const scriptsRef = db.collection('users').doc(currentUser.uid).collection('scripts');
    for (const [id, script] of Object.entries(defaultScripts)) {
        const docRef = scriptsRef.doc(id);
        batch.set(docRef, { name: script.name, content: script.content, version: 1, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        const versionRef = db.collection('users').doc(currentUser.uid).collection('scriptVersions').doc();
        batch.set(versionRef, { scriptId: id, content: script.content, version: 1, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    const userRef = db.collection('users').doc(currentUser.uid);
    batch.update(userRef, { scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing'] });
    await batch.commit();
}

async function syncAppointment(appointment) {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).collection('appointments').doc(appointment.id.toString()).set({
            ...appointment,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) { console.error('Sync appointment error:', error); showToast('Error saving appointment', 'error'); return false; }
}

async function deleteAppointmentRemote(id) {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).collection('appointments').doc(id.toString()).delete();
        return true;
    } catch (error) { console.error('Delete appointment error:', error); showToast('Error deleting appointment', 'error'); return false; }
}

async function syncTask(task) {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).collection('tasks').doc(task.id.toString()).set({
            ...task,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) { console.error('Sync task error:', error); showToast('Error saving task', 'error'); return false; }
}

async function deleteTaskRemote(id) {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).collection('tasks').doc(id.toString()).delete();
        return true;
    } catch (error) { console.error('Delete task error:', error); showToast('Error deleting task', 'error'); return false; }
}

async function syncScript(scriptId, data) {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).collection('scripts').doc(scriptId).set({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) { console.error('Sync script error:', error); showToast('Error saving script', 'error'); return false; }
}

async function syncScriptVersion(scriptId, version, content) {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).collection('scriptVersions').add({
            scriptId: scriptId, content: content, version: version,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) { console.error('Sync script version error:', error); return false; }
}

async function syncGoals() {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).update({
            'goals.daily': goals.daily, 'goals.weekly': goals.weekly, 'goals.monthly': goals.monthly,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) { console.error('Sync goals error:', error); showToast('Error saving goals', 'error'); return false; }
}

async function syncScriptOrder() {
    if (!currentUser) return false;
    try {
        await db.collection('users').doc(currentUser.uid).update({ scriptOrder: scriptOrder, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        return true;
    } catch (error) { console.error('Sync script order error:', error); showToast('Error saving script order', 'error'); return false; }
}

function subscribeToChanges() {
    if (!currentUser) return;
    if (appointmentsUnsubscribe) appointmentsUnsubscribe();
    if (tasksUnsubscribe) tasksUnsubscribe();

    try {
        appointmentsUnsubscribe = db.collection('users').doc(currentUser.uid).collection('appointments').onSnapshot(snapshot => {
            appointments = {};
            snapshot.forEach(doc => {
                const appt = doc.data();
                if (!appointments[appt.date]) { appointments[appt.date] = { count: 0, note: '', reports: [] }; }
                appointments[appt.date].reports.push({ ...appt, id: doc.id });
                appointments[appt.date].count = appointments[appt.date].reports.length;
            });
            updateStats();
            refreshCurrentView();
        }, (error) => { console.warn('Appointments subscription error:', error); });

        tasksUnsubscribe = db.collection('users').doc(currentUser.uid).collection('tasks').onSnapshot(snapshot => {
            tasks = [];
            snapshot.forEach(doc => { tasks.push({ ...doc.data(), id: doc.id }); });
            updateTaskStats();
            refreshCurrentView();
        }, (error) => { console.warn('Tasks subscription error:', error); });
    } catch (error) { console.warn('Realtime subscription error:', error); }
}

// ================================================================
// APPOINTMENT CRUD
// ================================================================

function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned, editId = null, status = 'Warm Call Booked', crmLink = '', tags = []) {
    if (!currentUser) { showToast('Please sign in first', 'error'); return; }
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    if (!STATUS_OPTIONS.includes(status)) { status = 'Warm Call Booked'; }
    const newAppt = {
        id: editId || generateUniqueId(),
        business, contactName, role: role || 'Owner', phone: phone || '',
        time: time || '', notes: notes || '', assigned: assigned || 'Daniel',
        status: status || 'Warm Call Booked', crmLink: crmLink || '', tags: tags || [],
        date: dateStr, createdAt: new Date().toISOString(),
        fullText: `Business: ${business}\nContact: ${contactName}\nRole: ${role || 'Owner'}\nPhone: ${phone || ''}\nTime: ${time || ''}\nNotes: ${notes || ''}\nAssigned: ${assigned || 'Daniel'}\nDate: ${dateStr}`
    };
    if (editId) {
        const idx = appointments[dateStr].reports.findIndex(r => r.id === editId);
        if (idx !== -1) appointments[dateStr].reports[idx] = newAppt;
        else appointments[dateStr].reports.unshift(newAppt);
    } else {
        appointments[dateStr].reports.unshift(newAppt);
    }
    appointments[dateStr].count = appointments[dateStr].reports.length;
    syncAppointment(newAppt);
    updateStats();
    return newAppt.fullText;
}

function deleteAppointment(dateStr, id, skipRemote = false) {
    if (appointments[dateStr]?.reports) {
        appointments[dateStr].reports = appointments[dateStr].reports.filter(r => r.id !== id);
        if (appointments[dateStr].reports.length === 0) delete appointments[dateStr];
        else appointments[dateStr].count = appointments[dateStr].reports.length;
        if (!skipRemote) {
            deleteAppointmentRemote(id);
        }
        updateStats();
        return true;
    }
    return false;
}

function saveAppointments() { updateStats(); }

function saveGoals() { syncGoals(); updateStats(); }

function getTodayCount() { return appointments[getTodayStr()]?.reports?.length || 0; }

function getWeekCount() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    let total = 0;
    for (let d in appointments) {
        const date = new Date(d);
        if (date >= start && date <= new Date(start.getTime() + 6 * 86400000) && appointments[d].reports) {
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

function getAverageScore() {
    let total = 0, count = 0;
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(appt => {
                total += calculateLeadScore(appt);
                count++;
            });
        }
    }
    return count > 0 ? Math.round(total / count) : 0;
}

function updateStats() {
    const todayElem = document.getElementById('statToday');
    if (todayElem) todayElem.innerText = getTodayCount();
    const weekElem = document.getElementById('statWeek');
    if (weekElem) weekElem.innerText = getWeekCount();
    const monthElem = document.getElementById('statMonth');
    if (monthElem) monthElem.innerText = getMonthCount();
    const goalDailyElem = document.getElementById('goalDaily');
    if (goalDailyElem) goalDailyElem.innerText = goals.daily;
    const goalWeeklyElem = document.getElementById('goalWeekly');
    if (goalWeeklyElem) goalWeeklyElem.innerText = goals.weekly;
    const goalMonthlyElem = document.getElementById('goalMonthly');
    if (goalMonthlyElem) goalMonthlyElem.innerText = goals.monthly;
    const avgScoreElem = document.getElementById('avgScore');
    if (avgScoreElem) avgScoreElem.innerText = getAverageScore();
    updateTaskStats();
}

// ================================================================
// TASKS
// ================================================================

function addTask(description, dueDate, priority = 'medium', appointmentId = null) {
    if (!currentUser) { showToast('Please sign in first', 'error'); return; }
    const task = {
        id: generateUniqueId(), description, dueDate: dueDate || null, priority,
        appointmentId, completed: false, createdAt: new Date().toISOString()
    };
    tasks.push(task);
    syncTask(task);
    updateTaskStats();
    return task;
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    deleteTaskRemote(id);
    updateTaskStats();
}

function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) { task.completed = !task.completed; syncTask(task); updateTaskStats(); }
}

function updateTaskStats() {
    const pending = tasks.filter(t => !t.completed).length;
    const pendingTasksElem = document.getElementById('pendingTasks');
    if (pendingTasksElem) pendingTasksElem.innerText = pending;
}

function getTasksForAppointment(appointmentId) {
    if (!appointmentId) return [];
    return tasks.filter(t => t.appointmentId === appointmentId.toString());
}

// ================================================================
// SCRIPT MANAGEMENT
// ================================================================

function initVersionHistory(id, c) {
    if (!versionHistory[id]) {
        versionHistory[id] = [{ content: c, timestamp: new Date().toISOString() }];
        currentVersionIndex[id] = 0;
    }
}

function saveVersion(id, newContent) {
    if (!versionHistory[id]) initVersionHistory(id, newContent);
    if (currentVersionIndex[id] < versionHistory[id].length - 1) {
        versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
    }
    versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
    currentVersionIndex[id] = versionHistory[id].length - 1;
    syncScriptVersion(id, currentVersionIndex[id] + 1, newContent);
}

function undoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] <= 0) { showToast('No earlier version', 'error'); return; }
    currentVersionIndex[id]--;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) {
        document.getElementById('editTextarea').value = scripts[id].content;
    }
    showToast('Undo', 'info');
}

function redoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) { showToast('No newer version', 'error'); return; }
    currentVersionIndex[id]++;
    scripts[id].content = versionHistory[id][currentVersionIndex[id]].content;
    saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) {
        document.getElementById('editTextarea').value = scripts[id].content;
    }
    showToast('Redo', 'info');
}

function loadScripts() {
    if (Object.keys(scripts).length === 0) {
        const defaultScripts = {
            "opening": { name: "🎯 Opening Script", content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is Flynn. I work with a web design company that helps companies like yours stand out online. We actually created a free, modern preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\"" },
            "owner_yes": { name: "👑 Owner - Yes", content: "✅ Perfect! I'll have my manager Daniel give you a quick call later today to show you the preview. Is this the best number to reach you at? Appreciate your time!" },
            "owner_no": { name: "🤤 Not Owner", content: "❌ Got it — do you usually help with marketing or sales? What's the best time to reach the owner today? I'll have Daniel give them a quick call." },
            "objection_website": { name: "⚠️ Already have a website", content: "Totally understandable. Most businesses we speak with do. This isn't about replacing it immediately — just showing a fresh perspective. Worst case, you get some good ideas." },
            "objection_webguy": { name: "⚠️ Have a web guy", content: "That's great! Many of our clients already have developers. They just like getting a second opinion. No commitment — just worth comparing." },
            "objection_cost": { name: "💰 How much does it cost?", content: "The preview itself is completely free. Daniel would only go over pricing if you actually like what you see. Right now it's just about showing you the concept first." },
            "objection_busy": { name: "🕐 I'm busy", content: "Totally understand — that's why I'm not trying to go through everything now. What's easier for you — later today or tomorrow for a quick 5–10 minute look?" },
            "objection_not_interested": { name: "❌ Not interested", content: "No worries. Just so you know, we already built the preview, so there's nothing to buy. Would it hurt to at least take a quick look?" },
            "objection_info": { name: "📧 Send me info", content: "I definitely can. The only reason I prefer a quick walkthrough is because the preview makes more sense visually. It honestly takes about 5 minutes. What's better — later today or tomorrow?" },
            "objection_found_me": { name: "🔍 How did you find me?", content: "I came across your Google listing while looking at businesses in your area. Your business stood out, so we created a sample concept using public info." },
            "closing": { name: "🏁 Closing Script", content: "Awesome, we're excited to show you the preview! I'll have Daniel give you a quick call [later/tomorrow]. Appreciate your time, Flynn! Talk soon!" }
        };
        scripts = JSON.parse(JSON.stringify(defaultScripts));
        scriptOrder = ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing'];
    }
}

function saveAllScripts() {
    for (const [id, script] of Object.entries(scripts)) { syncScript(id, script); }
    syncScriptOrder();
    document.getElementById('saveStatus').innerHTML = '<i class="fas fa-check"></i> Saved';
    setTimeout(() => {
        if (!isEditing) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-save"></i> Auto';
    }, 1500);
}

function getOrderedVisible() {
    let order = scriptOrder.length > 0 ? scriptOrder : customOrder;
    let ids = [...order.filter(id => scripts[id]), ...Object.keys(scripts).filter(id => !order.includes(id))];
    if (searchTerm) { ids = ids.filter(id => scripts[id].name.toLowerCase().includes(searchTerm.toLowerCase())); }
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
    document.getElementById('activeShortcutHint').innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur + 1}` : `Key: —`;
    if (versionHistory[currentScriptId]) {
        document.getElementById('versionNumber').innerText = `${currentVersionIndex[currentScriptId] + 1}/${versionHistory[currentScriptId].length}`;
    }
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
                if (currentScriptId === id) { document.getElementById('currentScriptName').innerHTML = scripts[id].name; }
                showToast('Renamed', 'success');
            }
        });
    });
    document.querySelectorAll('.delete-script').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (id === 'opening') { showToast('Cannot delete opening', 'error'); return; }
            if (confirm('Delete this script?')) {
                delete scripts[id];
                delete versionHistory[id];
                scriptOrder = scriptOrder.filter(i => i !== id);
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
    const displayContent = scripts[id].content;
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

function copyScript() { copyToClipboard(scripts[currentScriptId].content); }

function resetScript() {
    if (confirm('Reset this script to default?')) {
        const defaultScripts = {
            "opening": { name: "🎯 Opening Script", content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is Flynn. I work with a web design company that helps companies like yours stand out online. We actually created a free, modern preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\"" },
            "owner_yes": { name: "👑 Owner - Yes", content: "✅ Perfect! I'll have my manager Daniel give you a quick call later today to show you the preview. Is this the best number to reach you at? Appreciate your time!" },
            "owner_no": { name: "🤤 Not Owner", content: "❌ Got it — do you usually help with marketing or sales? What's the best time to reach the owner today? I'll have Daniel give them a quick call." },
            "objection_website": { name: "⚠️ Already have a website", content: "Totally understandable. Most businesses we speak with do. This isn't about replacing it immediately — just showing a fresh perspective. Worst case, you get some good ideas." },
            "objection_webguy": { name: "⚠️ Have a web guy", content: "That's great! Many of our clients already have developers. They just like getting a second opinion. No commitment — just worth comparing." },
            "objection_cost": { name: "💰 How much does it cost?", content: "The preview itself is completely free. Daniel would only go over pricing if you actually like what you see. Right now it's just about showing you the concept first." },
            "objection_busy": { name: "🕐 I'm busy", content: "Totally understand — that's why I'm not trying to go through everything now. What's easier for you — later today or tomorrow for a quick 5–10 minute look?" },
            "objection_not_interested": { name: "❌ Not interested", content: "No worries. Just so you know, we already built the preview, so there's nothing to buy. Would it hurt to at least take a quick look?" },
            "objection_info": { name: "📧 Send me info", content: "I definitely can. The only reason I prefer a quick walkthrough is because the preview makes more sense visually. It honestly takes about 5 minutes. What's better — later today or tomorrow?" },
            "objection_found_me": { name: "🔍 How did you find me?", content: "I came across your Google listing while looking at businesses in your area. Your business stood out, so we created a sample concept using public info." },
            "closing": { name: "🏁 Closing Script", content: "Awesome, we're excited to show you the preview! I'll have Daniel give you a quick call [later/tomorrow]. Appreciate your time, Flynn! Talk soon!" }
        };
        if (defaultScripts[currentScriptId]) {
            scripts[currentScriptId] = { ...defaultScripts[currentScriptId] };
            saveVersion(currentScriptId, scripts[currentScriptId].content);
            saveAllScripts();
            loadScript(currentScriptId);
            showToast('Reset complete', 'success');
        } else {
            showToast('No default version available', 'error');
        }
    }
}

function addNewScript() {
    if (isEditing) { showToast('Finish editing first', 'error'); return; }
    const name = prompt('Script name:');
    if (!name) return;
    const id = 'custom_' + generateUniqueId();
    scripts[id] = { name, content: 'Write your script here...' };
    scriptOrder.push(id);
    initVersionHistory(id, scripts[id].content);
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
        html += `<div style="padding:12px; border-bottom:1px solid var(--border-color); cursor:pointer;" data-index="${idx}">
            ${new Date(v.timestamp).toLocaleString()} ${idx === currentVersionIndex[currentScriptId] ? '✓ Current' : 'Restore'}
        </div>`;
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
            else if (isEditing && document.getElementById('editTextarea')) {
                document.getElementById('editTextarea').value = scripts[currentScriptId].content;
            }
            showToast('Restored', 'success');
            modal.remove();
        });
    });
    document.getElementById('closeHistBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ================================================================
// SMART IMPORT
// ================================================================

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
        if (result.time.toLowerCase().includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            result.parsedDate = formatToLocalDateStr(tomorrow);
        } else if (result.time.toLowerCase().includes('today')) {
            result.parsedDate = getTodayStr();
        }
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
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-magic"></i> Smart Appointment Import</h3>
        <p style="margin:12px 0; font-size:0.8rem; color:var(--text-muted);">Fill in the CRM link below, select tags, then paste appointment details.</p>
        <div class="form-group"><label for="crmLinkInput">🔗 CRM Link (Optional)</label><input type="url" id="crmLinkInput" class="crm-link-input" placeholder="https://yourcrm.com/lead/..."></div>
        <div class="form-group"><label>🏷️ Select Tags (Optional)</label><div class="tag-selector" id="tagSelector">${tagOptionsHtml}</div></div>
        <div class="form-group"><label for="smartDateInput">📅 Date</label><input type="date" id="smartDateInput" value="${getTodayStr()}"></div>
        <div class="form-group"><label for="smartTextArea">📝 Paste Details</label><textarea id="smartTextArea" rows="5" placeholder="Example:\nBusiness name: FINAL TOUCH ELECTRIC\nName: Constance\nRole: Owner\nPhone: +18775965698\nTime: Tomorrow at 9am CT\nNote: No website yet.\n@Daniel"></textarea></div>
        <div id="smartPreview" style="background:var(--bg-primary); border-radius:16px; padding:16px; margin:16px 0; display:none;"><strong><i class="fas fa-eye"></i> Preview:</strong><div id="smartPreviewContent"></div></div>
        <div style="display:flex; gap:12px; justify-content:flex-end;"><button id="smartParseBtn" class="btn-icon"><i class="fas fa-search"></i> Parse</button><button id="smartSaveBtn" class="btn-icon" style="background:var(--success); color:white;"><i class="fas fa-save"></i> Save</button><button id="smartCancelBtn" class="btn-icon"><i class="fas fa-times"></i> Cancel</button></div></div>`;
    document.body.appendChild(modal);
    let currentParsed = null;
    document.getElementById('smartParseBtn').addEventListener('click', () => {
        const text = document.getElementById('smartTextArea').value;
        const date = document.getElementById('smartDateInput').value;
        if (!text.trim()) { showToast('Enter details', 'error'); return; }
        currentParsed = parseAppointmentFromText(text, date);
        const crmLink = document.getElementById('crmLinkInput').value;
        const selectedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.value);
        document.getElementById('smartPreviewContent').innerHTML = `<div style="margin-top:8px;">
            <div><strong>📅 Date:</strong> ${currentParsed.finalDate}</div>
            <div><strong>🏢 Business:</strong> ${escapeHtml(currentParsed.business || '—')}</div>
            <div><strong>👤 Contact:</strong> ${escapeHtml(currentParsed.contactName || '—')}</div>
            <div><strong>💼 Role:</strong> ${escapeHtml(currentParsed.role || '—')}</div>
            <div><strong>📞 Phone:</strong> ${escapeHtml(currentParsed.phone || '—')}</div>
            <div><strong>🕐 Time:</strong> ${escapeHtml(currentParsed.time || '—')}</div>
            <div><strong>🔗 CRM Link:</strong> ${crmLink ? `<a href="${crmLink}" target="_blank" style="color:var(--primary);">${escapeHtml(crmLink)}</a>` : '—'}</div>
            <div><strong>🏷️ Tags:</strong> ${selectedTags.map(t => TAG_OPTIONS.find(opt => opt.id === t)?.name || t).join(', ') || '—'}</div>
            <div><strong>👨‍💼 Assigned:</strong> ${escapeHtml(currentParsed.assigned || 'Daniel')}</div>
            <div><strong>📝 Notes:</strong> ${escapeHtml(currentParsed.notes || '—')}</div>
        </div>`;
        document.getElementById('smartPreview').style.display = 'block';
        if (!currentParsed.business || !currentParsed.contactName) {
            showToast('Warning: Business or Contact not detected', 'error');
        } else { showToast('Ready to save!', 'success'); }
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

// ================================================================
// BULK ACTIONS
// ================================================================

function openBulkActionsModal() {
    const modal = document.getElementById('bulkActionsModal');
    const container = document.getElementById('bulkSelectionContainer');
    if (!modal || !container) return;
    let allAppointments = [];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => allAppointments.push({ ...a, date }));
        }
    }
    if (allAppointments.length === 0) { showToast('No appointments to select', 'info'); return; }
    let html = `<div style="margin-bottom:12px;">
        <button class="btn-icon" id="selectAllBtn" style="font-size:0.8rem;">Select All</button>
        <button class="btn-icon" id="deselectAllBtn" style="font-size:0.8rem;">Deselect All</button>
        <span style="margin-left:12px; font-size:0.8rem; color:var(--text-muted);"><span class="bulk-count">${selectedAppointments.size} selected</span></span>
    </div>`;
    allAppointments.forEach(appt => {
        const checked = selectedAppointments.has(appt.id.toString()) ? 'checked' : '';
        html += `<div class="bulk-item">
            <input type="checkbox" class="bulk-checkbox-item" data-id="${appt.id}" ${checked} />
            <span><strong>${escapeHtml(appt.business)}</strong> - ${escapeHtml(appt.contactName)}</span>
            <span style="margin-left:auto; font-size:0.8rem; color:var(--text-muted);">${formatDate(appt.date)}</span>
        </div>`;
    });
    container.innerHTML = html;
    modal.style.display = 'flex';
    document.querySelectorAll('.bulk-checkbox-item').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            if (e.target.checked) { selectedAppointments.add(id); } else { selectedAppointments.delete(id); }
            updateBulkSelectionCount();
        });
    });
    document.getElementById('selectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.bulk-checkbox-item').forEach(cb => {
            cb.checked = true;
            const id = cb.getAttribute('data-id');
            selectedAppointments.add(id);
        });
        updateBulkSelectionCount();
    });
    document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.bulk-checkbox-item').forEach(cb => {
            cb.checked = false;
            const id = cb.getAttribute('data-id');
            selectedAppointments.delete(id);
        });
        updateBulkSelectionCount();
    });
    const actionSelect = document.getElementById('bulkActionSelect');
    if (actionSelect) {
        actionSelect.dispatchEvent(new Event('change'));
    }
}

function updateBulkSelectionCount() {
    const count = selectedAppointments.size;
    const containers = document.querySelectorAll('.bulk-count');
    containers.forEach(el => {
        el.textContent = `${count} selected`;
    });
}

function executeBulkAction() {
    if (selectedAppointments.size === 0) { showToast('No appointments selected', 'error'); return; }
    const action = document.getElementById('bulkActionSelect').value;
    const ids = Array.from(selectedAppointments).map(id => id.toString());
    let count = 0;
    switch(action) {
        case 'status': {
            const newStatus = document.getElementById('bulkStatusSelect').value;
            for (let date in appointments) {
                if (appointments[date].reports) {
                    appointments[date].reports.forEach(appt => {
                        if (ids.includes(appt.id.toString())) {
                            appt.status = newStatus;
                            syncAppointment(appt);
                            count++;
                        }
                    });
                }
            }
            showToast(`Updated ${count} appointments to ${newStatus}`, 'success');
            break;
        }
        case 'tag': {
            const tag = document.getElementById('bulkTagSelect').value;
            for (let date in appointments) {
                if (appointments[date].reports) {
                    appointments[date].reports.forEach(appt => {
                        if (ids.includes(appt.id.toString())) {
                            if (!appt.tags) appt.tags = [];
                            if (!appt.tags.includes(tag)) {
                                appt.tags.push(tag);
                                syncAppointment(appt);
                                count++;
                            }
                        }
                    });
                }
            }
            const tagName = TAG_OPTIONS.find(t => t.id === tag)?.name || tag;
            showToast(`Added "${tagName}" tag to ${count} appointments`, 'success');
            break;
        }
        case 'delete': {
            if (!confirm(`Delete ${ids.length} selected appointments?`)) return;
            for (let date in appointments) {
                if (appointments[date].reports) {
                    appointments[date].reports = appointments[date].reports.filter(appt => {
                        if (ids.includes(appt.id.toString())) {
                            deleteAppointmentRemote(appt.id);
                            count++;
                            return false;
                        }
                        return true;
                    });
                    if (appointments[date].reports.length === 0) { delete appointments[date]; } else {
                        appointments[date].count = appointments[date].reports.length;
                    }
                }
            }
            selectedAppointments.clear();
            showToast(`Deleted ${count} appointments`, 'info');
            break;
        }
        case 'export': { exportSelectedCSV(ids); return; }
    }
    saveAppointments();
    selectedAppointments.clear();
    document.getElementById('bulkActionsModal').style.display = 'none';
    refreshCurrentView();
    updateStats();
}

function exportSelectedCSV(ids) {
    let rows = [['Date', 'Business', 'Contact', 'Role', 'Phone', 'Time', 'Status', 'Tags', 'CRM Link', 'Notes', 'Assigned', 'Lead Score']];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => {
                if (ids.includes(a.id.toString())) {
                    const score = calculateLeadScore(a);
                    rows.push([date, a.business, a.contactName, a.role || '', a.phone || '', a.time || '', getStatus(a), (a.tags || []).map(t => TAG_OPTIONS.find(opt => opt.id === t)?.name || t).join(', '), a.crmLink || '', a.notes || '', a.assigned || '', score]);
                }
            });
        }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `selected_appointments_${getTodayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Exported ${ids.length} appointments`, 'success');
    document.getElementById('bulkActionsModal').style.display = 'none';
    selectedAppointments.clear();
}

// ================================================================
// CSV IMPORT
// ================================================================

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) { showToast('CSV must contain headers and at least one row', 'error'); return; }
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
            let importedCount = 0, errorCount = 0;
            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = parseCSVRow(lines[i]);
                    if (values.length < Math.max(headerMap.date, headerMap.business, headerMap.contact) + 1) continue;
                    const date = values[headerMap.date]?.trim() || '';
                    const business = values[headerMap.business]?.trim() || '';
                    const contact = values[headerMap.contact]?.trim() || '';
                    if (!date || !business || !contact) { errorCount++; continue; }
                    const formattedDate = formatToLocalDateStr(date);
                    if (!formattedDate) { errorCount++; continue; }
                    const role = values[headerMap.role]?.trim() || 'Owner';
                    const phone = values[headerMap.phone]?.trim() || '';
                    const time = values[headerMap.time]?.trim() || '';
                    let status = values[headerMap.status]?.trim() || 'Warm Call Booked';
                    if (!STATUS_OPTIONS.includes(status)) { status = 'Warm Call Booked'; }
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
                } catch (err) { errorCount++; console.warn('Error importing row:', err); }
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
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
        else { current += char; }
    }
    values.push(current.trim());
    return values;
}

// ================================================================
// CALENDAR & LIST VIEW FUNCTIONS
// ================================================================

function renderCalendarPanel(container) {
    const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let daysHtml = '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(d => daysHtml += `<div class="day-name">${d}</div>`);
    for (let i = 0; i < firstDay; i++) { daysHtml += `<div class="calendar-day empty"></div>`; }
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
    const scoreCounts = { hot: 0, warm: 0, cold: 0 };
    selectedAppts.forEach(a => {
        const s = getStatus(a);
        statusCounts[s] = (statusCounts[s] || 0) + 1;
        const score = calculateLeadScore(a);
        if (score >= 70) scoreCounts.hot++;
        else if (score >= 40) scoreCounts.warm++;
        else scoreCounts.cold++;
    });
    const kpiHtml = `<div class="kpi-row">
        <div class="kpi-card"><div class="kpi-value">${total}</div><div class="kpi-label">Total</div></div>
        <div class="kpi-card"><div class="kpi-value">${statusCounts['Warm Call Booked'] || 0}</div><div class="kpi-label">Warm Call</div></div>
        <div class="kpi-card"><div class="kpi-value">${statusCounts['Meeting Booked'] || 0}</div><div class="kpi-label">Meeting</div></div>
        <div class="kpi-card"><div class="kpi-value">${statusCounts['Held'] || 0}</div><div class="kpi-label">Held</div></div>
        <div class="kpi-card"><div class="kpi-value">${scoreCounts.hot}</div><div class="kpi-label">🔥 Hot Leads</div></div>
        <div class="kpi-card"><div class="kpi-value">${scoreCounts.warm}</div><div class="kpi-label">Warm Leads</div></div>
    </div>`;
    const filtered = filterAndSortAppointments(selectedAppts);
    const listHtml = renderAppointmentsList(filtered, selectedCalDate);
    const toolbarHtml = `<div class="appointments-toolbar">
        <div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="appointmentSearchInput" placeholder="Search appointments..." value="${escapeHtml(currentListSearchTerm)}" /></div>
        <select id="statusFilterSelect"><option value="all" ${currentStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>${STATUS_OPTIONS.map(s => `<option value="${s}" ${currentStatusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select id="tagFilterSelect"><option value="all" ${currentTagFilter === 'all' ? 'selected' : ''}>All Tags</option>${TAG_OPTIONS.map(t => `<option value="${t.id}" ${currentTagFilter === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
        <select id="sortSelect"><option value="time" ${currentSort === 'time' ? 'selected' : ''}>Sort by Time</option><option value="status" ${currentSort === 'status' ? 'selected' : ''}>Sort by Status</option><option value="name" ${currentSort === 'name' ? 'selected' : ''}>Sort by Name</option><option value="score" ${currentSort === 'score' ? 'selected' : ''}>Sort by Lead Score</option></select>
        <button class="action-icon-btn" id="quickAddFromCalendar"><i class="fas fa-plus"></i> Add</button>
        <button class="action-icon-btn" id="smartAddFromCalendar"><i class="fas fa-magic"></i> Import</button>
        <button class="action-icon-btn" id="bulkFromCalendar"><i class="fas fa-check-double"></i> Bulk</button>
    </div>`;
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
            <div class="appointments-list" id="appointmentsListContainer">${listHtml}</div>
        </div>
    `;
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
    document.getElementById('bulkFromCalendar')?.addEventListener('click', () => {
        openBulkActionsModal();
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
        case 'time': filtered.sort((a, b) => (a.time || '').localeCompare(b.time || '')); break;
        case 'status': filtered.sort((a, b) => getStatus(a).localeCompare(getStatus(b))); break;
        case 'name': filtered.sort((a, b) => a.business.localeCompare(b.business)); break;
        case 'score': filtered.sort((a, b) => calculateLeadScore(b) - calculateLeadScore(a)); break;
    }
    return filtered;
}

function renderAppointmentsList(appts, dateStr) {
    if (!appts || appts.length === 0) {
        return `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>No appointments for this day</p><button class="btn-icon" id="emptyAddBtn" style="margin-top:12px;"><i class="fas fa-plus"></i> Add Appointment</button></div>`;
    }
    return appts.map(a => {
        const status = getStatus(a);
        const score = calculateLeadScore(a);
        const scoreLabel = getScoreLabel(score);
        const scoreClass = getScoreColor(score);
        const tagsDisplay = getTagDisplay(a.tags);
        const hasCrmLink = a.crmLink && a.crmLink.trim() !== '';
        const isSelected = selectedAppointments.has(a.id.toString());
        return `<div class="appointment-card" draggable="true" data-id="${a.id}" data-date="${dateStr}">
            <div class="card-row">
                <div class="business-name">
                    <input type="checkbox" class="bulk-checkbox" data-id="${a.id}" ${isSelected ? 'checked' : ''} />
                    <i class="fas fa-building"></i> ${escapeHtml(a.business)}
                    <span class="status-tag ${getStatusClassSmall(status)}">${escapeHtml(status)}</span>
                    <span class="score-badge ${scoreClass}">${scoreLabel} (${score})</span>
                </div>
                <div class="card-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
                    <span class="drag-handle"><i class="fas fa-grip-lines"></i></span>
                    <button class="action-icon-btn copy-btn" data-id="${a.id}" data-date="${dateStr}" title="Copy" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-icon-btn edit-btn" data-id="${a.id}" data-date="${dateStr}" title="Edit" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-icon-btn danger delete-btn" data-id="${a.id}" data-date="${dateStr}" title="Delete" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                        <i class="fas fa-trash"></i>
                    </button>
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
            <div style="display:flex; gap:8px; align-items:center; margin-top:4px; flex-wrap:wrap;">
                <select class="status-select-calendar" data-id="${a.id}" data-date="${dateStr}" style="padding:4px 8px; border-radius:20px; font-size:0.7rem; background:var(--bg-primary); border:1px solid var(--border-color);">
                    ${STATUS_OPTIONS.map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <button class="action-icon-btn add-task-btn" data-id="${a.id}" data-date="${dateStr}" title="Add Task" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                    <i class="fas fa-plus-circle"></i> Task
                </button>
                ${getTasksForAppointment(a.id).length > 0 ? `<span style="font-size:0.7rem; color:var(--text-muted);">${getTasksForAppointment(a.id).filter(t => !t.completed).length} pending tasks</span>` : ''}
            </div>
        </div>`;
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
            const apptId = data.id, oldDate = data.oldDate;
            if (oldDate === newDate) return;
            const appt = appointments[oldDate]?.reports?.find(r => r.id.toString() === apptId.toString());
            if (appt) {
                deleteAppointment(oldDate, apptId, true);
                addAppointment(newDate, appt.business, appt.contactName, appt.role, appt.phone, appt.time, appt.notes, appt.assigned, appt.id, appt.status, appt.crmLink, appt.tags);
                showToast(`Moved "${appt.business}" to ${newDate}`, 'success');
                refreshCurrentView();
            }
        });
    });
}

// ================================================================
// DELEGATED EVENT LISTENERS
// ================================================================

function setupDelegatedEventListeners() {
    const container = document.getElementById('appointmentsListContainer');
    if (!container) return;
    container.removeEventListener('click', handleDelegatedClick);
    container.removeEventListener('change', handleDelegatedChange);
    container.addEventListener('click', handleDelegatedClick);
    container.addEventListener('change', handleDelegatedChange);
}

function handleDelegatedClick(e) {
    if (e.target.classList.contains('bulk-checkbox')) {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) { selectedAppointments.add(id); } else { selectedAppointments.delete(id); }
        return;
    }
    const target = e.target.closest('button');
    if (!target) return;
    if (target.classList.contains('copy-btn')) {
        e.preventDefault(); e.stopPropagation();
        const id = target.getAttribute('data-id');
        const date = target.getAttribute('data-date');
        const appt = appointments[date]?.reports?.find(r => r.id.toString() === id.toString());
        if (appt) {
            copyToClipboard(appt.fullText);
            showToast('Copied!', 'success');
        } else {
            for (let d in appointments) {
                const found = appointments[d]?.reports?.find(r => r.id.toString() === id.toString());
                if (found) { copyToClipboard(found.fullText); showToast('Copied!', 'success'); break; }
            }
        }
        return;
    }
    if (target.classList.contains('edit-btn')) {
        e.preventDefault(); e.stopPropagation();
        const id = target.getAttribute('data-id');
        const date = target.getAttribute('data-date');
        const appt = appointments[date]?.reports?.find(r => r.id.toString() === id.toString());
        if (appt) { openEditAppointmentModal(date, appt); } else { showToast('Appointment not found', 'error'); }
        return;
    }
    if (target.classList.contains('delete-btn')) {
        e.preventDefault(); e.stopPropagation();
        const id = target.getAttribute('data-id');
        const date = target.getAttribute('data-date');
        if (confirm('Delete this appointment?')) {
            deleteAppointment(date, id);
            showToast('Deleted', 'info');
            refreshCurrentView();
        }
        return;
    }
    if (target.classList.contains('add-task-btn')) {
        e.preventDefault(); e.stopPropagation();
        const id = target.getAttribute('data-id');
        const date = target.getAttribute('data-date');
        const appt = appointments[date]?.reports?.find(r => r.id.toString() === id.toString());
        if (appt) { openAddTaskModalWithAppointment(appt); }
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
        const id = target.getAttribute('data-id');
        const date = target.getAttribute('data-date');
        const newStatus = target.value;
        const idx = appointments[date]?.reports?.findIndex(r => r.id.toString() === id.toString());
        if (idx !== -1 && appointments[date]) {
            appointments[date].reports[idx].status = newStatus;
            syncAppointment(appointments[date].reports[idx]);
            showToast(`Status updated to ${newStatus}`, 'info');
            refreshCurrentView();
        }
    }
}

// ================================================================
// TASK MODALS
// ================================================================

function openAddTaskModalWithAppointment(appt) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
        <h3><i class="fas fa-plus-circle"></i> Add Task for ${escapeHtml(appt.business)}</h3>
        <div class="form-group"><label for="taskDescriptionInput">Task Description *</label><input type="text" id="taskDescriptionInput" placeholder="What needs to be done?" value="Follow up with ${escapeHtml(appt.business)}" /></div>
        <div class="form-group"><label for="taskDueDateInput">Due Date</label><input type="date" id="taskDueDateInput" /></div>
        <div class="form-group"><label for="taskPrioritySelect">Priority</label><select id="taskPrioritySelect"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
        <div style="display:flex; gap:12px; justify-content:flex-end;"><button id="saveTaskBtn" class="btn-icon" style="background:var(--success); color:white;">Save</button><button id="cancelTaskBtn" class="btn-icon">Cancel</button></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('saveTaskBtn').addEventListener('click', () => {
        const desc = document.getElementById('taskDescriptionInput').value.trim();
        if (!desc) { showToast('Please enter a description', 'error'); return; }
        const dueDate = document.getElementById('taskDueDateInput').value || null;
        const priority = document.getElementById('taskPrioritySelect').value;
        addTask(desc, dueDate, priority, appt.id);
        modal.remove();
        showToast('Task added!', 'success');
        refreshCurrentView();
    });
    document.getElementById('cancelTaskBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ================================================================
// EDIT MODAL
// ================================================================

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
        <div class="form-group"><label for="editDateInput">Date</label><input type="date" id="editDateInput" value="${dateStr}"></div>
        <div class="form-group"><label for="editBusinessInput">Business *</label><input id="editBusinessInput" value="${escapeHtml(appt.business)}"></div>
        <div class="form-group"><label for="editNameInput">Contact *</label><input id="editNameInput" value="${escapeHtml(appt.contactName)}"></div>
        <div class="form-group"><label for="editRoleInput">Role</label><input id="editRoleInput" value="${escapeHtml(appt.role || '')}"></div>
        <div class="form-group"><label for="editPhoneInput">Phone</label><input id="editPhoneInput" value="${escapeHtml(appt.phone || '')}"></div>
        <div class="form-group"><label for="editTimeInput">Time</label><input id="editTimeInput" value="${escapeHtml(appt.time || '')}"></div>
        <div class="form-group"><label for="editStatusSelect">Status</label><select id="editStatusSelect">${STATUS_OPTIONS.map(s => `<option value="${s}" ${getStatus(appt) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>🏷️ Tags</label><div class="tag-selector" id="editTagSelector">${tagOptionsHtml}</div></div>
        <div class="form-group"><label for="editCrmLinkInput">CRM Link</label><input id="editCrmLinkInput" value="${escapeHtml(appt.crmLink || '')}" placeholder="https://..."></div>
        <div class="form-group"><label for="editNotesArea">Notes</label><textarea id="editNotesArea" rows="3">${escapeHtml(appt.notes || '')}</textarea></div>
        <div class="form-group"><label for="editAssignedInput">Assigned</label><input id="editAssignedInput" value="${escapeHtml(appt.assigned || 'Daniel')}"></div>
        <div style="display:flex; gap:12px; justify-content:flex-end;"><button id="saveEditBtn" class="btn-icon" style="background:var(--success); color:white;">Save</button><button id="cancelEditBtn" class="btn-icon">Cancel</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('saveEditBtn').addEventListener('click', () => {
        const newDate = document.getElementById('editDateInput').value;
        if (!document.getElementById('editBusinessInput').value || !document.getElementById('editNameInput').value) { showToast('Business and Contact required', 'error'); return; }
        const selectedTags = Array.from(document.querySelectorAll('.edit-tag-checkbox:checked')).map(cb => cb.value);
        deleteAppointment(dateStr, appt.id, true);
        addAppointment(newDate, document.getElementById('editBusinessInput').value, document.getElementById('editNameInput').value,
            document.getElementById('editRoleInput').value, document.getElementById('editPhoneInput').value, document.getElementById('editTimeInput').value,
            document.getElementById('editNotesArea').value, document.getElementById('editAssignedInput').value, appt.id,
            document.getElementById('editStatusSelect').value, document.getElementById('editCrmLinkInput').value, selectedTags);
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
        <div class="form-group"><label for="reportDateInput">Date</label><input type="date" id="reportDateInput" value="${defaultDate}"></div>
        <div class="form-group"><label for="reportBusinessInput">Business *</label><input id="reportBusinessInput"></div>
        <div class="form-group"><label for="reportNameInput">Contact *</label><input id="reportNameInput"></div>
        <div class="form-group"><label for="reportRoleSelect">Role</label><select id="reportRoleSelect"><option>Owner</option><option>Manager</option><option>Director</option></select></div>
        <div class="form-group"><label for="reportPhoneInput">Phone</label><input id="reportPhoneInput"></div>
        <div class="form-group"><label for="reportTimeInput">Time</label><input id="reportTimeInput"></div>
        <div class="form-group"><label for="reportStatusSelect">Status</label><select id="reportStatusSelect">${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>🏷️ Tags</label><div class="tag-selector" id="quickTagSelector">${tagOptionsHtml}</div></div>
        <div class="form-group"><label for="reportCrmLinkInput">CRM Link</label><input id="reportCrmLinkInput" placeholder="https://..."></div>
        <div class="form-group"><label for="reportNotesArea">Notes</label><textarea id="reportNotesArea" rows="2"></textarea></div>
        <div class="form-group"><label for="reportAssignedInput">Assigned</label><input id="reportAssignedInput" value="Daniel"></div>
        <div style="display:flex; gap:12px;"><button id="submitReportBtn" class="btn-icon" style="background:var(--success);color:white;">Save</button><button id="closeReportBtn" class="btn-icon">Cancel</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('submitReportBtn').addEventListener('click', () => {
        const bus = document.getElementById('reportBusinessInput').value, name = document.getElementById('reportNameInput').value;
        if (!bus || !name) { showToast('Required fields', 'error'); return; }
        const selectedTags = Array.from(document.querySelectorAll('.quick-tag-checkbox:checked')).map(cb => cb.value);
        addAppointment(document.getElementById('reportDateInput').value, bus, name, document.getElementById('reportRoleSelect').value,
            document.getElementById('reportPhoneInput').value, document.getElementById('reportTimeInput').value, document.getElementById('reportNotesArea').value,
            document.getElementById('reportAssignedInput').value, null, document.getElementById('reportStatusSelect').value,
            document.getElementById('reportCrmLinkInput').value, selectedTags);
        modal.remove();
        showToast('Saved!', 'success');
        refreshCurrentView();
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ================================================================
// TASKS PANEL
// ================================================================

function renderTasksPanel(container) {
    let filteredTasks = tasks;
    if (taskFilter === 'pending') { filteredTasks = tasks.filter(t => !t.completed); }
    filteredTasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
    const toolbarHtml = `<div class="tasks-toolbar">
        <div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="taskSearchInput" placeholder="Search tasks..." /></div>
        <button class="action-icon-btn" id="addTaskBtn"><i class="fas fa-plus"></i> New Task</button>
        <button class="action-icon-btn" id="taskRefreshBtn"><i class="fas fa-sync"></i> Refresh</button>
    </div>`;
    const listHtml = `<div class="tasks-list">
        ${filteredTasks.length === 0 ? `<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks found</p><button class="btn-icon" id="emptyAddTaskBtn" style="margin-top:12px;"><i class="fas fa-plus"></i> Add Task</button></div>` :
        filteredTasks.map(task => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
            const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString() && !task.completed;
            const priorityClass = task.priority === 'high' ? 'task-priority-high' : task.priority === 'medium' ? 'task-priority-medium' : 'task-priority-low';
            const statusClass = task.completed ? 'task-completed' : (isOverdue ? 'task-overdue' : (isDueToday ? 'task-due-today' : ''));
            return `<div class="task-card ${statusClass}">
                <div class="task-row">
                    <div class="task-title"><i class="fas ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i> ${escapeHtml(task.description)} <span class="${priorityClass}">${task.priority.toUpperCase()}</span></div>
                    <div class="task-actions">
                        <button class="action-icon-btn success complete-task" data-id="${task.id}" title="Toggle Complete"><i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i></button>
                        <button class="action-icon-btn delete-task" data-id="${task.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="task-meta">
                    ${task.dueDate ? `<span><i class="fas fa-calendar"></i> Due: ${formatDate(task.dueDate)} ${isOverdue ? '⚠️ Overdue' : ''}</span>` : ''}
                    ${task.appointmentId ? `<span><i class="fas fa-building"></i> Linked to appointment</span>` : ''}
                    <span><i class="fas fa-clock"></i> Created: ${formatDate(task.createdAt)}</span>
                </div>
            </div>`;
        }).join('')}
    </div>`;
    container.innerHTML = `<div class="tasks-section">
        <h4 style="display:flex; align-items:center; gap:8px; margin:0;"><i class="fas fa-tasks"></i> Follow-up Tasks <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">${tasks.filter(t => !t.completed).length} pending</span></h4>
        <div class="kpi-row" style="margin-bottom:16px;">
            <div class="kpi-card"><div class="kpi-value">${tasks.length}</div><div class="kpi-label">Total</div></div>
            <div class="kpi-card"><div class="kpi-value">${tasks.filter(t => !t.completed).length}</div><div class="kpi-label">Pending</div></div>
            <div class="kpi-card"><div class="kpi-value">${tasks.filter(t => t.completed).length}</div><div class="kpi-label">Completed</div></div>
            <div class="kpi-card"><div class="kpi-value">${tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed).length}</div><div class="kpi-label">Overdue</div></div>
        </div>
        ${toolbarHtml}
        ${listHtml}
    </div>`;
    document.getElementById('addTaskBtn')?.addEventListener('click', openAddTaskModal);
    document.getElementById('emptyAddTaskBtn')?.addEventListener('click', openAddTaskModal);
    document.getElementById('taskRefreshBtn')?.addEventListener('click', () => renderTasksPanel(container));
    document.getElementById('taskSearchInput')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.task-card');
        cards.forEach(card => { const text = card.textContent.toLowerCase(); card.style.display = text.includes(term) ? '' : 'none'; });
    });
    container.querySelectorAll('.complete-task').forEach(btn => {
        btn.removeEventListener('click', handleTaskComplete);
        btn.addEventListener('click', handleTaskComplete);
    });
    container.querySelectorAll('.delete-task').forEach(btn => {
        btn.removeEventListener('click', handleTaskDelete);
        btn.addEventListener('click', handleTaskDelete);
    });
}

function handleTaskComplete(e) {
    const id = e.currentTarget.getAttribute('data-id');
    toggleTaskComplete(id);
    refreshCurrentView();
}

function handleTaskDelete(e) {
    const id = e.currentTarget.getAttribute('data-id');
    if (confirm('Delete this task?')) { deleteTask(id); refreshCurrentView(); showToast('Task deleted', 'info'); }
}

function openAddTaskModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
        <h3><i class="fas fa-plus-circle"></i> Add Follow-up Task</h3>
        <div class="form-group"><label for="taskDescriptionInput">Task Description *</label><input type="text" id="taskDescriptionInput" placeholder="What needs to be done?" /></div>
        <div class="form-group"><label for="taskDueDateInput">Due Date</label><input type="date" id="taskDueDateInput" /></div>
        <div class="form-group"><label for="taskPrioritySelect">Priority</label><select id="taskPrioritySelect"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
        <div class="form-group"><label for="taskAppointmentSelect">Link to Appointment (Optional)</label><select id="taskAppointmentSelect"><option value="">None</option></select></div>
        <div style="display:flex; gap:12px; justify-content:flex-end;"><button id="saveTaskBtn" class="btn-icon" style="background:var(--success); color:white;">Save</button><button id="cancelTaskBtn" class="btn-icon">Cancel</button></div>
    </div>`;
    document.body.appendChild(modal);
    const select = document.getElementById('taskAppointmentSelect');
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(appt => {
                const option = document.createElement('option');
                option.value = appt.id;
                option.textContent = `${appt.business} - ${appt.contactName}`;
                select.appendChild(option);
            });
        }
    }
    document.getElementById('saveTaskBtn').addEventListener('click', () => {
        const desc = document.getElementById('taskDescriptionInput').value.trim();
        if (!desc) { showToast('Please enter a description', 'error'); return; }
        const dueDate = document.getElementById('taskDueDateInput').value || null;
        const priority = document.getElementById('taskPrioritySelect').value;
        const appointmentId = document.getElementById('taskAppointmentSelect').value ? document.getElementById('taskAppointmentSelect').value : null;
        addTask(desc, dueDate, priority, appointmentId);
        modal.remove();
        showToast('Task added!', 'success');
        refreshCurrentView();
    });
    document.getElementById('cancelTaskBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ================================================================
// LIST VIEW
// ================================================================

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
    container.innerHTML = `<div class="appointments-toolbar">
        <div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="listSearchInput" placeholder="Search all..." value="${escapeHtml(currentListSearchTerm)}" /></div>
        <select id="listStatusFilter"><option value="all" ${currentStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>${STATUS_OPTIONS.map(s => `<option value="${s}" ${currentStatusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select id="listTagFilter"><option value="all" ${currentTagFilter === 'all' ? 'selected' : ''}>All Tags</option>${TAG_OPTIONS.map(t => `<option value="${t.id}" ${currentTagFilter === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
        <button class="action-icon-btn" id="listSmartImport"><i class="fas fa-magic"></i> Import</button>
        <button class="action-icon-btn" id="listBulkBtn"><i class="fas fa-check-double"></i> Bulk</button>
    </div>
    <div class="appointments-list" id="appointmentsListContainer">
        ${filtered.length === 0 ? `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>No appointments found</p></div>` :
        filtered.map(a => `<div class="appointment-card">
            <div class="card-row">
                <div class="business-name">
                    <input type="checkbox" class="bulk-checkbox" data-id="${a.id}" ${selectedAppointments.has(a.id.toString()) ? 'checked' : ''} />
                    <i class="fas fa-building"></i> ${escapeHtml(a.business)} 
                    <span class="status-tag ${getStatusClassSmall(getStatus(a))}">${escapeHtml(getStatus(a))}</span>
                    <span class="score-badge ${getScoreColor(calculateLeadScore(a))}">${getScoreLabel(calculateLeadScore(a))} (${calculateLeadScore(a)})</span>
                </div>
                <div class="card-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="action-icon-btn copy-btn" data-id="${a.id}" data-date="${a.date}" title="Copy" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-icon-btn edit-btn" data-id="${a.id}" data-date="${a.date}" title="Edit" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-icon-btn danger delete-btn" data-id="${a.id}" data-date="${a.date}" title="Delete" style="padding:4px 10px; border-radius:8px; background:var(--bg-primary); border:none; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s; color:var(--text-secondary);">
                        <i class="fas fa-trash"></i>
                    </button>
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
        </div>`).join('')}
    </div>`;
    document.getElementById('listSearchInput')?.addEventListener('input', (e) => { currentListSearchTerm = e.target.value; renderListView(container); });
    document.getElementById('listStatusFilter')?.addEventListener('change', (e) => { currentStatusFilter = e.target.value; renderListView(container); });
    document.getElementById('listTagFilter')?.addEventListener('change', (e) => { currentTagFilter = e.target.value; renderListView(container); });
    document.getElementById('listSmartImport')?.addEventListener('click', () => { hideFeaturePanel(); setTimeout(openSmartAddModal, 100); });
    document.getElementById('listBulkBtn')?.addEventListener('click', openBulkActionsModal);
    setupDelegatedEventListeners();
}

// ================================================================
// ANALYTICS HUB
// ================================================================

function renderAnalyticsHub(container) {
    const tabHtml = `<div class="analytics-container">
        <div class="analytics-tabs">
            <button class="analytics-tab ${currentAnalyticsTab === 'insights' ? 'active' : ''}" data-tab="insights"><i class="fas fa-chart-pie"></i> Insights Dashboard</button>
            <button class="analytics-tab ${currentAnalyticsTab === 'reports' ? 'active' : ''}" data-tab="reports"><i class="fas fa-chart-line"></i> Advanced Reports</button>
        </div>
        <div class="analytics-content">
            <div class="analytics-panel ${currentAnalyticsTab === 'insights' ? 'active' : ''}" id="insightsPanel"></div>
            <div class="analytics-panel ${currentAnalyticsTab === 'reports' ? 'active' : ''}" id="reportsPanel"></div>
        </div>
    </div>`;
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
    const startDate = new Date(dashboardDateRange.start.replace(/-/g, '/')), endDate = new Date(dashboardDateRange.end.replace(/-/g, '/'));
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const chartLabels = [], chartData = [];
    for (let i = 0; i < daysDiff; i++) { const d = new Date(startDate); d.setDate(startDate.getDate() + i); const dateStr = formatToLocalDateStr(d); chartLabels.push(formatDateShort(dateStr)); chartData.push(appointments[dateStr]?.reports?.length || 0); }
    const assignedStats = {}, roleStats = {}, statusStats = {}, tagStats = {}, scoreDistribution = { hot: 0, warm: 0, cold: 0 };
    appointmentsInRange.forEach(a => {
        const assigned = a.assigned || 'Unassigned';
        assignedStats[assigned] = (assignedStats[assigned] || 0) + 1;
        const score = calculateLeadScore(a);
        if (score >= 70) scoreDistribution.hot++;
        else if (score >= 40) scoreDistribution.warm++;
        else scoreDistribution.cold++;
    });
    appointmentsInRange.forEach(a => { const role = a.role || 'Other'; roleStats[role] = (roleStats[role] || 0) + 1; });
    appointmentsInRange.forEach(a => { const s = getStatus(a); statusStats[s] = (statusStats[s] || 0) + 1; });
    appointmentsInRange.forEach(a => { if (a.tags) { a.tags.forEach(tag => { tagStats[tag] = (tagStats[tag] || 0) + 1; }); } });
    container.innerHTML = `<div class="insights-header">
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
    <div class="feature-card"><h4><i class="fas fa-fire"></i> Lead Score Distribution</h4><div class="distribution-list">
        <div class="distribution-item"><span>🔥 Hot (70-100)</span><span>${scoreDistribution.hot}</span></div>
        <div class="distribution-item"><span>Warm (40-69)</span><span>${scoreDistribution.warm}</span></div>
        <div class="distribution-item"><span>❄️ Cold (0-39)</span><span>${scoreDistribution.cold}</span></div>
    </div></div>
    <div class="feature-card"><h4><i class="fas fa-tags"></i> Tag Distribution</h4><div class="distribution-list">${Object.entries(tagStats).map(([t, c]) => `<div class="distribution-item"><span><i class="fas fa-tag"></i> ${TAG_OPTIONS.find(opt => opt.id === t)?.name || t}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
    <div class="feature-card"><h4><i class="fas fa-bullseye"></i> Goal Progress</h4>
        <div class="goal-progress-item"><div class="goal-progress-label"><span>Daily</span><span>${getTodayCount()}/${goals.daily}</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, (getTodayCount() / goals.daily) * 100)}%; background:var(--primary);"></div></div></div>
        <div class="goal-progress-item"><div class="goal-progress-label"><span>Weekly</span><span>${getWeekCount()}/${goals.weekly}</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, (getWeekCount() / goals.weekly) * 100)}%; background:var(--success);"></div></div></div>
        <div class="goal-progress-item"><div class="goal-progress-label"><span>Monthly</span><span>${getMonthCount()}/${goals.monthly}</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, (getMonthCount() / goals.monthly) * 100)}%; background:var(--secondary);"></div></div></div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
        <div class="feature-card"><h4><i class="fas fa-users"></i> Assignment</h4><div class="distribution-list">${Object.entries(assignedStats).map(([n, c]) => `<div class="distribution-item"><span><i class="fas fa-user"></i> ${escapeHtml(n)}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
        <div class="feature-card"><h4><i class="fas fa-briefcase"></i> Roles</h4><div class="distribution-list">${Object.entries(roleStats).map(([r, c]) => `<div class="distribution-item"><span><i class="fas fa-tag"></i> ${escapeHtml(r)}</span><span>${c}</span></div>`).join('') || 'No data'}</div></div>
    </div>`;
    const ctx = document.getElementById('insightsChartCanvas');
    if (ctx) {
        if (featureChartInstance) featureChartInstance.destroy();
        featureChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: chartLabels, datasets: [{ label: 'Appointments', data: chartData, backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 8 }] },
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
    const startDateStr = formatToLocalDateStr(startDate);
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
    const avgScore = appointmentsInRange.reduce((sum, a) => sum + calculateLeadScore(a), 0) / (appointmentsInRange.length || 1);
    const hotLeads = appointmentsInRange.filter(a => calculateLeadScore(a) >= 70).length;
    const last7Days = [], trendData = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dateStr = formatToLocalDateStr(d); last7Days.push(formatDateShort(dateStr)); trendData.push(appointments[dateStr]?.reports?.length || 0); }
    container.innerHTML = `<div class="reports-container">
        <div class="report-section">
            <div class="report-header"><h3><i class="fas fa-chart-line"></i> Performance Summary (Last 30 Days)</h3><button id="exportPDFBtn" class="btn-icon"><i class="fas fa-file-pdf"></i> Export PDF</button></div>
            <div class="report-content" id="reportContent">
                <div class="report-metrics">
                    <div class="metric-card"><div class="metric-value">${total}</div><div class="metric-label">Total Appointments</div></div>
                    <div class="metric-card"><div class="metric-value">${uniqueBusinesses}</div><div class="metric-label">Unique Businesses</div></div>
                    <div class="metric-card"><div class="metric-value">${conversionRate}%</div><div class="metric-label">Conversion Rate</div></div>
                    <div class="metric-card"><div class="metric-value">${Math.round(avgScore)}</div><div class="metric-label">Avg Lead Score</div></div>
                    <div class="metric-card"><div class="metric-value">${hotLeads}</div><div class="metric-label">🔥 Hot Leads</div></div>
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
    </div>`;
    new Chart(document.getElementById('reportTrendChart'), {
        type: 'line',
        data: { labels: last7Days, datasets: [{ label: 'Appointments', data: trendData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 }] },
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

// ================================================================
// UTILITIES & FEATURE PANEL
// ================================================================

function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('scriptflow_theme_main', document.body.classList.contains('dark') ? 'dark' : 'light');
    showToast(`${document.body.classList.contains('dark') ? 'Dark' : 'Light'} mode`, 'info');
}

function exportToCSV() {
    let rows = [['Date', 'Business', 'Contact', 'Role', 'Phone', 'Time', 'Status', 'Tags', 'CRM Link', 'Notes', 'Assigned', 'Lead Score']];
    for (let date in appointments) {
        if (appointments[date].reports) {
            appointments[date].reports.forEach(a => {
                rows.push([date, a.business, a.contactName, a.role || '', a.phone || '', a.time || '', getStatus(a), (a.tags || []).map(t => TAG_OPTIONS.find(opt => opt.id === t)?.name || t).join(', '), a.crmLink || '', a.notes || '', a.assigned || '', calculateLeadScore(a)]);
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
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-question-circle"></i> ScriptFlow Pro Guide</h3>
        <div style="margin:16px 0;"><strong>📊 Insights Dashboard</strong><br>Analytics and trends with lead scoring</div>
        <div style="margin:16px 0;"><strong>📋 Advanced Reports</strong><br>PDF export, conversion funnel, performance metrics</div>
        <div style="margin:16px 0;"><strong>📅 Drag & Drop Calendar</strong><br>Drag appointments to reschedule</div>
        <div style="margin:16px 0;"><strong>📋 List View</strong><br>Search, filter by status and tags, lead scores</div>
        <div style="margin:16px 0;"><strong>⭐ Lead Scoring</strong><br>Auto-calculated scores based on status, tags, and engagement</div>
        <div style="margin:16px 0;"><strong>📋 Follow-up Tasks</strong><br>Create and manage tasks linked to appointments</div>
        <div style="margin:16px 0;"><strong>✅ Bulk Actions</strong><br>Select multiple appointments and perform bulk operations</div>
        <div style="margin:16px 0;"><strong>✨ Smart Import</strong><br>CRM link field, tag selection, auto-extracts all fields</div>
        <div style="margin:16px 0;"><strong>🏷️ Tags System</strong><br>Qualified Warm Call (Green), Unqualified Warm Callback (Yellow), VIP (Blue), Negligent Warm Callback (Red)</div>
        <div style="margin:16px 0;"><strong>📌 Status Tracking</strong><br>Warm Call Booked, Meeting Booked, Held, Canceled, Rescheduled</div>
        <div style="margin:16px 0;"><strong>🚀 CRM Smart Workspace</strong><br>Tabbed browser, floating panels, quick copy library, command palette</div>
        <button id="closeHelp" class="btn-icon" style="margin-top:16px;">Got it</button>
    </div>`;
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

function showFeaturePanel(featureType, title) {
    const scriptPanel = document.getElementById('scriptPanel');
    const featurePanel = document.getElementById('featurePanel');
    const featureTitle = document.getElementById('featurePanelTitle');
    const featureBody = document.getElementById('featurePanelBody');
    const analyticsTabs = document.getElementById('analyticsTabContainer');
    const calendarTabs = document.getElementById('calendarViewToggle');
    const taskTabs = document.getElementById('taskViewToggle');
    const workspaceTabs = document.getElementById('workspaceViewToggle');
    if (!scriptPanel || !featurePanel) return;
    analyticsTabs.style.display = 'none';
    calendarTabs.style.display = 'none';
    taskTabs.style.display = 'none';
    workspaceTabs.style.display = 'none';
    featureTitle.innerHTML = `<i class="fas ${featureType === 'analytics' ? 'fa-chart-pie' : (featureType === 'calendar' ? 'fa-calendar-alt' : (featureType === 'tasks' ? 'fa-tasks' : 'fa-globe'))}"></i> ${title}`;
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
    } else if (featureType === 'tasks') {
        taskTabs.style.display = 'flex';
        currentView = 'tasks';
        renderTasksPanel(featureBody);
    } else if (featureType === 'smartworkspace') {
        workspaceTabs.style.display = 'flex';
        currentView = 'smartworkspace';
        renderSmartWorkspace(featureBody);
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

function refreshCurrentView() {
    const container = document.getElementById('featurePanelBody');
    if (!container) return;
    if (currentView === 'calendar') { renderCalendarPanel(container); }
    else if (currentView === 'tasks') { renderTasksPanel(container); }
    else if (currentView === 'analytics') { renderAnalyticsHub(container); }
    else if (currentView === 'smartworkspace') { renderSmartWorkspace(container); }
    else { renderListView(container); }
}

// ================================================================
// CRM SMART WORKSPACE - ENHANCED WITH ALL FEATURES
// ================================================================

// Workspace State Management
function loadWorkspaceState() {
    const saved = localStorage.getItem('workspace_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(key => {
                if (workspaceState.hasOwnProperty(key)) {
                    workspaceState[key] = parsed[key];
                }
            });
        } catch (e) {}
    }
}

function saveWorkspaceState() {
    try {
        const state = {
            notes: workspaceState.notes,
            script: workspaceState.script,
            bookmarks: workspaceState.bookmarks,
            clipboardHistory: workspaceState.clipboardHistory,
            quickCopyItems: workspaceState.quickCopyItems
        };
        localStorage.setItem('workspace_state', JSON.stringify(state));
    } catch (e) {}
}

function loadFloatingPanelState() {
    const saved = localStorage.getItem('workspace_floating_panels');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(key => {
                if (workspaceState.panels[key]) {
                    workspaceState.panels[key] = { ...workspaceState.panels[key], ...parsed[key] };
                }
            });
        } catch (e) {}
    }
}

function saveFloatingPanelState() {
    localStorage.setItem('workspace_floating_panels', JSON.stringify(workspaceState.panels));
}

// ================================================================
// RENDER SMART WORKSPACE
// ================================================================

function renderSmartWorkspace(container) {
    if (!container) return;
    
    loadWorkspaceState();
    loadFloatingPanelState();
    
    container.innerHTML = `
        <div class="workspace-container">
            <!-- Workspace Toolbar -->
            <div class="workspace-toolbar">
                <div class="workspace-actions">
                    <button id="wsBackBtn" title="Go Back (Alt+←)"><i class="fas fa-arrow-left"></i></button>
                    <button id="wsForwardBtn" title="Go Forward (Alt+→)"><i class="fas fa-arrow-right"></i></button>
                    <button id="wsReloadBtn" title="Reload (Ctrl+R)"><i class="fas fa-sync"></i></button>
                    <button id="wsHomeBtn" title="Home"><i class="fas fa-home"></i></button>
                </div>
                <div class="url-group">
                    <span class="secure-badge" id="wsSecureBadge">🔒</span>
                    <input type="text" id="wsUrlInput" placeholder="Enter URL or search..." spellcheck="false" autocomplete="off">
                    <button id="wsBookmarkBtn" title="Bookmark (Ctrl+D)"><i class="fas fa-star"></i></button>
                </div>
                <div class="workspace-actions">
                    <button id="wsSplitBtn" title="Split Screen"><i class="fas fa-columns"></i></button>
                    <button id="wsNotepadBtn" title="Notepad (Ctrl+Shift+N)"><i class="fas fa-sticky-note"></i></button>
                    <button id="wsScriptPanelBtn" title="Call Script (Ctrl+Shift+S)"><i class="fas fa-scroll"></i></button>
                    <button id="wsQuickCopyBtn" title="Quick Copy (Ctrl+Shift+C)"><i class="fas fa-copy"></i></button>
                    <button id="wsToggleCalc" title="Calculator"><i class="fas fa-calculator"></i></button>
                    <button id="wsToggleTimer" title="Timer"><i class="fas fa-clock"></i></button>
                    <button id="wsNewTab" title="New Tab (Ctrl+T)"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            
            <!-- Tab Bar -->
            <div class="workspace-tab-bar" id="wsTabBar"></div>
            
            <!-- Workspace Main -->
            <div class="workspace-main" id="wsMainArea">
                <div class="workspace-browser" id="wsBrowserContainer">
                    <div class="loading-overlay" id="wsLoadingOverlay">
                        <div class="spinner"></div>
                        <span class="loading-text">Loading...</span>
                    </div>
                    <div id="wsViewContainer" style="width:100%; height:100%;"></div>
                </div>
                <div class="workspace-sidebar" id="wsSidebar">
                    <div class="workspace-sidebar-header">
                        <h4><i class="fas fa-tools"></i> CRM Tools</h4>
                        <div class="sidebar-actions">
                            <button id="wsSidebarClose" title="Close"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="workspace-sidebar-content">
                        <div class="panel-section">
                            <h5><i class="fas fa-sticky-note"></i> Notes</h5>
                            <textarea id="wsNotesArea" placeholder="Jot down client notes here...">${workspaceState.notes || ''}</textarea>
                            <span style="font-size:10px; color:var(--text-muted); margin-top:4px;">Auto-saved</span>
                        </div>
                        <div class="panel-section">
                            <h5><i class="fas fa-scroll"></i> Sales Script</h5>
                            <textarea id="wsScriptArea" placeholder="Your sales script...">${workspaceState.script || ''}</textarea>
                            <button class="edit-btn" id="wsScriptEditBtn"><i class="fas fa-edit"></i> Edit</button>
                        </div>
                        <div class="panel-section">
                            <h5><i class="fas fa-clock"></i> Recent Notes</h5>
                            <div id="wsRecentNotes" style="font-size:12px; color:var(--text-muted);"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Status -->
            <div class="workspace-status">
                <span id="wsStatusText">✅ Ready</span>
                <span id="wsUrlDisplay">🔗 ${WORKSPACE_CONFIG.HOME_URL}</span>
                <span id="wsTabCount"></span>
            </div>
        </div>
    `;
    
    initEnhancedWorkspace(container);
    renderWorkspaceTabs();
    renderRecentNotes();
    createEnhancedFloatingPanels();
    setupSessionRecovery();
}

// ================================================================
// ENHANCED WORKSPACE INITIALIZATION
// ================================================================

function initEnhancedWorkspace(container) {
    const savedSession = loadWorkspaceSession();
    if (savedSession && savedSession.tabs && savedSession.tabs.length > 0) {
        restoreWorkspaceSession(savedSession);
    } else {
        createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
    }
    
    // Initialize events after DOM is ready
    setTimeout(() => {
        setupEnhancedWorkspaceEvents(container);
    }, 100);
    
    const sidebarState = localStorage.getItem('workspace_sidebar_open');
    const sidebar = document.getElementById('wsSidebar');
    if (sidebar && sidebarState === 'false') {
        sidebar.classList.add('collapsed');
    }
    
    setInterval(saveWorkspaceSession, WORKSPACE_CONFIG.AUTO_SAVE_INTERVAL);
}

// ================================================================
// WORKSPACE TABS
// ================================================================

function renderWorkspaceTabs() {
    const tabBar = document.getElementById('wsTabBar');
    if (!tabBar) return;
    
    tabBar.innerHTML = '';
    workspaceState.tabs.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = `ws-tab ${tab.id === workspaceState.activeTabId ? 'active' : ''}`;
        tabEl.innerHTML = `
            <span class="tab-title">${tab.title || 'Loading...'}</span>
            <span class="tab-close" data-tabid="${tab.id}">✖</span>
        `;
        tabEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                e.stopPropagation();
                closeWorkspaceTab(tab.id);
            } else {
                switchWorkspaceTab(tab.id);
            }
        });
        tabBar.appendChild(tabEl);
    });
    
    const newTabBtn = document.createElement('div');
    newTabBtn.className = 'ws-new-tab';
    newTabBtn.innerHTML = '<i class="fas fa-plus"></i>';
    newTabBtn.addEventListener('click', () => createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true));
    tabBar.appendChild(newTabBtn);
    
    const tabCountEl = document.getElementById('wsTabCount');
    if (tabCountEl) {
        tabCountEl.textContent = `${workspaceState.tabs.length} tabs`;
    }
}

function createWorkspaceTab(url, activate = true) {
    if (workspaceState.tabs.length >= WORKSPACE_CONFIG.MAX_TABS) {
        showToast('Maximum tabs reached', 'error');
        return null;
    }
    
    const id = 'ws_tab_' + (++workspaceState.tabCounter);
    const container = document.getElementById('wsViewContainer');
    
    const viewEl = document.createElement('div');
    viewEl.className = 'webview';
    viewEl.id = `ws_view_${id}`;
    viewEl.style.cssText = 'width:100%; height:100%; display:none; background:#fff;';
    container.appendChild(viewEl);
    
    workspaceState.tabs.push({ id, url, title: 'Loading...' });
    workspaceState.history[id] = [url];
    workspaceState.historyIndex[id] = 0;
    
    if (activate) {
        switchWorkspaceTab(id);
    }
    
    loadWorkspaceUrl(url, id);
    renderWorkspaceTabs();
    saveWorkspaceSession();
    return id;
}

function closeWorkspaceTab(id) {
    const index = workspaceState.tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    
    const viewEl = document.getElementById(`ws_view_${id}`);
    if (viewEl) viewEl.remove();
    
    workspaceState.tabs.splice(index, 1);
    delete workspaceState.history[id];
    delete workspaceState.historyIndex[id];
    
    if (workspaceState.tabs.length === 0) {
        createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
    } else if (workspaceState.activeTabId === id) {
        const newActive = workspaceState.tabs[Math.min(index, workspaceState.tabs.length - 1)];
        switchWorkspaceTab(newActive.id);
    }
    
    renderWorkspaceTabs();
    saveWorkspaceSession();
}

function switchWorkspaceTab(id) {
    workspaceState.activeTabId = id;
    
    document.querySelectorAll('#wsViewContainer .webview').forEach(v => v.style.display = 'none');
    const activeView = document.getElementById(`ws_view_${id}`);
    if (activeView) {
        activeView.style.display = 'block';
    }
    
    const tab = workspaceState.tabs.find(t => t.id === id);
    if (tab) {
        document.getElementById('wsUrlInput').value = tab.url;
        document.getElementById('wsUrlDisplay').textContent = `🔗 ${tab.url}`;
        updateWorkspaceSecureBadge(tab.url);
        updateWorkspaceBookmarkButton(tab.url);
        updateWorkspaceNavButtons();
    }
    
    renderWorkspaceTabs();
}

function loadWorkspaceUrl(input, tabId = workspaceState.activeTabId, addToHistory = true) {
    let finalUrl = input.trim();
    if (!finalUrl || finalUrl === 'about:blank') finalUrl = WORKSPACE_CONFIG.HOME_URL;
    
    try {
        const urlObj = new URL(finalUrl);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            finalUrl = 'https://' + finalUrl;
        }
    } catch (e) {
        if (/^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}/.test(finalUrl)) {
            finalUrl = 'https://' + finalUrl;
        } else {
            finalUrl = WORKSPACE_CONFIG.SEARCH_ENGINE + encodeURIComponent(finalUrl);
        }
    }
    
    const tab = workspaceState.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    tab.url = finalUrl;
    document.getElementById('wsUrlInput').value = finalUrl;
    document.getElementById('wsUrlDisplay').textContent = `🔗 ${finalUrl}`;
    updateWorkspaceSecureBadge(finalUrl);
    updateWorkspaceBookmarkButton(finalUrl);
    
    const overlay = document.getElementById('wsLoadingOverlay');
    if (overlay) overlay.classList.add('active');
    
    fetch('/___browser_api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl })
    })
    .then(res => res.json())
    .then(urlInfo => {
        const viewEl = document.getElementById(`ws_view_${tabId}`);
        if (!viewEl) return;
        
        if (urlInfo.embed) {
            viewEl.innerHTML = `
                <div style="padding:20px; background:var(--bg-primary); height:100%; overflow:auto;">
                    ${urlInfo.embed.html}
                </div>
            `;
            tab.title = urlInfo.type + ' Embed';
            updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
        } else if (['netflix', 'amazon', 'google'].includes(urlInfo.type)) {
            viewEl.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#fff; color:#333; padding:40px; text-align:center;">
                    <h2 style="margin-bottom:16px;">🌐 Opening in New Tab</h2>
                    <p style="margin-bottom:16px; color:#666;">This site blocks iframes. Opening in a new window...</p>
                    <button onclick="window.open('${finalUrl}', '_blank')" style="padding:10px 24px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer;">Open</button>
                </div>
            `;
            tab.title = 'Redirecting...';
            updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
            setTimeout(() => window.open(finalUrl, '_blank'), 500);
        } else {
            fetch('/___browser_api/set-target', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: finalUrl })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    viewEl.innerHTML = `
                        <iframe src="${data.pathname}" 
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals" 
                            style="width:100%; height:100%; border:none; background:#fff;"
                            id="ws_iframe_${tabId}">
                        </iframe>
                    `;
                    const iframe = document.getElementById(`ws_iframe_${tabId}`);
                    iframe.onload = () => {
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            if (doc.title) {
                                tab.title = doc.title;
                                updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
                            }
                        } catch(e) {}
                    };
                    tab.title = new URL(finalUrl).hostname;
                    updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
                } else {
                    viewEl.innerHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#fff; color:#333; padding:40px; text-align:center;">
                            <h2 style="color:var(--danger);">Error</h2>
                            <p style="color:#666;">Invalid URL mapping</p>
                        </div>
                    `;
                    tab.title = 'Error';
                    updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
                }
                finalizeWorkspaceLoad(tabId, finalUrl, addToHistory);
            })
            .catch(() => {
                viewEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#fff; color:#333; padding:40px; text-align:center;">
                        <h2 style="color:var(--danger);">Connection Error</h2>
                        <p style="color:#666;">Could not reach the server</p>
                    </div>
                `;
                tab.title = 'Error';
                updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
                finalizeWorkspaceLoad(tabId, finalUrl, addToHistory);
            });
        }
    })
    .catch(() => {
        const viewEl = document.getElementById(`ws_view_${tabId}`);
        if (viewEl) {
            viewEl.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#fff; color:#333; padding:40px; text-align:center;">
                    <h2 style="color:var(--danger);">Error</h2>
                    <p style="color:#666;">Failed to load page</p>
                </div>
            `;
        }
        tab.title = 'Error';
        updateWorkspaceTabMeta(tabId, finalUrl, tab.title);
        finalizeWorkspaceLoad(tabId, finalUrl, addToHistory);
    });
    
    function finalizeWorkspaceLoad(tabId, finalUrl, addToHistory) {
        const overlay = document.getElementById('wsLoadingOverlay');
        if (overlay) overlay.classList.remove('active');
        
        if (addToHistory && workspaceState.history[tabId]) {
            const history = workspaceState.history[tabId];
            const index = workspaceState.historyIndex[tabId];
            if (history[history.length - 1] !== finalUrl) {
                workspaceState.history[tabId] = history.slice(0, index + 1);
                workspaceState.history[tabId].push(finalUrl);
                workspaceState.historyIndex[tabId] = workspaceState.history[tabId].length - 1;
            }
        }
        
        if (tabId === workspaceState.activeTabId) {
            updateWorkspaceNavButtons();
        }
        renderWorkspaceTabs();
        saveWorkspaceSession();
    }
}

function updateWorkspaceTabMeta(id, url, title) {
    const tab = workspaceState.tabs.find(t => t.id === id);
    if (tab) {
        tab.url = url;
        if (title) tab.title = title;
    }
}

function updateWorkspaceNavButtons() {
    const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
    if (!tab) return;
    
    const history = workspaceState.history[tab.id] || [];
    const index = workspaceState.historyIndex[tab.id] || 0;
    
    const backBtn = document.getElementById('wsBackBtn');
    const forwardBtn = document.getElementById('wsForwardBtn');
    if (backBtn) backBtn.disabled = index <= 0;
    if (forwardBtn) forwardBtn.disabled = index >= history.length - 1;
}

function updateWorkspaceSecureBadge(url) {
    const badge = document.getElementById('wsSecureBadge');
    if (!badge) return;
    if (url.startsWith('https://')) {
        badge.textContent = '🔒';
        badge.style.color = 'var(--success)';
    } else if (url.startsWith('http://')) {
        badge.textContent = '🔓';
        badge.style.color = 'var(--danger)';
    } else {
        badge.textContent = '🔗';
        badge.style.color = '';
    }
}

function updateWorkspaceBookmarkButton(url) {
    const btn = document.getElementById('wsBookmarkBtn');
    if (!btn) return;
    if (workspaceState.bookmarks.includes(url)) {
        btn.style.color = '#ffd700';
    } else {
        btn.style.color = '';
    }
}

function renderRecentNotes() {
    const container = document.getElementById('wsRecentNotes');
    if (!container) return;
    
    const notes = workspaceState.notes || '';
    if (!notes.trim()) {
        container.innerHTML = '<span style="color:var(--text-muted);">No recent notes</span>';
        return;
    }
    
    const lines = notes.split('\n').filter(l => l.trim());
    const recent = lines.slice(-3);
    
    container.innerHTML = recent.map(line => 
        `<div style="padding:4px 0; border-bottom:1px solid var(--border-color); font-size:12px; color:var(--text-secondary);">${escapeHtml(line.substring(0, 80))}${line.length > 80 ? '...' : ''}</div>`
    ).join('');
}

// ================================================================
// SESSION RECOVERY
// ================================================================

function saveWorkspaceSession() {
    try {
        const sessionData = {
            tabs: workspaceState.tabs.map(t => ({
                id: t.id,
                url: t.url,
                title: t.title
            })),
            activeTabId: workspaceState.activeTabId,
            history: workspaceState.history,
            historyIndex: workspaceState.historyIndex,
            timestamp: Date.now()
        };
        localStorage.setItem(WORKSPACE_CONFIG.SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {
        console.warn('Failed to save session:', e);
    }
}

function loadWorkspaceSession() {
    try {
        const data = localStorage.getItem(WORKSPACE_CONFIG.SESSION_KEY);
        if (data) {
            const session = JSON.parse(data);
            if (session.timestamp && (Date.now() - session.timestamp) < 86400000) {
                return session;
            }
        }
    } catch (e) {
        console.warn('Failed to load session:', e);
    }
    return null;
}

function restoreWorkspaceSession(session) {
    workspaceState.tabs = [];
    workspaceState.history = {};
    workspaceState.historyIndex = {};
    
    session.tabs.forEach((tabData, index) => {
        const id = tabData.id || `ws_tab_${++workspaceState.tabCounter}`;
        const container = document.getElementById('wsViewContainer');
        const viewEl = document.createElement('div');
        viewEl.className = 'webview';
        viewEl.id = `ws_view_${id}`;
        viewEl.style.cssText = 'width:100%; height:100%; display:none; background:#fff;';
        container.appendChild(viewEl);
        
        workspaceState.tabs.push({ id, url: tabData.url, title: tabData.title || 'Loading...' });
        workspaceState.history[id] = session.history[id] || [tabData.url];
        workspaceState.historyIndex[id] = session.historyIndex[id] || 0;
        
        if (index === 0 || tabData.id === session.activeTabId) {
            workspaceState.activeTabId = id;
        }
    });
    
    if (workspaceState.activeTabId) {
        switchWorkspaceTab(workspaceState.activeTabId);
    }
    
    renderWorkspaceTabs();
    showSessionRecoveryBanner();
}

function setupSessionRecovery() {
    // Session recovery is handled in initEnhancedWorkspace
}

function showSessionRecoveryBanner() {
    const existingBanner = document.querySelector('.session-recovery-banner');
    if (existingBanner) existingBanner.remove();
    
    const banner = document.createElement('div');
    banner.className = 'session-recovery-banner';
    banner.innerHTML = `
        <span>🔄 Session restored from previous session</span>
        <div class="recovery-actions">
            <button class="recover-btn" onclick="this.closest('.session-recovery-banner').remove()">👍 Got it</button>
            <button class="dismiss-btn" onclick="this.closest('.session-recovery-banner').remove()">Dismiss</button>
        </div>
    `;
    document.body.appendChild(banner);
    
    setTimeout(() => {
        if (banner.parentNode) {
            banner.style.transition = 'opacity 0.5s';
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 500);
        }
    }, 8000);
}

// ================================================================
// SPLIT SCREEN MODE
// ================================================================

function toggleSplitScreen() {
    const container = document.getElementById('wsBrowserContainer');
    if (!container) return;
    
    splitModeActive = !splitModeActive;
    
    if (splitModeActive) {
        const mainArea = document.getElementById('wsMainArea');
        const splitDiv = document.createElement('div');
        splitDiv.className = 'workspace-split';
        splitDiv.id = 'wsSplitContainer';
        
        const browserContent = container.innerHTML;
        container.innerHTML = '';
        
        splitDiv.innerHTML = `
            <div class="split-pane" id="wsSplitPane1">
                ${browserContent}
            </div>
            <div class="split-divider" id="wsSplitDivider"></div>
            <div class="split-pane" id="wsSplitPane2">
                <div class="split-content">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">
                        <i class="fas fa-plus-circle" style="font-size:48px; margin-bottom:16px;"></i>
                        <p>Open a second view</p>
                        <input type="text" id="wsSplitUrlInput" placeholder="Enter URL..." style="width:80%; max-width:400px; padding:8px 16px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary); margin-top:8px;" />
                        <button id="wsSplitLoadBtn" style="margin-top:8px; padding:6px 16px; border-radius:20px; border:none; background:var(--primary); color:white; cursor:pointer;">Load</button>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(splitDiv);
        
        const divider = document.getElementById('wsSplitDivider');
        if (divider) {
            divider.addEventListener('mousedown', startSplitResize);
        }
        
        document.getElementById('wsSplitLoadBtn')?.addEventListener('click', () => {
            const url = document.getElementById('wsSplitUrlInput')?.value;
            if (url) loadSplitContent(url);
        });
        
        document.getElementById('wsSplitUrlInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value;
                if (url) loadSplitContent(url);
            }
        });
        
        const splitBtn = document.getElementById('wsSplitBtn');
        if (splitBtn) splitBtn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        const splitContainer = document.getElementById('wsSplitContainer');
        if (splitContainer) {
            const pane1 = document.getElementById('wsSplitPane1');
            if (pane1) {
                container.innerHTML = pane1.innerHTML;
            }
            splitContainer.remove();
        }
        const splitBtn = document.getElementById('wsSplitBtn');
        if (splitBtn) splitBtn.innerHTML = '<i class="fas fa-columns"></i>';
    }
    
    localStorage.setItem('workspace_split_mode', splitModeActive);
}

function loadSplitContent(url) {
    const pane2 = document.getElementById('wsSplitPane2');
    if (!pane2) return;
    
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
            finalUrl = 'https://' + finalUrl;
        } else {
            finalUrl = WORKSPACE_CONFIG.SEARCH_ENGINE + encodeURIComponent(finalUrl);
        }
    }
    
    fetch('/___browser_api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl })
    })
    .then(res => res.json())
    .then(urlInfo => {
        if (urlInfo.embed) {
            pane2.innerHTML = `
                <div style="padding:20px; background:var(--bg-primary); height:100%; overflow:auto;">
                    ${urlInfo.embed.html}
                </div>
            `;
        } else {
            pane2.innerHTML = `
                <iframe src="${finalUrl}" style="width:100%; height:100%; border:none; background:#fff;"></iframe>
            `;
        }
    })
    .catch(() => {
        pane2.innerHTML = `
            <iframe src="${finalUrl}" style="width:100%; height:100%; border:none; background:#fff;"></iframe>
        `;
    });
}

let splitResizeActive = false;

function startSplitResize(e) {
    splitResizeActive = true;
    const container = document.getElementById('wsSplitContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startWidth = rect.width;
    
    document.addEventListener('mousemove', onSplitResize);
    document.addEventListener('mouseup', stopSplitResize);
    
    function onSplitResize(ev) {
        if (!splitResizeActive) return;
        const delta = ev.clientX - startX;
        const newRatio = Math.min(85, Math.max(15, (startWidth / 2 + delta) / startWidth * 100));
        const pane1 = document.getElementById('wsSplitPane1');
        const pane2 = document.getElementById('wsSplitPane2');
        if (pane1 && pane2) {
            pane1.style.flex = newRatio;
            pane2.style.flex = 100 - newRatio;
        }
    }
    
    function stopSplitResize() {
        splitResizeActive = false;
        document.removeEventListener('mousemove', onSplitResize);
        document.removeEventListener('mouseup', stopSplitResize);
    }
}

// ================================================================
// QUICK COPY LIBRARY - FIXED WITH UNIQUE IDs
// ================================================================

function renderQuickCopyPanel(container) {
    const items = workspaceState.quickCopyItems || [];
    const category = container.dataset.filter || 'all';
    
    let filteredItems = items;
    if (category !== 'all') {
        filteredItems = items.filter(item => item.category === category);
    }
    
    container.innerHTML = `
        <div style="margin-bottom:12px;">
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                <button class="quick-copy-filter active" data-filter="all">All (${items.length})</button>
                <button class="quick-copy-filter" data-filter="email">📧 Email (${items.filter(i => i.category === 'email').length})</button>
                <button class="quick-copy-filter" data-filter="sms">💬 SMS (${items.filter(i => i.category === 'sms').length})</button>
                <button class="quick-copy-filter" data-filter="script">📜 Script (${items.filter(i => i.category === 'script').length})</button>
                <button class="quick-copy-filter" data-filter="response">💡 Response (${items.filter(i => i.category === 'response').length})</button>
            </div>
            <button class="btn-icon" id="addQuickCopyBtn" style="margin-bottom:12px; background:var(--success); color:white;">
                <i class="fas fa-plus"></i> New Template
            </button>
        </div>
        <div id="quickCopyList" style="max-height:400px; overflow-y:auto;">
            ${filteredItems.length === 0 ? 
                '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-copy" style="font-size:32px; display:block; margin-bottom:12px;"></i>No templates yet. Create your first one!</div>' :
                filteredItems.map((item, index) => `
                    <div class="quick-copy-item" data-index="${index}">
                        <div class="copy-content">
                            <div class="copy-title">${escapeHtml(item.name)}</div>
                            <div class="copy-preview">${escapeHtml(item.content.substring(0, 100))}${item.content.length > 100 ? '...' : ''}</div>
                            <span class="quick-copy-badge">${item.category}</span>
                        </div>
                        <div class="copy-actions">
                            <button class="copy-use" title="Use template"><i class="fas fa-copy"></i></button>
                            <button class="copy-delete" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')
            }
        </div>
    `;
    
    container.querySelectorAll('.quick-copy-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.quick-copy-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.dataset.filter = btn.dataset.filter;
            renderQuickCopyPanel(container);
        });
    });
    
    container.querySelector('#addQuickCopyBtn')?.addEventListener('click', () => {
        openAddQuickCopyModal();
    });
    
    container.querySelectorAll('.copy-use').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.closest('.quick-copy-item').dataset.index);
            const item = filteredItems[index];
            if (item) {
                navigator.clipboard.writeText(item.content).then(() => {
                    showToast('Copied to clipboard!', 'success');
                }).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = item.content;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast('Copied to clipboard!', 'success');
                });
            }
        });
    });
    
    container.querySelectorAll('.copy-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.closest('.quick-copy-item').dataset.index);
            const item = filteredItems[index];
            if (item && confirm(`Delete "${item.name}"?`)) {
                const allItems = workspaceState.quickCopyItems || [];
                const realIndex = allItems.findIndex(i => i.id === item.id);
                if (realIndex !== -1) {
                    allItems.splice(realIndex, 1);
                    workspaceState.quickCopyItems = allItems;
                    localStorage.setItem('workspace_quickcopy', JSON.stringify(allItems));
                    renderQuickCopyPanel(container);
                    showToast('Template deleted', 'info');
                }
            }
        });
    });
}

function openAddQuickCopyModal() {
    const modal = document.getElementById('addQuickCopyTemplateModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    document.getElementById('quickCopyNameInput').value = '';
    document.getElementById('quickCopyContentArea').value = '';
    document.getElementById('quickCopyCategorySelect').value = 'email';
    
    document.getElementById('saveQuickCopyBtn').onclick = () => {
        const name = document.getElementById('quickCopyNameInput').value.trim();
        const content = document.getElementById('quickCopyContentArea').value.trim();
        const category = document.getElementById('quickCopyCategorySelect').value;
        
        if (!name) { showToast('Please enter a name', 'error'); return; }
        if (!content) { showToast('Please enter content', 'error'); return; }
        
        if (!workspaceState.quickCopyItems) workspaceState.quickCopyItems = [];
        workspaceState.quickCopyItems.push({
            id: Date.now().toString(),
            name,
            content,
            category,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem('workspace_quickcopy', JSON.stringify(workspaceState.quickCopyItems));
        
        modal.style.display = 'none';
        showToast('Template saved!', 'success');
        
        const container = document.querySelector('#quickCopyList')?.parentElement;
        if (container) renderQuickCopyPanel(container);
    };
    
    document.getElementById('cancelQuickCopyBtn').onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function openQuickCopyModal() {
    const modal = document.getElementById('quickCopyModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    const container = document.getElementById('quickCopyList');
    if (container) {
        const parent = container.closest('.modal-card');
        if (parent) {
            parent.dataset.filter = 'all';
            renderQuickCopyPanel(container);
        }
    }
    
    document.getElementById('closeQuickCopyBtn').onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

// ================================================================
// ENHANCED FLOATING PANELS
// ================================================================

function createEnhancedFloatingPanels() {
    createFloatingPanel('notepad', '📝 Notepad', `
        <textarea id="wsFloatingNotepad" placeholder="Quick notes...">${workspaceState.notes || ''}</textarea>
        <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">Auto-saved</span>
    `);
    
    createFloatingPanel('callscript', '📜 Call Script', `
        <textarea id="wsFloatingScript" placeholder="Your sales script..." readonly>${workspaceState.script || ''}</textarea>
        <button class="edit-btn" id="wsFloatingScriptEditBtn" style="margin-top:8px; padding:4px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px;">✏️ Edit</button>
    `);
    
    createFloatingPanel('calculator', '🧮 Calculator', `
        <input type="text" class="workspace-calc-display" id="wsFloatingCalcDisplay" disabled>
        <div class="workspace-calc-grid">
            <button onclick="workspaceCalcPress('7')">7</button>
            <button onclick="workspaceCalcPress('8')">8</button>
            <button onclick="workspaceCalcPress('9')">9</button>
            <button onclick="workspaceCalcPress('/')">/</button>
            <button onclick="workspaceCalcPress('4')">4</button>
            <button onclick="workspaceCalcPress('5')">5</button>
            <button onclick="workspaceCalcPress('6')">6</button>
            <button onclick="workspaceCalcPress('*')">*</button>
            <button onclick="workspaceCalcPress('1')">1</button>
            <button onclick="workspaceCalcPress('2')">2</button>
            <button onclick="workspaceCalcPress('3')">3</button>
            <button onclick="workspaceCalcPress('-')">-</button>
            <button onclick="workspaceCalcPress('C')">C</button>
            <button onclick="workspaceCalcPress('0')">0</button>
            <button onclick="workspaceCalcPress('=')">=</button>
            <button onclick="workspaceCalcPress('+')">+</button>
        </div>
    `);
    
    createFloatingPanel('timer', '⏱️ Call Timer', `
        <div class="workspace-timer-display" id="wsFloatingTimerDisplay">00:00:00</div>
        <div class="workspace-timer-controls">
            <button class="timer-start" id="wsFloatingTimerStart">Start</button>
            <button class="timer-pause" id="wsFloatingTimerPause">Pause</button>
            <button class="timer-reset" id="wsFloatingTimerReset">Reset</button>
        </div>
    `);
    
    createFloatingPanel('clipboard', '📋 Clipboard History', `
        <button class="workspace-clipboard-capture" id="wsFloatingCaptureClipboard">📥 Capture Current Clipboard</button>
        <ul class="workspace-clipboard-list" id="wsFloatingClipboardList"></ul>
    `);
}

function createFloatingPanel(panelId, title, contentHtml) {
    const state = workspaceState.panels[panelId];
    if (!state) return;
    
    const panel = document.createElement('div');
    panel.className = 'workspace-floating-panel';
    panel.id = `ws_floating_${panelId}`;
    panel.style.top = state.y + 'px';
    panel.style.left = state.x + 'px';
    panel.style.width = state.width + 'px';
    panel.style.height = state.height + 'px';
    panel.style.display = 'none';
    if (state.minimized) {
        panel.classList.add('minimized');
    }
    
    panel.innerHTML = `
        <div class="panel-header" style="cursor:move;">
            <h5>${title}</h5>
            <div class="panel-controls">
                <button class="minimize-btn" title="Minimize"><i class="fas fa-minus"></i></button>
                <button class="maximize-btn" title="Maximize"><i class="fas fa-expand"></i></button>
                <button class="close-btn" title="Close"><i class="fas fa-times"></i></button>
            </div>
        </div>
        <div class="panel-body">
            ${contentHtml}
        </div>
        <div class="resize-handle"></div>
    `;
    
    document.body.appendChild(panel);
    state.element = panel;
    setupFloatingPanelControls(panelId);
    
    if (state.visible) {
        panel.style.display = 'block';
    }
}

function setupFloatingPanelControls(panelId) {
    const panel = document.getElementById(`ws_floating_${panelId}`);
    if (!panel) return;
    const state = workspaceState.panels[panelId];
    
    const closeBtn = panel.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            state.visible = false;
            saveFloatingPanelState();
        });
    }
    
    const minBtn = panel.querySelector('.minimize-btn');
    if (minBtn) {
        minBtn.addEventListener('click', () => {
            panel.classList.toggle('minimized');
            state.minimized = panel.classList.contains('minimized');
            saveFloatingPanelState();
        });
    }
    
    const maxBtn = panel.querySelector('.maximize-btn');
    if (maxBtn) {
        maxBtn.addEventListener('click', () => {
            if (panel.classList.contains('maximized')) {
                panel.classList.remove('maximized');
                panel.style.width = state.width + 'px';
                panel.style.height = state.height + 'px';
                panel.style.top = state.y + 'px';
                panel.style.left = state.x + 'px';
                maxBtn.innerHTML = '<i class="fas fa-expand"></i>';
            } else {
                panel.classList.add('maximized');
                panel.style.width = '90vw';
                panel.style.height = '80vh';
                panel.style.top = '5vh';
                panel.style.left = '5vw';
                maxBtn.innerHTML = '<i class="fas fa-compress"></i>';
            }
        });
    }
    
    const header = panel.querySelector('.panel-header');
    makeWorkspaceDraggable(panel, header, panelId);
    
    const resizeHandle = panel.querySelector('.resize-handle');
    if (resizeHandle) {
        makeWorkspaceResizable(panel, resizeHandle, panelId);
    }
    
    setupPanelContent(panelId);
}

function makeWorkspaceDraggable(panel, header, panelId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = () => {
            document.onmouseup = null;
            document.onmousemove = null;
            const state = workspaceState.panels[panelId];
            if (state && !panel.classList.contains('maximized')) {
                state.x = panel.offsetLeft;
                state.y = panel.offsetTop;
                saveFloatingPanelState();
            }
        };
        document.onmousemove = (ev) => {
            ev.preventDefault();
            pos1 = pos3 - ev.clientX;
            pos2 = pos4 - ev.clientY;
            pos3 = ev.clientX;
            pos4 = ev.clientY;
            panel.style.top = (panel.offsetTop - pos2) + "px";
            panel.style.left = (panel.offsetLeft - pos1) + "px";
        };
    };
}

function makeWorkspaceResizable(panel, handle, panelId) {
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = panel.offsetWidth;
        startHeight = panel.offsetHeight;
        
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', onResizeEnd);
    });
    
    function onResize(e) {
        const newWidth = Math.max(200, startWidth + (e.clientX - startX));
        const newHeight = Math.max(120, startHeight + (e.clientY - startY));
        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
    }
    
    function onResizeEnd(e) {
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', onResizeEnd);
        const state = workspaceState.panels[panelId];
        if (state) {
            state.width = panel.offsetWidth;
            state.height = panel.offsetHeight;
            saveFloatingPanelState();
        }
    }
}

function setupPanelContent(panelId) {
    const panel = document.getElementById(`ws_floating_${panelId}`);
    if (!panel) return;
    
    switch(panelId) {
        case 'notepad':
            const noteArea = panel.querySelector('#wsFloatingNotepad');
            if (noteArea) {
                noteArea.addEventListener('input', () => {
                    workspaceState.notes = noteArea.value;
                    localStorage.setItem('workspace_notes', workspaceState.notes);
                    const dockedNotes = document.getElementById('wsNotesArea');
                    if (dockedNotes) dockedNotes.value = workspaceState.notes;
                    renderRecentNotes();
                });
            }
            break;
            
        case 'callscript':
            const scriptArea = panel.querySelector('#wsFloatingScript');
            const editBtn = panel.querySelector('#wsFloatingScriptEditBtn');
            if (scriptArea && editBtn) {
                editBtn.addEventListener('click', function() {
                    if (scriptArea.hasAttribute('readonly')) {
                        scriptArea.removeAttribute('readonly');
                        this.textContent = '🔒 Lock';
                        this.style.background = 'var(--warning)';
                    } else {
                        scriptArea.setAttribute('readonly', 'readonly');
                        this.textContent = '✏️ Edit';
                        this.style.background = 'var(--primary)';
                        workspaceState.script = scriptArea.value;
                        localStorage.setItem('workspace_script', workspaceState.script);
                        const dockedScript = document.getElementById('wsScriptArea');
                        if (dockedScript) dockedScript.value = workspaceState.script;
                    }
                });
            }
            break;
            
        case 'timer':
            setupFloatingTimer(panel);
            break;
            
        case 'clipboard':
            setupFloatingClipboard(panel);
            break;
    }
}

function setupFloatingTimer(panel) {
    let timerInterval = null;
    let seconds = 0;
    const display = panel.querySelector('#wsFloatingTimerDisplay');
    
    function updateDisplay() {
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        display.textContent = `${h}:${m}:${s}`;
    }
    
    panel.querySelector('#wsFloatingTimerStart').addEventListener('click', () => {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            seconds++;
            updateDisplay();
        }, 1000);
    });
    
    panel.querySelector('#wsFloatingTimerPause').addEventListener('click', () => {
        clearInterval(timerInterval);
    });
    
    panel.querySelector('#wsFloatingTimerReset').addEventListener('click', () => {
        clearInterval(timerInterval);
        seconds = 0;
        updateDisplay();
    });
}

function setupFloatingClipboard(panel) {
    const list = panel.querySelector('#wsFloatingClipboardList');
    
    function renderClipboard() {
        if (!list) return;
        list.innerHTML = '';
        workspaceState.clipboardHistory.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            li.title = 'Click to copy';
            li.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    const status = document.getElementById('wsStatusText');
                    if (status) {
                        status.textContent = '✅ Copied to clipboard';
                        setTimeout(() => status.textContent = '✅ Ready', 2000);
                    }
                } catch(e) {}
            });
            list.appendChild(li);
        });
    }
    
    panel.querySelector('#wsFloatingCaptureClipboard').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && !workspaceState.clipboardHistory.includes(text)) {
                workspaceState.clipboardHistory.unshift(text);
                if (workspaceState.clipboardHistory.length > 20) workspaceState.clipboardHistory.pop();
                localStorage.setItem('workspace_clipboard', JSON.stringify(workspaceState.clipboardHistory));
                renderClipboard();
                const status = document.getElementById('wsStatusText');
                if (status) {
                    status.textContent = '✅ Clipboard captured';
                    setTimeout(() => status.textContent = '✅ Ready', 2000);
                }
            }
        } catch(e) {
            alert('Please allow clipboard permissions or copy text manually.');
        }
    });
    
    renderClipboard();
}

function toggleFloatingPanel(panelId) {
    const panel = document.getElementById(`ws_floating_${panelId}`);
    const state = workspaceState.panels[panelId];
    if (!panel || !state) return;
    
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        state.visible = false;
    } else {
        panel.style.display = 'block';
        state.visible = true;
        if (state.minimized) {
            panel.classList.add('minimized');
        }
        panel.style.zIndex = Date.now();
    }
    saveFloatingPanelState();
}

window.workspaceCalcPress = function(val) {
    const display = document.getElementById('wsFloatingCalcDisplay') || document.getElementById('wsCalcDisplay');
    if (!display) return;
    if (val === 'C') {
        display.value = '';
    } else if (val === '=') {
        try {
            display.value = eval(display.value) || '';
        } catch(e) {
            display.value = 'Err';
        }
    } else {
        display.value += val;
    }
};

// ================================================================
// COMMAND PALETTE
// ================================================================

function toggleCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (!palette) return;
    
    commandPaletteOpen = !commandPaletteOpen;
    palette.style.display = commandPaletteOpen ? 'flex' : 'none';
    
    if (commandPaletteOpen) {
        const input = document.getElementById('commandInput');
        if (input) {
            input.value = '';
            input.focus();
            updateCommandResults('');
        }
    }
}

function updateCommandResults(query) {
    const container = document.getElementById('commandResults');
    if (!container) return;
    
    const commands = [
        { label: 'New Tab', icon: 'fa-plus', action: () => createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true), shortcut: '⌘T' },
        { label: 'Close Tab', icon: 'fa-times', action: () => closeWorkspaceTab(workspaceState.activeTabId), shortcut: '⌘W' },
        { label: 'Go Home', icon: 'fa-home', action: () => loadWorkspaceUrl(WORKSPACE_CONFIG.HOME_URL), shortcut: '' },
        { label: 'Toggle Notepad', icon: 'fa-sticky-note', action: () => toggleFloatingPanel('notepad'), shortcut: '⌘⇧N' },
        { label: 'Toggle Script', icon: 'fa-scroll', action: () => toggleFloatingPanel('callscript'), shortcut: '⌘⇧S' },
        { label: 'Toggle Split Screen', icon: 'fa-columns', action: toggleSplitScreen, shortcut: '⌘⇧|' },
        { label: 'Quick Copy Library', icon: 'fa-copy', action: openQuickCopyModal, shortcut: '⌘⇧C' },
        { label: 'Toggle Calculator', icon: 'fa-calculator', action: () => toggleFloatingPanel('calculator'), shortcut: '' },
        { label: 'Toggle Timer', icon: 'fa-clock', action: () => toggleFloatingPanel('timer'), shortcut: '' },
        { label: 'Refresh Page', icon: 'fa-sync', action: () => document.getElementById('wsReloadBtn')?.click(), shortcut: '⌘R' },
        { label: 'Bookmark Page', icon: 'fa-star', action: () => document.getElementById('wsBookmarkBtn')?.click(), shortcut: '⌘D' },
        { label: 'Toggle Theme', icon: 'fa-moon', action: toggleTheme, shortcut: '' },
        { label: 'Export Data', icon: 'fa-file-csv', action: exportToCSV, shortcut: '' },
        { label: 'Help Guide', icon: 'fa-question-circle', action: showHelpModal, shortcut: '' },
    ];
    
    const q = query.toLowerCase().trim();
    let results = commands;
    if (q) {
        results = commands.filter(cmd => 
            cmd.label.toLowerCase().includes(q) || 
            cmd.shortcut.toLowerCase().includes(q)
        );
    }
    
    if (results.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">No commands found</div>';
        return;
    }
    
    container.innerHTML = results.map((cmd, index) => `
        <div class="command-result-item ${index === 0 ? 'selected' : ''}" data-index="${index}">
            <i class="fas ${cmd.icon}"></i>
            <span class="command-label">${cmd.label}</span>
            ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
        </div>
    `).join('');
    
    container.querySelectorAll('.command-result-item').forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.dataset.index);
            if (results[index]) {
                results[index].action();
                toggleCommandPalette();
            }
        });
    });
    
    container.dataset.selectedIndex = '0';
    container.dataset.results = JSON.stringify(results.map(r => r.label));
}

// ================================================================
// ENHANCED WORKSPACE EVENTS - FIXED WITH NULL CHECKS
// ================================================================

function setupEnhancedWorkspaceEvents(container) {
    // URL Input
    const urlInput = document.getElementById('wsUrlInput');
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loadWorkspaceUrl(e.target.value);
            }
        });
    }
    
    // Navigation buttons
    const backBtn = document.getElementById('wsBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
            if (!tab) return;
            const history = workspaceState.history[tab.id] || [];
            const index = workspaceState.historyIndex[tab.id] || 0;
            if (index > 0) {
                workspaceState.historyIndex[tab.id] = index - 1;
                loadWorkspaceUrl(history[index - 1], workspaceState.activeTabId, false);
            }
        });
    }
    
    const forwardBtn = document.getElementById('wsForwardBtn');
    if (forwardBtn) {
        forwardBtn.addEventListener('click', () => {
            const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
            if (!tab) return;
            const history = workspaceState.history[tab.id] || [];
            const index = workspaceState.historyIndex[tab.id] || 0;
            if (index < history.length - 1) {
                workspaceState.historyIndex[tab.id] = index + 1;
                loadWorkspaceUrl(history[index + 1], workspaceState.activeTabId, false);
            }
        });
    }
    
    const reloadBtn = document.getElementById('wsReloadBtn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
            if (tab) loadWorkspaceUrl(tab.url, workspaceState.activeTabId, false);
        });
    }
    
    const homeBtn = document.getElementById('wsHomeBtn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            loadWorkspaceUrl(WORKSPACE_CONFIG.HOME_URL);
        });
    }
    
    const newTabBtn = document.getElementById('wsNewTab');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
        });
    }
    
    const bookmarkBtn = document.getElementById('wsBookmarkBtn');
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', () => {
            const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
            if (!tab) return;
            const idx = workspaceState.bookmarks.indexOf(tab.url);
            if (idx > -1) {
                workspaceState.bookmarks.splice(idx, 1);
            } else {
                workspaceState.bookmarks.push(tab.url);
            }
            localStorage.setItem('workspace_bookmarks', JSON.stringify(workspaceState.bookmarks));
            updateWorkspaceBookmarkButton(tab.url);
            const statusEl = document.getElementById('wsStatusText');
            if (statusEl) {
                statusEl.textContent = idx > -1 ? '✅ Bookmark removed' : '✅ Bookmark added';
                setTimeout(() => statusEl.textContent = '✅ Ready', 2000);
            }
        });
    }
    
    const splitBtn = document.getElementById('wsSplitBtn');
    if (splitBtn) {
        splitBtn.addEventListener('click', toggleSplitScreen);
    }
    
    const quickCopyBtn = document.getElementById('wsQuickCopyBtn');
    if (quickCopyBtn) {
        quickCopyBtn.addEventListener('click', openQuickCopyModal);
    }
    
    const toggleSidebarBtn = document.getElementById('wsToggleSidebar');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('wsSidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('workspace_sidebar_open', !sidebar.classList.contains('collapsed'));
            }
        });
    }
    
    const sidebarCloseBtn = document.getElementById('wsSidebarClose');
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('wsSidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
                localStorage.setItem('workspace_sidebar_open', 'false');
            }
        });
    }
    
    const notepadBtn = document.getElementById('wsNotepadBtn');
    if (notepadBtn) {
        notepadBtn.addEventListener('click', () => toggleFloatingPanel('notepad'));
    }
    
    const scriptPanelBtn = document.getElementById('wsScriptPanelBtn');
    if (scriptPanelBtn) {
        scriptPanelBtn.addEventListener('click', () => toggleFloatingPanel('callscript'));
    }
    
    const toggleCalcBtn = document.getElementById('wsToggleCalc');
    if (toggleCalcBtn) {
        toggleCalcBtn.addEventListener('click', () => toggleFloatingPanel('calculator'));
    }
    
    const toggleTimerBtn = document.getElementById('wsToggleTimer');
    if (toggleTimerBtn) {
        toggleTimerBtn.addEventListener('click', () => toggleFloatingPanel('timer'));
    }
    
    // Notes Area
    const notesArea = document.getElementById('wsNotesArea');
    if (notesArea) {
        notesArea.addEventListener('input', () => {
            workspaceState.notes = notesArea.value;
            localStorage.setItem('workspace_notes', workspaceState.notes);
            renderRecentNotes();
            const floatingNote = document.getElementById('wsFloatingNotepad');
            if (floatingNote) floatingNote.value = workspaceState.notes;
        });
    }
    
    // Script Area
    const scriptArea = document.getElementById('wsScriptArea');
    if (scriptArea) {
        scriptArea.addEventListener('input', () => {
            workspaceState.script = scriptArea.value;
            localStorage.setItem('workspace_script', workspaceState.script);
            const floatingScript = document.getElementById('wsFloatingScript');
            if (floatingScript) floatingScript.value = workspaceState.script;
        });
        scriptArea.setAttribute('readonly', 'readonly');
    }
    
    const scriptEditBtn = document.getElementById('wsScriptEditBtn');
    if (scriptEditBtn && scriptArea) {
        scriptEditBtn.addEventListener('click', function() {
            if (scriptArea.hasAttribute('readonly')) {
                scriptArea.removeAttribute('readonly');
                this.textContent = '🔒 Lock';
                this.style.background = 'var(--warning)';
            } else {
                scriptArea.setAttribute('readonly', 'readonly');
                this.textContent = '✏️ Edit';
                this.style.background = 'var(--primary)';
                workspaceState.script = scriptArea.value;
                localStorage.setItem('workspace_script', workspaceState.script);
            }
        });
    }
    
    // Handle iframe navigation messages
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'navigate' && event.data.url) {
            loadWorkspaceUrl(event.data.url);
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleWorkspaceKeyboardShortcuts);
    
    // Command palette input handler
    const cmdInput = document.getElementById('commandInput');
    if (cmdInput) {
        cmdInput.addEventListener('input', (e) => {
            updateCommandResults(e.target.value);
        });
        
        cmdInput.addEventListener('keydown', (e) => {
            const container = document.getElementById('commandResults');
            if (!container) return;
            
            const items = container.querySelectorAll('.command-result-item');
            let currentIndex = parseInt(container.dataset.selectedIndex || '0');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, items.length - 1);
                items.forEach(el => el.classList.remove('selected'));
                if (items[currentIndex]) items[currentIndex].classList.add('selected');
                container.dataset.selectedIndex = currentIndex;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                items.forEach(el => el.classList.remove('selected'));
                if (items[currentIndex]) items[currentIndex].classList.add('selected');
                container.dataset.selectedIndex = currentIndex;
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = container.querySelector('.command-result-item.selected');
                if (selected) {
                    const index = parseInt(selected.dataset.index);
                    const results = JSON.parse(container.dataset.results || '[]');
                    if (results[index]) {
                        const commands = [
                            { label: 'New Tab', action: () => createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true) },
                            { label: 'Close Tab', action: () => closeWorkspaceTab(workspaceState.activeTabId) },
                            { label: 'Go Home', action: () => loadWorkspaceUrl(WORKSPACE_CONFIG.HOME_URL) },
                            { label: 'Toggle Notepad', action: () => toggleFloatingPanel('notepad') },
                            { label: 'Toggle Script', action: () => toggleFloatingPanel('callscript') },
                            { label: 'Toggle Split Screen', action: toggleSplitScreen },
                            { label: 'Quick Copy Library', action: openQuickCopyModal },
                            { label: 'Toggle Calculator', action: () => toggleFloatingPanel('calculator') },
                            { label: 'Toggle Timer', action: () => toggleFloatingPanel('timer') },
                            { label: 'Refresh Page', action: () => {
                                const reloadBtn = document.getElementById('wsReloadBtn');
                                if (reloadBtn) reloadBtn.click();
                            }},
                            { label: 'Bookmark Page', action: () => {
                                const bookmarkBtn = document.getElementById('wsBookmarkBtn');
                                if (bookmarkBtn) bookmarkBtn.click();
                            }},
                            { label: 'Toggle Theme', action: toggleTheme },
                            { label: 'Export Data', action: exportToCSV },
                            { label: 'Help Guide', action: showHelpModal },
                        ];
                        const cmd = commands.find(c => c.label === results[index]);
                        if (cmd) {
                            cmd.action();
                            toggleCommandPalette();
                        }
                    }
                }
            } else if (e.key === 'Escape') {
                toggleCommandPalette();
            }
        });
    }
    
    const commandPalette = document.getElementById('commandPalette');
    if (commandPalette) {
        commandPalette.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                toggleCommandPalette();
            }
        });
    }
}

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================

function handleWorkspaceKeyboardShortcuts(e) {
    const panel = document.getElementById('featurePanel');
    if (!panel || panel.style.display !== 'block') return;
    const container = document.getElementById('featurePanelBody');
    if (!container || !container.querySelector('.workspace-container')) return;
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        closeWorkspaceTab(workspaceState.activeTabId);
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        const input = document.getElementById('wsUrlInput');
        if (input) { input.focus(); input.select(); }
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        toggleFloatingPanel('notepad');
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        toggleFloatingPanel('callscript');
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        openQuickCopyModal();
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        toggleSplitScreen();
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const bookmarkBtn = document.getElementById('wsBookmarkBtn');
        if (bookmarkBtn) bookmarkBtn.click();
        return;
    }
}

// ================================================================
// APP INITIALIZATION
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('scriptflow_theme_main')) {
        document.body.classList.add('dark');
        localStorage.setItem('scriptflow_theme_main', 'dark');
    } else if (localStorage.getItem('scriptflow_theme_main') === 'dark') {
        document.body.classList.add('dark');
    }
    
    auth.onAuthStateChanged(async (user) => {
        try {
            if (user) {
                currentUser = user;
                updateSidebarProfile(currentUser);
                await loadUserData();
                subscribeToChanges();
                initializeApp();
            } else {
                showAuthModal();
            }
        } catch (error) {
            handleError(error, 'Auth State Change');
        }
    });
    
    document.getElementById('signOutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        signOut();
    });
    
    document.getElementById('refreshBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        refreshData();
    });
    
    document.getElementById('workspaceLauncherBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.tool-item').forEach(item => {
            const text = item.querySelector('span')?.innerText || item.innerText;
            if (text.includes('CRM Smart Workspace')) {
                item.click();
            }
        });
    });
    
    window.addEventListener('online', () => {
        showOfflineIndicator(false);
        showToast('Back online! Syncing data...', 'success');
        refreshData();
    });
    
    window.addEventListener('offline', () => {
        showOfflineIndicator(true);
        showToast('You are offline. Changes will sync when you reconnect.', 'error');
    });
});

function initializeApp() {
    const csvFileInput = document.getElementById('csvFileInput');
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    if (csvUploadBtn && csvFileInput) {
        csvUploadBtn.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') { csvFileInput.click(); }
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
    
    document.getElementById('toolsHeader')?.addEventListener('click', toggleToolsMenu);
    if (toolsOpen) {
        document.getElementById('toolsMenu')?.classList.add('open');
        document.getElementById('toolsChevron')?.classList.add('rotated');
    }
    
    document.querySelectorAll('.tool-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = item.querySelector('span')?.innerText || item.innerText;
            try {
                if (text.includes('Analytics Hub')) {
                    currentAnalyticsTab = 'insights';
                    showFeaturePanel('analytics', 'Analytics Hub');
                } else if (text.includes('Appointment Calendar')) {
                    showFeaturePanel('calendar', 'Appointment Calendar');
                } else if (text.includes('Follow-up Tasks')) {
                    showFeaturePanel('tasks', 'Follow-up Tasks');
                } else if (text.includes('CRM Smart Workspace')) {
                    showFeaturePanel('smartworkspace', 'CRM Smart Workspace');
                } else if (text.includes('Export')) {
                    exportToCSV();
                } else if (text.includes('Dark/Light')) {
                    toggleTheme();
                } else if (text.includes('Help')) {
                    showHelpModal();
                } else if (text.includes('Factory Reset')) {
                    if (confirm('ERASE ALL DATA? This will clear your local storage.')) {
                        localStorage.clear();
                        location.reload();
                    }
                }
            } catch (error) {
                handleError(error, 'Tool Action');
            }
        });
    });
    
    document.getElementById('closeFeaturePanelBtn')?.addEventListener('click', hideFeaturePanel);
    
    document.getElementById('insightsTabBtn')?.addEventListener('click', () => {
        try {
            currentAnalyticsTab = 'insights';
            const container = document.getElementById('featurePanelBody');
            if (container) renderAnalyticsHub(container);
        } catch (error) {
            handleError(error, 'Switch to Insights');
        }
    });
    
    document.getElementById('reportsTabBtn')?.addEventListener('click', () => {
        try {
            currentAnalyticsTab = 'reports';
            const container = document.getElementById('featurePanelBody');
            if (container) renderAnalyticsHub(container);
        } catch (error) {
            handleError(error, 'Switch to Reports');
        }
    });
    
    document.getElementById('calendarViewBtn')?.addEventListener('click', () => {
        try {
            currentView = 'calendar';
            refreshCurrentView();
            document.getElementById('calendarViewBtn').classList.add('active');
            document.getElementById('listViewBtn').classList.remove('active');
            currentListSearchTerm = '';
        } catch (error) {
            handleError(error, 'Switch to Calendar');
        }
    });
    
    document.getElementById('listViewBtn')?.addEventListener('click', () => {
        try {
            currentView = 'list';
            refreshCurrentView();
            document.getElementById('listViewBtn').classList.add('active');
            document.getElementById('calendarViewBtn').classList.remove('active');
        } catch (error) {
            handleError(error, 'Switch to List');
        }
    });
    
    document.getElementById('taskListViewBtn')?.addEventListener('click', () => {
        try {
            taskFilter = 'all';
            refreshCurrentView();
            document.getElementById('taskListViewBtn').classList.add('active');
            document.getElementById('taskPendingBtn').classList.remove('active');
        } catch (error) {
            handleError(error, 'Switch to All Tasks');
        }
    });
    
    document.getElementById('taskPendingBtn')?.addEventListener('click', () => {
        try {
            taskFilter = 'pending';
            refreshCurrentView();
            document.getElementById('taskPendingBtn').classList.add('active');
            document.getElementById('taskListViewBtn').classList.remove('active');
        } catch (error) {
            handleError(error, 'Switch to Pending Tasks');
        }
    });
    
    document.getElementById('bulkActionsBtn')?.addEventListener('click', openBulkActionsModal);
    document.getElementById('closeBulkModalBtn')?.addEventListener('click', () => {
        document.getElementById('bulkActionsModal').style.display = 'none';
    });
    document.getElementById('executeBulkActionBtn')?.addEventListener('click', executeBulkAction);
    document.getElementById('bulkActionsModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('bulkActionsModal').style.display = 'none';
        }
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
    
    const actionSelect = document.getElementById('bulkActionSelect');
    if (actionSelect) {
        actionSelect.addEventListener('change', () => {
            const val = actionSelect.value;
            const optionsDiv = document.getElementById('bulkActionOptions');
            const statusGrp = document.getElementById('bulkStatusGroup');
            const tagGrp = document.getElementById('bulkTagGroup');
            if (optionsDiv) optionsDiv.style.display = 'block';
            if (statusGrp) statusGrp.style.display = val === 'status' ? 'block' : 'none';
            if (tagGrp) tagGrp.style.display = val === 'tag' ? 'block' : 'none';
        });
    }
    
    document.getElementById('closeQuickCopyBtn')?.addEventListener('click', () => {
        document.getElementById('quickCopyModal').style.display = 'none';
    });
    
    document.getElementById('cancelQuickCopyBtn')?.addEventListener('click', () => {
        document.getElementById('addQuickCopyTemplateModal').style.display = 'none';
    });

    window.addEventListener('keydown', (e) => {
        try {
            if (e.key === 'Escape') {
                const fp = document.getElementById('featurePanel');
                if (fp && fp.style.display === 'block') { hideFeaturePanel(); e.preventDefault(); }
                const bm = document.getElementById('bulkActionsModal');
                if (bm && bm.style.display === 'flex') { bm.style.display = 'none'; e.preventDefault(); }
                const qc = document.getElementById('quickCopyModal');
                if (qc && qc.style.display === 'flex') { qc.style.display = 'none'; e.preventDefault(); }
                const aq = document.getElementById('addQuickCopyTemplateModal');
                if (aq && aq.style.display === 'flex') { aq.style.display = 'none'; e.preventDefault(); }
            }
            if (e.key >= '1' && e.key <= '9' && !isEditing && !e.target.matches('textarea,input')) {
                const fp = document.getElementById('featurePanel');
                if (fp && fp.style.display === 'block') {
                    const container = document.getElementById('featurePanelBody');
                    if (container && container.querySelector('.workspace-container')) return;
                }
                e.preventDefault();
                const t = getKeyMapping().get(e.key);
                if (t && scripts[t]) { loadScript(t); showToast(`Switched to: ${scripts[t].name}`, 'info'); }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isEditing) { e.preventDefault(); undoScript(currentScriptId); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !isEditing) { e.preventDefault(); redoScript(currentScriptId); }
            if (e.key === 'Escape' && isEditing) { cancelEdit(); showToast('Edit cancelled', 'info'); }
        } catch (error) {
            handleError(error, 'Keyboard Shortcut');
        }
    });
    setInterval(() => updateStats(), 5000);
}
