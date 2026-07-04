// ================================================================
// SCRIPTFLOW PRO - COMPLETE WITH SUPABASE BACKEND & GOOGLE SIGN-IN
// ================================================================

// ---- SUPABASE CLIENT INITIALIZATION ----
let supabaseClient = null;
let currentUser = null;
let authModalOpen = false;

// Initialize Supabase
function initSupabase() {
  if (typeof SUPABASE_CONFIG === 'undefined') {
    console.error('SUPABASE_CONFIG not found. Please create config.js');
    showToast('Please configure Supabase credentials in config.js', 'error');
    return false;
  }
  
  try {
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('✅ Supabase initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    showToast('Failed to connect to Supabase. Check your credentials.', 'error');
    return false;
  }
}

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
// AUTHENTICATION WITH GOOGLE
// ================================================================

// Google Sign-In function
async function signInWithGoogle() {
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    
    if (error) throw error;
    
    showToast('Redirecting to Google...', 'info');
    return true;
  } catch (error) {
    console.error('Google Sign-In error:', error);
    showToast('Google Sign-In failed. Please try again.', 'error');
    return false;
  }
}

// Check authentication with OAuth redirect handling
async function checkAuth() {
  // Check if we're returning from OAuth
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  
  // If we have an access token in the URL, the OAuth flow completed
  if (hash.includes('access_token') || params.get('access_token')) {
    // The Supabase client will handle this automatically
    // Clean up the URL
    if (hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    // Reload to process the session
    setTimeout(() => {
      window.location.reload();
    }, 500);
    return false;
  }
  
  try {
    // First check if we have a session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (sessionError) {
      console.warn('Session check error:', sessionError);
      showAuthModal();
      return false;
    }
    
    if (!session) {
      // No session, show auth modal
      showAuthModal();
      return false;
    }
    
    // We have a session, get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError) {
      console.warn('Get user error:', userError);
      showAuthModal();
      return false;
    }
    
    if (user) {
      currentUser = user;
      document.getElementById('userEmail').textContent = user.email;
      document.getElementById('userInfo').style.display = 'block';
      await loadUserData();
      showToast('Welcome back! 👋', 'success');
      return true;
    } else {
      showAuthModal();
      return false;
    }
  } catch (error) {
    console.error('Auth check error:', error);
    showAuthModal();
    return false;
  }
}

async function signUp(email, password, username) {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
    if (data.user) {
      try {
        await supabaseClient.from('profiles').upsert({
          id: data.user.id,
          username: username,
          full_name: username,
          updated_at: new Date().toISOString()
        });
        
        await supabaseClient.from('goals').insert({
          user_id: data.user.id,
          daily: 3,
          weekly: 15,
          monthly: 60
        });
      } catch (profileError) {
        console.warn('Profile creation error:', profileError);
      }
      
      showToast('Account created! 🎉', 'success');
      closeAuthModal();
      
      // Auto sign in after registration
      const signInResult = await signIn(email, password);
      if (!signInResult) {
        showAuthModal();
        document.getElementById('loginTabBtn')?.click();
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
        showToast('Please sign in with your credentials', 'info');
      }
      return true;
    }
  } catch (error) {
    console.error('Signup error:', error);
    showToast(error.message || 'Signup failed. Please try again.', 'error');
    return false;
  }
}

async function signIn(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    if (data.user) {
      currentUser = data.user;
      document.getElementById('userEmail').textContent = data.user.email;
      document.getElementById('userInfo').style.display = 'block';
      await loadUserData();
      showToast('Welcome back! 👋', 'success');
      closeAuthModal();
      return true;
    }
  } catch (error) {
    console.error('Signin error:', error);
    if (error.message === 'Email not confirmed') {
      showToast('Please confirm your email address first. Check your inbox.', 'error');
    } else {
      showToast(error.message || 'Sign in failed. Please try again.', 'error');
    }
    return false;
  }
}

async function signOut() {
  try {
    await supabaseClient.auth.signOut();
    currentUser = null;
    appointments = {};
    tasks = [];
    scripts = {};
    document.getElementById('userInfo').style.display = 'none';
    showToast('Signed out', 'info');
    updateStats();
    renderSidebar();
    showAuthModal();
  } catch (error) {
    console.error('Signout error:', error);
    showToast('Error signing out', 'error');
  }
}

