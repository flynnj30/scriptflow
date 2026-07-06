// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

// Replace with your Firebase config from the console
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD_Ry0pM7EKSDJeTegt0rY5muiw-xCgrhw",
    authDomain: "scriptflow-pro-2cf4c.firebaseapp.com",
    projectId: "scriptflow-pro-2cf4c",
    storageBucket: "scriptflow-pro-2cf4c.firebasestorage.app",
    messagingSenderId: "250157640936",
    appId: "1:250157640936:web:cd6218470c302b305aed5d"
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);

// Initialize Firestore
const db = firebase.firestore();

// Apply settings with proper configuration
try {
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        merge: true
    });
} catch (error) {
    console.warn('Firestore settings already applied:', error);
}

// Enable offline persistence with proper error handling
try {
    db.enablePersistence({ synchronizeTabs: true })
        .catch(err => {
            if (err.code !== 'failed-precondition' && err.code !== 'unavailable') {
                console.warn('Firebase persistence error:', err);
            }
        });
} catch (err) {
    console.warn('Firebase persistence setup:', err);
}

// Initialize Auth
const auth = firebase.auth();

// Enable persistence for auth
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => {
        console.warn('Auth persistence error:', err);
    });

// Make available globally
window.db = db;
window.auth = auth;
window.firebase = firebase;

console.log('✅ Firebase initialized successfully');

// ================================================================
// CRM SMART WORKSPACE - ENHANCED WITH PRODUCTIVITY FEATURES
// ================================================================

// Workspace State - Enhanced
const WORKSPACE_CONFIG = {
    HOME_URL: 'https://sales.regen-digital.com/campaigns',
    SEARCH_ENGINE: 'https://www.google.com/search?q=',
    MAX_TABS: 20,
    AUTO_SAVE_INTERVAL: 30000, // 30 seconds
    SESSION_KEY: 'workspace_session_state'
};

// Workspace State
let workspaceState = {
    tabs: [],
    activeTabId: null,
    tabCounter: 0,
    history: {},
    historyIndex: {},
    bookmarks: JSON.parse(localStorage.getItem('workspace_bookmarks') || '[]'),
    clipboardHistory: JSON.parse(localStorage.getItem('workspace_clipboard') || '[]'),
    notes: localStorage.getItem('workspace_notes') || '',
    script: localStorage.getItem('workspace_script') || '',
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

// ================================================================
// ENHANCED WORKSPACE RENDERER
// ================================================================

function renderSmartWorkspace(container) {
    if (!container) return;
    
    // Load state
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
                            <textarea id="wsNotesArea" placeholder="Jot down client notes here...">${workspaceState.notes}</textarea>
                            <span style="font-size:10px; color:var(--text-muted); margin-top:4px;">Auto-saved</span>
                        </div>
                        <div class="panel-section">
                            <h5><i class="fas fa-scroll"></i> Sales Script</h5>
                            <textarea id="wsScriptArea" placeholder="Your sales script...">${workspaceState.script}</textarea>
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
    
    // Initialize workspace
    initEnhancedWorkspace(container);
    renderWorkspaceTabs();
    renderRecentNotes();
    createEnhancedFloatingPanels();
    setupSessionRecovery();
}

// ================================================================
// ENHANCED TAB MANAGEMENT WITH RECOVERY
// ================================================================

function initEnhancedWorkspace(container) {
    // Try to restore session
    const savedSession = loadWorkspaceSession();
    if (savedSession && savedSession.tabs && savedSession.tabs.length > 0) {
        restoreWorkspaceSession(savedSession);
    } else {
        // Create initial tab with CRM homepage
        createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
    }
    
    setupEnhancedWorkspaceEvents(container);
    
    // Load sidebar state
    const sidebarState = localStorage.getItem('workspace_sidebar_open');
    const sidebar = document.getElementById('wsSidebar');
    if (sidebar && sidebarState === 'false') {
        sidebar.classList.add('collapsed');
    }
    
    // Auto-save session periodically
    setInterval(saveWorkspaceSession, WORKSPACE_CONFIG.AUTO_SAVE_INTERVAL);
}

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
    
    // New tab button
    const newTabBtn = document.createElement('div');
    newTabBtn.className = 'ws-new-tab';
    newTabBtn.innerHTML = '<i class="fas fa-plus"></i>';
    newTabBtn.addEventListener('click', () => createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true));
    tabBar.appendChild(newTabBtn);
    
    // Update tab count
    const tabCountEl = document.getElementById('wsTabCount');
    if (tabCountEl) {
        tabCountEl.textContent = `${workspaceState.tabs.length} tabs`;
    }
}

