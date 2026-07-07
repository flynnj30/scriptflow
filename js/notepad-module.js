// ================================================================
// NOTEPAD MODULE - Complete Production-Ready Implementation
// ================================================================

class NotepadModule {
    constructor() {
        // State
        this.notes = [];
        this.currentNoteId = null;
        this.folders = ['Personal', 'Work', 'Sales', 'Ideas'];
        this.tags = ['important', 'todo', 'follow-up', 'meeting', 'call'];
        this.currentFolder = 'all';
        this.currentTag = 'all';
        this.currentFilter = 'all';
        this.currentSort = 'recent';
        this.searchQuery = '';
        this.isDarkMode = localStorage.getItem('notepad-dark-mode') === 'true';
        this.fontSize = parseInt(localStorage.getItem('notepad-font-size')) || 16;
        this.isCompact = localStorage.getItem('notepad-compact') === 'true';
        this.isFocusMode = false;
        this.isLocked = false;
        this.lockPin = null;
        this.autoLockTimer = null;
        this.undoStack = [];
        this.redoStack = [];
        this.showArchived = false;
        this.showFavorites = false;
        this.selectedNoteIds = new Set();
        this.isBulkSelectMode = false;
        this.reminders = [];
        this.viewMode = 'list'; // list, grid
        
        // Template definitions
        this.templates = [
            {
                id: 'meeting-notes',
                name: 'Meeting Notes',
                content: `# Meeting Notes\n\n## Date: \n## Attendees: \n\n## Agenda\n\n## Discussion Points\n\n## Action Items\n\n## Next Steps`
            },
            {
                id: 'sales-call',
                name: 'Sales Call Script',
                content: `# Sales Call Script\n\n## Opening\n\n"Hi [Name], this is [Your Name] from [Company]. I noticed you're doing great things with [their business]..."\n\n## Discovery Questions\n\n1. What's your biggest challenge right now?\n2. How are you currently handling [problem]?\n3. What would success look like for you?\n\n## Objection Handling\n\n**Objection:** "Not interested"\n**Response:** "That's fair. Just curious, what's working well for you now?"\n\n## Closing\n\n"Based on what you've shared, I think we can help. What's the best next step?"`
            },
            {
                id: 'follow-up',
                name: 'Follow-up Template',
                content: `# Follow-up\n\n## Previous Conversation Summary\n\n## Key Decisions Made\n\n## Action Items\n\n- [ ] \n- [ ] \n\n## Next Meeting / Call\n\n## Follow-up Notes`
            },
            {
                id: 'daily-notes',
                name: 'Daily Notes',
                content: `# Daily Notes\n\n## Date: \n\n## Top Priorities\n\n1. \n2. \n3. \n\n## Completed\n\n- \n\n## Notes\n\n## Tomorrow's Focus`
            }
        ];
        
        // Initialize
        this.init();
    }

    // ================================================================
    // INITIALIZATION
    // ================================================================

    init() {
        this.loadNotes();
        this.render();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupAutoSave();
        this.setupCommandPalette();
        this.applyTheme();
        this.applyFontSize();
        this.applyCompactMode();
        this.setupAutoLock();
        
        console.log('📝 Notepad Module initialized successfully');
    }

    loadNotes() {
        try {
            const data = localStorage.getItem('notepad_data');
            if (data) {
                const parsed = JSON.parse(data);
                this.notes = parsed.notes || [];
                this.folders = parsed.folders || ['Personal', 'Work', 'Sales', 'Ideas'];
                this.tags = parsed.tags || ['important', 'todo', 'follow-up', 'meeting', 'call'];
                this.reminders = parsed.reminders || [];
                
                // Ensure all notes have required fields
                this.notes = this.notes.map(note => ({
                    ...this.getDefaultNote(),
                    ...note,
                    id: note.id || this.generateId()
                }));
            } else {
                this.createDefaultNotes();
            }
        } catch (e) {
            console.error('Failed to load notes:', e);
            this.createDefaultNotes();
        }
    }

    createDefaultNotes() {
        const now = new Date().toISOString();
        this.notes = [
            {
                id: this.generateId(),
                title: '📝 Welcome to Smart Notepad!',
                content: `# Welcome to Your Smart Notepad\n\nThis is your new notepad module for ScriptFlow Pro. Here's what you can do:\n\n## Key Features\n\n- 📝 Create and manage unlimited notes\n- 🏷️ Organize with folders and tags\n- ✨ Rich text and Markdown support\n- 🔍 Full-text search\n- 📎 Attachments\n- 🔒 Password protection\n- 📤 Export to multiple formats\n\n## Getting Started\n\n1. **Create a new note** by clicking the + button\n2. **Organize** your notes with folders and tags\n3. **Search** instantly across all notes\n4. **Pin** important notes for quick access\n\n## Templates\n\nClick "Templates" in the toolbar to use pre-built templates for:\n- 📅 Meeting Notes\n- 📞 Sales Call Scripts\n- 📋 Follow-up Templates\n- 📝 Daily Notes\n\nHappy note-taking! 🚀`,
                folder: 'Personal',
                tags: ['important'],
                color: '#4CAF50',
                isPinned: true,
                isFavorite: true,
                isArchived: false,
                isLocked: false,
                password: '',
                createdAt: now,
                updatedAt: now,
                lastEdited: now,
                version: 1,
                versions: [],
                checklist: [
                    { text: 'Explore the notepad features', checked: false },
                    { text: 'Create your first note', checked: false },
                    { text: 'Try using templates', checked: false }
                ],
                attachments: [],
                reminder: null,
                dueDate: null,
                wordCount: 0,
                charCount: 0,
                readingTime: 0,
                isDraft: false
            },
            {
                id: this.generateId(),
                title: '📞 Sales Call Script Template',
                content: `# Sales Call Script\n\n## Opening\n\n"Hi [Name], this is [Your Name] from [Company]. I noticed you're doing great things with [their business]. We help companies like yours..."\n\n## Discovery Questions\n\n1. What's your biggest challenge right now?\n2. How are you currently handling [problem]?\n3. What would success look like for you?\n\n## Objection Handling\n\n**Objection:** "Not interested"\n**Response:** "That's fair. Just curious, what's working well for you now?"\n\n## Closing\n\n"Based on what you've shared, I think we can help. What's the best next step?"`,
                folder: 'Sales',
                tags: ['call', 'follow-up'],
                color: '#2196F3',
                isPinned: false,
                isFavorite: true,
                isArchived: false,
                isLocked: false,
                password: '',
                createdAt: now,
                updatedAt: now,
                lastEdited: now,
                version: 1,
                versions: [],
                checklist: [],
                attachments: [],
                reminder: null,
                dueDate: null,
                wordCount: 0,
                charCount: 0,
                readingTime: 0,
                isDraft: false
            }
        ];
        this.saveNotes();
    }

