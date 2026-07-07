// ================================================================
// NOTEPAD PRO - COMPLETE APPLICATION
// ================================================================

(function() {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    const CONFIG = {
        STORAGE_KEY: 'notepad_pro_data',
        SETTINGS_KEY: 'notepad_pro_settings',
        MAX_VERSIONS: 50,
        AUTO_SAVE_DELAY: 1000,
        INACTIVITY_LOCK: 300000, // 5 minutes
        TEMPLATES: {
            meeting: `# Meeting Notes\n\n## Attendees\n- \n\n## Agenda\n- \n\n## Discussion Points\n- \n\n## Action Items\n- [ ] `,
            sales: `# Sales Call Notes\n\n## Client: \n## Date: \n\n## Key Points\n- \n\n## Objections\n- \n\n## Next Steps\n- [ ] `,
            followup: `# Follow-up Notes\n\n## Contact: \n## Date: \n\n## Summary\n\n## Action Items\n- [ ] `,
            daily: `# Daily Notes\n\n## Date: \n\n## Tasks\n- [ ] \n\n## Notes\n- \n\n## Tomorrow's Priorities\n- `
        }
    };

    // ============================================================
    // STATE
    // ============================================================
    let state = {
        notes: [],
        folders: [],
        tags: [],
        currentNoteId: null,
        currentFolder: 'all',
        currentTag: 'all',
        currentFilter: 'all',
        searchQuery: '',
        sortBy: 'updated',
        viewMode: 'list',
        selectedNotes: new Set(),
        isLocked: false,
        lockTimeout: null,
        editorMode: 'rich',
        isDark: localStorage.getItem('notepad_theme') === 'dark'
    };

    let editorInstance = null;
    let saveTimeout = null;
    let isSaving = false;
    let commandPaletteOpen = false;
    let selectedCommandIndex = -1;

    // ============================================================
    // DOM REFS
    // ============================================================
    const DOM = {};

    function cacheDomRefs() {
        DOM.app = document.getElementById('notepadApp');
        DOM.sidebar = document.querySelector('.notepad-sidebar');
        DOM.notesList = document.getElementById('notesList');
        DOM.emptyState = document.getElementById('emptyState');
        DOM.noteEditor = document.getElementById('noteEditor');
        DOM.noteTitle = document.getElementById('noteTitle');
        DOM.richEditor = document.getElementById('richEditor');
        DOM.markdownEditor = document.getElementById('markdownEditor');
        DOM.plainEditor = document.getElementById('plainEditor');
        DOM.markdownPreview = document.getElementById('markdownPreview');
        DOM.searchInput = document.getElementById('searchNotes');
        DOM.sortSelect = document.getElementById('sortBy');
        DOM.wordCount = document.getElementById('wordCount');
        DOM.charCount = document.getElementById('charCount');
        DOM.readingTime = document.getElementById('readingTime');
        DOM.saveStatus = document.getElementById('saveStatus');
        DOM.lastEdited = document.getElementById('lastEdited');
        DOM.noteCount = document.getElementById('noteCount');
        DOM.notesCount = document.getElementById('notesCount');
        DOM.selectedCount = document.getElementById('selectedCount');
        DOM.storageInfo = document.getElementById('storageInfo');
        DOM.foldersList = document.getElementById('foldersList');
        DOM.tagsList = document.getElementById('tagsList');
        DOM.colorPickerModal = document.getElementById('colorPickerModal');
        DOM.exportModal = document.getElementById('exportModal');
        DOM.templateModal = document.getElementById('templateModal');
        DOM.commandPalette = document.getElementById('commandPalette');
        DOM.commandInput = document.getElementById('commandInput');
        DOM.commandResults = document.getElementById('commandResults');
        DOM.noteOptionsDropdown = document.getElementById('noteOptionsDropdown');
        DOM.editorContainer = document.getElementById('editorContainer');
    }

    // ============================================================
    // DATA MANAGEMENT
    // ============================================================
    function loadData() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                state.notes = parsed.notes || [];
                state.folders = parsed.folders || ['Personal', 'Work', 'Sales'];
                state.tags = parsed.tags || ['important', 'idea', 'todo', 'follow-up'];
                state.currentNoteId = parsed.currentNoteId || null;
                return true;
            }
        } catch (e) {
            console.warn('Failed to load data:', e);
        }
        // Initialize with sample data
        initializeSampleData();
        return false;
    }

    function saveData() {
        try {
            const data = {
                notes: state.notes,
                folders: state.folders,
                tags: state.tags,
                currentNoteId: state.currentNoteId
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
            updateStorageInfo();
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);
            showToast('Failed to save data', 'error');
            return false;
        }
    }

    function initializeSampleData() {
        const now = new Date().toISOString();
        state.notes = [
            {
                id: '1',
                title: 'Welcome to Notepad Pro',
                content: '<h1>Welcome!</h1><p>This is your first note. Start writing by creating a new note or selecting this one.</p><ul><li>Rich text editing</li><li>Markdown support</li><li>Auto-save</li></ul>',
                plainContent: 'Welcome!\n\nThis is your first note. Start writing by creating a new note or selecting this one.\n\n- Rich text editing\n- Markdown support\n- Auto-save',
                markdownContent: '# Welcome!\n\nThis is your first note. Start writing by creating a new note or selecting this one.\n\n- Rich text editing\n- Markdown support\n- Auto-save',
                folder: 'Personal',
                tags: ['important', 'idea'],
                color: '#ffffff',
                pinned: true,
                favorite: true,
                archived: false,
                locked: false,
                version: 1,
                versions: [],
                created: now,
                updated: now,
                reminder: null,
                dueDate: null,
                checklist: []
            },
            {
                id: '2',
                title: 'Meeting Notes Template',
                content: '<h2>Team Sync</h2><p><strong>Date:</strong> Today</p><p><strong>Attendees:</strong> Team</p><h3>Agenda</h3><ul><li>Review progress</li><li>Plan next sprint</li></ul>',
                plainContent: 'Team Sync\n\nDate: Today\nAttendees: Team\n\nAgenda\n- Review progress\n- Plan next sprint',
                markdownContent: '# Team Sync\n\n**Date:** Today\n**Attendees:** Team\n\n## Agenda\n- Review progress\n- Plan next sprint',
                folder: 'Work',
                tags: ['meeting'],
                color: '#dbeafe',
                pinned: false,
                favorite: false,
                archived: false,
                locked: false,
                version: 1,
                versions: [],
                created: now,
                updated: now,
                reminder: null,
                dueDate: null,
                checklist: []
            }
        ];
        state.folders = ['Personal', 'Work', 'Sales'];
        state.tags = ['important', 'idea', 'todo', 'follow-up', 'meeting'];
        state.currentNoteId = '1';
        saveData();
    }

    // ============================================================
    // NOTE CRUD OPERATIONS
    // ============================================================
    function createNote(data = {}) {
        const now = new Date().toISOString();
        const note = {
            id: generateId(),
            title: data.title || 'Untitled',
            content: data.content || '<p>Start writing...</p>',
            plainContent: data.plainContent || 'Start writing...',
            markdownContent: data.markdownContent || 'Start writing...',
            folder: data.folder || 'Personal',
            tags: data.tags || [],
            color: data.color || '#ffffff',
            pinned: data.pinned || false,
            favorite: data.favorite || false,
            archived: data.archived || false,
            locked: data.locked || false,
            version: 1,
            versions: [],
            created: now,
            updated: now,
            reminder: data.reminder || null,
            dueDate: data.dueDate || null,
            checklist: data.checklist || []
        };
        state.notes.unshift(note);
        state.currentNoteId = note.id;
        saveData();
        renderAll();
        selectNote(note.id);
        showToast('Note created', 'success');
        return note;
    }

    function updateNote(id, updates) {
        const note = getNote(id);
        if (!note) return null;
        
        const oldContent = note.content;
        Object.assign(note, updates);
        
        // Save version if content changed
        if (updates.content && updates.content !== oldContent) {
            saveVersion(id);
        }
        
        note.updated = new Date().toISOString();
        saveData();
        renderAll();
        return note;
    }

    function deleteNote(id, permanent = false) {
        const note = getNote(id);
        if (!note) return false;
        
        if (permanent) {
            state.notes = state.notes.filter(n => n.id !== id);
        } else {
            note.archived = true;
        }
        
        if (state.currentNoteId === id) {
            const remaining = getVisibleNotes();
            state.currentNoteId = remaining.length > 0 ? remaining[0].id : null;
        }
        
        saveData();
        renderAll();
        if (state.currentNoteId) {
            selectNote(state.currentNoteId);
        } else {
            showEmptyState();
        }
        showToast(permanent ? 'Note permanently deleted' : 'Note archived', 'info');
        return true;
    }

    function duplicateNote(id) {
        const note = getNote(id);
        if (!note) return null;
        
        const newNote = {
            ...note,
            id: generateId(),
            title: note.title + ' (Copy)',
            pinned: false,
            favorite: false,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            versions: []
        };
        state.notes.unshift(newNote);
        saveData();
        renderAll();
        selectNote(newNote.id);
        showToast('Note duplicated', 'success');
        return newNote;
    }

    function getNote(id) {
        return state.notes.find(n => n.id === id);
    }

    function getVisibleNotes() {
        let notes = [...state.notes];
        
        // Filter by archive
        if (state.currentFilter === 'archive') {
            notes = notes.filter(n => n.archived);
        } else {
            notes = notes.filter(n => !n.archived);
        }
        
        // Filter by folder
        if (state.currentFolder !== 'all') {
            notes = notes.filter(n => n.folder === state.currentFolder);
        }
        
        // Filter by tag
        if (state.currentTag !== 'all') {
            notes = notes.filter(n => n.tags && n.tags.includes(state.currentTag));
        }
        
        // Filter by favorites
        if (state.currentFilter === 'favorites') {
            notes = notes.filter(n => n.favorite);
        }
        
        // Filter by pinned
        if (state.currentFilter === 'pinned') {
            notes = notes.filter(n => n.pinned);
        }
        
        // Search
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            notes = notes.filter(n => 
                n.title.toLowerCase().includes(query) ||
                n.plainContent.toLowerCase().includes(query)
            );
        }
        
        // Sort
        switch (state.sortBy) {
            case 'title':
                notes.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'created':
                notes.sort((a, b) => new Date(b.created) - new Date(a.created));
                break;
            case 'pinned':
                notes.sort((a, b) => (b.pinned - a.pinned) || new Date(b.updated) - new Date(a.updated));
                break;
            case 'favorites':
                notes.sort((a, b) => (b.favorite - a.favorite) || new Date(b.updated) - new Date(a.updated));
                break;
            default: // updated
                notes.sort((a, b) => new Date(b.updated) - new Date(a.updated));
                break;
        }
        
        return notes;
    }

    // ============================================================
    // VERSION HISTORY
    // ============================================================
    function saveVersion(id) {
        const note = getNote(id);
        if (!note) return;
        
        if (!note.versions) note.versions = [];
        note.versions.push({
            content: note.content,
            timestamp: new Date().toISOString()
        });
        
        if (note.versions.length > CONFIG.MAX_VERSIONS) {
            note.versions = note.versions.slice(-CONFIG.MAX_VERSIONS);
        }
        note.version = note.versions.length + 1;
    }

    function restoreVersion(id, versionIndex) {
        const note = getNote(id);
        if (!note || !note.versions[versionIndex]) return false;
        
        const version = note.versions[versionIndex];
        note.content = version.content;
        note.updated = new Date().toISOString();
        saveData();
        renderAll();
        selectNote(id);
        showToast('Version restored', 'success');
        return true;
    }

    // ============================================================
    // RENDERING
    // ============================================================
    function renderAll() {
        renderNotesList();
        renderFolders();
        renderTags();
        renderStats();
        if (state.currentNoteId) {
            selectNote(state.currentNoteId);
        }
        updateNoteCounts();
    }

    function renderNotesList() {
        const notes = getVisibleNotes();
        const container = DOM.notesList;
        
        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:40px 20px;">
                    <i class="fas fa-sticky-note" style="font-size:2rem; opacity:0.3;"></i>
                    <p style="margin-top:12px; color:var(--text-muted);">No notes found</p>
                    <button class="primary-btn" style="margin-top:12px;" onclick="window.createNewNote()">
                        <i class="fas fa-plus"></i> Create Note
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = notes.map(note => `
            <div class="note-item ${note.id === state.currentNoteId ? 'active' : ''}" 
                 data-id="${note.id}"
                 role="button"
                 tabindex="0"
                 aria-label="${note.title}">
                ${note.color && note.color !== '#ffffff' ? 
                    `<div class="note-color-indicator" style="background:${note.color};"></div>` : ''}
                <div style="flex:1; min-width:0;">
                    <div class="note-title">
                        ${note.pinned ? '<i class="fas fa-thumbtack pinned-icon"></i>' : ''}
                        ${note.favorite ? '<i class="fas fa-star favorite-icon"></i>' : ''}
                        ${escapeHtml(note.title)}
                    </div>
                    <div class="note-preview">${escapeHtml(stripHtml(note.content).substring(0, 100))}</div>
                    <div class="note-meta-row">
                        <span>${formatDate(note.updated)}</span>
                        ${note.tags && note.tags.length > 0 ? 
                            `<div class="note-tags">${note.tags.slice(0, 2).map(t => 
                                `<span class="note-tag">${escapeHtml(t)}</span>`
                            ).join('')}${note.tags.length > 2 ? `<span class="note-tag">+${note.tags.length - 2}</span>` : ''}</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Attach click events
        container.querySelectorAll('.note-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                if (id) selectNote(id);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const id = el.dataset.id;
                    if (id) selectNote(id);
                }
            });
        });
    }

    function renderFolders() {
        const container = DOM.foldersList;
        container.innerHTML = `
            <div class="folder-item ${state.currentFolder === 'all' ? 'active' : ''}" data-folder="all">
                <span><i class="fas fa-inbox"></i> All Notes</span>
            </div>
            ${state.folders.map(folder => `
                <div class="folder-item ${state.currentFolder === folder ? 'active' : ''}" data-folder="${escapeHtml(folder)}">
                    <span><i class="fas fa-folder"></i> ${escapeHtml(folder)}</span>
                    <span class="item-actions">
                        <button class="edit-folder" data-folder="${escapeHtml(folder)}" title="Rename"><i class="fas fa-edit"></i></button>
                        <button class="delete-folder" data-folder="${escapeHtml(folder)}" title="Delete"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
            `).join('')}
        `;
        
        container.querySelectorAll('.folder-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.item-actions')) return;
                state.currentFolder = el.dataset.folder;
                renderAll();
            });
        });
        
        container.querySelectorAll('.edit-folder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const oldName = btn.dataset.folder;
                const newName = prompt('Rename folder:', oldName);
                if (newName && newName.trim() && newName !== oldName) {
                    renameFolder(oldName, newName.trim());
                }
            });
        });
        
        container.querySelectorAll('.delete-folder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const folder = btn.dataset.folder;
                if (folder === 'Personal' || folder === 'Work' || folder === 'Sales') {
                    showToast('Cannot delete default folder', 'error');
                    return;
                }
                if (confirm(`Delete folder "${folder}"? Notes will be moved to "Personal".`)) {
                    deleteFolder(folder);
                }
            });
        });
    }

    function renderTags() {
        const container = DOM.tagsList;
        container.innerHTML = `
            <div class="tag-item ${state.currentTag === 'all' ? 'active' : ''}" data-tag="all">
                <span><i class="fas fa-tags"></i> All Tags</span>
            </div>
            ${state.tags.map(tag => `
                <div class="tag-item ${state.currentTag === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
                    <span><i class="fas fa-tag"></i> ${escapeHtml(tag)}</span>
                    <span class="item-actions">
                        <button class="edit-tag" data-tag="${escapeHtml(tag)}" title="Rename"><i class="fas fa-edit"></i></button>
                        <button class="delete-tag" data-tag="${escapeHtml(tag)}" title="Delete"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
            `).join('')}
        `;
        
        container.querySelectorAll('.tag-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.item-actions')) return;
                state.currentTag = el.dataset.tag;
                renderAll();
            });
        });
        
        container.querySelectorAll('.edit-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const oldName = btn.dataset.tag;
                const newName = prompt('Rename tag:', oldName);
                if (newName && newName.trim() && newName !== oldName) {
                    renameTag(oldName, newName.trim());
                }
            });
        });
        
        container.querySelectorAll('.delete-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.dataset.tag;
                if (confirm(`Delete tag "${tag}"?`)) {
                    deleteTag(tag);
                }
            });
        });
    }

    function renderStats() {
        const total = state.notes.length;
        const visible = getVisibleNotes().length;
        DOM.noteCount.textContent = `${total} notes`;
        DOM.notesCount.textContent = `${visible} notes`;
        DOM.selectedCount.textContent = `${state.selectedNotes.size} selected`;
    }

    function updateNoteCounts() {
        // Already handled in renderStats
    }

    function updateStorageInfo() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            const size = data ? (data.length / 1024).toFixed(1) : '0';
            DOM.storageInfo.textContent = `${size} KB used`;
        } catch (e) {
            DOM.storageInfo.textContent = '0 KB used';
        }
    }

    // ============================================================
    // NOTE SELECTION & EDITING
    // ============================================================
    function selectNote(id) {
        const note = getNote(id);
        if (!note) {
            showEmptyState();
            return;
        }
        
        state.currentNoteId = id;
        DOM.emptyState.style.display = 'none';
        DOM.noteEditor.style.display = 'flex';
        
        // Set title
        DOM.noteTitle.value = note.title;
        
        // Set content based on mode
        setEditorContent(note);
        
        // Update meta buttons
        updateMetaButtons(note);
        
        // Update last edited
        DOM.lastEdited.textContent = `Last edited: ${formatDate(note.updated)}`;
        
        // Update word count
        updateWordCount();
        
        // Mark as active in list
        document.querySelectorAll('.note-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });
        
        // Auto-save on input
        setupAutoSave();
    }

    function showEmptyState() {
        DOM.emptyState.style.display = 'flex';
        DOM.noteEditor.style.display = 'none';
        state.currentNoteId = null;
    }

    function setEditorContent(note) {
        const mode = state.editorMode;
        
        // Hide all editors
        DOM.richEditor.style.display = 'none';
        DOM.markdownEditor.style.display = 'none';
        DOM.plainEditor.style.display = 'none';
        DOM.markdownPreview.style.display = 'none';
        
        // Show the right one
        if (mode === 'rich') {
            DOM.richEditor.style.display = 'block';
            DOM.richEditor.innerHTML = note.content || '<p>Start writing...</p>';
        } else if (mode === 'markdown') {
            DOM.markdownEditor.style.display = 'block';
            DOM.markdownEditor.value = note.markdownContent || note.plainContent || '';
        } else {
            DOM.plainEditor.style.display = 'block';
            DOM.plainEditor.value = note.plainContent || '';
        }
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    function getEditorContent() {
        const mode = state.editorMode;
        if (mode === 'rich') {
            return DOM.richEditor.innerHTML;
        } else if (mode === 'markdown') {
            return DOM.markdownEditor.value;
        } else {
            return DOM.plainEditor.value;
        }
    }

    function updateMetaButtons(note) {
        const pinBtn = document.getElementById('pinNoteBtn');
        const favBtn = document.getElementById('favoriteNoteBtn');
        const archiveBtn = document.getElementById('archiveNoteBtn');
        
        pinBtn.classList.toggle('active', note.pinned);
        favBtn.classList.toggle('active', note.favorite);
        archiveBtn.classList.toggle('active', note.archived);
    }

    function updateWordCount() {
        const content = getEditorContent();
        const text = stripHtml(content);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const readingTime = Math.max(1, Math.ceil(words / 200));
        
        DOM.wordCount.textContent = `${words} words`;
        DOM.charCount.textContent = `${chars} characters`;
        DOM.readingTime.textContent = `${readingTime} min read`;
    }

    // ============================================================
    // AUTO-SAVE
    // ============================================================
    function setupAutoSave() {
        const inputs = [DOM.richEditor, DOM.markdownEditor, DOM.plainEditor, DOM.noteTitle];
        
        inputs.forEach(input => {
            input.removeEventListener('input', handleAutoSave);
            input.addEventListener('input', handleAutoSave);
        });
    }

    function handleAutoSave() {
        clearTimeout(saveTimeout);
        DOM.saveStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveTimeout = setTimeout(saveCurrentNote, CONFIG.AUTO_SAVE_DELAY);
        updateWordCount();
    }

    function saveCurrentNote() {
        const id = state.currentNoteId;
        if (!id) return;
        
        const note = getNote(id);
        if (!note) return;
        
        const title = DOM.noteTitle.value.trim() || 'Untitled';
        const content = getEditorContent();
        
        // Build plain and markdown versions
        const plainContent = stripHtml(content);
        const markdownContent = convertToMarkdown(content);
        
        // Update note
        const updates = {
            title,
            content,
            plainContent,
            markdownContent,
            updated: new Date().toISOString()
        };
        
        // Save version if content changed significantly
        if (content !== note.content) {
            saveVersion(id);
        }
        
        Object.assign(note, updates);
        saveData();
        
        DOM.saveStatus.innerHTML = '<i class="fas fa-check"></i> Saved';
        DOM.lastEdited.textContent = `Last edited: ${formatDate(note.updated)}`;
        
        // Update list
        renderNotesList();
        renderStats();
        
        isSaving = false;
    }

    // ============================================================
    // FOLDER & TAG MANAGEMENT
    // ============================================================
    function renameFolder(oldName, newName) {
        const index = state.folders.indexOf(oldName);
        if (index === -1) return;
        
        state.folders[index] = newName;
        state.notes.forEach(n => {
            if (n.folder === oldName) n.folder = newName;
        });
        if (state.currentFolder === oldName) state.currentFolder = newName;
        saveData();
        renderAll();
        showToast(`Folder renamed to "${newName}"`, 'success');
    }

    function deleteFolder(folder) {
        const index = state.folders.indexOf(folder);
        if (index === -1) return;
        
        state.folders.splice(index, 1);
        state.notes.forEach(n => {
            if (n.folder === folder) n.folder = 'Personal';
        });
        if (state.currentFolder === folder) state.currentFolder = 'all';
        saveData();
        renderAll();
        showToast(`Folder "${folder}" deleted`, 'info');
    }

    function renameTag(oldName, newName) {
        const index = state.tags.indexOf(oldName);
        if (index === -1) return;
        
        state.tags[index] = newName;
        state.notes.forEach(n => {
            if (n.tags && n.tags.includes(oldName)) {
                const idx = n.tags.indexOf(oldName);
                n.tags[idx] = newName;
            }
        });
        if (state.currentTag === oldName) state.currentTag = newName;
        saveData();
        renderAll();
        showToast(`Tag renamed to "${newName}"`, 'success');
    }

    function deleteTag(tag) {
        const index = state.tags.indexOf(tag);
        if (index === -1) return;
        
        state.tags.splice(index, 1);
        state.notes.forEach(n => {
            if (n.tags) {
                n.tags = n.tags.filter(t => t !== tag);
            }
        });
        if (state.currentTag === tag) state.currentTag = 'all';
        saveData();
        renderAll();
        showToast(`Tag "${tag}" deleted`, 'info');
    }

    // ============================================================
    // EXPORT FUNCTIONS
    // ============================================================
    function exportNote(format) {
        const note = getNote(state.currentNoteId);
        if (!note) {
            showToast('No note selected', 'error');
            return;
        }
        
        let content = '';
        let filename = `${note.title || 'untitled'}`;
        let mimeType = 'text/plain';
        
        switch (format) {
            case 'txt':
                content = note.plainContent || stripHtml(note.content);
                filename += '.txt';
                break;
            case 'html':
                content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(note.title)}</title></head><body>${note.content}</body></html>`;
                filename += '.html';
                mimeType = 'text/html';
                break;
            case 'markdown':
                content = note.markdownContent || note.plainContent || '';
                filename += '.md';
                break;
            case 'json':
                content = JSON.stringify(note, null, 2);
                filename += '.json';
                mimeType = 'application/json';
                break;
            case 'pdf':
                exportPDF(note);
                return;
            default:
                content = note.plainContent || stripHtml(note.content);
                filename += '.txt';
        }
        
        downloadFile(content, filename, mimeType);
        showToast(`Exported as ${format.toUpperCase()}`, 'success');
    }

    function exportPDF(note) {
        // Simple PDF export using browser print
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            showToast('Please allow popups for PDF export', 'error');
            return;
        }
        
        printWindow.document.write(`
            <html>
                <head><title>${escapeHtml(note.title)}</title></head>
                <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6;">
                    <h1>${escapeHtml(note.title)}</h1>
                    <div>${note.content}</div>
                    <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                        Exported from Notepad Pro on ${new Date().toLocaleString()}
                    </p>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============================================================
    // TEMPLATES
    // ============================================================
    function applyTemplate(type) {
        const content = CONFIG.TEMPLATES[type];
        if (!content) return;
        
        const note = getNote(state.currentNoteId);
        if (!note) {
            // Create new note with template
            const now = new Date().toISOString();
            const newNote = {
                id: generateId(),
                title: `${type.charAt(0).toUpperCase() + type.slice(1)} Notes`,
                content: content,
                plainContent: stripHtml(content),
                markdownContent: content,
                folder: 'Personal',
                tags: [type],
                color: '#ffffff',
                pinned: false,
                favorite: false,
                archived: false,
                locked: false,
                version: 1,
                versions: [],
                created: now,
                updated: now,
                reminder: null,
                dueDate: null,
                checklist: []
            };
            state.notes.unshift(newNote);
            state.currentNoteId = newNote.id;
            saveData();
            renderAll();
            selectNote(newNote.id);
            showToast('Template applied', 'success');
        } else {
            // Apply template to current note
            const plainContent = stripHtml(content);
            updateNote(note.id, {
                content: content,
                plainContent: plainContent,
                markdownContent: content
            });
            showToast('Template applied', 'success');
        }
    }

    // ============================================================
    // SEARCH & FILTER
    // ============================================================
    function performSearch(query) {
        state.searchQuery = query.trim();
        renderNotesList();
        renderStats();
    }

    function setFilter(filter) {
        state.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        renderAll();
    }

    function setSort(sort) {
        state.sortBy = sort;
        renderNotesList();
    }

    // ============================================================
    // COMMAND PALETTE
    // ============================================================
    function toggleCommandPalette() {
        commandPaletteOpen = !commandPaletteOpen;
        DOM.commandPalette.style.display = commandPaletteOpen ? 'flex' : 'none';
        if (commandPaletteOpen) {
            DOM.commandInput.value = '';
            DOM.commandInput.focus();
            updateCommands('');
        }
    }

    function updateCommands(query) {
        const commands = [
            { label: 'New Note', icon: 'fa-plus', action: () => createNewNote(), shortcut: '⌘N' },
            { label: 'Search Notes', icon: 'fa-search', action: () => DOM.searchInput.focus(), shortcut: '⌘F' },
            { label: 'Toggle Theme', icon: 'fa-moon', action: toggleTheme, shortcut: '⌘⇧T' },
            { label: 'Export Note', icon: 'fa-file-export', action: () => openExportModal(), shortcut: '' },
            { label: 'Apply Template', icon: 'fa-copy', action: () => openTemplateModal(), shortcut: '' },
            { label: 'Delete Note', icon: 'fa-trash', action: () => deleteCurrentNote(), shortcut: '' },
            { label: 'Toggle Pin', icon: 'fa-thumbtack', action: () => togglePin(), shortcut: '' },
            { label: 'Toggle Favorite', icon: 'fa-star', action: () => toggleFavorite(), shortcut: '' },
            { label: 'Toggle Archive', icon: 'fa-archive', action: () => toggleArchive(), shortcut: '' },
            { label: 'View All Notes', icon: 'fa-list', action: () => { state.currentFilter = 'all'; renderAll(); }, shortcut: '' },
            { label: 'View Favorites', icon: 'fa-star', action: () => { state.currentFilter = 'favorites'; renderAll(); }, shortcut: '' },
            { label: 'View Pinned', icon: 'fa-thumbtack', action: () => { state.currentFilter = 'pinned'; renderAll(); }, shortcut: '' },
            { label: 'View Archive', icon: 'fa-archive', action: () => { state.currentFilter = 'archive'; renderAll(); }, shortcut: '' },
        ];
        
        const q = query.toLowerCase().trim();
        let results = commands;
        if (q) {
            results = commands.filter(c => 
                c.label.toLowerCase().includes(q) || 
                c.shortcut.toLowerCase().includes(q)
            );
        }
        
        if (results.length === 0) {
            DOM.commandResults.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">No commands found</div>';
            return;
        }
        
        DOM.commandResults.innerHTML = results.map((cmd, index) => `
            <div class="command-item ${index === 0 ? 'selected' : ''}" data-index="${index}">
                <i class="fas ${cmd.icon}"></i>
                <span class="command-label">${cmd.label}</span>
                ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
            </div>
        `).join('');
        
        DOM.commandResults.querySelectorAll('.command-item').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                if (results[index]) {
                    results[index].action();
                    toggleCommandPalette();
                }
            });
        });
        
        selectedCommandIndex = 0;
    }

    // ============================================================
    // THEME
    // ============================================================
    function toggleTheme() {
        state.isDark = !state.isDark;
        document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
        localStorage.setItem('notepad_theme', state.isDark ? 'dark' : 'light');
        document.getElementById('toggleThemeBtn').innerHTML = state.isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        showToast(state.isDark ? 'Dark mode' : 'Light mode', 'info');
    }

    // ============================================================
    // UI HELPERS
    // ============================================================
    function createNewNote() {
        const note = createNote();
        selectNote(note.id);
        DOM.noteTitle.focus();
        DOM.noteTitle.select();
    }

    function deleteCurrentNote() {
        const note = getNote(state.currentNoteId);
        if (!note) return;
        if (confirm(`Delete "${note.title}"?`)) {
            deleteNote(state.currentNoteId);
        }
    }

    function togglePin() {
        const note = getNote(state.currentNoteId);
        if (!note) return;
        note.pinned = !note.pinned;
        saveData();
        renderAll();
        selectNote(note.id);
        showToast(note.pinned ? 'Pinned' : 'Unpinned', 'info');
    }

    function toggleFavorite() {
        const note = getNote(state.currentNoteId);
        if (!note) return;
        note.favorite = !note.favorite;
        saveData();
        renderAll();
        selectNote(note.id);
        showToast(note.favorite ? 'Added to favorites' : 'Removed from favorites', 'info');
    }

    function toggleArchive() {
        const note = getNote(state.currentNoteId);
        if (!note) return;
        note.archived = !note.archived;
        saveData();
        renderAll();
        if (note.archived) {
            // Switch to next note
            const remaining = getVisibleNotes();
            if (remaining.length > 0) {
                selectNote(remaining[0].id);
            } else {
                showEmptyState();
            }
        } else {
            selectNote(note.id);
        }
        showToast(note.archived ? 'Archived' : 'Unarchived', 'info');
    }

    function openColorPicker() {
        DOM.colorPickerModal.style.display = 'flex';
        const note = getNote(state.currentNoteId);
        if (note) {
            document.querySelectorAll('.color-option').forEach(el => {
                el.classList.toggle('active', el.dataset.color === note.color);
            });
        }
    }

    function selectColor(color) {
        const note = getNote(state.currentNoteId);
        if (!note) return;
        note.color = color;
        saveData();
        renderAll();
        selectNote(note.id);
        DOM.colorPickerModal.style.display = 'none';
        showToast('Color updated', 'success');
    }

    function openExportModal() {
        DOM.exportModal.style.display = 'flex';
    }

    function openTemplateModal() {
        DOM.templateModal.style.display = 'flex';
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================
    function generateId() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    function stripHtml(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'Just now';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function convertToMarkdown(html) {
        // Simple HTML to Markdown conversion
        if (!html) return '';
        let text = html;
        // Headings
        text = text.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
        text = text.replace(/<h2>(.*?)<\/h2>/g, '## $1\n');
        text = text.replace(/<h3>(.*?)<\/h3>/g, '### $1\n');
        // Lists
        text = text.replace(/<ul>/g, '');
        text = text.replace(/<\/ul>/g, '');
        text = text.replace(/<ol>/g, '');
        text = text.replace(/<\/ol>/g, '');
        text = text.replace(/<li>(.*?)<\/li>/g, '- $1\n');
        // Bold, Italic
        text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
        text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');
        // Links
        text = text.replace(/<a href="([^"]*)">(.*?)<\/a>/g, '[$2]($1)');
        // Blockquotes
        text = text.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n');
        // Code
        text = text.replace(/<code>(.*?)<\/code>/g, '`$1`');
        // Paragraphs
        text = text.replace(/<p>(.*?)<\/p>/g, '$1\n\n');
        // Line breaks
        text = text.replace(/<br\s*\/?>/g, '\n');
        // Clean up
        text = text.replace(/<[^>]*>/g, '');
        text = text.replace(/\n{3,}/g, '\n\n');
        return text.trim();
    }

    // ============================================================
    // TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Command Palette - Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                toggleCommandPalette();
                return;
            }
            
            // New Note - Ctrl+N
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                createNewNote();
                return;
            }
            
            // Save - Ctrl+S
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveCurrentNote();
                return;
            }
            
            // Search - Ctrl+F
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                DOM.searchInput.focus();
                DOM.searchInput.select();
                return;
            }
            
            // Delete - Delete/Backspace when note selected
            if ((e.key === 'Delete' || e.key === 'Backspace') && state.currentNoteId) {
                // Don't delete if editing content
                if (e.target.closest('.rich-editor, .markdown-editor, .plain-editor, input, textarea')) {
                    return;
                }
                e.preventDefault();
                deleteCurrentNote();
                return;
            }
            
            // Escape
            if (e.key === 'Escape') {
                if (commandPaletteOpen) {
                    toggleCommandPalette();
                }
                if (DOM.colorPickerModal.style.display === 'flex') {
                    DOM.colorPickerModal.style.display = 'none';
                }
                if (DOM.exportModal.style.display === 'flex') {
                    DOM.exportModal.style.display = 'none';
                }
                if (DOM.templateModal.style.display === 'flex') {
                    DOM.templateModal.style.display = 'none';
                }
                if (DOM.noteOptionsDropdown.style.display === 'block') {
                    DOM.noteOptionsDropdown.style.display = 'none';
                }
            }
            
            // Command palette navigation
            if (commandPaletteOpen) {
                const items = DOM.commandResults.querySelectorAll('.command-item');
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedCommandIndex = Math.min(selectedCommandIndex + 1, items.length - 1);
                    items.forEach((el, i) => el.classList.toggle('selected', i === selectedCommandIndex));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0);
                    items.forEach((el, i) => el.classList.toggle('selected', i === selectedCommandIndex));
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (items[selectedCommandIndex]) {
                        items[selectedCommandIndex].click();
                    }
                }
            }
        });
    }

    // ============================================================
    // EVENT BINDING
    // ============================================================
    function bindEvents() {
        // New Note
        document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
        document.getElementById('emptyNewNoteBtn').addEventListener('click', createNewNote);
        
        // Theme Toggle
        document.getElementById('toggleThemeBtn').addEventListener('click', toggleTheme);
        
        // Search
        DOM.searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });
        
        document.getElementById('clearSearchBtn').addEventListener('click', () => {
            DOM.searchInput.value = '';
            performSearch('');
        });
        
        // Sort
        DOM.sortSelect.addEventListener('change', (e) => {
            setSort(e.target.value);
        });
        
        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setFilter(btn.dataset.filter);
            });
        });
        
        // New Folder
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            const name = prompt('Enter folder name:');
            if (name && name.trim()) {
                state.folders.push(name.trim());
                saveData();
                renderAll();
                showToast(`Folder "${name.trim()}" created`, 'success');
            }
        });
        
        // New Tag
        document.getElementById('newTagBtn').addEventListener('click', () => {
            const name = prompt('Enter tag name:');
            if (name && name.trim()) {
                state.tags.push(name.trim());
                saveData();
                renderAll();
                showToast(`Tag "${name.trim()}" created`, 'success');
            }
        });
        
        // Pin Note
        document.getElementById('pinNoteBtn').addEventListener('click', togglePin);
        
        // Favorite Note
        document.getElementById('favoriteNoteBtn').addEventListener('click', toggleFavorite);
        
        // Archive Note
        document.getElementById('archiveNoteBtn').addEventListener('click', toggleArchive);
        
        // Color Picker
        document.getElementById('noteColorBtn').addEventListener('click', openColorPicker);
        document.getElementById('closeColorPickerBtn').addEventListener('click', () => {
            DOM.colorPickerModal.style.display = 'none';
        });
        document.getElementById('clearColorBtn').addEventListener('click', () => {
            selectColor('#ffffff');
        });
        document.querySelectorAll('.color-option').forEach(el => {
            el.addEventListener('click', () => {
                selectColor(el.dataset.color);
            });
        });
        
        // Editor Modes
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.editorMode = btn.dataset.mode;
                if (state.currentNoteId) {
                    // Save current content before switching
                    saveCurrentNote();
                    setTimeout(() => selectNote(state.currentNoteId), 100);
                }
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Markdown Preview Toggle
        // (handled in render)
        
        // Export
        document.getElementById('exportNoteBtn').addEventListener('click', openExportModal);
        document.getElementById('cancelExportBtn').addEventListener('click', () => {
            DOM.exportModal.style.display = 'none';
        });
        document.getElementById('confirmExportBtn').addEventListener('click', () => {
            const format = document.getElementById('exportFormat').value;
            exportNote(format);
            DOM.exportModal.style.display = 'none';
        });
        
        // Templates
        document.getElementById('addTagBtn').addEventListener('click', () => {
            const tag = prompt('Enter tag name:');
            if (tag && tag.trim()) {
                const note = getNote(state.currentNoteId);
                if (note) {
                    if (!note.tags) note.tags = [];
                    if (!note.tags.includes(tag.trim())) {
                        note.tags.push(tag.trim());
                        if (!state.tags.includes(tag.trim())) {
                            state.tags.push(tag.trim());
                        }
                        saveData();
                        renderAll();
                        selectNote(note.id);
                        showToast(`Tag "${tag.trim()}" added`, 'success');
                    } else {
                        showToast('Tag already exists', 'warning');
                    }
                }
            }
        });
        
        document.getElementById('addFolderBtn').addEventListener('click', () => {
            const folder = prompt('Enter folder name:');
            if (folder && folder.trim()) {
                const note = getNote(state.currentNoteId);
                if (note) {
                    if (!state.folders.includes(folder.trim())) {
                        state.folders.push(folder.trim());
                    }
                    note.folder = folder.trim();
                    saveData();
                    renderAll();
                    selectNote(note.id);
                    showToast(`Moved to "${folder.trim()}"`, 'success');
                }
            }
        });
        
        document.getElementById('templateModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                DOM.templateModal.style.display = 'none';
            }
        });
        document.getElementById('closeTemplateBtn').addEventListener('click', () => {
            DOM.templateModal.style.display = 'none';
        });
        document.querySelectorAll('.template-card').forEach(el => {
            el.addEventListener('click', () => {
                const template = el.dataset.template;
                applyTemplate(template);
                DOM.templateModal.style.display = 'none';
            });
        });
        
        // Note Options
        document.getElementById('noteOptionsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = e.target.getBoundingClientRect();
            const dropdown = DOM.noteOptionsDropdown;
            dropdown.style.top = rect.bottom + 8 + 'px';
            dropdown.style.right = (window.innerWidth - rect.right) + 'px';
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#noteOptionsBtn') && !e.target.closest('#noteOptionsDropdown')) {
                DOM.noteOptionsDropdown.style.display = 'none';
            }
        });
        
        document.getElementById('duplicateNoteBtn').addEventListener('click', () => {
            if (state.currentNoteId) {
                duplicateNote(state.currentNoteId);
                DOM.noteOptionsDropdown.style.display = 'none';
            }
        });
        
        document.getElementById('renameNoteBtn').addEventListener('click', () => {
            const note = getNote(state.currentNoteId);
            if (!note) return;
            const newTitle = prompt('Rename note:', note.title);
            if (newTitle && newTitle.trim()) {
                note.title = newTitle.trim();
                saveData();
                renderAll();
                selectNote(note.id);
                showToast('Note renamed', 'success');
            }
            DOM.noteOptionsDropdown.style.display = 'none';
        });
        
        document.getElementById('versionHistoryBtn').addEventListener('click', () => {
            showVersionHistory();
            DOM.noteOptionsDropdown.style.display = 'none';
        });
        
        document.getElementById('lockNoteBtn').addEventListener('click', () => {
            toggleLock();
            DOM.noteOptionsDropdown.style.display = 'none';
        });
        
        document.getElementById('permanentDeleteBtn').addEventListener('click', () => {
            if (state.currentNoteId) {
                if (confirm('Permanently delete this note? This cannot be undone.')) {
                    deleteNote(state.currentNoteId, true);
                }
            }
            DOM.noteOptionsDropdown.style.display = 'none';
        });
        
        // Delete Note
        document.getElementById('deleteNoteBtn').addEventListener('click', deleteCurrentNote);
        
        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Command Palette
        document.getElementById('commandPaletteBtn').addEventListener('click', toggleCommandPalette);
        DOM.commandPalette.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                toggleCommandPalette();
            }
        });
        DOM.commandInput.addEventListener('input', (e) => {
            updateCommands(e.target.value);
        });
        
        // Keyboard shortcuts
        setupKeyboardShortcuts();
        
        // Sidebar toggle for mobile
        document.getElementById('toggleSidebarBtn').addEventListener('click', () => {
            DOM.sidebar.classList.toggle('open');
        });
        
        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !e.target.closest('.notepad-sidebar') && 
                !e.target.closest('#toggleSidebarBtn')) {
                DOM.sidebar.classList.remove('open');
            }
        });
    }

    // ============================================================
    // VERSION HISTORY VIEWER
    // ============================================================
    function showVersionHistory() {
        const note = getNote(state.currentNoteId);
        if (!note || !note.versions || note.versions.length === 0) {
            showToast('No version history available', 'info');
            return;
        }
        
        let html = `
            <div class="modal-overlay" style="display:flex;" id="versionHistoryModal">
                <div class="modal-card" style="max-width: 500px;">
                    <h3><i class="fas fa-history"></i> Version History</h3>
                    <div style="max-height: 400px; overflow-y: auto;">
        `;
        
        note.versions.slice().reverse().forEach((version, index) => {
            const realIndex = note.versions.length - 1 - index;
            html += `
                <div style="padding:12px; border-bottom:1px solid var(--border-color); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" 
                     onclick="window.restoreVersionFromNotepad('${note.id}', ${realIndex})">
                    <span>${formatDate(version.timestamp)}</span>
                    <span style="font-size:0.7rem; color:var(--text-muted);">v${realIndex + 1}</span>
                </div>
            `;
        });
        
        html += `
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;">
                        <button class="secondary-btn" onclick="document.getElementById('versionHistoryModal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existing = document.getElementById('versionHistoryModal');
        if (existing) existing.remove();
        
        document.body.insertAdjacentHTML('beforeend', html);
    }

    window.restoreVersionFromNotepad = function(id, index) {
        restoreVersion(id, index);
        const modal = document.getElementById('versionHistoryModal');
        if (modal) modal.remove();
    };

    // ============================================================
    // LOCK FUNCTIONALITY
    // ============================================================
    function toggleLock() {
        const note = getNote(state.currentNoteId);
        if (!note) return;
        note.locked = !note.locked;
        saveData();
        renderAll();
        selectNote(note.id);
        showToast(note.locked ? 'Note locked' : 'Note unlocked', 'info');
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        // Set theme
        if (state.isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('toggleThemeBtn').innerHTML = '<i class="fas fa-sun"></i>';
        }
        
        cacheDomRefs();
        loadData();
        renderAll();
        bindEvents();
        
        // Select first note if available
        if (state.currentNoteId) {
            selectNote(state.currentNoteId);
        } else {
            const notes = getVisibleNotes();
            if (notes.length > 0) {
                selectNote(notes[0].id);
            } else {
                showEmptyState();
            }
        }
        
        // Auto-save interval
        setInterval(() => {
            if (state.currentNoteId && !isSaving) {
                saveCurrentNote();
            }
        }, 30000);
        
        console.log('📝 Notepad Pro initialized');
        console.log(`📊 ${state.notes.length} notes loaded`);
    }

    // Make functions globally accessible
    window.createNewNote = createNewNote;
    window.restoreVersionFromNotepad = restoreVersion;

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();