function closeWorkspaceTab(id) {
    const index = workspaceState.tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    
    // Remove from DOM
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
            // Check if session is recent (within 24 hours)
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
    // Clear existing tabs
    workspaceState.tabs = [];
    workspaceState.history = {};
    workspaceState.historyIndex = {};
    
    // Restore tabs
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
    
    // Activate the active tab
    if (workspaceState.activeTabId) {
        switchWorkspaceTab(workspaceState.activeTabId);
    }
    
    renderWorkspaceTabs();
    
    // Show recovery banner
    showSessionRecoveryBanner();
}

function showSessionRecoveryBanner() {
    // Remove existing banner
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

let splitModeActive = false;
let splitDirection = 'horizontal';
let splitRatio = 50;

function toggleSplitScreen() {
    const container = document.getElementById('wsBrowserContainer');
    if (!container) return;
    
    splitModeActive = !splitModeActive;
    
    if (splitModeActive) {
        // Enable split screen
        const mainArea = document.getElementById('wsMainArea');
        const splitDiv = document.createElement('div');
        splitDiv.className = 'workspace-split';
        splitDiv.id = 'wsSplitContainer';
        
        // Move browser content into split
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
        
        // Setup split divider
        const divider = document.getElementById('wsSplitDivider');
        if (divider) {
            divider.addEventListener('mousedown', startSplitResize);
        }
        
        // Setup split load
        document.getElementById('wsSplitLoadBtn')?.addEventListener('click', () => {
            const url = document.getElementById('wsSplitUrlInput')?.value;
            if (url) {
                loadSplitContent(url);
            }
        });
        
        document.getElementById('wsSplitUrlInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value;
                if (url) loadSplitContent(url);
            }
        });
        
        document.getElementById('wsSplitBtn').innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        // Disable split screen
        const splitContainer = document.getElementById('wsSplitContainer');
        if (splitContainer) {
            const pane1 = document.getElementById('wsSplitPane1');
            if (pane1) {
                container.innerHTML = pane1.innerHTML;
            }
            splitContainer.remove();
        }
        document.getElementById('wsSplitBtn').innerHTML = '<i class="fas fa-columns"></i>';
    }
    
    localStorage.setItem('workspace_split_mode', splitModeActive);
}