    getDefaultNote() {
        return {
            id: this.generateId(),
            title: 'Untitled Note',
            content: '',
            folder: 'Personal',
            tags: [],
            color: '#4CAF50',
            isPinned: false,
            isFavorite: false,
            isArchived: false,
            isLocked: false,
            password: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
            version: 1,
            versions: [],
            checklist: [],
            attachments: [],
            reminder: null,
            dueDate: null,
            wordCount: 0,
            charCount: 0,
            readingTime: 0,
            isDraft: false
        };
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    saveNotes() {
        try {
            const data = {
                notes: this.notes,
                folders: this.folders,
                tags: this.tags,
                reminders: this.reminders
            };
            localStorage.setItem('notepad_data', JSON.stringify(data));
            this.updateSaveStatus(true);
        } catch (e) {
            console.error('Failed to save notes:', e);
            this.updateSaveStatus(false);
        }
    }

    updateSaveStatus(success) {
        const status = document.getElementById('notepad-save-status');
        if (status) {
            status.textContent = success ? '✓ Saved' : '⚠️ Error saving';
            status.style.color = success ? 'var(--success)' : 'var(--danger)';
            setTimeout(() => {
                status.textContent = '💾 Auto-saved';
                status.style.color = 'var(--text-muted)';
            }, 2000);
        }
    }

    // ================================================================
    // RENDER
    // ================================================================

    render() {
        const container = document.getElementById('notepad-container');
        if (!container) {
            console.warn('Notepad container not found');
            return;
        }

        // Show container
        container.style.display = 'block';

        const notes = this.getFilteredNotes();
        const totalNotes = this.notes.length;
        const archivedCount = this.notes.filter(n => n.isArchived).length;
        const pinnedCount = this.notes.filter(n => n.isPinned).length;
        const favoriteCount = this.notes.filter(n => n.isFavorite).length;

        container.innerHTML = `
            <div class="notepad-module" data-theme="${this.isDarkMode ? 'dark' : 'light'}">
                <!-- Toolbar -->
                <div class="notepad-toolbar">
                    <div class="notepad-toolbar-left">
                        <button class="notepad-btn notepad-btn-icon" id="notepad-menu-btn" aria-label="Menu">
                            <i class="fas fa-bars"></i>
                        </button>
                        <h2 class="notepad-title">📝 Notes</h2>
                        <span class="notepad-count">${totalNotes} notes</span>
                    </div>
                    <div class="notepad-toolbar-right">
                        <button class="notepad-btn notepad-btn-sm notepad-btn-outline" id="notepad-templates-btn" title="Templates">
                            <i class="fas fa-copy"></i> Templates
                        </button>
                        <button class="notepad-btn notepad-btn-icon" id="notepad-search-toggle" aria-label="Search">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="notepad-btn notepad-btn-icon" id="notepad-view-toggle" aria-label="Toggle view">
                            <i class="fas ${this.viewMode === 'grid' ? 'fa-list' : 'fa-th'}"></i>
                        </button>
                        <button class="notepad-btn notepad-btn-icon" id="notepad-theme-toggle" aria-label="Toggle theme">
                            <i class="fas ${this.isDarkMode ? 'fa-sun' : 'fa-moon'}"></i>
                        </button>
                        <button class="notepad-btn notepad-btn-primary" id="notepad-new-btn">
                            <i class="fas fa-plus"></i> New Note
                        </button>
                    </div>
                </div>

                <!-- Search Bar -->
                <div class="notepad-search-bar" id="notepad-search-bar" style="display:none;">
                    <i class="fas fa-search"></i>
                    <input type="text" id="notepad-search-input" placeholder="Search all notes..." value="${this.searchQuery}" />
                    <button class="notepad-btn notepad-btn-icon" id="notepad-search-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Main Layout -->
                <div class="notepad-main">
                    <!-- Sidebar -->
                    <div class="notepad-sidebar" id="notepad-sidebar">
                        <div class="notepad-sidebar-section">
                            <h4>📂 Folders</h4>
                            <div class="notepad-sidebar-list">
                                <div class="notepad-sidebar-item ${this.currentFolder === 'all' ? 'active' : ''}" data-folder="all">
                                    <i class="fas fa-inbox"></i> All Notes <span class="badge">${totalNotes}</span>
                                </div>
                                <div class="notepad-sidebar-item ${this.currentFolder === 'favorites' ? 'active' : ''}" data-folder="favorites">
                                    <i class="fas fa-star"></i> Favorites <span class="badge">${favoriteCount}</span>
                                </div>
                                <div class="notepad-sidebar-item ${this.currentFolder === 'pinned' ? 'active' : ''}" data-folder="pinned">
                                    <i class="fas fa-thumbtack"></i> Pinned <span class="badge">${pinnedCount}</span>
                                </div>
                                <div class="notepad-sidebar-item ${this.currentFolder === 'archived' ? 'active' : ''}" data-folder="archived">
                                    <i class="fas fa-archive"></i> Archived <span class="badge">${archivedCount}</span>
                                </div>
                                ${this.folders.map(folder => `
                                    <div class="notepad-sidebar-item ${this.currentFolder === folder ? 'active' : ''}" data-folder="${folder}">
                                        <i class="fas fa-folder"></i> ${folder}
                                    </div>
                                `).join('')}
                            </div>
                            <button class="notepad-btn notepad-btn-sm notepad-btn-outline" id="notepad-add-folder">
                                <i class="fas fa-plus"></i> Add Folder
                            </button>
                        </div>

                        <div class="notepad-sidebar-section">
                            <h4>🏷️ Tags</h4>
                            <div class="notepad-sidebar-list">
                                <div class="notepad-sidebar-item ${this.currentTag === 'all' ? 'active' : ''}" data-tag="all">
                                    <i class="fas fa-tags"></i> All Tags
                                </div>
                                ${this.tags.map(tag => `
                                    <div class="notepad-sidebar-item ${this.currentTag === tag ? 'active' : ''}" data-tag="${tag}">
                                        <i class="fas fa-tag"></i> ${tag}
                                    </div>
                                `).join('')}
                            </div>
                            <button class="notepad-btn notepad-btn-sm notepad-btn-outline" id="notepad-add-tag">
                                <i class="fas fa-plus"></i> Add Tag
                            </button>
                        </div>
                    </div>

                    <!-- Notes List -->
                    <div class="notepad-list">
                        <div class="notepad-list-header">
                            <div class="notepad-list-header-left">
                                <button class="notepad-btn notepad-btn-sm notepad-btn-icon" id="notepad-bulk-select" aria-label="Bulk select">
                                    <i class="fas fa-check-square"></i>
                                </button>
                                <span class="notepad-list-count">${notes.length} of ${totalNotes}</span>
                            </div>
                            <div class="notepad-list-header-right">
                                <select id="notepad-sort-select" class="notepad-select">
                                    <option value="recent" ${this.currentSort === 'recent' ? 'selected' : ''}>Recent</option>
                                    <option value="title" ${this.currentSort === 'title' ? 'selected' : ''}>Title</option>
                                    <option value="created" ${this.currentSort === 'created' ? 'selected' : ''}>Created Date</option>
                                    <option value="pinned" ${this.currentSort === 'pinned' ? 'selected' : ''}>Pinned</option>
                                    <option value="favorites" ${this.currentSort === 'favorites' ? 'selected' : ''}>Favorites</option>
                                </select>
                            </div>
                        </div>
                        <div class="notepad-list-items" id="notepad-list-items">
                            ${notes.length === 0 ? `
                                <div class="notepad-empty-state">
                                    <i class="fas fa-sticky-note"></i>
                                    <h3>No notes found</h3>
                                    <p>Create your first note to get started</p>
                                    <button class="notepad-btn notepad-btn-primary" id="notepad-empty-new-btn">
                                        <i class="fas fa-plus"></i> Create Note
                                    </button>
                                </div>
                            ` : notes.map(note => this.renderNoteItem(note)).join('')}
                        </div>
                    </div>

                    <!-- Editor -->
                    <div class="notepad-editor" id="notepad-editor">
                        ${this.currentNoteId ? this.renderEditor() : `
                            <div class="notepad-editor-empty">
                                <i class="fas fa-sticky-note"></i>
                                <h3>Select a note to edit</h3>
                                <p>Or create a new one</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Status Bar -->
                <div class="notepad-statusbar">
                    <span id="notepad-save-status">💾 Auto-saved</span>
                    <span id="notepad-word-count">Words: 0</span>
                    <span id="notepad-char-count">Characters: 0</span>
                    <span id="notepad-reading-time">Reading time: 0 min</span>
                    <span id="notepad-last-edited">Last edited: ${this.currentNoteId ? new Date(this.getCurrentNote()?.lastEdited || Date.now()).toLocaleString() : 'Never'}</span>
                </div>
            </div>
        `;

        // Templates modal hidden by default
        this.attachEventListeners();
        this.applyTheme();
        this.applyFontSize();
        this.applyCompactMode();
        this.updateWordCount();
    }

    renderNoteItem(note) {
        const isSelected = this.selectedNoteIds.has(note.id);
        const isCurrent = this.currentNoteId === note.id;
        
        return `
            <div class="notepad-list-item ${isCurrent ? 'active' : ''} ${note.isPinned ? 'pinned' : ''} ${note.isFavorite ? 'favorite' : ''} ${isSelected ? 'selected' : ''}" 
                 data-note-id="${note.id}" 
                 draggable="true">
                <div class="notepad-list-item-content">
                    <div class="notepad-list-item-header">
                        <h4 class="notepad-list-item-title">${this.escapeHtml(note.title)}</h4>
                        <div class="notepad-list-item-actions">
                            ${note.isPinned ? '<i class="fas fa-thumbtack pin-icon"></i>' : ''}
                            ${note.isFavorite ? '<i class="fas fa-star favorite-icon"></i>' : ''}
                            ${note.isArchived ? '<i class="fas fa-archive archive-icon"></i>' : ''}
                            ${note.color ? `<span class="color-dot" style="background:${note.color}"></span>` : ''}
                        </div>
                    </div>
                    <div class="notepad-list-item-preview">${this.escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</div>
                    <div class="notepad-list-item-meta">
                        <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
                        ${note.folder ? `<span class="folder-tag">📁 ${note.folder}</span>` : ''}
                        ${note.tags?.slice(0, 2).map(tag => `<span class="tag-pill">#${tag}</span>`).join('')}
                        ${note.tags?.length > 2 ? `<span class="tag-pill">+${note.tags.length - 2}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderEditor() {
        const note = this.getCurrentNote();
        if (!note) return this.renderEmptyEditor();

        return `
            <div class="notepad-editor-content">
                <div class="notepad-editor-toolbar">
                    <div class="notepad-editor-toolbar-left">
                        <button class="notepad-editor-btn" data-action="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                        <button class="notepad-editor-btn" data-action="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                        <button class="notepad-editor-btn" data-action="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                        <button class="notepad-editor-btn" data-action="strikethrough" title="Strikethrough"><s>S</s></button>
                        <span class="notepad-editor-divider"></span>
                        <button class="notepad-editor-btn" data-action="heading1" title="Heading 1">H1</button>
                        <button class="notepad-editor-btn" data-action="heading2" title="Heading 2">H2</button>
                        <button class="notepad-editor-btn" data-action="heading3" title="Heading 3">H3</button>
                        <span class="notepad-editor-divider"></span>
                        <button class="notepad-editor-btn" data-action="bullet-list" title="Bullet List"><i class="fas fa-list-ul"></i></button>
                        <button class="notepad-editor-btn" data-action="numbered-list" title="Numbered List"><i class="fas fa-list-ol"></i></button>
                        <button class="notepad-editor-btn" data-action="checklist" title="Checklist"><i class="fas fa-check-square"></i></button>
                        <span class="notepad-editor-divider"></span>
                        <button class="notepad-editor-btn" data-action="link" title="Insert Link (Ctrl+K)"><i class="fas fa-link"></i></button>
                        <button class="notepad-editor-btn" data-action="quote" title="Quote"><i class="fas fa-quote-right"></i></button>
                        <button class="notepad-editor-btn" data-action="code" title="Code"><i class="fas fa-code"></i></button>
                        <button class="notepad-editor-btn" data-action="code-block" title="Code Block"><i class="fas fa-terminal"></i></button>
                    </div>
                    <div class="notepad-editor-toolbar-right">
                        <button class="notepad-editor-btn" data-action="markdown-toggle" title="Toggle Markdown">
                            <i class="fas fa-markdown"></i>
                        </button>
                        <button class="notepad-editor-btn" data-action="preview-toggle" title="Toggle Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="notepad-editor-btn" data-action="undo" title="Undo (Ctrl+Z)">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="notepad-editor-btn" data-action="redo" title="Redo (Ctrl+Y)">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button class="notepad-editor-btn" data-action="save" title="Save (Ctrl+S)">
                            <i class="fas fa-save"></i>
                        </button>
                    </div>
                </div>

                <div class="notepad-editor-body">
                    <div class="notepad-editor-meta">
                        <input type="text" class="notepad-editor-title" id="notepad-editor-title" value="${this.escapeHtml(note.title)}" placeholder="Note title..." />
                        <div class="notepad-editor-meta-actions">
                            <button class="notepad-btn notepad-btn-sm notepad-btn-icon" id="notepad-pin-btn" title="Pin">
                                <i class="fas ${note.isPinned ? 'fa-thumbtack' : 'fa-thumbtack'}" style="${note.isPinned ? 'color:var(--notepad-warning)' : ''}"></i>
                            </button>
                            <button class="notepad-btn notepad-btn-sm notepad-btn-icon" id="notepad-favorite-btn" title="Favorite">
                                <i class="fas ${note.isFavorite ? 'fa-star' : 'fa-star'}" style="${note.isFavorite ? 'color:var(--notepad-warning)' : ''}"></i>
                            </button>
                            <button class="notepad-btn notepad-btn-sm notepad-btn-icon" id="notepad-archive-btn" title="Archive">
                                <i class="fas ${note.isArchived ? 'fa-archive' : 'fa-archive'}" style="${note.isArchived ? 'color:var(--notepad-primary)' : ''}"></i>
                            </button>
                            <button class="notepad-btn notepad-btn-sm notepad-btn-icon" id="notepad-lock-btn" title="Lock">
                                <i class="fas ${note.isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
                            </button>
                            <select id="notepad-folder-select" class="notepad-select-sm">
                                ${this.folders.map(f => `<option value="${f}" ${note.folder === f ? 'selected' : ''}>📁 ${f}</option>`).join('')}
                            </select>
                            <input type="color" id="notepad-color-picker" value="${note.color || '#4CAF50'}" title="Color" />
                        </div>
                    </div>
                    <div class="notepad-editor-area">
                        <textarea id="notepad-editor-textarea" class="notepad-editor-textarea" placeholder="Start writing...">${this.escapeHtml(note.content)}</textarea>
                        <div class="notepad-editor-preview" id="notepad-editor-preview" style="display:none;"></div>
                    </div>
                    <div class="notepad-editor-tags">
                        <input type="text" id="notepad-tag-input" placeholder="Add tags (comma separated)" value="${(note.tags || []).join(', ')}" />
                    </div>
                    <div class="notepad-editor-checklist" id="notepad-checklist-area">
                        ${this.renderChecklist(note)}
                    </div>
                </div>
            </div>
        `;
    }

    renderChecklist(note) {
        if (!note.checklist || note.checklist.length === 0) {
            return `
                <div class="notepad-checklist-empty">
                    <button class="notepad-btn notepad-btn-sm notepad-btn-outline" id="notepad-checklist-add">
                        <i class="fas fa-plus"></i> Add Checklist Item
                    </button>
                </div>
            `;
        }

        return `
            <div class="notepad-checklist">
                <h4>✅ Checklist</h4>
                ${note.checklist.map((item, index) => `
                    <div class="notepad-checklist-item" data-index="${index}">
                        <input type="checkbox" ${item.checked ? 'checked' : ''} data-index="${index}" />
                        <span class="${item.checked ? 'checked' : ''}">${this.escapeHtml(item.text)}</span>
                        <button class="notepad-btn notepad-btn-sm notepad-btn-icon checklist-delete" data-index="${index}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
                <button class="notepad-btn notepad-btn-sm notepad-btn-outline" id="notepad-checklist-add">
                    <i class="fas fa-plus"></i> Add Item
                </button>
            </div>
        `;
    }

    renderEmptyEditor() {
        return `
            <div class="notepad-editor-empty">
                <i class="fas fa-sticky-note"></i>
                <h3>Select a note to edit</h3>
                <p>Or create a new one</p>
            </div>
        `;
    }

    // ================================================================
    // TEMPLATES MODAL
    // ================================================================

    showTemplatesModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'notepad-templates-modal';
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 500px;">
                <h3><i class="fas fa-copy"></i> Note Templates</h3>
                <p style="color:var(--text-muted); margin-bottom:16px;">Choose a template to create a new note</p>
                <div id="notepad-templates-list" style="max-height:400px; overflow-y:auto;">
                    ${this.templates.map(t => `
                        <div class="notepad-template-item" data-template-id="${t.id}" style="
                            padding: 12px 16px;
                            border: 1px solid var(--border-color);
                            border-radius: 8px;
                            margin-bottom: 8px;
                            cursor: pointer;
                            transition: all 0.2s;
                            background: var(--bg-card);
                        ">
                            <h4 style="margin:0; font-size:14px;">${t.name}</h4>
                            <p style="margin:4px 0 0; font-size:12px; color:var(--text-muted);">${t.content.substring(0, 100)}...</p>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;">
                    <button class="btn-icon" id="notepad-templates-close">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Template click handlers
        document.querySelectorAll('.notepad-template-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.templateId;
                const template = this.templates.find(t => t.id === id);
                if (template) {
                    const note = this.createNote(template.name, template.content);
                    modal.remove();
                    setTimeout(() => {
                        const textarea = document.getElementById('notepad-editor-textarea');
                        if (textarea) {
                            textarea.focus();
                            textarea.selectionStart = textarea.value.length;
                        }
                    }, 100);
                }
            });
        });

        document.getElementById('notepad-templates-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // ================================================================
    // EVENT LISTENERS
    // ================================================================

    attachEventListeners() {
        // New Note
        document.querySelectorAll('#notepad-new-btn, #notepad-empty-new-btn').forEach(btn => {
            btn?.addEventListener('click', () => this.createNote());
        });

        // Templates
        document.getElementById('notepad-templates-btn')?.addEventListener('click', () => {
            this.showTemplatesModal();
        });

        // Sidebar Navigation
        document.querySelectorAll('.notepad-sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const folder = item.dataset.folder;
                const tag = item.dataset.tag;
                if (folder) {
                    this.currentFolder = folder;
                    this.currentTag = 'all';
                    this.render();
                } else if (tag) {
                    this.currentTag = tag;
                    this.currentFolder = 'all';
                    this.render();
                }
                // Close sidebar on mobile
                const sidebar = document.getElementById('notepad-sidebar');
                if (sidebar && window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
        });

        // Note List Items
        document.querySelectorAll('.notepad-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.notepad-list-item-actions') || e.target.closest('button')) return;
                const id = item.dataset.noteId;
                if (id) this.selectNote(id);
            });

            // Drag and Drop
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.noteId);
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
            item.addEventListener('dragover', (e) => e.preventDefault());
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData('text/plain');
                const toId = item.dataset.noteId;
                if (fromId && toId && fromId !== toId) {
                    this.reorderNotes(fromId, toId);
                }
            });
        });

        // Editor Actions
        document.querySelectorAll('.notepad-editor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleEditorAction(action);
            });
        });

        // Title Input
        const titleInput = document.getElementById('notepad-editor-title');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.title = titleInput.value || 'Untitled Note';
                    this.saveNotes();
                    this.updateNoteList();
                }
            });
        }

        // Editor Textarea
        const textarea = document.getElementById('notepad-editor-textarea');
        if (textarea) {
            textarea.addEventListener('input', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.content = textarea.value;
                    note.lastEdited = new Date().toISOString();
                    this.updateStats(note);
                    this.saveNotes();
                    this.updateNoteList();
                    this.updateWordCount();
                }
            });
        }

        // Tags Input
        const tagInput = document.getElementById('notepad-tag-input');
        if (tagInput) {
            tagInput.addEventListener('change', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.tags = tagInput.value.split(',').map(t => t.trim()).filter(t => t);
                    this.saveNotes();
                }
            });
        }

        // Folder Select
        const folderSelect = document.getElementById('notepad-folder-select');
        if (folderSelect) {
            folderSelect.addEventListener('change', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.folder = folderSelect.value;
                    this.saveNotes();
                    this.render();
                }
            });
        }

        // Color Picker
        const colorPicker = document.getElementById('notepad-color-picker');
        if (colorPicker) {
            colorPicker.addEventListener('input', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.color = colorPicker.value;
                    this.saveNotes();
                    this.updateNoteList();
                }
            });
        }

        // Pin Button
        const pinBtn = document.getElementById('notepad-pin-btn');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.isPinned = !note.isPinned;
                    this.saveNotes();
                    this.render();
                }
            });
        }

        // Favorite Button
        const favBtn = document.getElementById('notepad-favorite-btn');
        if (favBtn) {
            favBtn.addEventListener('click', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.isFavorite = !note.isFavorite;
                    this.saveNotes();
                    this.render();
                }
            });
        }

        // Archive Button
        const archiveBtn = document.getElementById('notepad-archive-btn');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', () => {
                const note = this.getCurrentNote();
                if (note) {
                    note.isArchived = !note.isArchived;
                    this.saveNotes();
                    this.render();
                }
            });
        }

        // Lock Button
        const lockBtn = document.getElementById('notepad-lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', () => {
                const note = this.getCurrentNote();
                if (note) {
                    this.toggleNoteLock(note);
                }
            });
        }

        // Search Toggle
        const searchToggle = document.getElementById('notepad-search-toggle');
        if (searchToggle) {
            searchToggle.addEventListener('click', () => {
                const bar = document.getElementById('notepad-search-bar');
                if (bar) {
                    bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
                    if (bar.style.display === 'flex') {
                        document.getElementById('notepad-search-input')?.focus();
                    }
                }
            });
        }

        // Search Input
        const searchInput = document.getElementById('notepad-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value;
                this.render();
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const bar = document.getElementById('notepad-search-bar');
                    if (bar) bar.style.display = 'none';
                }
            });
        }

        // Search Close
        const searchClose = document.getElementById('notepad-search-close');
        if (searchClose) {
            searchClose.addEventListener('click', () => {
                const bar = document.getElementById('notepad-search-bar');
                if (bar) {
                    bar.style.display = 'none';
                    this.searchQuery = '';
                    this.render();
                }
            });
        }

        // Theme Toggle
        const themeBtn = document.getElementById('notepad-theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.isDarkMode = !this.isDarkMode;
                localStorage.setItem('notepad-dark-mode', this.isDarkMode);
                this.applyTheme();
                this.render();
            });
        }

        // Sort Select
        const sortSelect = document.getElementById('notepad-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.currentSort = sortSelect.value;
                this.render();
            });
        }

        // Add Folder
        const addFolderBtn = document.getElementById('notepad-add-folder');
        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => {
                const name = prompt('Enter folder name:');
                if (name && name.trim()) {
                    this.folders.push(name.trim());
                    this.saveNotes();
                    this.render();
                }
            });
        }

        // Add Tag
        const addTagBtn = document.getElementById('notepad-add-tag');
        if (addTagBtn) {
            addTagBtn.addEventListener('click', () => {
                const name = prompt('Enter tag name:');
                if (name && name.trim()) {
                    this.tags.push(name.trim());
                    this.saveNotes();
                    this.render();
                }
            });
        }

        // Checklist Add
        const checklistAddBtn = document.getElementById('notepad-checklist-add');
        if (checklistAddBtn) {
            checklistAddBtn.addEventListener('click', () => {
                const note = this.getCurrentNote();
                if (note) {
                    const text = prompt('Enter checklist item:');
                    if (text && text.trim()) {
                        if (!note.checklist) note.checklist = [];
                        note.checklist.push({ text: text.trim(), checked: false });
                        note.lastEdited = new Date().toISOString();
                        this.saveNotes();
                        this.render();
                    }
                }
            });
        }

        // Checklist Checkbox
        document.querySelectorAll('.notepad-checklist-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const note = this.getCurrentNote();
                if (note && note.checklist) {
                    const index = parseInt(cb.dataset.index);
                    note.checklist[index].checked = cb.checked;
                    note.lastEdited = new Date().toISOString();
                    this.saveNotes();
                    this.render();
                }
            });
        });

        // Checklist Delete
        document.querySelectorAll('.checklist-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const note = this.getCurrentNote();
                if (note && note.checklist) {
                    const index = parseInt(btn.dataset.index);
                    note.checklist.splice(index, 1);
                    note.lastEdited = new Date().toISOString();
                    this.saveNotes();
                    this.render();
                }
            });
        });

        // Bulk Select
        const bulkBtn = document.getElementById('notepad-bulk-select');
        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => {
                this.isBulkSelectMode = !this.isBulkSelectMode;
                if (!this.isBulkSelectMode) this.selectedNoteIds.clear();
                this.render();
            });
        }

        // View Toggle
        const viewBtn = document.getElementById('notepad-view-toggle');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
                this.isCompact = this.viewMode === 'grid';
                localStorage.setItem('notepad-compact', this.isCompact);
                this.applyCompactMode();
                this.render();
            });
        }

        // Menu Button (mobile)
        const menuBtn = document.getElementById('notepad-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('notepad-sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('open');
                }
            });
        }

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('notepad-sidebar');
            const menuBtn = document.getElementById('notepad-menu-btn');
            if (sidebar && sidebar.classList.contains('open') && 
                !sidebar.contains(e.target) && 
                !menuBtn?.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    // ================================================================
    // CORE FUNCTIONS
    // ================================================================

    createNote(title = 'Untitled Note', content = '') {
        const note = {
            ...this.getDefaultNote(),
            title: title || 'Untitled Note',
            content: content || '',
            folder: this.currentFolder !== 'all' && this.currentFolder !== 'favorites' && this.currentFolder !== 'pinned' && this.currentFolder !== 'archived' ? this.currentFolder : 'Personal',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
            isDraft: true
        };
        this.notes.unshift(note);
        this.saveNotes();
        this.currentNoteId = note.id;
        this.render();
        // Focus on title
        setTimeout(() => {
            const titleInput = document.getElementById('notepad-editor-title');
            if (titleInput) {
                titleInput.focus();
                titleInput.select();
            }
        }, 100);
        return note;
    }

    selectNote(id) {
        if (this.isLocked) return;
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        if (note.isLocked) {
            this.promptForPassword(note);
            return;
        }
        
        this.currentNoteId = id;
        this.render();
    }

    getCurrentNote() {
        return this.notes.find(n => n.id === this.currentNoteId);
    }

    deleteNote(id) {
        if (!confirm('Delete this note?')) return;
        this.notes = this.notes.filter(n => n.id !== id);
        if (this.currentNoteId === id) this.currentNoteId = null;
        this.saveNotes();
        this.render();
    }

    duplicateNote(id) {
        const original = this.notes.find(n => n.id === id);
        if (!original) return;
        const copy = {
            ...original,
            id: this.generateId(),
            title: original.title + ' (Copy)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
            isDraft: true,
            versions: [],
            attachments: []
        };
        this.notes.unshift(copy);
        this.saveNotes();
        this.currentNoteId = copy.id;
        this.render();
    }

    toggleNoteLock(note) {
        if (note.isLocked) {
            const password = prompt('Enter current password:');
            if (password === note.password) {
                note.isLocked = false;
                note.password = '';
                this.saveNotes();
                this.render();
            } else {
                alert('Incorrect password');
            }
        } else {
            const password = prompt('Set a password for this note:');
            if (password && password.trim()) {
                note.isLocked = true;
                note.password = password.trim();
                this.saveNotes();
                this.render();
            }
        }
    }

    promptForPassword(note) {
        const password = prompt('This note is locked. Enter password:');
        if (password === note.password) {
            note.isLocked = false;
            this.saveNotes();
            this.currentNoteId = note.id;
            this.render();
        } else {
            alert('Incorrect password');
        }
    }

    reorderNotes(fromId, toId) {
        const fromIndex = this.notes.findIndex(n => n.id === fromId);
        const toIndex = this.notes.findIndex(n => n.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;
        const [note] = this.notes.splice(fromIndex, 1);
        this.notes.splice(toIndex, 0, note);
        this.saveNotes();
        this.render();
    }

    // ================================================================
    // FILTERING & SORTING
    // ================================================================

    getFilteredNotes() {
        let filtered = [...this.notes];

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(n => 
                n.title.toLowerCase().includes(query) ||
                n.content.toLowerCase().includes(query) ||
                (n.tags || []).some(t => t.toLowerCase().includes(query)) ||
                n.folder.toLowerCase().includes(query)
            );
        }

        // Folder filter
        if (this.currentFolder === 'favorites') {
            filtered = filtered.filter(n => n.isFavorite);
        } else if (this.currentFolder === 'pinned') {
            filtered = filtered.filter(n => n.isPinned);
        } else if (this.currentFolder === 'archived') {
            filtered = filtered.filter(n => n.isArchived);
        } else if (this.currentFolder !== 'all') {
            filtered = filtered.filter(n => n.folder === this.currentFolder && !n.isArchived);
        } else {
            filtered = filtered.filter(n => !n.isArchived);
        }

        // Tag filter
        if (this.currentTag !== 'all') {
            filtered = filtered.filter(n => (n.tags || []).includes(this.currentTag));
        }

        // Sorting
        switch (this.currentSort) {
            case 'recent':
                filtered.sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited));
                break;
            case 'title':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'created':
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'pinned':
                filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
                break;
            case 'favorites':
                filtered.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
                break;
        }

        return filtered;
    }

    // ================================================================
    // EDITOR ACTIONS
    // ================================================================

    handleEditorAction(action) {
        const textarea = document.getElementById('notepad-editor-textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);

        let newText = '';
        let newStart = start;
        let newEnd = end;

        switch (action) {
            case 'bold':
                newText = before + `**${selectedText || 'bold text'}**` + after;
                newStart = start + 2;
                newEnd = end + 2 + (selectedText ? 0 : 10);
                break;
            case 'italic':
                newText = before + `*${selectedText || 'italic text'}*` + after;
                newStart = start + 1;
                newEnd = end + 1 + (selectedText ? 0 : 11);
                break;
            case 'underline':
                newText = before + `_${selectedText || 'underline text'}_` + after;
                newStart = start + 1;
                newEnd = end + 1 + (selectedText ? 0 : 13);
                break;
            case 'strikethrough':
                newText = before + `~~${selectedText || 'strikethrough'}~~` + after;
                newStart = start + 2;
                newEnd = end + 2 + (selectedText ? 0 : 13);
                break;
            case 'heading1':
                newText = before + `# ${selectedText || 'Heading 1'}` + after;
                newStart = start + 2;
                newEnd = end + 2 + (selectedText ? 0 : 8);
                break;
            case 'heading2':
                newText = before + `## ${selectedText || 'Heading 2'}` + after;
                newStart = start + 3;
                newEnd = end + 3 + (selectedText ? 0 : 8);
                break;
            case 'heading3':
                newText = before + `### ${selectedText || 'Heading 3'}` + after;
                newStart = start + 4;
                newEnd = end + 4 + (selectedText ? 0 : 8);
                break;
            case 'bullet-list':
                const bulletLines = (selectedText || 'List item').split('\n').map(l => `- ${l}`).join('\n');
                newText = before + bulletLines + after;
                newStart = start + 2;
                newEnd = end + 2;
                break;
            case 'numbered-list':
                const numLines = (selectedText || 'List item').split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
                newText = before + numLines + after;
                newStart = start + 3;
                newEnd = end + 3;
                break;
            case 'checklist':
                const checkLines = (selectedText || 'Task').split('\n').map(l => `- [ ] ${l}`).join('\n');
                newText = before + checkLines + after;
                newStart = start + 5;
                newEnd = end + 5;
                break;
            case 'link':
                const url = prompt('Enter URL:', 'https://');
                if (url) {
                    newText = before + `[${selectedText || 'link text'}](${url})` + after;
                    newStart = start + 1;
                    newEnd = end + 1 + (selectedText ? 0 : 9) + url.length + 3;
                } else return;
                break;
            case 'quote':
                newText = before + `> ${selectedText || 'Quote'}` + after;
                newStart = start + 2;
                newEnd = end + 2 + (selectedText ? 0 : 5);
                break;
            case 'code':
                newText = before + `\`${selectedText || 'code'}\`` + after;
                newStart = start + 1;
                newEnd = end + 1 + (selectedText ? 0 : 4);
                break;
            case 'code-block':
                newText = before + `\`\`\`\n${selectedText || 'code block'}\n\`\`\`` + after;
                newStart = start + 4;
                newEnd = end + 4 + (selectedText ? 0 : 12);
                break;
            case 'undo':
                this.undo();
                return;
            case 'redo':
                this.redo();
                return;
            case 'save':
                this.saveNotes();
                return;
            case 'markdown-toggle':
                this.toggleMarkdown();
                return;
            case 'preview-toggle':
                this.togglePreview();
                return;
            default:
                return;
        }

        textarea.value = newText;
        textarea.selectionStart = newStart;
        textarea.selectionEnd = newEnd;
        textarea.focus();

        // Trigger input event
        textarea.dispatchEvent(new Event('input'));
    }

    // ================================================================
    // UNDO / REDO
    // ================================================================

    undo() {
        if (this.undoStack.length === 0) return;
        const note = this.getCurrentNote();
        if (!note) return;
        const current = note.content;
        const previous = this.undoStack.pop();
        this.redoStack.push(current);
        note.content = previous;
        note.lastEdited = new Date().toISOString();
        this.saveNotes();
        const textarea = document.getElementById('notepad-editor-textarea');
        if (textarea) {
            textarea.value = previous;
            textarea.dispatchEvent(new Event('input'));
        }
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const note = this.getCurrentNote();
        if (!note) return;
        const current = note.content;
        const next = this.redoStack.pop();
        this.undoStack.push(current);
        note.content = next;
        note.lastEdited = new Date().toISOString();
        this.saveNotes();
        const textarea = document.getElementById('notepad-editor-textarea');
        if (textarea) {
            textarea.value = next;
            textarea.dispatchEvent(new Event('input'));
        }
    }

    // ================================================================
    // MARKDOWN & PREVIEW
    // ================================================================

    toggleMarkdown() {
        const textarea = document.getElementById('notepad-editor-textarea');
        if (!textarea) return;
        const isMarkdown = textarea.style.fontFamily === 'monospace';
        textarea.style.fontFamily = isMarkdown ? 'inherit' : 'monospace';
        textarea.style.background = isMarkdown ? 'var(--bg-primary)' : 'var(--bg-input)';
    }

    togglePreview() {
        const preview = document.getElementById('notepad-editor-preview');
        const textarea = document.getElementById('notepad-editor-textarea');
        if (!preview || !textarea) return;
        
        if (preview.style.display === 'none') {
            preview.style.display = 'block';
            textarea.style.display = 'none';
            preview.innerHTML = this.parseMarkdown(textarea.value);
        } else {
            preview.style.display = 'none';
            textarea.style.display = 'block';
        }
    }

    parseMarkdown(text) {
        let html = text;
        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
        // Strikethrough
        html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');
        // Code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
        // Lists
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        // Quotes
        html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // ================================================================
    // STATS
    // ================================================================

    updateStats(note) {
        const content = note.content || '';
        note.wordCount = content.split(/\s+/).filter(w => w).length;
        note.charCount = content.length;
        note.readingTime = Math.ceil(note.wordCount / 200);
    }

    updateWordCount() {
        const note = this.getCurrentNote();
        if (!note) return;
        
        const wordCountEl = document.getElementById('notepad-word-count');
        const charCountEl = document.getElementById('notepad-char-count');
        const readingTimeEl = document.getElementById('notepad-reading-time');
        const lastEditedEl = document.getElementById('notepad-last-edited');
        
        if (wordCountEl) wordCountEl.textContent = `Words: ${note.wordCount || 0}`;
        if (charCountEl) charCountEl.textContent = `Characters: ${note.charCount || 0}`;
        if (readingTimeEl) readingTimeEl.textContent = `Reading time: ${note.readingTime || 0} min`;
        if (lastEditedEl) lastEditedEl.textContent = `Last edited: ${new Date(note.lastEdited).toLocaleString()}`;
    }

    updateNoteList() {
        const items = document.querySelectorAll('.notepad-list-item');
        const note = this.getCurrentNote();
        items.forEach(item => {
            const id = item.dataset.noteId;
            const isCurrent = id === this.currentNoteId;
            item.classList.toggle('active', isCurrent);
            if (isCurrent) {
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
        this.updateWordCount();
    }

    // ================================================================
    // AUTO-SAVE
    // ================================================================

    setupAutoSave() {
        let timeout = null;
        document.addEventListener('input', (e) => {
            if (e.target.closest('.notepad-module')) {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.saveNotes();
                }, 1000);
            }
        });
    }

    // ================================================================
    // KEYBOARD SHORTCUTS
    // ================================================================

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isNotepadActive = document.querySelector('.notepad-module');
            if (!isNotepadActive) return;

            // Ctrl/Cmd + Key
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.createNote();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveNotes();
                        break;
                    case 'z':
                        e.preventDefault();
                        this.undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 'b':
                        e.preventDefault();
                        this.handleEditorAction('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.handleEditorAction('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.handleEditorAction('underline');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.handleEditorAction('link');
                        break;
                    case 'f':
                        e.preventDefault();
                        const searchBar = document.getElementById('notepad-search-bar');
                        if (searchBar) {
                            searchBar.style.display = searchBar.style.display === 'none' ? 'flex' : 'none';
                            if (searchBar.style.display === 'flex') {
                                document.getElementById('notepad-search-input')?.focus();
                            }
                        }
                        break;
                }
            }

            // Escape
            if (e.key === 'Escape') {
                const searchBar = document.getElementById('notepad-search-bar');
                if (searchBar && searchBar.style.display === 'flex') {
                    searchBar.style.display = 'none';
                    this.searchQuery = '';
                    this.render();
                }
                const sidebar = document.getElementById('notepad-sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            }

            // Delete key
            if (e.key === 'Delete' && this.currentNoteId) {
                if (document.activeElement?.tagName !== 'INPUT' && 
                    document.activeElement?.tagName !== 'TEXTAREA') {
                    this.deleteNote(this.currentNoteId);
                }
            }
        });
    }

    // ================================================================
    // COMMAND PALETTE
    // ================================================================

    setupCommandPalette() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showCommandPalette();
            }
        });
    }

    showCommandPalette() {
        const commands = [
            { label: 'New Note', action: () => this.createNote(), shortcut: 'Ctrl+N' },
            { label: 'Save Note', action: () => this.saveNotes(), shortcut: 'Ctrl+S' },
            { label: 'Search Notes', action: () => {
                const bar = document.getElementById('notepad-search-bar');
                if (bar) {
                    bar.style.display = 'flex';
                    document.getElementById('notepad-search-input')?.focus();
                }
            }, shortcut: 'Ctrl+F' },
            { label: 'Toggle Theme', action: () => {
                this.isDarkMode = !this.isDarkMode;
                localStorage.setItem('notepad-dark-mode', this.isDarkMode);
                this.applyTheme();
                this.render();
            }, shortcut: '' },
            { label: 'Export All Notes', action: () => this.exportAll('json'), shortcut: '' },
            { label: 'Import Notes', action: () => this.importNotes(), shortcut: '' },
            { label: 'Show Templates', action: () => this.showTemplatesModal(), shortcut: '' },
            { label: 'Toggle Split View', action: () => {
                const previewBtn = document.querySelector('[data-action="preview-toggle"]');
                if (previewBtn) previewBtn.click();
            }, shortcut: '' },
        ];

        const modal = document.createElement('div');
        modal.className = 'notepad-command-palette';
        modal.innerHTML = `
            <div class="notepad-command-palette-content">
                <div class="notepad-command-palette-header">
                    <i class="fas fa-search"></i>
                    <input type="text" id="notepad-command-input" placeholder="Type a command..." autofocus />
                    <button class="notepad-command-close">&times;</button>
                </div>
                <div class="notepad-command-palette-results" id="notepad-command-results">
                    ${commands.map((cmd, i) => `
                        <div class="notepad-command-item" data-index="${i}">
                            <span>${cmd.label}</span>
                            ${cmd.shortcut ? `<span class="notepad-command-shortcut">${cmd.shortcut}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input = document.getElementById('notepad-command-input');
        const results = document.getElementById('notepad-command-results');

        const filterCommands = (query) => {
            const q = query.toLowerCase().trim();
            const filtered = commands.filter(cmd => 
                cmd.label.toLowerCase().includes(q) ||
                cmd.shortcut.toLowerCase().includes(q)
            );
            results.innerHTML = filtered.map((cmd, i) => `
                <div class="notepad-command-item" data-index="${i}">
                    <span>${cmd.label}</span>
                    ${cmd.shortcut ? `<span class="notepad-command-shortcut">${cmd.shortcut}</span>` : ''}
                </div>
            `).join('');
        };

        input.addEventListener('input', () => filterCommands(input.value));

        results.addEventListener('click', (e) => {
            const item = e.target.closest('.notepad-command-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                const filtered = commands.filter(cmd => 
                    cmd.label.toLowerCase().includes(input.value.toLowerCase()) ||
                    cmd.shortcut.toLowerCase().includes(input.value.toLowerCase())
                );
                if (filtered[index]) {
                    filtered[index].action();
                    modal.remove();
                }
            }
        });

        modal.querySelector('.notepad-command-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstItem = results.querySelector('.notepad-command-item');
                if (firstItem) firstItem.click();
            }
            if (e.key === 'Escape') modal.remove();
        });

        setTimeout(() => input.focus(), 50);
    }

    // ================================================================
    // EXPORT & IMPORT
    // ================================================================

    exportAll(format = 'json') {
        const data = {
            notes: this.notes,
            folders: this.folders,
            tags: this.tags,
            reminders: this.reminders,
            exportedAt: new Date().toISOString()
        };

        let content = '';
        let mimeType = '';
        let extension = '';

        switch (format) {
            case 'json':
                content = JSON.stringify(data, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'txt':
                content = this.notes.map(n => `${n.title}\n${'='.repeat(n.title.length)}\n${n.content}\n\n`).join('');
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            case 'md':
                content = this.notes.map(n => `# ${n.title}\n\n${n.content}\n\n---\n`).join('');
                mimeType = 'text/markdown';
                extension = 'md';
                break;
            case 'html':
                content = `<!DOCTYPE html><html><head><title>Notes Export</title></head><body>
                    ${this.notes.map(n => `<h1>${this.escapeHtml(n.title)}</h1><div>${this.parseMarkdown(n.content)}</div><hr>`).join('')}
                </body></html>`;
                mimeType = 'text/html';
                extension = 'html';
                break;
            default:
                return;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes_export.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importNotes() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.notes) {
                        if (confirm(`This will add ${data.notes.length} notes. Continue?`)) {
                            data.notes.forEach(n => {
                                n.id = this.generateId();
                                n.createdAt = new Date().toISOString();
                                n.updatedAt = new Date().toISOString();
                                n.lastEdited = new Date().toISOString();
                                this.notes.push(n);
                            });
                            if (data.folders) {
                                data.folders.forEach(f => {
                                    if (!this.folders.includes(f)) this.folders.push(f);
                                });
                            }
                            if (data.tags) {
                                data.tags.forEach(t => {
                                    if (!this.tags.includes(t)) this.tags.push(t);
                                });
                            }
                            this.saveNotes();
                            this.render();
                            alert(`Successfully imported ${data.notes.length} notes!`);
                        }
                    }
                } catch (err) {
                    alert('Invalid import file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ================================================================
    // THEME & STYLING
    // ================================================================

    applyTheme() {
        const module = document.querySelector('.notepad-module');
        if (module) {
            module.dataset.theme = this.isDarkMode ? 'dark' : 'light';
        }
        const themeBtn = document.getElementById('notepad-theme-toggle');
        if (themeBtn) {
            themeBtn.innerHTML = `<i class="fas ${this.isDarkMode ? 'fa-sun' : 'fa-moon'}"></i>`;
        }
    }

    applyFontSize() {
        const module = document.querySelector('.notepad-module');
        if (module) {
            module.style.fontSize = this.fontSize + 'px';
        }
    }

    applyCompactMode() {
        const module = document.querySelector('.notepad-module');
        if (module) {
            module.classList.toggle('compact', this.isCompact);
        }
    }

    // ================================================================
    // AUTO-LOCK
    // ================================================================

    setupAutoLock() {
        const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        let inactivityTimer = null;

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                if (this.currentNoteId && !this.isLocked) {
                    this.lockModule();
                }
            }, LOCK_TIMEOUT);
        };

        ['click', 'keydown', 'mousemove', 'scroll'].forEach(event => {
            document.addEventListener(event, () => {
                if (document.querySelector('.notepad-module')) {
                    resetTimer();
                }
            });
        });

        resetTimer();
    }

