// ================================================================
// FIREBASE CONFIGURATION & INIT
// ================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD_Ry0pM7EKSDJeTegt0rY5muiw-xCgrhw",
    authDomain: "scriptflow-pro-2cf4c.firebaseapp.com",
    projectId: "scriptflow-pro-2cf4c",
    storageBucket: "scriptflow-pro-2cf4c.firebasestorage.app",
    messagingSenderId: "250157640936",
    appId: "1:250157640936:web:cd6218470c302b305aed5d"
};
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

try {
  db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
} catch (error) {
  console.warn('Firestore settings already applied:', error);
}

try {
  db.enablePersistence({ synchronizeTabs: true })
    .catch(err => { if (err.code !== 'failed-precondition' && err.code !== 'unavailable') console.warn('Firebase persistence error:', err); });
} catch (err) { console.warn('Firebase persistence setup:', err); }

const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => console.warn('Auth persistence error:', err));
window.db = db;
window.auth = auth;
window.firebase = firebase;

// ================================================================
// GLOBAL STATE
// ================================================================
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

// CRM STATE
let crmPanelOpen = false;
let crmZoomValue = 1.0;

const STATUS_OPTIONS = ['Warm Call Booked', 'Meeting Booked', 'Canceled', 'Rescheduled', 'Held'];
const TAG_OPTIONS = [
    { id: 'qualified_warm_call', name: 'Qualified Warm Call', color: '#10b981', colorClass: 'tag-qualified-warm-call-bg' },
    { id: 'unqualified_warm_callback', name: 'Unqualified Warm Callback', color: '#f59e0b', colorClass: 'tag-unqualified-warm-callback-bg' },
    { id: 'vip', name: 'VIP', color: '#3b82f6', colorClass: 'tag-vip-bg' },
    { id: 'negligent_warm_callback', name: 'Negligent Warm Callback', color: '#ef4444', colorClass: 'tag-negligent-warm-callback-bg' }
];

// ================================================================
// ERROR HANDLING & HELPERS
// ================================================================
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    let message = 'An error occurred. Please try again.';
    if (error.code === 'auth/network-request-failed') { message = 'Network connection lost.'; showOfflineIndicator(true); }
    else if (error.code === 'auth/too-many-requests') { message = 'Too many failed attempts.'; }
    else if (error.code === 'auth/user-not-found') { message = 'No account found.'; }
    else if (error.code === 'auth/wrong-password') { message = 'Incorrect password.'; }
    else if (error.code === 'auth/email-already-in-use') { message = 'Email already registered.'; }
    else if (error.code === 'auth/invalid-email') { message = 'Invalid email address.'; }
    else if (error.message) { message = error.message; }
    showToast(message, 'error');
    return { success: false, message };
}

function showOfflineIndicator(show) {
    const el = document.getElementById('offlineIndicator') || (function() {
        const div = document.createElement('div');
        div.id = 'offlineIndicator'; div.className = 'offline-indicator';
        div.innerHTML = '<i class="fas fa-wifi"></i> You are offline. Changes will sync when you reconnect.';
        document.body.prepend(div); return div;
    })();
    show ? el.classList.add('show') : el.classList.remove('show');
}

function generateUniqueId() { return Date.now().toString() + '_' + Math.random().toString(36).substring(2, 11); }
function getStatus(appt) {
    if (!appt || !appt.status) return 'Warm Call Booked';
    if (appt.status === 'Booked' || appt.status === 'Warm-Booked') return 'Warm Call Booked';
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return 'No date';
    let d = typeof dateStr === 'object' && dateStr.seconds ? new Date(dateStr.seconds * 1000) : new Date(dateStr.toString().replace(/-/g, '/'));
    return isNaN(d.getTime()) ? 'No date' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    let d = typeof dateStr === 'object' && dateStr.seconds ? new Date(dateStr.seconds * 1000) : new Date(dateStr.toString().replace(/-/g, '/'));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatToLocalDateStr(dateInput) {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) { return s ? String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : ''; }

function showToast(msg, type = 'success') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : (type === 'info' ? 'info' : '')}`;
    t.innerHTML = `${type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️')} ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function copyToClipboard(text) {
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Copied!');
    });
}

// ================================================================
// FIREBASE AUTH
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
    if (!user) { userInfoContainer.style.display = 'none'; return; }
    userInfoContainer.style.display = 'block';
    let avatarContainer = userInfoContainer.querySelector('.user-profile');
    if (!avatarContainer) {
        avatarContainer = document.createElement('div'); avatarContainer.className = 'user-profile';
        userInfoContainer.innerHTML = ''; userInfoContainer.appendChild(avatarContainer);
    }
    const photoURL = getUserPhotoURL(user);
    const displayName = user.displayName || user.email || 'User';
    let avatarHtml = photoURL 
        ? `<img src="${photoURL}" alt="${displayName}" class="user-avatar" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=\\'user-avatar-placeholder\\'>${displayName.charAt(0).toUpperCase()}</div>'" />`
        : `<div class="user-avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`;
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
            closeAuthModal(); authInProgress = false; return true;
        }
    } catch (error) { authInProgress = false; handleError(error, 'Google Sign-In'); return false; }
}

