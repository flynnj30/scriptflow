// ================================================================
// SCRIPTFLOW PRO - COMPLETE WITH DARK MODE, ERROR HANDLING & REFRESH
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

// ---- ERROR HANDLING ----
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    // Show user-friendly error message
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
    const indicator = document.getElementById('offlineIndicator');
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
    
    avatarContainer.innerHTML = `
        ${avatarHtml}
        <span class="user-email">${user.email || displayName}</span>
    `;
}

async function signInWithGoogle() {
    if (authInProgress) {
        showToast('Sign in already in progress...', 'info');
        return;
    }
    
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
    if (authInProgress) {
        showToast('Sign in progress...', 'info');
        return;
    }
    
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
                goals: {
                    daily: 3,
                    weekly: 15,
                    monthly: 60
                },
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
    if (authInProgress) {
        showToast('Sign in progress...', 'info');
        return;
    }
    
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
        
        setTimeout(() => {
            showAuthModal();
        }, 300);
        
    } catch (error) {
        handleError(error, 'Sign Out');
    }
}

function showAuthModal() {
    if (authModalOpen) return;
    authModalOpen = true;
    
    const existingModal = document.getElementById('authModal');
    if (existingModal) {
        existingModal.remove();
    }
    
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
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="loginEmail" placeholder="you@example.com" />
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="loginPassword" placeholder="••••••••" />
                    </div>
                    <button id="loginBtn" class="btn-icon" style="width:100%; justify-content:center; background:var(--primary); color:white;">
                        <i class="fas fa-sign-in-alt"></i> Sign In
                    </button>
                </div>
                
                <div id="signupForm" style="display:none;">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="signupUsername" placeholder="Choose a username" />
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="signupEmail" placeholder="you@example.com" />
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="signupPassword" placeholder="•••••••• (min 6 chars)" />
                    </div>
                    <button id="signupBtn" class="btn-icon" style="width:100%; justify-content:center; background:var(--success); color:white;">
                        <i class="fas fa-user-plus"></i> Create Account
                    </button>
                </div>
            </div>
            
            <div style="margin-top:16px; text-align:center; font-size:0.8rem; color:var(--text-muted);">
                🔒 Your data is securely stored in the cloud
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('googleSignInBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await signInWithGoogle();
    });
    
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
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        await signIn(email, password);
    });
    
    document.getElementById('signupBtn').addEventListener('click', async () => {
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        if (!username || !email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
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
    if (modal) {
        modal.remove();
        authModalOpen = false;
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
                goals: {
                    daily: 3,
                    weekly: 15,
                    monthly: 60
                },
                scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing']
            });
            return loadUserData();
        }
        
        if (userData.goals) {
            goals = {
                daily: userData.goals.daily || 3,
                weekly: userData.goals.weekly || 15,
                monthly: userData.goals.monthly || 60
            };
        }
        
        scriptOrder = userData.scriptOrder || ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing'];
        
        const appointmentsSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('appointments')
            .orderBy('createdAt', 'desc')
            .get();
        
        appointments = {};
        appointmentsSnapshot.forEach(doc => {
            const appt = doc.data();
            if (!appointments[appt.date]) {
                appointments[appt.date] = { count: 0, note: '', reports: [] };
            }
            appointments[appt.date].reports.push({ ...appt, id: doc.id });
            appointments[appt.date].count = appointments[appt.date].reports.length;
        });
        
        const tasksSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('tasks')
            .orderBy('createdAt', 'desc')
            .get();
        
        tasks = [];
        tasksSnapshot.forEach(doc => {
            tasks.push({ ...doc.data(), id: doc.id });
        });
        
        const scriptsSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('scripts')
            .get();
        
        scripts = {};
        scriptsSnapshot.forEach(doc => {
            const data = doc.data();
            scripts[doc.id] = {
                name: data.name,
                content: data.content
            };
        });
        
        if (Object.keys(scripts).length === 0) {
            await createDefaultScripts();
            return loadUserData();
        }
        
        const versionsSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('scriptVersions')
            .orderBy('version', 'asc')
            .get();
        
        versionHistory = {};
        versionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!versionHistory[data.scriptId]) {
                versionHistory[data.scriptId] = [];
            }
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
        if (Object.keys(scripts).length > 0) {
            loadScript('opening');
        }
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

// ---- REFRESH FUNCTION ----
async function refreshData() {
    if (isRefreshing) return;
    isRefreshing = true;
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('spinning');
        refreshBtn.disabled = true;
    }
    
    try {
        showToast('Refreshing data...', 'info');
        await loadUserData(true);
        refreshCurrentView();
        showToast('Data refreshed successfully!', 'success');
    } catch (error) {
        handleError(error, 'Refresh');
    } finally {
        isRefreshing = false;
        if (refreshBtn) {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
}

// ================================================================
// [REST OF THE CODE - KEEP ALL EXISTING IMPLEMENTATIONS]
// ================================================================

// All existing functions: createDefaultScripts, syncAppointment, deleteAppointmentRemote,
// syncTask, deleteTaskRemote, syncScript, syncScriptVersion, syncGoals, syncScriptOrder,
// subscribeToChanges, addAppointment, deleteAppointment, saveAppointments, saveGoals,
// getTodayCount, getWeekCount, getMonthCount, getAverageScore, updateStats, addTask,
// deleteTask, toggleTaskComplete, updateTaskStats, getTasksForAppointment, initVersionHistory,
// saveVersion, undoScript, redoScript, loadScripts, saveAllScripts, getOrderedVisible,
// getKeyMapping, renderSidebar, attachScriptEvents, loadScript, enterEdit, saveEdit,
// cancelEdit, copyScript, resetScript, addNewScript, showVersionHistoryModal,
// parseAppointmentFromText, openSmartAddModal, openBulkActionsModal, updateBulkSelectionCount,
// executeBulkAction, exportSelectedCSV, importCSV, parseCSVRow, renderCalendarPanel,
// filterAndSortAppointments, renderAppointmentsList, setupDragAndDrop, setupDelegatedEventListeners,
// handleDelegatedClick, handleDelegatedChange, openAddTaskModalWithAppointment,
// openEditAppointmentModal, openQuickReportWithDate, renderTasksPanel, handleTaskComplete,
// handleTaskDelete, openAddTaskModal, renderListView, renderAnalyticsHub, getDateRange,
// renderInsightsPanel, renderAdvancedReports, toggleTheme, exportToCSV, showHelpModal,
// toggleToolsMenu, showFeaturePanel, hideFeaturePanel, refreshCurrentView

// ================================================================
// APP INITIALIZATION
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Set dark mode as default
    if (!localStorage.getItem('scriptflow_theme_main')) {
        document.body.classList.add('dark');
        localStorage.setItem('scriptflow_theme_main', 'dark');
    } else if (localStorage.getItem('scriptflow_theme_main') === 'dark') {
        document.body.classList.add('dark');
    }
    
    // Check authentication state
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

    // Sign out button
    document.getElementById('signOutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        signOut();
    });
    
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        refreshData();
    });
    
    // Online/Offline detection
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

    window.addEventListener('keydown', (e) => {
        try {
            if (e.key === 'Escape') {
                const fp = document.getElementById('featurePanel');
                if (fp && fp.style.display === 'block') { hideFeaturePanel(); e.preventDefault(); }
                const bm = document.getElementById('bulkActionsModal');
                if (bm && bm.style.display === 'flex') { bm.style.display = 'none'; e.preventDefault(); }
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
        } catch (error) {
            handleError(error, 'Keyboard Shortcut');
        }
    });

    setInterval(() => updateStats(), 5000);
}