function loadSplitContent(url) {
    const pane2 = document.getElementById('wsSplitPane2');
    if (!pane2) return;
    
    // Format URL
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
            finalUrl = 'https://' + finalUrl;
        } else {
            finalUrl = WORKSPACE_CONFIG.SEARCH_ENGINE + encodeURIComponent(finalUrl);
        }
    }
    
    // Detect and embed if possible
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
// QUICK COPY LIBRARY
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
    
    // Setup filter buttons
    container.querySelectorAll('.quick-copy-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.quick-copy-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.dataset.filter = btn.dataset.filter;
            renderQuickCopyPanel(container);
        });
    });
    
    // Setup add button
    container.querySelector('#addQuickCopyBtn')?.addEventListener('click', () => {
        openAddQuickCopyModal();
    });
    
    // Setup item actions
    container.querySelectorAll('.copy-use').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.closest('.quick-copy-item').dataset.index);
            const item = filteredItems[index];
            if (item) {
                navigator.clipboard.writeText(item.content).then(() => {
                    showToast('Copied to clipboard!', 'success');
                }).catch(() => {
                    // Fallback
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
    document.getElementById('quickCopyName').value = '';
    document.getElementById('quickCopyContent').value = '';
    document.getElementById('quickCopyCategory').value = 'email';
    
    document.getElementById('saveQuickCopyBtn').onclick = () => {
        const name = document.getElementById('quickCopyName').value.trim();
        const content = document.getElementById('quickCopyContent').value.trim();
        const category = document.getElementById('quickCopyCategory').value;
        
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
        
        // Refresh quick copy view
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
        // Find parent container for filter state
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
// RECENT NOTES
// ================================================================

function renderRecentNotes() {
    const container = document.getElementById('wsRecentNotes');
    if (!container) return;
    
    const notes = workspaceState.notes || '';
    if (!notes.trim()) {
        container.innerHTML = '<span style="color:var(--text-muted);">No recent notes</span>';
        return;
    }
    
    // Get last 3 lines or first 100 characters
    const lines = notes.split('\n').filter(l => l.trim());
    const recent = lines.slice(-3);
    
    container.innerHTML = recent.map(line => 
        `<div style="padding:4px 0; border-bottom:1px solid var(--border-color); font-size:12px; color:var(--text-secondary);">${escapeHtml(line.substring(0, 80))}${line.length > 80 ? '...' : ''}</div>`
    ).join('');
}

// ================================================================
// ENHANCED EVENT SETUP
// ================================================================

function setupEnhancedWorkspaceEvents(container) {
    // URL Input
    document.getElementById('wsUrlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadWorkspaceUrl(e.target.value);
        }
    });
    
    // Navigation
    document.getElementById('wsBackBtn').addEventListener('click', () => {
        const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
        if (!tab) return;
        const history = workspaceState.history[tab.id] || [];
        const index = workspaceState.historyIndex[tab.id] || 0;
        if (index > 0) {
            workspaceState.historyIndex[tab.id] = index - 1;
            loadWorkspaceUrl(history[index - 1], workspaceState.activeTabId, false);
        }
    });
    
    document.getElementById('wsForwardBtn').addEventListener('click', () => {
        const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
        if (!tab) return;
        const history = workspaceState.history[tab.id] || [];
        const index = workspaceState.historyIndex[tab.id] || 0;
        if (index < history.length - 1) {
            workspaceState.historyIndex[tab.id] = index + 1;
            loadWorkspaceUrl(history[index + 1], workspaceState.activeTabId, false);
        }
    });
    
    document.getElementById('wsReloadBtn').addEventListener('click', () => {
        const tab = workspaceState.tabs.find(t => t.id === workspaceState.activeTabId);
        if (tab) loadWorkspaceUrl(tab.url, workspaceState.activeTabId, false);
    });
    
    document.getElementById('wsHomeBtn').addEventListener('click', () => {
        loadWorkspaceUrl(WORKSPACE_CONFIG.HOME_URL);
    });
    
    // New Tab
    document.getElementById('wsNewTab').addEventListener('click', () => {
        createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
    });
    
    // Bookmark
    document.getElementById('wsBookmarkBtn').addEventListener('click', () => {
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
        document.getElementById('wsStatusText').textContent = idx > -1 ? '✅ Bookmark removed' : '✅ Bookmark added';
        setTimeout(() => document.getElementById('wsStatusText').textContent = '✅ Ready', 2000);
    });
    
    // Split Screen
    document.getElementById('wsSplitBtn').addEventListener('click', toggleSplitScreen);
    
    // Quick Copy
    document.getElementById('wsQuickCopyBtn').addEventListener('click', openQuickCopyModal);
    
    // Sidebar Toggle
    document.getElementById('wsToggleSidebar').addEventListener('click', () => {
        const sidebar = document.getElementById('wsSidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('workspace_sidebar_open', !sidebar.classList.contains('collapsed'));
    });
    
    document.getElementById('wsSidebarClose').addEventListener('click', () => {
        const sidebar = document.getElementById('wsSidebar');
        sidebar.classList.add('collapsed');
        localStorage.setItem('workspace_sidebar_open', 'false');
    });
    
    // Floating Panel Toggles
    document.getElementById('wsNotepadBtn').addEventListener('click', () => toggleFloatingPanel('notepad'));
    document.getElementById('wsScriptPanelBtn').addEventListener('click', () => toggleFloatingPanel('callscript'));
    document.getElementById('wsToggleCalc').addEventListener('click', () => toggleFloatingPanel('calculator'));
    document.getElementById('wsToggleTimer').addEventListener('click', () => toggleFloatingPanel('timer'));
    
    // Notes Auto-save with sync
    const notesArea = document.getElementById('wsNotesArea');
    notesArea.addEventListener('input', () => {
        workspaceState.notes = notesArea.value;
        localStorage.setItem('workspace_notes', workspaceState.notes);
        renderRecentNotes();
        // Sync with floating notepad
        const floatingNote = document.getElementById('wsFloatingNotepad');
        if (floatingNote) floatingNote.value = workspaceState.notes;
    });
    
    // Script Auto-save with sync
    const scriptArea = document.getElementById('wsScriptArea');
    scriptArea.addEventListener('input', () => {
        workspaceState.script = scriptArea.value;
        localStorage.setItem('workspace_script', workspaceState.script);
        // Sync with floating script
        const floatingScript = document.getElementById('wsFloatingScript');
        if (floatingScript) floatingScript.value = workspaceState.script;
    });
    
    document.getElementById('wsScriptEditBtn').addEventListener('click', function() {
        const area = document.getElementById('wsScriptArea');
        if (area.hasAttribute('readonly')) {
            area.removeAttribute('readonly');
            this.textContent = '🔒 Lock';
            this.style.background = 'var(--warning)';
        } else {
            area.setAttribute('readonly', 'readonly');
            this.textContent = '✏️ Edit';
            this.style.background = 'var(--primary)';
            workspaceState.script = area.value;
            localStorage.setItem('workspace_script', workspaceState.script);
        }
    });
    scriptArea.setAttribute('readonly', 'readonly');
    
    // Handle iframe navigation messages
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'navigate' && event.data.url) {
            loadWorkspaceUrl(event.data.url);
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleWorkspaceKeyboardShortcuts);
}

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================

function handleWorkspaceKeyboardShortcuts(e) {
    // Check if workspace is active
    const panel = document.getElementById('featurePanel');
    if (!panel || panel.style.display !== 'block') return;
    const container = document.getElementById('featurePanelBody');
    if (!container || !container.querySelector('.workspace-container')) return;
    
    // Command Palette - Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
    }
    
    // New Tab - Ctrl+T
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        createWorkspaceTab(WORKSPACE_CONFIG.HOME_URL, true);
        return;
    }
    
    // Close Tab - Ctrl+W
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        closeWorkspaceTab(workspaceState.activeTabId);
        return;
    }
    
    // URL Focus - Ctrl+L
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        const input = document.getElementById('wsUrlInput');
        if (input) { input.focus(); input.select(); }
        return;
    }
    
    // Notepad - Ctrl+Shift+N
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        toggleFloatingPanel('notepad');
        return;
    }
    
    // Script - Ctrl+Shift+S
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        toggleFloatingPanel('callscript');
        return;
    }
    
    // Quick Copy - Ctrl+Shift+C
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        openQuickCopyModal();
        return;
    }
    
    // Split Screen - Ctrl+Shift+|
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        toggleSplitScreen();
        return;
    }
    
    // Bookmark - Ctrl+D
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        document.getElementById('wsBookmarkBtn')?.click();
        return;
    }
}