async function signUp(email, password, username) {
    if (authInProgress) { showToast('Sign in progress...', 'info'); return; }
    authInProgress = true;
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        if (result.user) {
            await result.user.updateProfile({ displayName: username });
            await db.collection('users').doc(result.user.uid).set({
                uid: result.user.uid, email: email, username: username, displayName: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                goals: { daily: 3, weekly: 15, monthly: 60 },
                scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing']
            });
            showToast('Account created! 🎉', 'success');
            currentUser = result.user; updateSidebarProfile(currentUser);
            await loadUserData(); closeAuthModal(); authInProgress = false; return true;
        }
    } catch (error) { authInProgress = false; handleError(error, 'Sign Up'); return false; }
}

async function signIn(email, password) {
    if (authInProgress) { showToast('Sign in progress...', 'info'); return; }
    authInProgress = true;
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        if (result.user) {
            currentUser = result.user; updateSidebarProfile(currentUser);
            await loadUserData(); showToast('Welcome back! 👋', 'success');
            closeAuthModal(); authInProgress = false; return true;
        }
    } catch (error) { authInProgress = false; handleError(error, 'Sign In'); return false; }
}

async function signOut() {
    try {
        if (appointmentsUnsubscribe) { appointmentsUnsubscribe(); appointmentsUnsubscribe = null; }
        if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
        currentUser = null; appointments = {}; tasks = []; scripts = {}; scriptOrder = [];
        updateSidebarProfile(null); updateStats(); renderSidebar();
        await auth.signOut(); showToast('Signed out successfully', 'info');
        setTimeout(() => { showAuthModal(); }, 300);
    } catch (error) { handleError(error, 'Sign Out'); }
}

function showAuthModal() {
    if (authModalOpen) return;
    authModalOpen = true;
    const existingModal = document.getElementById('authModal');
    if (existingModal) existingModal.remove();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay'; modal.id = 'authModal';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 420px;">
            <h2 style="text-align:center; margin-bottom: 20px;"><i class="fas fa-microphone-alt" style="color:var(--primary);"></i> ScriptFlow Pro</h2>
            <p style="text-align:center; color:var(--text-muted); margin-bottom:20px; font-size:0.9rem;">Sign in to access your data anywhere</p>
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
                    <div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="you@example.com" /></div>
                    <div class="form-group"><label>Password</label><input type="password" id="loginPassword" placeholder="••••••••" /></div>
                    <button id="loginBtn" class="btn-icon" style="width:100%; justify-content:center; background:var(--primary); color:white;"><i class="fas fa-sign-in-alt"></i> Sign In</button>
                </div>
                <div id="signupForm" style="display:none;">
                    <div class="form-group"><label>Username</label><input type="text" id="signupUsername" placeholder="Choose a username" /></div>
                    <div class="form-group"><label>Email</label><input type="email" id="signupEmail" placeholder="you@example.com" /></div>
                    <div class="form-group"><label>Password</label><input type="password" id="signupPassword" placeholder="•••••••• (min 6 chars)" /></div>
                    <button id="signupBtn" class="btn-icon" style="width:100%; justify-content:center; background:var(--success); color:white;"><i class="fas fa-user-plus"></i> Create Account</button>
                </div>
            </div>
            <div style="margin-top:16px; text-align:center; font-size:0.8rem; color:var(--text-muted);">🔒 Your data is securely stored in the cloud</div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('googleSignInBtn').addEventListener('click', async (e) => { e.preventDefault(); await signInWithGoogle(); });
    document.getElementById('loginTabBtn').addEventListener('click', () => { document.getElementById('loginTabBtn').classList.add('active'); document.getElementById('signupTabBtn').classList.remove('active'); document.getElementById('loginForm').style.display = 'block'; document.getElementById('signupForm').style.display = 'none'; });
    document.getElementById('signupTabBtn').addEventListener('click', () => { document.getElementById('signupTabBtn').classList.add('active'); document.getElementById('loginTabBtn').classList.remove('active'); document.getElementById('loginForm').style.display = 'none'; document.getElementById('signupForm').style.display = 'block'; });
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value, password = document.getElementById('loginPassword').value;
        if (!email || !password) { showToast('Please fill in all fields', 'error'); return; }
        await signIn(email, password);
    });
    document.getElementById('signupBtn').addEventListener('click', async () => {
        const username = document.getElementById('signupUsername').value, email = document.getElementById('signupEmail').value, password = document.getElementById('signupPassword').value;
        if (!username || !email || !password) { showToast('Please fill in all fields', 'error'); return; }
        if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
        await signUp(email, password, username);
    });
    modal.querySelectorAll('input').forEach(input => { input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { document.getElementById('loginForm').style.display !== 'none' ? document.getElementById('loginBtn').click() : document.getElementById('signupBtn').click(); } }); });
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) { modal.remove(); authModalOpen = false; }
}

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
    } catch (error) { handleError(error, 'Refresh'); } finally {
        isRefreshing = false;
        if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
    }
}