function showAuthModal() {
  if (authModalOpen) return;
  authModalOpen = true;
  
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
      
      <!-- Google Sign-In Button -->
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
  
  // Google Sign-In Button
  document.getElementById('googleSignInBtn').addEventListener('click', async () => {
    await signInWithGoogle();
  });
  
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
// DATA LOADING
// ================================================================

async function loadUserData() {
  if (!currentUser) return;
  
  try {
    // Load appointments
    const { data: appointmentsData, error: apptError } = await supabaseClient
      .from('appointments')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (apptError) throw apptError;
    
    appointments = {};
    if (appointmentsData) {
      appointmentsData.forEach(appt => {
        if (!appointments[appt.date]) {
          appointments[appt.date] = { count: 0, note: '', reports: [] };
        }
        appointments[appt.date].reports.push(appt);
        appointments[appt.date].count = appointments[appt.date].reports.length;
      });
    }
    
    // Load tasks
    const { data: tasksData, error: taskError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (taskError && taskError.code !== 'PGRST116') throw taskError;
    tasks = tasksData || [];
    
    // Load scripts
    const { data: scriptsData, error: scriptError } = await supabaseClient
      .from('scripts')
      .select('*')
      .eq('user_id', currentUser.id);
    
    if (scriptError && scriptError.code !== 'PGRST116') throw scriptError;
    
    scripts = {};
    if (scriptsData && scriptsData.length > 0) {
      scriptsData.forEach(script => {
        scripts[script.id] = {
          name: script.name,
          content: script.content
        };
      });
    }
    
    if (Object.keys(scripts).length === 0) {
      await createDefaultScripts();
    }
    
    // Load goals
    const { data: goalsData, error: goalsError } = await supabaseClient
      .from('goals')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    
    if (goalsError && goalsError.code !== 'PGRST116') throw goalsError;
    if (goalsData) {
      goals = {
        daily: goalsData.daily || 3,
        weekly: goalsData.weekly || 15,
        monthly: goalsData.monthly || 60
      };
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
    if (error.code !== 'PGRST116') {
      showToast('Error loading data. Please refresh.', 'error');
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
  
  for (const [id, script] of Object.entries(defaultScripts)) {
    try {
      await supabaseClient.from('scripts').insert({
        id: id,
        user_id: currentUser.id,
        name: script.name,
        content: script.content,
        version: 1
      });
    } catch (error) {
      console.warn('Script already exists:', id, error);
    }
  }
  
  await loadUserData();
}

// ================================================================
// DATA SYNC FUNCTIONS
// ================================================================

async function syncAppointment(appointment) {
  if (!currentUser) return false;
  
  try {
    const data = {
      ...appointment,
      user_id: currentUser.id,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabaseClient
      .from('appointments')
      .upsert(data, { onConflict: 'id' });
    
    if (error) {
      console.error('Sync appointment error:', error);
      showToast('Error saving appointment', 'error');
      return false;
    }
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
    const { error } = await supabaseClient
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);
    
    if (error) {
      console.error('Delete appointment error:', error);
      showToast('Error deleting appointment', 'error');
      return false;
    }
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
    const data = {
      ...task,
      user_id: currentUser.id,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabaseClient
      .from('tasks')
      .upsert(data, { onConflict: 'id' });
    
    if (error) {
      console.error('Sync task error:', error);
      showToast('Error saving task', 'error');
      return false;
    }
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
    const { error } = await supabaseClient
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);
    
    if (error) {
      console.error('Delete task error:', error);
      showToast('Error deleting task', 'error');
      return false;
    }
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
    const { error } = await supabaseClient
      .from('scripts')
      .upsert({
        id: scriptId,
        user_id: currentUser.id,
        ...data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Sync script error:', error);
      showToast('Error saving script', 'error');
      return false;
    }
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
    const { error } = await supabaseClient
      .from('script_versions')
      .insert({
        script_id: scriptId,
        user_id: currentUser.id,
        content: content,
        version: version,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Sync script version error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Sync script version error:', error);
    return false;
  }
}

async function syncGoals() {
  if (!currentUser) return false;
  
  try {
    const { error } = await supabaseClient
      .from('goals')
      .upsert({
        user_id: currentUser.id,
        daily: goals.daily,
        weekly: goals.weekly,
        monthly: goals.monthly,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Sync goals error:', error);
      showToast('Error saving goals', 'error');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Sync goals error:', error);
    showToast('Error saving goals', 'error');
    return false;
  }
}

// ================================================================
// REAL-TIME SUBSCRIPTION
// ================================================================

function subscribeToChanges() {
  if (!currentUser) return;
  
  try {
    supabaseClient
      .channel('appointments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `user_id=eq.${currentUser.id}`
      }, () => {
        loadUserData();
        refreshCurrentView();
      })
      .subscribe();
    
    supabaseClient
      .channel('tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${currentUser.id}`
      }, () => {
        loadUserData();
        refreshCurrentView();
      })
      .subscribe();
  } catch (error) {
    console.warn('Realtime subscription error:', error);
  }
}

// ================================================================
// APPOINTMENT CRUD
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
    id: editId || Date.now(),
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

function saveAppointments() {
  updateStats();
}

function saveGoals() {
  localStorage.setItem('scriptflow_goals_main', JSON.stringify(goals));
  syncGoals();
  updateStats();
}

function loadAppointmentData() {
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
// TASKS
// ================================================================

function addTask(description, dueDate, priority = 'medium', appointmentId = null) {
  if (!currentUser) {
    showToast('Please sign in first', 'error');
    return;
  }
  
  const task = {
    id: Date.now(),
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

function saveTasks() {
  updateTaskStats();
}

function loadTasks() {
  updateTaskStats();
}

function updateTaskStats() {
  const pending = tasks.filter(t => !t.completed).length;
  document.getElementById('pendingTasks').innerText = pending;
}

function getTasksForAppointment(appointmentId) {
  return tasks.filter(t => t.appointmentId === appointmentId);
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
  if (currentVersionIndex[id] < versionHistory[id].length - 1) versionHistory[id] = versionHistory[id].slice(0, currentVersionIndex[id] + 1);
  versionHistory[id].push({ content: newContent, timestamp: new Date().toISOString() });
  currentVersionIndex[id] = versionHistory[id].length - 1;
  localStorage.setItem('scriptflow_version_history', JSON.stringify(versionHistory));
  syncScriptVersion(id, currentVersionIndex[id] + 1, newContent);
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
  }
  
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
  
  for (const [id, script] of Object.entries(scripts)) {
    syncScript(id, script);
  }
  
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
  const scoreCounts = { hot: 0, warm: 0, cold: 0 };
  selectedAppts.forEach(a => {
    const s = getStatus(a);
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    const score = calculateLeadScore(a);
    if (score >= 70) scoreCounts.hot++;
    else if (score >= 40) scoreCounts.warm++;
    else scoreCounts.cold++;
  });
  
  const kpiHtml = `
            <div class="kpi-row">
              <div class="kpi-card"><div class="kpi-value">${total}</div><div class="kpi-label">Total</div></div>
              <div class="kpi-card"><div class="kpi-value">${statusCounts['Warm Call Booked'] || 0}</div><div class="kpi-label">Warm Call</div></div>
              <div class="kpi-card"><div class="kpi-value">${statusCounts['Meeting Booked'] || 0}</div><div class="kpi-label">Meeting</div></div>
              <div class="kpi-card"><div class="kpi-value">${statusCounts['Held'] || 0}</div><div class="kpi-label">Held</div></div>
              <div class="kpi-card"><div class="kpi-value">${scoreCounts.hot}</div><div class="kpi-label">🔥 Hot Leads</div></div>
              <div class="kpi-card"><div class="kpi-value">${scoreCounts.warm}</div><div class="kpi-label">Warm Leads</div></div>
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
                <option value="score" ${currentSort === 'score' ? 'selected' : ''}>Sort by Lead Score</option>
              </select>
              <button class="action-icon-btn" id="quickAddFromCalendar"><i class="fas fa-plus"></i> Add</button>
              <button class="action-icon-btn" id="smartAddFromCalendar"><i class="fas fa-magic"></i> Import</button>
              <button class="action-icon-btn" id="bulkFromCalendar"><i class="fas fa-check-double"></i> Bulk</button>
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
    case 'time':
      filtered.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      break;
    case 'status':
      filtered.sort((a, b) => getStatus(a).localeCompare(getStatus(b)));
      break;
    case 'name':
      filtered.sort((a, b) => a.business.localeCompare(b.business));
      break;
    case 'score':
      filtered.sort((a, b) => calculateLeadScore(b) - calculateLeadScore(a));
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
    const score = calculateLeadScore(a);
    const scoreLabel = getScoreLabel(score);
    const scoreClass = getScoreColor(score);
    const tagsDisplay = getTagDisplay(a.tags);
    const hasCrmLink = a.crmLink && a.crmLink.trim() !== '';
    const isSelected = selectedAppointments.has(a.id);
    return `
              <div class="appointment-card" draggable="true" data-id="${a.id}" data-date="${dateStr}">
                <div class="card-row">
                  <div class="business-name">
                    <input type="checkbox" class="bulk-checkbox" data-id="${a.id}" ${isSelected ? 'checked' : ''} />
                    <i class="fas fa-building"></i> ${escapeHtml(a.business)}
                    <span class="status-tag ${getStatusClassSmall(status)}">${escapeHtml(status)}</span>
                    <span class="score-badge ${scoreClass}">${scoreLabel} (${score})</span>
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
                <div style="display:flex; gap:8px; align-items:center; margin-top:4px; flex-wrap:wrap;">
                  <select class="status-select-calendar" data-id="${a.id}" data-date="${dateStr}" style="padding:4px 8px; border-radius:20px; font-size:0.7rem; background:var(--bg-primary); border:1px solid var(--border-color);">
                    ${STATUS_OPTIONS.map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                  <button class="action-icon-btn add-task-btn" data-id="${a.id}" title="Add Task"><i class="fas fa-plus-circle"></i> Task</button>
                  ${getTasksForAppointment(a.id).length > 0 ? `<span style="font-size:0.7rem; color:var(--text-muted);">${getTasksForAppointment(a.id).filter(t => !t.completed).length} pending tasks</span>` : ''}
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
  const target = e.target.closest('button');
  
  if (e.target.classList.contains('bulk-checkbox')) {
    const id = parseInt(e.target.getAttribute('data-id'));
    if (e.target.checked) {
      selectedAppointments.add(id);
    } else {
      selectedAppointments.delete(id);
    }
    return;
  }
  
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

  if (target.classList.contains('add-task-btn')) {
    e.preventDefault();
    const id = parseInt(target.getAttribute('data-id'));
    const date = target.getAttribute('data-date');
    const appt = appointments[date]?.reports?.find(r => r.id === id);
    if (appt) {
      openAddTaskModalWithAppointment(appt);
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
  modal.innerHTML = `
    <div class="modal-card">
      <h3><i class="fas fa-plus-circle"></i> Add Task for ${escapeHtml(appt.business)}</h3>
      <div class="form-group">
        <label>Task Description *</label>
        <input type="text" id="taskDescription" placeholder="What needs to be done?" value="Follow up with ${escapeHtml(appt.business)}" />
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="taskDueDate" />
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="taskPriority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button id="saveTaskBtn" class="btn-icon" style="background:var(--success); color:white;">Save</button>
        <button id="cancelTaskBtn" class="btn-icon">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('saveTaskBtn').addEventListener('click', () => {
    const desc = document.getElementById('taskDescription').value.trim();
    if (!desc) { showToast('Please enter a description', 'error'); return; }
    const dueDate = document.getElementById('taskDueDate').value || null;
    const priority = document.getElementById('taskPriority').value;
    
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

// ================================================================
// TASKS PANEL
// ================================================================

function renderTasksPanel(container) {
  let filteredTasks = tasks;
  
  if (taskFilter === 'pending') {
    filteredTasks = tasks.filter(t => !t.completed);
  }
  
  filteredTasks.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  const toolbarHtml = `
    <div class="tasks-toolbar">
      <div class="search-wrapper">
        <i class="fas fa-search"></i>
        <input type="text" id="taskSearchInput" placeholder="Search tasks..." />
      </div>
      <button class="action-icon-btn" id="addTaskBtn"><i class="fas fa-plus"></i> New Task</button>
      <button class="action-icon-btn" id="taskRefreshBtn"><i class="fas fa-sync"></i> Refresh</button>
    </div>
  `;
  
  const listHtml = `
    <div class="tasks-list">
      ${filteredTasks.length === 0 ? 
        `<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks found</p><button class="btn-icon" id="emptyAddTaskBtn" style="margin-top:12px;"><i class="fas fa-plus"></i> Add Task</button></div>` :
        filteredTasks.map(task => {
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
          const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString() && !task.completed;
          const priorityClass = task.priority === 'high' ? 'task-priority-high' : task.priority === 'medium' ? 'task-priority-medium' : 'task-priority-low';
          const statusClass = task.completed ? 'task-completed' : (isOverdue ? 'task-overdue' : (isDueToday ? 'task-due-today' : ''));
          
          return `
            <div class="task-card ${statusClass}">
              <div class="task-row">
                <div class="task-title">
                  <i class="fas ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                  ${escapeHtml(task.description)}
                  <span class="${priorityClass}">${task.priority.toUpperCase()}</span>
                </div>
                <div class="task-actions">
                  <button class="action-icon-btn success complete-task" data-id="${task.id}" title="Toggle Complete">
                    <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                  </button>
                  <button class="action-icon-btn delete-task" data-id="${task.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
              </div>
              <div class="task-meta">
                ${task.dueDate ? `<span><i class="fas fa-calendar"></i> Due: ${formatDate(task.dueDate)} ${isOverdue ? '⚠️ Overdue' : ''}</span>` : ''}
                ${task.appointmentId ? `<span><i class="fas fa-building"></i> Linked to appointment</span>` : ''}
                <span><i class="fas fa-clock"></i> Created: ${formatDate(task.createdAt)}</span>
              </div>
            </div>
          `;
        }).join('')
      }
    </div>
  `;
  
  container.innerHTML = `
    <div class="tasks-section">
      <h4 style="display:flex; align-items:center; gap:8px; margin:0;">
        <i class="fas fa-tasks"></i> Follow-up Tasks
        <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">${tasks.filter(t => !t.completed).length} pending</span>
      </h4>
      <div class="kpi-row" style="margin-bottom:16px;">
        <div class="kpi-card"><div class="kpi-value">${tasks.length}</div><div class="kpi-label">Total</div></div>
        <div class="kpi-card"><div class="kpi-value">${tasks.filter(t => !t.completed).length}</div><div class="kpi-label">Pending</div></div>
        <div class="kpi-card"><div class="kpi-value">${tasks.filter(t => t.completed).length}</div><div class="kpi-label">Completed</div></div>
        <div class="kpi-card"><div class="kpi-value">${tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed).length}</div><div class="kpi-label">Overdue</div></div>
      </div>
      ${toolbarHtml}
      ${listHtml}
    </div>
  `;
  
  document.getElementById('addTaskBtn')?.addEventListener('click', openAddTaskModal);
  document.getElementById('emptyAddTaskBtn')?.addEventListener('click', openAddTaskModal);
  document.getElementById('taskRefreshBtn')?.addEventListener('click', () => renderTasksPanel(container));
  
  document.getElementById('taskSearchInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.task-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(term) ? '' : 'none';
    });
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
  const id = parseInt(e.currentTarget.getAttribute('data-id'));
  toggleTaskComplete(id);
  refreshCurrentView();
}

function handleTaskDelete(e) {
  const id = parseInt(e.currentTarget.getAttribute('data-id'));
  if (confirm('Delete this task?')) {
    deleteTask(id);
    refreshCurrentView();
    showToast('Task deleted', 'info');
  }
}

function openAddTaskModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <h3><i class="fas fa-plus-circle"></i> Add Follow-up Task</h3>
      <div class="form-group">
        <label>Task Description *</label>
        <input type="text" id="taskDescription" placeholder="What needs to be done?" />
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="taskDueDate" />
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="taskPriority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div class="form-group">
        <label>Link to Appointment (Optional)</label>
        <select id="taskAppointment">
          <option value="">None</option>
        </select>
      </div>
      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button id="saveTaskBtn" class="btn-icon" style="background:var(--success); color:white;">Save</button>
        <button id="cancelTaskBtn" class="btn-icon">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const select = document.getElementById('taskAppointment');
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
    const desc = document.getElementById('taskDescription').value.trim();
    if (!desc) { showToast('Please enter a description', 'error'); return; }
    const dueDate = document.getElementById('taskDueDate').value || null;
    const priority = document.getElementById('taskPriority').value;
    const appointmentId = document.getElementById('taskAppointment').value ? parseInt(document.getElementById('taskAppointment').value) : null;
    
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

  container.innerHTML = `
            <div class="appointments-toolbar">
              <div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="listSearchInput" placeholder="Search all..." value="${escapeHtml(currentListSearchTerm)}" /></div>
              <select id="listStatusFilter"><option value="all" ${currentStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>${STATUS_OPTIONS.map(s => `<option value="${s}" ${currentStatusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
              <select id="listTagFilter"><option value="all" ${currentTagFilter === 'all' ? 'selected' : ''}>All Tags</option>${TAG_OPTIONS.map(t => `<option value="${t.id}" ${currentTagFilter === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
              <button class="action-icon-btn" id="listSmartImport"><i class="fas fa-magic"></i> Import</button>
              <button class="action-icon-btn" id="listBulkBtn"><i class="fas fa-check-double"></i> Bulk</button>
            </div>
            <div class="appointments-list" id="appointmentsListContainer">
              ${filtered.length === 0 ? `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>No appointments found</p></div>` :
              filtered.map(a => `
                    <div class="appointment-card">
                      <div class="card-row">
                        <div class="business-name">
                          <input type="checkbox" class="bulk-checkbox" data-id="${a.id}" ${selectedAppointments.has(a.id) ? 'checked' : ''} />
                          <i class="fas fa-building"></i> ${escapeHtml(a.business)} 
                          <span class="status-tag ${getStatusClassSmall(getStatus(a))}">${escapeHtml(getStatus(a))}</span>
                          <span class="score-badge ${getScoreColor(calculateLeadScore(a))}">${getScoreLabel(calculateLeadScore(a))} (${calculateLeadScore(a)})</span>
                        </div>
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
  document.getElementById('listBulkBtn')?.addEventListener('click', openBulkActionsModal);
  
  setupDelegatedEventListeners();
}

// ================================================================
// ANALYTICS HUB
// ================================================================

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
                  <input type="date" id="customEndDate" value="${dashboardDateRange.end}" class="date-input>
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
  const avgScore = appointmentsInRange.reduce((sum, a) => sum + calculateLeadScore(a), 0) / (appointmentsInRange.length || 1);
  const hotLeads = appointmentsInRange.filter(a => calculateLeadScore(a) >= 70).length;
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
    <button id="closeHelp" class="btn-icon" style="margin-top:16px;">Got it</button></div>`;
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

  if (!scriptPanel || !featurePanel) return;

  analyticsTabs.style.display = 'none';
  calendarTabs.style.display = 'none';
  taskTabs.style.display = 'none';

  featureTitle.innerHTML = `<i class="fas ${featureType === 'analytics' ? 'fa-chart-pie' : (featureType === 'calendar' ? 'fa-calendar-alt' : 'fa-tasks')}"></i> ${title}`;

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
  if (currentView === 'calendar') {
    renderCalendarPanel(container);
  } else if (currentView === 'tasks') {
    renderTasksPanel(container);
  } else if (currentView === 'analytics') {
    renderAnalyticsHub(container);
  } else {
    renderListView(container);
  }
}

// ================================================================
// APP INITIALIZATION
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize Supabase
  const initialized = initSupabase();
  if (!initialized) {
    showToast('Failed to initialize Supabase. Check your config.', 'error');
    return;
  }
  
  // Check authentication first
  checkAuth().then(authenticated => {
    if (authenticated) {
      subscribeToChanges();
      initializeApp();
    }
  });

  document.getElementById('signOutBtn')?.addEventListener('click', signOut);
});

function initializeApp() {
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