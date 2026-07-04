// ================================================================
// SCRIPTFLOW PRO - COMPLETE FIREBASE BACKEND (FIXED)
// ================================================================

// ---- GLOBAL STATE ----
let currentUser = null;
let authModalOpen = false;
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
// FIREBASE AUTHENTICATION (FIXED)
// ================================================================

// Get user's photo URL from Firebase
function getUserPhotoURL(user) {
    if (!user) return null;
    // Check for photoURL from Google
    if (user.photoURL) return user.photoURL;
    // Check for avatar from provider data
    if (user.providerData && user.providerData.length > 0) {
        const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
        if (googleProvider && googleProvider.photoURL) return googleProvider.photoURL;
    }
    return null;
}

// Update user profile display
function updateUserProfile(user) {
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    
    if (!user) {
        userInfo.style.display = 'none';
        return;
    }
    
    userInfo.style.display = 'block';
    userEmail.textContent = user.email || user.displayName || 'User';
    
    // Handle avatar
    const photoURL = getUserPhotoURL(user);
    if (photoURL) {
        // Use image for avatar
        userAvatar.innerHTML = `<img src="${photoURL}" alt="${user.displayName || 'User'}" class="user-avatar" referrerpolicy="no-referrer" />`;
    } else {
        // Use initials fallback
        const initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
        userAvatar.innerHTML = `<div class="user-avatar-placeholder">${initials}</div>`;
    }
}

function updateSidebarProfile(user) {
    const userInfoContainer = document.getElementById('userInfo');
    if (!userInfoContainer) return;
    
    if (!user) {
        userInfoContainer.style.display = 'none';
        return;
    }
    
    userInfoContainer.style.display = 'block';
    
    // Create or update avatar element
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
        avatarHtml = `<img src="${photoURL}" alt="${displayName}" class="user-avatar" referrerpolicy="no-referrer" />`;
    } else {
        const initials = displayName.charAt(0).toUpperCase();
        avatarHtml = `<div class="user-avatar-placeholder">${initials}</div>`;
    }
    
    avatarContainer.innerHTML = `
        ${avatarHtml}
        <span class="user-email">${user.email || displayName}</span>
    `;
}

// Google Sign-In
async function signInWithGoogle() {
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
            return true;
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        showToast(error.message || 'Google Sign-In failed', 'error');
        return false;
    }
}

// Email/Password Sign Up
async function signUp(email, password, username) {
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        
        if (result.user) {
            await result.user.updateProfile({ displayName: username });
            
            // Create user document in Firestore
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
            return true;
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast(error.message || 'Signup failed', 'error');
        return false;
    }
}

// Email/Password Sign In
async function signIn(email, password) {
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        
        if (result.user) {
            currentUser = result.user;
            updateSidebarProfile(currentUser);
            await loadUserData();
            showToast('Welcome back! 👋', 'success');
            closeAuthModal();
            return true;
        }
    } catch (error) {
        console.error('Signin error:', error);
        showToast(error.message || 'Sign in failed', 'error');
        return false;
    }
}

// Sign Out (FIXED)
async function signOut() {
    try {
        // Clear local state first
        currentUser = null;
        appointments = {};
        tasks = [];
        scripts = {};
        scriptOrder = [];
        
        // Update UI before signing out
        updateSidebarProfile(null);
        updateStats();
        renderSidebar();
        
        // Sign out from Firebase
        await auth.signOut();
        
        showToast('Signed out successfully', 'info');
        
        // Show auth modal after sign out
        setTimeout(() => {
            showAuthModal();
        }, 300);
        
    } catch (error) {
        console.error('Signout error:', error);
        showToast('Error signing out. Please try again.', 'error');
    }
}

// ---- AUTH MODAL ----
function showAuthModal() {
    if (authModalOpen) return;
    authModalOpen = true;
    
    // Remove any existing modal
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
    
    // Google Sign-In
    document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
    
    // Tab switching
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
    
    // Login
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        await signIn(email, password);
    });
    
    // Signup
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
    
    // Enter key support
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
    
    // Click outside
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
// FIREBASE DATA LOADING
// ================================================================