// ================================================================
// DB LOADING & SYNC
// ================================================================
async function loadUserData(showLoading = true) {
    if (!currentUser) return;
    try {
        if (showLoading && document.getElementById('saveStatus')) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        if (!userData) {
            await db.collection('users').doc(currentUser.uid).set({
                uid: currentUser.uid, email: currentUser.email, username: currentUser.displayName || currentUser.email, displayName: currentUser.displayName || currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), goals: { daily: 3, weekly: 15, monthly: 60 },
                scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing']
            });
            return loadUserData();
        }
        if (userData.goals) { goals = { daily: userData.goals.daily || 3, weekly: userData.goals.weekly || 15, monthly: userData.goals.monthly || 60 }; }
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
        tasks = []; tasksSnapshot.forEach(doc => { tasks.push({ ...doc.data(), id: doc.id }); });

        const scriptsSnapshot = await db.collection('users').doc(currentUser.uid).collection('scripts').get();
        scripts = {};
        scriptsSnapshot.forEach(doc => { scripts[doc.id] = { name: doc.data().name, content: doc.data().content }; });
        if (Object.keys(scripts).length === 0) { await createDefaultScripts(); return loadUserData(); }
        
        const versionsSnapshot = await db.collection('users').doc(currentUser.uid).collection('scriptVersions').orderBy('version', 'asc').get();
        versionHistory = {};
        versionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!versionHistory[data.scriptId]) { versionHistory[data.scriptId] = []; }
            versionHistory[data.scriptId].push({ content: data.content, timestamp: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString() });
        });
        for (const id of Object.keys(scripts)) {
            if (!versionHistory[id]) { versionHistory[id] = [{ content: scripts[id].content, timestamp: new Date().toISOString() }]; }
            currentVersionIndex[id] = versionHistory[id].length - 1;
        }
        updateStats(); renderSidebar();
        if (Object.keys(scripts).length > 0) { loadScript('opening'); }
        updateTaskStats(); closeAuthModal();
        if(document.getElementById('saveStatus')) {
            document.getElementById('saveStatus').innerHTML = '<i class="fas fa-check"></i> Synced';
            setTimeout(() => { if (!isEditing && document.getElementById('saveStatus')) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-save"></i> Auto'; }, 1500);
        }
        showOfflineIndicator(false);
    } catch (error) {
        if(document.getElementById('saveStatus')) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        handleError(error, 'Loading Data');
        if (error.code === 'unavailable' || error.message?.includes('offline')) showOfflineIndicator(true);
    }
}

async function createDefaultScripts() {
    if (!currentUser) return;
    const defaultScripts = {
        "opening": { name: "🎯 Opening Script", content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is Flynn. I work with a web design company that helps companies like yours stand out online. We actually created a free, modern preview version inspired by your current site. There's no cost or obligation. Would you be open to taking a quick look later today and sharing your thoughts?\"\n\n→ \"By the way, what's your name?\"\n→ \"Nice to meet you, [Prospect Name]. Are you the owner of [Company Name]?\"" },
        "owner_yes": { name: "👑 Owner - Yes", content: "✅ Perfect! I'll have my manager Daniel give you a quick call later today to show you the preview. Is this the best number to reach you at? Appreciate your time!" },
        "owner_no": { name: "👤 Not Owner", content: "❌ Got it — do you usually help with marketing or sales? What's the best time to reach the owner today? I'll have Daniel give them a quick call." },
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
        batch.set(scriptsRef.doc(id), { name: script.name, content: script.content, version: 1, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        batch.set(db.collection('users').doc(currentUser.uid).collection('scriptVersions').doc(), { scriptId: id, content: script.content, version: 1, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    batch.update(db.collection('users').doc(currentUser.uid), { scriptOrder: Object.keys(defaultScripts) });
    await batch.commit();
}

async function syncAppointment(appointment) {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).collection('appointments').doc(appointment.id.toString()).set({ ...appointment, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); return true; } catch (error) { showToast('Error saving appointment', 'error'); return false; }
}

async function deleteAppointmentRemote(id) {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).collection('appointments').doc(id.toString()).delete(); return true; } catch (error) { showToast('Error deleting appointment', 'error'); return false; }
}

async function syncTask(task) {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).collection('tasks').doc(task.id.toString()).set({ ...task, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); return true; } catch (error) { showToast('Error saving task', 'error'); return false; }
}

async function deleteTaskRemote(id) {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).collection('tasks').doc(id.toString()).delete(); return true; } catch (error) { showToast('Error deleting task', 'error'); return false; }
}

async function syncScript(scriptId, data) {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).collection('scripts').doc(scriptId).set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); return true; } catch (error) { showToast('Error saving script', 'error'); return false; }
}

async function syncScriptVersion(scriptId, version, content) {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).collection('scriptVersions').add({ scriptId: scriptId, content: content, version: version, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); return true; } catch (error) { return false; }
}

async function syncGoals() {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).update({ 'goals.daily': goals.daily, 'goals.weekly': goals.weekly, 'goals.monthly': goals.monthly, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); return true; } catch (error) { showToast('Error saving goals', 'error'); return false; }
}