// ================================================================
// COMMAND PALETTE
// ================================================================

let commandPaletteOpen = false;

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
    
    // Click handler
    container.querySelectorAll('.command-result-item').forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.dataset.index);
            if (results[index]) {
                results[index].action();
                toggleCommandPalette();
            }
        });
    });
    
    // Keyboard navigation
    let selectedIndex = 0;
    container.querySelectorAll('.command-result-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => {
            container.querySelectorAll('.command-result-item').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            selectedIndex = i;
        });
    });
    
    // Store for keyboard navigation
    container.dataset.selectedIndex = '0';
    container.dataset.results = JSON.stringify(results.map(r => r.label));
}

// Command palette input
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('commandInput');
    if (input) {
        input.addEventListener('input', (e) => {
            updateCommandResults(e.target.value);
        });
        
        input.addEventListener('keydown', (e) => {
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
                        // Find and execute the command
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
                            { label: 'Refresh Page', action: () => document.getElementById('wsReloadBtn')?.click() },
                            { label: 'Bookmark Page', action: () => document.getElementById('wsBookmarkBtn')?.click() },
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
    
    // Close palette on overlay click
    document.getElementById('commandPalette')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            toggleCommandPalette();
        }
    });
});

// ================================================================
// ENHANCED FLOATING PANELS
// ================================================================

function createEnhancedFloatingPanels() {
    // Create Notepad Panel
    createFloatingPanel('notepad', '📝 Notepad', `
        <textarea id="wsFloatingNotepad" placeholder="Quick notes...">${workspaceState.notes}</textarea>
        <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:4px;">Auto-saved</span>
    `);
    
    // Create Call Script Panel
    createFloatingPanel('callscript', '📜 Call Script', `
        <textarea id="wsFloatingScript" placeholder="Your sales script..." readonly>${workspaceState.script}</textarea>
        <button class="edit-btn" id="wsFloatingScriptEditBtn" style="margin-top:8px; padding:4px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px;">✏️ Edit</button>
    `);
    
    // Create Calculator Panel
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
    
    // Create Timer Panel
    createFloatingPanel('timer', '⏱️ Call Timer', `
        <div class="workspace-timer-display" id="wsFloatingTimerDisplay">00:00:00</div>
        <div class="workspace-timer-controls">
            <button class="timer-start" id="wsFloatingTimerStart">Start</button>
            <button class="timer-pause" id="wsFloatingTimerPause">Pause</button>
            <button class="timer-reset" id="wsFloatingTimerReset">Reset</button>
        </div>
    `);
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function loadWorkspaceState() {
    // Load from localStorage
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
// INITIALIZATION - Add to existing DOMContentLoaded
// ================================================================

// Add to the existing DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', function() {
    // ... existing initialization code ...
    
    // Add workspace launcher handler
    document.getElementById('workspaceLauncherBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.tool-item').forEach(item => {
            const text = item.querySelector('span')?.innerText || item.innerText;
            if (text.includes('CRM Smart Workspace')) {
                item.click();
            }
        });
    });
});

// ================================================================
// EXPORT - Make functions available globally
// ================================================================

window.toggleCommandPalette = toggleCommandPalette;
window.toggleSplitScreen = toggleSplitScreen;
window.openQuickCopyModal = openQuickCopyModal;
window.toggleFloatingPanel = toggleFloatingPanel;
window.loadWorkspaceUrl = loadWorkspaceUrl;
window.createWorkspaceTab = createWorkspaceTab;
window.closeWorkspaceTab = closeWorkspaceTab;
window.workspaceCalcPress = workspaceCalcPress;