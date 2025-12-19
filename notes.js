const NotesManager = {
  async init() {
    try {
      if (typeof i18n === 'undefined' || !i18n.init) {
        console.warn('i18n не загружен, пропускаем инициализацию заметок');
        return;
      }
      await i18n.init();
      this.setupEventListeners();
      await this.loadNotesForCurrentPage();
    } catch (error) {
      console.error('Ошибка инициализации NotesManager:', error);
    }
  },

  setupEventListeners() {
    const addNoteBtn = document.getElementById('addNoteBtn');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', () => this.showAddNoteDialog());
    }
  },

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
        return null;
      }
      return tab;
    } catch (error) {
      return null;
    }
  },

  async loadNotesForCurrentPage() {
    try {
      const tab = await this.getCurrentTab();
      if (!tab || !tab.url) {
        const notesSection = document.getElementById('notesSection');
        if (notesSection) {
          notesSection.style.display = 'block';
        }
        this.renderNotes([]);
        return;
      }

      const url = this.normalizeUrl(tab.url);
      const notes = await this.getNotesForUrl(url);
      
      this.renderNotes(notes);
      
      const notesSection = document.getElementById('notesSection');
      if (notesSection) {
        if (this.isPageAccessible(tab.url)) {
          notesSection.style.display = 'block';
        } else {
          notesSection.style.display = 'none';
        }
      }
    } catch (error) {
      const notesSection = document.getElementById('notesSection');
      if (notesSection) {
        notesSection.style.display = 'block';
      }
    }
  },

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  },

  isPageAccessible(url) {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const blockedSchemes = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'];
      return !blockedSchemes.some(scheme => urlObj.protocol.startsWith(scheme));
    } catch {
      return false;
    }
  },

  async getNotesForUrl(url) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['pageNotes'], (result) => {
        const allNotes = result.pageNotes || {};
        resolve(allNotes[url] || []);
      });
    });
  },

  async saveNote(url, noteId, text) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['pageNotes'], (result) => {
        const allNotes = result.pageNotes || {};
        if (!allNotes[url]) {
          allNotes[url] = [];
        }

        const note = {
          id: noteId,
          text: text,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const index = allNotes[url].findIndex(n => n.id === noteId);
        if (index !== -1) {
          allNotes[url][index] = { ...allNotes[url][index], text, updatedAt: Date.now() };
        } else {
          allNotes[url].push(note);
        }

        chrome.storage.local.set({ pageNotes: allNotes }, () => {
          resolve();
        });
      });
    });
  },

  async deleteNote(url, noteId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['pageNotes'], (result) => {
        const allNotes = result.pageNotes || {};
        if (allNotes[url]) {
          allNotes[url] = allNotes[url].filter(n => n.id !== noteId);
          if (allNotes[url].length === 0) {
            delete allNotes[url];
          }
        }
        chrome.storage.local.set({ pageNotes: allNotes }, () => {
          resolve();
        });
      });
    });
  },

  renderNotes(notes) {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;

    if (notes.length === 0) {
      notesList.innerHTML = `<div class="empty-state">${i18n.t('popup.noNotes')}</div>`;
      return;
    }

    notesList.innerHTML = notes.map(note => `
      <div class="note-item" data-note-id="${note.id}">
        <div class="note-text">${this.escapeHtml(note.text)}</div>
        <div class="note-actions">
          <button class="note-edit-btn" data-note-id="${note.id}" title="${i18n.t('popup.editNote')}">${i18n.t('popup.editNote')}</button>
          <button class="note-delete-btn" data-note-id="${note.id}" title="${i18n.t('popup.deleteNote')}">${i18n.t('popup.deleteNote')}</button>
        </div>
      </div>
    `).join('');

    // Обработчики событий
    notesList.querySelectorAll('.note-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = e.target.dataset.noteId;
        const note = notes.find(n => n.id === noteId);
        if (note) {
          this.showEditNoteDialog(noteId, note.text);
        }
      });
    });

    notesList.querySelectorAll('.note-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const noteId = e.target.dataset.noteId;
        if (confirm('Удалить заметку?')) {
          const tab = await this.getCurrentTab();
          const url = this.normalizeUrl(tab.url);
          await this.deleteNote(url, noteId);
          await this.loadNotesForCurrentPage();
        }
      });
    });
  },

  async showAddNoteDialog() {
    const text = prompt(i18n.t('popup.notePlaceholder'), '');
    if (text && text.trim()) {
      const tab = await this.getCurrentTab();
      const url = this.normalizeUrl(tab.url);
      const noteId = 'note-' + Date.now();
      await this.saveNote(url, noteId, text.trim());
      await this.loadNotesForCurrentPage();
    }
  },

  async showEditNoteDialog(noteId, currentText) {
    const text = prompt(i18n.t('popup.notePlaceholder'), currentText);
    if (text && text.trim() && text !== currentText) {
      const tab = await this.getCurrentTab();
      const url = this.normalizeUrl(tab.url);
      await this.saveNote(url, noteId, text.trim());
      await this.loadNotesForCurrentPage();
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Показ заметок на странице (вызывается из content.js)
  async showNotesOnPage() {
    const tab = await this.getCurrentTab();
    if (!tab || !tab.url || !this.isPageAccessible(tab.url)) return;

    const url = this.normalizeUrl(tab.url);
    const notes = await this.getNotesForUrl(url);
    
    if (notes.length > 0) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotes',
        notes: notes
      }).catch(() => {});
    }
  }
};