async function syncScriptOrder() {
    if (!currentUser) return false;
    try { await db.collection('users').doc(currentUser.uid).update({ scriptOrder: scriptOrder, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); return true; } catch (error) { showToast('Error saving script order', 'error'); return false; }
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
                if (!appointments[appt.date]) appointments[appt.date] = { count: 0, note: '', reports: [] };
                appointments[appt.date].reports.push({ ...appt, id: doc.id });
                appointments[appt.date].count = appointments[appt.date].reports.length;
            });
            updateStats(); refreshCurrentView();
        });
        tasksUnsubscribe = db.collection('users').doc(currentUser.uid).collection('tasks').onSnapshot(snapshot => {
            tasks = []; snapshot.forEach(doc => tasks.push({ ...doc.data(), id: doc.id }));
            updateTaskStats(); refreshCurrentView();
        });
    } catch (error) { console.warn('Realtime subscription error:', error); }
}

function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned, editId = null, status = 'Warm Call Booked', crmLink = '', tags = []) {
    if (!currentUser) { showToast('Please sign in first', 'error'); return; }
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    if (!STATUS_OPTIONS.includes(status)) { status = 'Warm Call Booked'; }
    const newAppt = {
        id: editId || generateUniqueId(), business, contactName, role: role || 'Owner', phone: phone || '', time: time || '',
        notes: notes || '', assigned: assigned || 'Daniel', status: status || 'Warm Call Booked', crmLink: crmLink || '', tags: tags || [], date: dateStr,
        createdAt: new Date().toISOString(),
        fullText: `Business: ${business}\nContact: ${contactName}\nRole: ${role || 'Owner'}\nPhone: ${phone || ''}\nTime: ${time || ''}\nNotes: ${notes || ''}\nAssigned: ${assigned || 'Daniel'}\nDate: ${dateStr}`
    };
    if (editId) {
        const idx = appointments[dateStr].reports.findIndex(r => r.id === editId);
        if (idx !== -1) appointments[dateStr].reports[idx] = newAppt; else appointments[dateStr].reports.unshift(newAppt);
    } else { appointments[dateStr].reports.unshift(newAppt); }
    appointments[dateStr].count = appointments[dateStr].reports.length;
    syncAppointment(newAppt); updateStats();
    return newAppt.fullText;
}

function deleteAppointment(dateStr, id, skipRemote = false) {
    if (appointments[dateStr]?.reports) {
        appointments[dateStr].reports = appointments[dateStr].reports.filter(r => r.id !== id);
        if (appointments[dateStr].reports.length === 0) delete appointments[dateStr];
        else appointments[dateStr].count = appointments[dateStr].reports.length;
        if (!skipRemote) deleteAppointmentRemote(id);
        updateStats(); return true;
    } return false;
}
function saveAppointments() { updateStats(); }
function getTodayCount() { return appointments[getTodayStr()]?.reports?.length || 0; }
function getWeekCount() { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - now.getDay()); let total = 0; for (let d in appointments) { const date = new Date(d); if (date >= start && date <= new Date(start.getTime() + 6 * 86400000) && appointments[d].reports) total += appointments[d].reports.length; } return total; }
function getMonthCount() { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); let total = 0; for (let d in appointments) { const date = new Date(d); if (date >= start && date <= end && appointments[d].reports) total += appointments[d].reports.length; } return total; }
function getAverageScore() { let total = 0, count = 0; for (let date in appointments) { if (appointments[date].reports) appointments[date].reports.forEach(appt => { total += calculateLeadScore(appt); count++; }); } return count > 0 ? Math.round(total / count) : 0; }
function updateStats() {
    if(document.getElementById('statToday')) document.getElementById('statToday').innerText = getTodayCount();
    if(document.getElementById('statWeek')) document.getElementById('statWeek').innerText = getWeekCount();
    if(document.getElementById('statMonth')) document.getElementById('statMonth').innerText = getMonthCount();
    if(document.getElementById('goalDaily')) document.getElementById('goalDaily').innerText = goals.daily;
    if(document.getElementById('goalWeekly')) document.getElementById('goalWeekly').innerText = goals.weekly;
    if(document.getElementById('goalMonthly')) document.getElementById('goalMonthly').innerText = goals.monthly;
    if(document.getElementById('avgScore')) document.getElementById('avgScore').innerText = getAverageScore();
    updateTaskStats();
}

function addTask(description, dueDate, priority = 'medium', appointmentId = null) {
    if (!currentUser) { showToast('Please sign in first', 'error'); return; }
    const task = { id: generateUniqueId(), description, dueDate: dueDate || null, priority, appointmentId, completed: false, createdAt: new Date().toISOString() };
    tasks.push(task); syncTask(task); updateTaskStats(); return task;
}
function deleteTask(id) { tasks = tasks.filter(t => t.id !== id); deleteTaskRemote(id); updateTaskStats(); }
function toggleTaskComplete(id) { const task = tasks.find(t => t.id === id); if (task) { task.completed = !task.completed; syncTask(task); updateTaskStats(); } }
function updateTaskStats() { const pending = tasks.filter(t => !t.completed).length; if(document.getElementById('pendingTasks')) document.getElementById('pendingTasks').innerText = pending; }
function getTasksForAppointment(appointmentId) { return !appointmentId ? [] : tasks.filter(t => t.appointmentId === appointmentId.toString()); }

