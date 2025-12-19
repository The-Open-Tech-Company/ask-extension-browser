// Управление закладками с тегами
const BookmarksManager = {
  searchQuery: '',
  showAllBookmarks: false,

  async init() {
    try {
      if (typeof i18n === 'undefined' || !i18n.init) {
        console.warn('i18n не загружен, пропускаем инициализацию закладок');
        return;
      }
      await i18n.init();
      this.setupEventListeners();
      await this.loadBookmarks();
    } catch (error) {
      console.error('Ошибка инициализации BookmarksManager:', error);
    }
  },

  setupEventListeners() {
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');
    const bookmarkSearchBtn = document.getElementById('bookmarkSearchBtn');
    const bookmarkSearchInput = document.getElementById('bookmarkSearchInput');
    const exportBookmarksBtn = document.getElementById('exportBookmarksBtn');
    const importBookmarksBtn = document.getElementById('importBookmarksBtn');

    if (addBookmarkBtn) {
      addBookmarkBtn.addEventListener('click', () => this.showAddBookmarkDialog());
    }

    if (bookmarkSearchBtn) {
      bookmarkSearchBtn.addEventListener('click', () => this.toggleSearch());
    }

    if (bookmarkSearchInput) {
      bookmarkSearchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.loadBookmarks();
      });
    }

    if (exportBookmarksBtn) {
      exportBookmarksBtn.addEventListener('click', () => this.exportBookmarks());
    }

    if (importBookmarksBtn) {
      importBookmarksBtn.addEventListener('click', () => this.importBookmarks());
    }
  },

  toggleSearch() {
    const searchInput = document.getElementById('bookmarkSearchInput');
    if (searchInput) {
      const isVisible = searchInput.style.display !== 'none';
      searchInput.style.display = isVisible ? 'none' : 'block';
      if (isVisible) {
        this.searchQuery = '';
        this.showAllBookmarks = false;
        this.loadBookmarks();
      } else if (!isVisible) {
        searchInput.focus();
      } else {
        searchInput.value = '';
        this.searchQuery = '';
        this.showAllBookmarks = false;
        this.loadBookmarks();
      }
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

  async getAllBookmarks() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['bookmarks'], (result) => {
        resolve(result.bookmarks || []);
      });
    });
  },

  async saveBookmark(bookmark) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['bookmarks'], (result) => {
        const bookmarks = result.bookmarks || [];
        
        const index = bookmarks.findIndex(b => b.id === bookmark.id);
        if (index !== -1) {
          bookmarks[index] = bookmark;
        } else {
          bookmarks.push(bookmark);
        }

        chrome.storage.local.set({ bookmarks: bookmarks }, () => {
          resolve();
        });
      });
    });
  },

  async deleteBookmark(bookmarkId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['bookmarks'], (result) => {
        const bookmarks = (result.bookmarks || []).filter(b => b.id !== bookmarkId);
        chrome.storage.local.set({ bookmarks: bookmarks }, () => {
          resolve();
        });
      });
    });
  },

  async loadBookmarks() {
    try {
      const bookmarks = await this.getAllBookmarks();
      let filteredBookmarks = bookmarks;

      // Фильтрация по поисковому запросу
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filteredBookmarks = bookmarks.filter(bookmark => {
          const titleMatch = bookmark.title.toLowerCase().includes(query);
          const descMatch = (bookmark.description || '').toLowerCase().includes(query);
          const tagsMatch = (bookmark.tags || []).some(tag => tag.toLowerCase().includes(query));
          const urlMatch = bookmark.url.toLowerCase().includes(query);
          return titleMatch || descMatch || tagsMatch || urlMatch;
        });
        // При поиске показываем все результаты
        this.showAllBookmarks = true;
      } else {
        // При обычной загрузке сбрасываем флаг показа всех
        this.showAllBookmarks = false;
      }

      // Сортировка по дате создания (новые первые)
      filteredBookmarks.sort((a, b) => b.createdAt - a.createdAt);

      this.renderBookmarks(filteredBookmarks);
    } catch (error) {}
  },

  renderBookmarks(bookmarks) {
    const bookmarksList = document.getElementById('bookmarksList');
    if (!bookmarksList) return;

    if (bookmarks.length === 0) {
      bookmarksList.innerHTML = `<div class="empty-state">${i18n.t('popup.noBookmarks')}</div>`;
      // Удаляем кнопку "Показать всё", если она есть
      const showAllBtn = document.getElementById('showAllBookmarksBtn');
      if (showAllBtn) {
        showAllBtn.remove();
      }
      return;
    }

    // Определяем, сколько закладок показывать
    const maxVisible = 3;
    const shouldShowAll = this.showAllBookmarks || bookmarks.length <= maxVisible;
    const visibleBookmarks = shouldShowAll ? bookmarks : bookmarks.slice(0, maxVisible);
    const hasMore = bookmarks.length > maxVisible;

    bookmarksList.innerHTML = visibleBookmarks.map(bookmark => {
      const tagsHtml = (bookmark.tags || []).map(tag => 
        `<span class="bookmark-tag">${this.escapeHtml(tag)}</span>`
      ).join('');

      return `
        <div class="bookmark-item" data-bookmark-id="${bookmark.id}">
          <div class="bookmark-header">
            <a href="${this.escapeHtml(bookmark.url)}" target="_blank" class="bookmark-title">${this.escapeHtml(bookmark.title)}</a>
          <div class="bookmark-actions">
            <button class="bookmark-edit-btn" data-bookmark-id="${bookmark.id}" title="${i18n.t('popup.editNote')}">${i18n.t('popup.editNote')}</button>
            <button class="bookmark-delete-btn" data-bookmark-id="${bookmark.id}" title="${i18n.t('popup.deleteNote')}">${i18n.t('popup.deleteNote')}</button>
          </div>
          </div>
          ${bookmark.description ? `<div class="bookmark-description">${this.escapeHtml(bookmark.description)}</div>` : ''}
          ${tagsHtml ? `<div class="bookmark-tags">${tagsHtml}</div>` : ''}
          <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
        </div>
      `;
    }).join('');

    // Удаляем старую кнопку, если она есть
    const oldShowAllBtn = document.getElementById('showAllBookmarksBtn');
    if (oldShowAllBtn) {
      oldShowAllBtn.remove();
    }

    // Добавляем кнопку "Показать всё" или "Скрыть", если есть больше 3 закладок
    if (hasMore) {
      const showAllBtn = document.createElement('button');
      showAllBtn.id = 'showAllBookmarksBtn';
      showAllBtn.className = 'show-all-bookmarks-btn';
      showAllBtn.textContent = this.showAllBookmarks 
        ? i18n.t('popup.hideBookmarks') 
        : `${i18n.t('popup.showAllBookmarks')} (${bookmarks.length - maxVisible})`;
      showAllBtn.addEventListener('click', () => {
        this.showAllBookmarks = !this.showAllBookmarks;
        this.renderBookmarks(bookmarks);
      });
      // Добавляем кнопку после списка закладок, но внутри секции закладок
      const bookmarksSection = bookmarksList.closest('.bookmarks-section');
      if (bookmarksSection) {
        bookmarksSection.appendChild(showAllBtn);
      } else {
        bookmarksList.parentElement.appendChild(showAllBtn);
      }
    }

    // Обработчики событий
    bookmarksList.querySelectorAll('.bookmark-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const bookmarkId = e.target.dataset.bookmarkId;
        const bookmarks = await this.getAllBookmarks();
        const bookmark = bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
          this.showEditBookmarkDialog(bookmark);
        }
      });
    });

    bookmarksList.querySelectorAll('.bookmark-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const bookmarkId = e.target.dataset.bookmarkId;
        if (confirm('Удалить закладку?')) {
          await this.deleteBookmark(bookmarkId);
          await this.loadBookmarks();
        }
      });
    });
  },

  async showAddBookmarkDialog() {
    const tab = await this.getCurrentTab();
    if (!tab || !tab.url) return;

    const title = prompt(i18n.t('popup.bookmarkTitle') + ':', tab.title || '');
    if (!title) return;

    const tagsInput = prompt(i18n.t('popup.bookmarkTags') + ':', '');
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const description = prompt(i18n.t('popup.bookmarkDescription') + ':', '');

    const bookmark = {
      id: 'bookmark-' + Date.now(),
      url: tab.url,
      title: title.trim(),
      tags: tags,
      description: description ? description.trim() : '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.saveBookmark(bookmark);
    await this.loadBookmarks();
  },

  async showEditBookmarkDialog(bookmark) {
    const title = prompt(i18n.t('popup.bookmarkTitle') + ':', bookmark.title || '');
    if (!title) return;

    const tagsInput = prompt(i18n.t('popup.bookmarkTags') + ':', (bookmark.tags || []).join(', '));
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const description = prompt(i18n.t('popup.bookmarkDescription') + ':', bookmark.description || '');

    bookmark.title = title.trim();
    bookmark.tags = tags;
    bookmark.description = description ? description.trim() : '';
    bookmark.updatedAt = Date.now();

    await this.saveBookmark(bookmark);
    await this.loadBookmarks();
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  async exportBookmarks() {
    const bookmarks = await this.getAllBookmarks();
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  async importBookmarks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      try {
        const importedBookmarks = JSON.parse(text);
        if (!Array.isArray(importedBookmarks)) {
          throw new Error('Invalid format');
        }

        const existingBookmarks = await this.getAllBookmarks();
        const mergedBookmarks = [...existingBookmarks];

        importedBookmarks.forEach(imported => {
          const exists = mergedBookmarks.find(b => b.id === imported.id || b.url === imported.url);
          if (!exists) {
            mergedBookmarks.push({
              ...imported,
              id: imported.id || 'bookmark-' + Date.now() + '-' + Math.random()
            });
          }
        });

        chrome.storage.local.set({ bookmarks: mergedBookmarks }, async () => {
          await this.loadBookmarks();
          alert('Закладки импортированы');
        });
      } catch (error) {
        alert('Ошибка импорта: ' + error.message);
      }
    };
    input.click();
  }
};

// Инициализация будет вызвана из popup.js после загрузки DOM

// Экспортируем для использования в других скриптах
if (typeof window !== 'undefined') {
  window.BookmarksManager = BookmarksManager;
  window.NotesManager = NotesManager;
}