    lockModule() {
        if (this.isLocked) return;
        this.isLocked = true;
        const password = prompt('Set a PIN to lock the notepad:');
        if (password && password.trim()) {
            this.lockPin = password.trim();
            this.renderLockScreen();
        } else {
            this.isLocked = false;
        }
    }

    renderLockScreen() {
        const container = document.getElementById('notepad-container');
        if (!container) return;
        container.innerHTML = `
            <div class="notepad-lock-screen">
                <i class="fas fa-lock" style="font-size:48px; margin-bottom:20px;"></i>
                <h2>Notepad Locked</h2>
                <p>Enter your PIN to unlock</p>
                <input type="password" id="notepad-unlock-input" placeholder="Enter PIN..." style="
                    padding: 10px 16px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-input);
                    color: var(--text-primary);
                    font-size: 16px;
                    width: 200px;
                    margin: 12px 0;
                " />
                <button class="notepad-btn notepad-btn-primary" id="notepad-unlock-btn">Unlock</button>
            </div>
        `;

        document.getElementById('notepad-unlock-btn').addEventListener('click', () => {
            const input = document.getElementById('notepad-unlock-input');
            if (input.value === this.lockPin) {
                this.isLocked = false;
                this.render();
            } else {
                alert('Incorrect PIN');
                input.value = '';
                input.focus();
            }
        });

        document.getElementById('notepad-unlock-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('notepad-unlock-btn').click();
            }
        });

        setTimeout(() => {
            document.getElementById('notepad-unlock-input')?.focus();
        }, 100);
    }

    // ================================================================
    // UTILITY FUNCTIONS
    // ================================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ================================================================
    // INTEGRATION API - Methods for external use
    // ================================================================

    // Get all notes (for integration with main app)
    getAllNotes() {
        return this.notes;
    }

    // Get a note by ID
    getNote(id) {
        return this.notes.find(n => n.id === id);
    }

    // Create a note from external data
    createNoteFromExternal(data) {
        return this.createNote(data.title, data.content);
    }

    // Search notes from external
    searchNotes(query) {
        this.searchQuery = query;
        this.render();
        return this.getFilteredNotes();
    }

    // Export a single note
    exportNote(id, format = 'txt') {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        let content = '';
        let extension = '';
        
        switch (format) {
            case 'txt':
                content = `${note.title}\n${'='.repeat(note.title.length)}\n${note.content}`;
                extension = 'txt';
                break;
            case 'md':
                content = `# ${note.title}\n\n${note.content}`;
                extension = 'md';
                break;
            case 'html':
                content = `<!DOCTYPE html><html><head><title>${this.escapeHtml(note.title)}</title></head>
                    <body><h1>${this.escapeHtml(note.title)}</h1><div>${this.parseMarkdown(note.content)}</div></body></html>`;
                extension = 'html';
                break;
            default:
                return;
        }
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Print a note
    printNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.escapeHtml(note.title)}</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
                    h1 { color: #333; }
                    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
                    .content { white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>${this.escapeHtml(note.title)}</h1>
                <div class="meta">Created: ${new Date(note.createdAt).toLocaleString()} | Updated: ${new Date(note.updatedAt).toLocaleString()}</div>
                <div class="content">${this.escapeHtml(note.content)}</div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
}

// ================================================================
// INITIALIZATION
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Wait for the container to be ready
    const container = document.getElementById('notepad-container');
    if (container) {
        window.notepad = new NotepadModule();
    } else {
        console.warn('Notepad container not found. Module will not initialize.');
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotepadModule;
}