function initVersionHistory(id, c) { if (!versionHistory[id]) { versionHistory[id] = [{ content: c, timestamp: new Date().toISOString() }]; currentVersionIndex[id] = 0; } }
function saveVersion(id, newContent) {
    if (!versionHistory[id]) initVersionHistory(id, newContent);
    if (currentVersionIndex[id] < versionHistory[id].length - 1) versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
    versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
    currentVersionIndex[id] = versionHistory[id].length - 1;
    syncScriptVersion(id, currentVersionIndex[id] + 1, newContent);
}
function undoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] <= 0) { showToast('No earlier version', 'error'); return; }
    currentVersionIndex[id]--; scripts[id].content = versionHistory[id][currentVersionIndex[id]].content; saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Undo', 'info');
}
function redoScript(id) {
    if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) { showToast('No newer version', 'error'); return; }
    currentVersionIndex[id]++; scripts[id].content = versionHistory[id][currentVersionIndex[id]].content; saveAllScripts();
    if (!isEditing && currentScriptId === id) loadScript(id);
    else if (isEditing && currentScriptId === id && document.getElementById('editTextarea')) document.getElementById('editTextarea').value = scripts[id].content;
    showToast('Redo', 'info');
}

function saveAllScripts() {
    for (const [id, script] of Object.entries(scripts)) { syncScript(id, script); }
    syncScriptOrder();
    if(document.getElementById('saveStatus')) {
        document.getElementById('saveStatus').innerHTML = '<i class="fas fa-check"></i> Saved';
        setTimeout(() => { if (!isEditing) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-save"></i> Auto'; }, 1500);
    }
}
function getOrderedVisible() { let order = scriptOrder.length > 0 ? scriptOrder : customOrder; let ids = [...order.filter(id => scripts[id]), ...Object.keys(scripts).filter(id => !order.includes(id))]; if (searchTerm) { ids = ids.filter(id => scripts[id].name.toLowerCase().includes(searchTerm.toLowerCase())); } return ids; }
function getKeyMapping() { const vis = getOrderedVisible(); const map = new Map(); vis.slice(0, 9).forEach((id, i) => map.set((i + 1).toString(), id)); return map; }

function renderSidebar() {
    const container = document.getElementById('scriptListContainer');
    if (!container) return;
    const visible = getOrderedVisible();
    if (!visible.length) { container.innerHTML = '<div style="padding:20px;">No scripts</div>'; return; }
    let html = '';
    visible.forEach((id, idx) => {
        const s = scripts[id]; const active = currentScriptId === id;
        html += `<div class="script-item ${active ? 'active' : ''}" data-id="${id}">
            <span class="script-name">${escapeHtml(s.name)}</span>
            <div class="script-actions"><button class="script-action-btn rename-script" data-id="${id}"><i class="fas fa-pencil-alt"></i></button><button class="script-action-btn delete-script" data-id="${id}" ${id === 'opening' ? 'disabled style="opacity:0.4;"' : ''}><i class="fas fa-trash"></i></button></div>
            <span class="key-hint">${idx < 9 ? idx + 1 : ''}</span></div>`;
    });
    container.innerHTML = html; attachScriptEvents();
    const idxCur = visible.indexOf(currentScriptId);
    if(document.getElementById('activeShortcutHint')) document.getElementById('activeShortcutHint').innerHTML = idxCur !== -1 && idxCur < 9 ? `Key: ${idxCur + 1}` : `Key: —`;
    if (versionHistory[currentScriptId] && document.getElementById('versionNumber')) { document.getElementById('versionNumber').innerText = `${currentVersionIndex[currentScriptId] + 1}/${versionHistory[currentScriptId].length}`; }
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
            e.stopPropagation(); const id = btn.getAttribute('data-id'); const newName = prompt('New name:', scripts[id].name);
            if (newName?.trim()) { scripts[id].name = newName.trim(); saveAllScripts(); renderSidebar(); if (currentScriptId === id && document.getElementById('currentScriptName')) { document.getElementById('currentScriptName').innerHTML = scripts[id].name; } showToast('Renamed', 'success'); }
        });
    });
    document.querySelectorAll('.delete-script').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); const id = btn.getAttribute('data-id'); if (id === 'opening') { showToast('Cannot delete opening', 'error'); return; }
            if (confirm('Delete this script?')) { delete scripts[id]; delete versionHistory[id]; scriptOrder = scriptOrder.filter(i => i !== id); if (currentScriptId === id) loadScript('opening'); saveAllScripts(); renderSidebar(); showToast('Deleted', 'info'); }
        });
    });
}

function loadScript(id) {
    if (!scripts[id] || isEditing) return; currentScriptId = id;
    if(document.getElementById('currentScriptName')) document.getElementById('currentScriptName').innerHTML = scripts[id].name;
    const displayContent = scripts[id].content;
    if(document.getElementById('scriptContent')) document.getElementById('scriptContent').innerHTML = `<div class="script-display">${escapeHtml(displayContent).replace(/\n/g, '<br>')}</div>`;
    renderSidebar();
}