async function loadUserData() {
    if (!currentUser) return;
    
    try {
        // Load user document
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
        
        // Load goals
        if (userData.goals) {
            goals = {
                daily: userData.goals.daily || 3,
                weekly: userData.goals.weekly || 15,
                monthly: userData.goals.monthly || 60
            };
        }
        
        // Load script order
        scriptOrder = userData.scriptOrder || ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing'];
        
        // Load appointments
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
        
        // Load tasks
        const tasksSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('tasks')
            .orderBy('createdAt', 'desc')
            .get();
        
        tasks = [];
        tasksSnapshot.forEach(doc => {
            tasks.push({ ...doc.data(), id: doc.id });
        });
        
        // Load scripts
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
        
        // If no scripts, create defaults
        if (Object.keys(scripts).length === 0) {
            await createDefaultScripts();
            return loadUserData();
        }
        
        // Load version history
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
        
        // Initialize version indices
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
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading data. Please refresh.', 'error');
    }
}

async function createDefaultScripts() {
    if (!currentUser) return;
    
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
    
    const batch = db.batch();
    const scriptsRef = db.collection('users').doc(currentUser.uid).collection('scripts');
    
    for (const [id, script] of Object.entries(defaultScripts)) {
        const docRef = scriptsRef.doc(id);
        batch.set(docRef, {
            name: script.name,
            content: script.content,
            version: 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const versionRef = db.collection('users').doc(currentUser.uid)
            .collection('scriptVersions').doc();
        batch.set(versionRef, {
            scriptId: id,
            content: script.content,
            version: 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    
    const userRef = db.collection('users').doc(currentUser.uid);
    batch.update(userRef, {
        scriptOrder: ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing']
    });
    
    await batch.commit();
}

// ================================================================
// FIREBASE DATA SYNC FUNCTIONS
// ================================================================

async function syncAppointment(appointment) {
    if (!currentUser) return false;
    
    try {
        const docRef = db.collection('users').doc(currentUser.uid)
            .collection('appointments').doc(appointment.id.toString());
        
        await docRef.set({
            ...appointment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Sync appointment error:', error);
        showToast('Error saving appointment', 'error');
        return false;
    }
}

async function deleteAppointmentRemote(id) {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('appointments').doc(id.toString()).delete();
        return true;
    } catch (error) {
        console.error('Delete appointment error:', error);
        showToast('Error deleting appointment', 'error');
        return false;
    }
}

async function syncTask(task) {
    if (!currentUser) return false;
    
    try {
        const docRef = db.collection('users').doc(currentUser.uid)
            .collection('tasks').doc(task.id.toString());
        
        await docRef.set({
            ...task,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Sync task error:', error);
        showToast('Error saving task', 'error');
        return false;
    }
}

async function deleteTaskRemote(id) {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('tasks').doc(id.toString()).delete();
        return true;
    } catch (error) {
        console.error('Delete task error:', error);
        showToast('Error deleting task', 'error');
        return false;
    }
}

async function syncScript(scriptId, data) {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('scripts').doc(scriptId).set({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        return true;
    } catch (error) {
        console.error('Sync script error:', error);
        showToast('Error saving script', 'error');
        return false;
    }
}

async function syncScriptVersion(scriptId, version, content) {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('scriptVersions').add({
                scriptId: scriptId,
                content: content,
                version: version,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        return true;
    } catch (error) {
        console.error('Sync script version error:', error);
        return false;
    }
}

async function syncGoals() {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            'goals.daily': goals.daily,
            'goals.weekly': goals.weekly,
            'goals.monthly': goals.monthly,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Sync goals error:', error);
        showToast('Error saving goals', 'error');
        return false;
    }
}

async function syncScriptOrder() {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            scriptOrder: scriptOrder,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Sync script order error:', error);
        showToast('Error saving script order', 'error');
        return false;
    }
}

// ================================================================
// REAL-TIME SUBSCRIPTION
// ================================================================

function subscribeToChanges() {
    if (!currentUser) return;
    
    try {
        // Subscribe to appointments with proper error handling
        db.collection('users').doc(currentUser.uid)
            .collection('appointments')
            .onSnapshot((snapshot) => {
                if (!snapshot.empty) {
                    loadUserData();
                    refreshCurrentView();
                }
            }, (error) => {
                console.warn('Appointments subscription error:', error);
            });
        
        // Subscribe to tasks
        db.collection('users').doc(currentUser.uid)
            .collection('tasks')
            .onSnapshot((snapshot) => {
                if (!snapshot.empty) {
                    loadUserData();
                    refreshCurrentView();
                }
            }, (error) => {
                console.warn('Tasks subscription error:', error);
            });
    } catch (error) {
        console.warn('Realtime subscription error:', error);
    }
}

// ================================================================
// APPOINTMENT CRUD (with Firebase sync)
// ================================================================

function addAppointment(dateStr, business, contactName, role, phone, time, notes, assigned, editId = null, status = 'Warm Call Booked', crmLink = '', tags = []) {
    if (!currentUser) {
        showToast('Please sign in first', 'error');
        return;
    }
    
    if (!appointments[dateStr]) appointments[dateStr] = { count: 0, note: '', reports: [] };
    if (!STATUS_OPTIONS.includes(status)) {
        status = 'Warm Call Booked';
    }
    
    const newAppt = {
        id: editId || Date.now().toString(),
        business,
        contactName,
        role: role || 'Owner',
        phone: phone || '',
        time: time || '',
        notes: notes || '',
        assigned: assigned || 'Daniel',
        status: status || 'Warm Call Booked',
        crmLink: crmLink || '',
        tags: tags || [],
        date: dateStr,
        createdAt: new Date().toISOString(),
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

function deleteAppointment(dateStr, id) {
    if (appointments[dateStr]?.reports) {
        appointments[dateStr].reports = appointments[dateStr].reports.filter(r => r.id !== id);
        if (appointments[dateStr].reports.length === 0) delete appointments[dateStr];
        else appointments[dateStr].count = appointments[dateStr].reports.length;
        
        deleteAppointmentRemote(id);
        updateStats();
        return true;
    }
    return false;
}

function saveAppointments() { updateStats(); }

function saveGoals() {
    syncGoals();
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
    let total = 0;
    let count = 0;
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
    document.getElementById('statToday').innerText = getTodayCount();
    document.getElementById('statWeek').innerText = getWeekCount();
    document.getElementById('statMonth').innerText = getMonthCount();
    document.getElementById('goalDaily').innerText = goals.daily;
    document.getElementById('goalWeekly').innerText = goals.weekly;
    document.getElementById('goalMonthly').innerText = goals.monthly;
    document.getElementById('avgScore').innerText = getAverageScore();
    updateTaskStats();
}

// ================================================================
// TASKS (with Firebase sync)
// ================================================================

function addTask(description, dueDate, priority = 'medium', appointmentId = null) {
    if (!currentUser) {
        showToast('Please sign in first', 'error');
        return;
    }
    
    const task = {
        id: Date.now().toString(),
        description,
        dueDate: dueDate || null,
        priority,
        appointmentId,
        completed: false,
        createdAt: new Date().toISOString()
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
    if (task) {
        task.completed = !task.completed;
        syncTask(task);
        updateTaskStats();
    }
}

function updateTaskStats() {
    const pending = tasks.filter(t => !t.completed).length;
    document.getElementById('pendingTasks').innerText = pending;
}

function getTasksForAppointment(appointmentId) {
    return tasks.filter(t => t.appointmentId === appointmentId);
}

// ================================================================
// SCRIPT MANAGEMENT (with Firebase sync)
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
    if (!versionHistory[id] || currentVersionIndex[id] <= 0) {
        showToast('No earlier version', 'error');
        return;
    }
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
    if (!versionHistory[id] || currentVersionIndex[id] >= versionHistory[id].length - 1) {
        showToast('No newer version', 'error');
        return;
    }
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
        scripts = JSON.parse(JSON.stringify(defaultScripts));
        scriptOrder = ['opening', 'owner_yes', 'owner_no', 'objection_website', 'objection_webguy', 'objection_cost', 'objection_busy', 'objection_not_interested', 'objection_info', 'objection_found_me', 'closing'];
    }
}

function saveAllScripts() {
    for (const [id, script] of Object.entries(scripts)) {
        syncScript(id, script);
    }
    syncScriptOrder();
    
    document.getElementById('saveStatus').innerHTML = '<i class="fas fa-check"></i> Saved';
    setTimeout(() => {
        if (!isEditing) document.getElementById('saveStatus').innerHTML = '<i class="fas fa-save"></i> Auto';
    }, 1500);
}

// ---- SCRIPT ORDER FUNCTIONS ----
function getOrderedVisible() {
    let order = scriptOrder.length > 0 ? scriptOrder : customOrder;
    let ids = [...order.filter(id => scripts[id]), ...Object.keys(scripts).filter(id => !order.includes(id))];
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

function renderSidebar() {
    const container = document.getElementById('scriptListContainer');
    if (!container) return;
    const visible = getOrderedVisible();
    if (!visible.length) {
        container.innerHTML = '<div style="padding:20px;">No scripts</div>';
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
                if (currentScriptId === id) {
                    document.getElementById('currentScriptName').innerHTML = scripts[id].name;
                }
                showToast('Renamed', 'success');
            }
        });
    });
    
    document.querySelectorAll('.delete-script').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (id === 'opening') {
                showToast('Cannot delete opening', 'error');
                return;
            }
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

function copyScript() {
    copyToClipboard(scripts[currentScriptId].content);
}

function resetScript() {
    if (confirm('Reset this script to default?')) {
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
    if (isEditing) {
        showToast('Finish editing first', 'error');
        return;
    }
    const name = prompt('Script name:');
    if (!name) return;
    const id = 'custom_' + Date.now();
    scripts[id] = { name, content: 'Write your script here...' };
    scriptOrder.push(id);
    initVersionHistory(id, scripts[id].content);
    saveAllScripts();
    renderSidebar();
    loadScript(id);
    showToast(`Added: ${name}`, 'success');
}

function showVersionHistoryModal() {
    if (!versionHistory[currentScriptId]) {
        showToast('No history', 'error');
        return;
    }
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
            result.parsedDate = tomorrow.toISOString().split('T')[0];
        } else if (result.time.toLowerCase().includes('today')) {
            result.parsedDate = getTodayStr();
        }
    }
    const noteMatch = text.match(/(?:Note|Notes)[:\s]+([^\n]+)/i);
    if (noteMatch) result.notes = noteMatch[1].trim();
    else {
        result.notes = text.replace(/[@Daniel]/g, '').trim();
    }
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
        if (!text.trim()) {
            showToast('Enter details', 'error');
            return;
        }
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
        } else {
            showToast('Ready to save!', 'success');
        }
    });

    document.getElementById('smartSaveBtn').addEventListener('click', () => {
        if (!currentParsed) {
            showToast('Parse first', 'error');
            return;
        }
        if (!currentParsed.business || !currentParsed.contactName) {
            showToast('Business and Contact required', 'error');
            return;
        }
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
    
    if (allAppointments.length === 0) {
        showToast('No appointments to select', 'info');
        return;
    }
    
    let html = `<div style="margin-bottom:12px;">
        <button class="btn-icon" id="selectAllBtn" style="font-size:0.8rem;">Select All</button>
        <button class="btn-icon" id="deselectAllBtn" style="font-size:0.8rem;">Deselect All</button>
        <span style="margin-left:12px; font-size:0.8rem; color:var(--text-muted);">${selectedAppointments.size} selected</span>
    </div>`;
    
    allAppointments.forEach(appt => {
        const checked = selectedAppointments.has(appt.id) ? 'checked' : '';
        html += `
            <div class="bulk-item">
                <input type="checkbox" class="bulk-checkbox-item" data-id="${appt.id}" ${checked} />
                <span><strong>${escapeHtml(appt.business)}</strong> - ${escapeHtml(appt.contactName)}</span>
                <span style="margin-left:auto; font-size:0.8rem; color:var(--text-muted);">${formatDate(appt.date)}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
    modal.style.display = 'flex';
    
    document.querySelectorAll('.bulk-checkbox-item').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (e.target.checked) {
                selectedAppointments.add(id);
            } else {
                selectedAppointments.delete(id);
            }
            updateBulkSelectionCount();
        });
    });
    
    document.getElementById('selectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.bulk-checkbox-item').forEach(cb => {
            cb.checked = true;
            const id = parseInt(cb.getAttribute('data-id'));
            selectedAppointments.add(id);
        });
        updateBulkSelectionCount();
    });
    
    document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.bulk-checkbox-item').forEach(cb => {
            cb.checked = false;
            const id = parseInt(cb.getAttribute('data-id'));
            selectedAppointments.delete(id);
        });
        updateBulkSelectionCount();
    });
    
    const actionSelect = document.getElementById('bulkActionSelect');
    actionSelect.addEventListener('change', () => {
        const val = actionSelect.value;
        document.getElementById('bulkActionOptions').style.display = 'block';
        document.getElementById('bulkStatusGroup').style.display = val === 'status' ? 'block' : 'none';
        document.getElementById('bulkTagGroup').style.display = val === 'tag' ? 'block' : 'none';
    });
    actionSelect.dispatchEvent(new Event('change'));
}

function updateBulkSelectionCount() {
    const count = selectedAppointments.size;
    const container = document.getElementById('bulkSelectionContainer');
    if (container) {
        const existing = container.querySelector('.bulk-count');
        if (existing) existing.textContent = `${count} selected`;
    }
}

function executeBulkAction() {
    if (selectedAppointments.size === 0) {
        showToast('No appointments selected', 'error');
        return;
    }
    
    const action = document.getElementById('bulkActionSelect').value;
    const ids = Array.from(selectedAppointments);
    let count = 0;
    
    switch(action) {
        case 'status': {
            const newStatus = document.getElementById('bulkStatusSelect').value;
            for (let date in appointments) {
                if (appointments[date].reports) {
                    appointments[date].reports.forEach(appt => {
                        if (ids.includes(appt.id)) {
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
                        if (ids.includes(appt.id)) {
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
                        if (ids.includes(appt.id)) {
                            deleteAppointmentRemote(appt.id);
                            count++;
                            return false;
                        }
                        return true;
                    });
                    if (appointments[date].reports.length === 0) {
                        delete appointments[date];
                    } else {
                        appointments[date].count = appointments[date].reports.length;
                    }
                }
            }
            selectedAppointments.clear();
            showToast(`Deleted ${count} appointments`, 'info');
            break;
        }
        case 'export': {
            exportSelectedCSV(ids);
            return;
        }
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
                if (ids.includes(a.id)) {
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

// ================================================================
// CALENDAR & LIST VIEW FUNCTIONS
// ================================================================

// [All existing renderCalendarPanel, filterAndSortAppointments, renderAppointmentsList, 
//  setupDragAndDrop, setupDelegatedEventListeners, handleDelegatedClick, handleDelegatedChange,
//  openAddTaskModalWithAppointment, openEditAppointmentModal, openQuickReportWithDate,
//  renderTasksPanel, handleTaskComplete, handleTaskDelete, openAddTaskModal,
//  renderListView, renderAnalyticsHub, renderInsightsPanel, renderAdvancedReports,
//  toggleTheme, exportToCSV, showHelpModal, toggleToolsMenu, showFeaturePanel,
//  hideFeaturePanel, refreshCurrentView remain exactly as before]

// ================================================================
// APP INITIALIZATION
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            updateSidebarProfile(currentUser);
            await loadUserData();
            subscribeToChanges();
            initializeApp();
        } else {
            // Show auth modal
            showAuthModal();
        }
    });

    // Sign out button - FIXED
    document.getElementById('signOutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        signOut();
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

    document.getElementById('taskListViewBtn')?.addEventListener('click', () => {
        taskFilter = 'all';
        refreshCurrentView();
        document.getElementById('taskListViewBtn').classList.add('active');
        document.getElementById('taskPendingBtn').classList.remove('active');
    });
    document.getElementById('taskPendingBtn')?.addEventListener('click', () => {
        taskFilter = 'pending';
        refreshCurrentView();
        document.getElementById('taskPendingBtn').classList.add('active');
        document.getElementById('taskListViewBtn').classList.remove('active');
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
    });

    setInterval(() => updateStats(), 5000);
}