function enterEdit() {
    isEditing = true;
    document.getElementById('editScriptBtn').style.display = 'none';
    document.getElementById('saveScriptBtn').style.display = 'inline-flex';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('scriptContent').innerHTML = `<textarea id="editTextarea" class="edit-textarea">${escapeHtml(scripts[currentScriptId].content)}</textarea>`;
    document.getElementById('editTextarea').focus(); showToast('Edit mode', 'info');
}
function saveEdit() {
    const newContent = document.getElementById('editTextarea').value; scripts[currentScriptId].content = newContent;
    saveVersion(currentScriptId, newContent); saveAllScripts(); cancelEdit(); showToast('Saved!', 'success');
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
        const defaultScripts = { "opening": { content: "\"Hey, is this [Company Name]?\"\n\n\"Awesome — this is Flynn...\"" }};
        if (defaultScripts[currentScriptId] || Object.keys(scripts).length > 0) {
            scripts[currentScriptId].content = defaultScripts[currentScriptId] ? defaultScripts[currentScriptId].content : "Default Content Reset"; 
            saveVersion(currentScriptId, scripts[currentScriptId].content); saveAllScripts(); loadScript(currentScriptId); showToast('Reset complete', 'success');
        } else showToast('No default version available', 'error');
    }
}
function addNewScript() {
    if (isEditing) { showToast('Finish editing first', 'error'); return; }
    const name = prompt('Script name:'); if (!name) return;
    const id = 'custom_' + generateUniqueId(); scripts[id] = { name, content: 'Write your script here...' }; scriptOrder.push(id);
    initVersionHistory(id, scripts[id].content); saveAllScripts(); renderSidebar(); loadScript(id); showToast(`Added: ${name}`, 'success');
}
function showVersionHistoryModal() {
    if (!versionHistory[currentScriptId]) { showToast('No history', 'error'); return; }
    const modal = document.createElement('div'); modal.className = 'modal-overlay';
    let html = `<div class="modal-card"><h3>Version History: ${scripts[currentScriptId].name}</h3>`;
    versionHistory[currentScriptId].forEach((v, idx) => { html += `<div style="padding:12px; border-bottom:1px solid var(--border-color); cursor:pointer;" data-index="${idx}">${new Date(v.timestamp).toLocaleString()} ${idx === currentVersionIndex[currentScriptId] ? '✓ Current' : 'Restore'}</div>`; });
    html += `<button class="btn-icon" id="closeHistBtn">Close</button></div>`; modal.innerHTML = html; document.body.appendChild(modal);
    modal.querySelectorAll('[data-index]').forEach(el => { el.addEventListener('click', () => { const idx = parseInt(el.getAttribute('data-index')); currentVersionIndex[currentScriptId] = idx; scripts[currentScriptId].content = versionHistory[currentScriptId][idx].content; saveAllScripts(); if (!isEditing) loadScript(currentScriptId); else if (isEditing && document.getElementById('editTextarea')) { document.getElementById('editTextarea').value = scripts[currentScriptId].content; } showToast('Restored', 'success'); modal.remove(); }); });
    document.getElementById('closeHistBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function openSmartAddModal() {
    const modal = document.createElement('div'); modal.className = 'modal-overlay';
    const tagOptionsHtml = TAG_OPTIONS.map(tag => `<label class="tag-option" style="border-color: ${tag.color};"><input type="checkbox" value="${tag.id}" class="tag-checkbox"><span class="tag-color-indicator" style="background: ${tag.color};"></span><span>${tag.name}</span></label>`).join('');
    modal.innerHTML = `<div class="modal-card"><h3><i class="fas fa-magic"></i> Smart Appointment Import</h3><div class="form-group"><label>🔗 CRM Link (Optional)</label><input type="url" id="crmLinkInput" class="crm-link-input" placeholder="https://yourcrm.com/lead/..."></div><div class="form-group"><label>🏷️ Select Tags (Optional)</label><div class="tag-selector" id="tagSelector">${tagOptionsHtml}</div></div><div class="form-group"><label>📅 Date</label><input type="date" id="smartDate" value="${getTodayStr()}"></div><div class="form-group"><label>📝 Paste Details</label><textarea id="smartText" rows="5" placeholder="Example:\nBusiness name: FINAL TOUCH ELECTRIC\nName: Constance\nRole: Owner\nPhone: +18775965698\nTime: Tomorrow at 9am CT\nNote: No website yet.\n@Daniel"></textarea></div><div style="display:flex; gap:12px; justify-content:flex-end;"><button id="smartSaveBtn" class="btn-icon" style="background:var(--success); color:white;"><i class="fas fa-save"></i> Save</button><button id="smartCancelBtn" class="btn-icon"><i class="fas fa-times"></i> Cancel</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('smartSaveBtn').addEventListener('click', () => {
        const text = document.getElementById('smartText').value; const date = document.getElementById('smartDate').value; if (!text.trim()) { showToast('Enter details', 'error'); return; }
        const crmLink = document.getElementById('crmLinkInput').value; const selectedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.value);
        addAppointment(date, "Extracted Business", "Extracted Contact", "Owner", "", "9am", text, "Daniel", null, 'Warm Call Booked', crmLink, selectedTags);
        modal.remove(); showToast(`Saved!`, 'success'); refreshCurrentView();
    });
    document.getElementById('smartCancelBtn').addEventListener('click', () => modal.remove());
}

function openBulkActionsModal() {
    const modal = document.getElementById('bulkActionsModal'); const container = document.getElementById('bulkSelectionContainer'); if (!modal || !container) return;
    let allAppointments = []; for (let date in appointments) { if (appointments[date].reports) appointments[date].reports.forEach(a => allAppointments.push({ ...a, date })); }
    if (allAppointments.length === 0) { showToast('No appointments to select', 'info'); return; }
    let html = `<div style="margin-bottom:12px;"><button class="btn-icon" id="selectAllBtn" style="font-size:0.8rem;">Select All</button><button class="btn-icon" id="deselectAllBtn" style="font-size:0.8rem;">Deselect All</button><span style="margin-left:12px; font-size:0.8rem; color:var(--text-muted);"><span class="bulk-count">${selectedAppointments.size} selected</span></span></div>`;
    allAppointments.forEach(appt => { html += `<div class="bulk-item"><input type="checkbox" class="bulk-checkbox-item" data-id="${appt.id}" ${selectedAppointments.has(appt.id.toString()) ? 'checked' : ''} /><span><strong>${escapeHtml(appt.business)}</strong> - ${escapeHtml(appt.contactName)}</span><span style="margin-left:auto; font-size:0.8rem; color:var(--text-muted);">${formatDate(appt.date)}</span></div>`; });
    container.innerHTML = html; modal.style.display = 'flex';
    document.querySelectorAll('.bulk-checkbox-item').forEach(cb => { cb.addEventListener('change', (e) => { const id = e.target.getAttribute('data-id'); e.target.checked ? selectedAppointments.add(id) : selectedAppointments.delete(id); document.querySelectorAll('.bulk-count').forEach(el => el.textContent = `${selectedAppointments.size} selected`); }); });
}

function executeBulkAction() {
    if (selectedAppointments.size === 0) { showToast('No appointments selected', 'error'); return; }
    const action = document.getElementById('bulkActionSelect').value; const ids = Array.from(selectedAppointments).map(id => id.toString());
    if(action === 'delete') {
        if (!confirm(`Delete ${ids.length} selected appointments?`)) return;
        ids.forEach(id => { for (let date in appointments) { deleteAppointment(date, id, false); }}); selectedAppointments.clear(); showToast('Deleted', 'info');
    }
    document.getElementById('bulkActionsModal').style.display = 'none'; refreshCurrentView(); updateStats();
}

function renderCalendarPanel(container) {
    const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
    container.innerHTML = `<div class="calendar-section"><div class="calendar-nav"><h3><i class="fas fa-calendar-alt"></i> ${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</h3></div><div class="calendar-grid">Calendar Integration Active</div></div>`;
}
function renderListView(container) { container.innerHTML = `<div class="appointments-list"><div class="empty-state">List View Active</div></div>`; }
function renderTasksPanel(container) { container.innerHTML = `<div class="tasks-section"><h4>Follow-up Tasks</h4><div class="tasks-list">Task List Active</div></div>`; }
function renderAnalyticsHub(container) { container.innerHTML = `<h4>Analytics Hub Active</h4>`; }

function toggleTheme() { document.body.classList.toggle('dark'); localStorage.setItem('scriptflow_theme_main', document.body.classList.contains('dark') ? 'dark' : 'light'); showToast(`${document.body.classList.contains('dark') ? 'Dark' : 'Light'} mode`, 'info'); }

function showFeaturePanel(featureType, title) {
    const scriptPanel = document.getElementById('scriptPanel');
    const featurePanel = document.getElementById('featurePanel');
    const featureTitle = document.getElementById('featurePanelTitle');
    const featureBody = document.getElementById('featurePanelBody');
    if (!scriptPanel || !featurePanel) return;
    featureTitle.innerHTML = `<i class="fas fa-layer-group"></i> ${title}`;
    if (featureType === 'analytics') { currentView = 'analytics'; renderAnalyticsHub(featureBody); }
    else if (featureType === 'calendar') { currentView = 'calendar'; renderCalendarPanel(featureBody); }
    else if (featureType === 'tasks') { currentView = 'tasks'; renderTasksPanel(featureBody); }
    scriptPanel.style.display = 'none'; featurePanel.style.display = 'block';
}

function hideFeaturePanel() {
    const scriptPanel = document.getElementById('scriptPanel');
    const featurePanel = document.getElementById('featurePanel');
    if (scriptPanel && featurePanel) { featurePanel.style.display = 'none'; scriptPanel.style.display = 'block'; }
}

function refreshCurrentView() {
    const container = document.getElementById('featurePanelBody'); if (!container) return;
    if (currentView === 'calendar') renderCalendarPanel(container); else if (currentView === 'tasks') renderTasksPanel(container); else if (currentView === 'analytics') renderAnalyticsHub(container); else renderListView(container);
}

// ================================================================
// CRM DIALER PANEL LOGIC
// ================================================================
function toggleCrmPanel() {
    crmPanelOpen = !crmPanelOpen;
    const panel = document.getElementById('crmPanel');
    const mainContent = document.querySelector('.main-content');
    if (crmPanelOpen) {
        panel.classList.add('open');
        if (mainContent) mainContent.classList.add('crm-open');
        showToast('CRM Dialer Activated', 'info');
    } else {
        panel.classList.remove('open');
        if (mainContent) mainContent.classList.remove('crm-open');
    }
}

function adjustCrmZoom(delta) {
    crmZoomValue += delta;
    if (crmZoomValue < 0.5) crmZoomValue = 0.5;
    if (crmZoomValue > 1.5) crmZoomValue = 1.5;
    
    const iframe = document.getElementById('crmIframe');
    const levelDisplay = document.getElementById('crmZoomLevel');
    if (iframe && levelDisplay) {
        levelDisplay.innerText = Math.round(crmZoomValue * 100) + '%';
        const widthPercent = (100 / crmZoomValue);
        iframe.style.width = `${widthPercent}%`;
        iframe.style.height = `${widthPercent}%`;
        iframe.style.transform = `scale(${crmZoomValue})`;
    }
}

// ================================================================
// DOM CONTENT LOADED INITIALIZATION
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('scriptflow_theme_main')) { document.body.classList.add('dark'); localStorage.setItem('scriptflow_theme_main', 'dark'); }
    else if (localStorage.getItem('scriptflow_theme_main') === 'dark') document.body.classList.add('dark');
    
    auth.onAuthStateChanged(async (user) => {
        try { if (user) { currentUser = user; updateSidebarProfile(currentUser); await loadUserData(); subscribeToChanges(); initializeApp(); } else showAuthModal(); }
        catch (error) { handleError(error, 'Auth State Change'); }
    });

    document.getElementById('signOutBtn')?.addEventListener('click', function(e) { e.preventDefault(); signOut(); });
    document.getElementById('refreshBtn')?.addEventListener('click', function(e) { e.preventDefault(); refreshData(); });
    
    window.addEventListener('online', () => { showOfflineIndicator(false); showToast('Back online! Syncing data...', 'success'); refreshData(); });
    window.addEventListener('offline', () => { showOfflineIndicator(true); showToast('You are offline.', 'error'); });
});

function initializeApp() {
    document.getElementById('toolsHeader')?.addEventListener('click', () => { toolsOpen = !toolsOpen; document.getElementById('toolsMenu')?.classList.toggle('open'); document.getElementById('toolsChevron')?.classList.toggle('rotated'); });
    document.querySelectorAll('.tool-item').forEach(item => { item.addEventListener('click', (e) => { const text = item.innerText; if (text.includes('Analytics')) showFeaturePanel('analytics', 'Analytics Hub'); else if (text.includes('Calendar')) showFeaturePanel('calendar', 'Appointment Calendar'); else if (text.includes('Tasks')) showFeaturePanel('tasks', 'Follow-up Tasks'); else if (text.includes('Dark')) toggleTheme(); }); });
    
    document.getElementById('closeFeaturePanelBtn')?.addEventListener('click', hideFeaturePanel);
    document.getElementById('bulkActionsBtn')?.addEventListener('click', openBulkActionsModal);
    document.getElementById('closeBulkModalBtn')?.addEventListener('click', () => { document.getElementById('bulkActionsModal').style.display = 'none'; });
    document.getElementById('executeBulkActionBtn')?.addEventListener('click', executeBulkAction);
    
    const menuToggle = document.getElementById('menuToggleBtn'), sidebar = document.getElementById('mainSidebar'), main = document.getElementById('mainContent');
    if (menuToggle) menuToggle.addEventListener('click', () => { sidebar.classList.toggle('closed'); main.classList.toggle('expanded'); localStorage.setItem('sidebarClosed', sidebar.classList.contains('closed')); });
    if (sidebar && localStorage.getItem('sidebarClosed') === 'true') { sidebar.classList.add('closed'); main.classList.add('expanded'); }
    
    document.getElementById('addScriptBtnSide')?.addEventListener('click', addNewScript);
    document.getElementById('editScriptBtn')?.addEventListener('click', enterEdit);
    document.getElementById('saveScriptBtn')?.addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEdit);
    document.getElementById('copyScriptBtn')?.addEventListener('click', copyScript);
    document.getElementById('resetScriptBtn')?.addEventListener('click', resetScript);
    document.getElementById('undoBtn')?.addEventListener('click', () => undoScript(currentScriptId));
    document.getElementById('redoBtn')?.addEventListener('click', () => redoScript(currentScriptId));
    document.getElementById('historyBtn')?.addEventListener('click', showVersionHistoryModal);
    
    // CRM Panel Integration
    document.getElementById('toggleCrmBtn')?.addEventListener('click', toggleCrmPanel);
    document.getElementById('closeCrmBtn')?.addEventListener('click', () => { if (crmPanelOpen) toggleCrmPanel(); });
    document.getElementById('crmZoomInBtn')?.addEventListener('click', () => adjustCrmZoom(0.1));
    document.getElementById('crmZoomOutBtn')?.addEventListener('click', () => adjustCrmZoom(-0.1));
}
