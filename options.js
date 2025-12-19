let currentLanguage = 'ru';

let migrateAISettings;
if (typeof window !== 'undefined' && window.utils && window.utils.migrateAISettings) {
  migrateAISettings = window.utils.migrateAISettings;
} else {
  migrateAISettings = function(aiSettings) {
    if (!aiSettings || typeof aiSettings !== 'object') return aiSettings;
    if (aiSettings.apiKey && !aiSettings.deepseekApiKey && !aiSettings.chatgptApiKey) {
      if (aiSettings.model === "deepseek") {
        aiSettings.deepseekApiKey = aiSettings.apiKey;
      } else {
        aiSettings.chatgptApiKey = aiSettings.apiKey;
      }
    }
    if (aiSettings.temperature && !aiSettings.deepseekTemperature && !aiSettings.chatgptTemperature) {
      aiSettings.deepseekTemperature = aiSettings.temperature;
      aiSettings.chatgptTemperature = aiSettings.temperature;
    }
    return aiSettings;
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  await i18n.init();
  currentLanguage = i18n.getCurrentLang();
  updateLanguage();
  initTabs();
  loadSettings();
  loadAboutInfo();
  setupEventListeners();
  initTemplates();
  
  // Применяем настройки доступности сразу после загрузки
  chrome.storage.sync.get(["accessibilitySettings"], (result) => {
    const settings = result.accessibilitySettings || {
      epilepsyMode: false
    };
    applyEpilepsyMode(settings.epilepsyMode);
  });
});

function updateLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.hasAttribute('data-i18n-html')) {
      el.innerHTML = i18n.t(key);
    } else {
      el.textContent = i18n.t(key);
    }
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = i18n.t(key);
  });
  
  document.querySelectorAll('option[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = i18n.t(key);
  });
}

function initTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.dataset.tab;

      navItems.forEach(nav => nav.classList.remove("active"));
      tabContents.forEach(content => content.classList.remove("active"));

      item.classList.add("active");
      document.getElementById(`${targetTab}-tab`).classList.add("active");
      
      if (targetTab === "templates") {
        loadTemplates();
      } else if (targetTab === "bookmarks") {
        loadBookmarksManagement();
      } else if (targetTab === "notes") {
        loadNotesManagement();
      }
    });
  });
}

function loadAboutInfo() {
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById("extension-version");
  const descriptionElement = document.getElementById("extension-description");
  
  if (versionElement && manifest) {
    versionElement.textContent = manifest.version || "2.0.0";
  }
  
  if (descriptionElement && manifest) {
    descriptionElement.textContent = manifest.description || i18n.t('settings.description');
  }
}

function loadSettings() {
  chrome.storage.sync.get(["translateSettings", "language"], (result) => {
    const settings = result.translateSettings || {
      defaultTo: "ru",
      russianTo: "en"
    };
    
    if (result.language) {
      currentLanguage = result.language;
      i18n.setLanguage(result.language);
      document.getElementById("language-selector").value = result.language;
      updateLanguage();
    }

    document.getElementById("default-to-lang").value = settings.defaultTo || "ru";
    document.getElementById("russian-to-lang").value = settings.russianTo || "en";
  });

  chrome.storage.sync.get(["aiSettings"], (result) => {
    const settings = result.aiSettings || {
      model: "deepseek",
      deepseekApiKey: "",
      chatgptApiKey: "",
      deepseekTemperature: 0.7,
      chatgptTemperature: 0.7,
      systemPrompt: "",
      developerMode: false
    };

    migrateAISettings(settings);

    document.getElementById("ai-model").value = settings.model || "deepseek";
    document.getElementById("deepseek-api-key").value = settings.deepseekApiKey || "";
    document.getElementById("chatgpt-api-key").value = settings.chatgptApiKey || "";
    document.getElementById("deepseek-temperature").value = settings.deepseekTemperature || 0.7;
    document.getElementById("chatgpt-temperature").value = settings.chatgptTemperature || 0.7;
    document.getElementById("system-prompt").value = settings.systemPrompt || "";
    document.getElementById("developer-mode").checked = settings.developerMode || false;

    if (settings.chatgptModel) {
      document.getElementById("chatgpt-model").value = settings.chatgptModel;
    }
  });

  chrome.storage.sync.get(["accessibilitySettings"], (result) => {
    const settings = result.accessibilitySettings || {
      epilepsyMode: false
    };
    
    const epilepsyModeCheckbox = document.getElementById("epilepsy-mode");
    if (epilepsyModeCheckbox) {
      epilepsyModeCheckbox.checked = settings.epilepsyMode || false;
      applyEpilepsyMode(settings.epilepsyMode);
    }
  });
}

function setupEventListeners() {
  const exportAllBookmarksBtn = document.getElementById('export-all-bookmarks');
  const importBookmarksBtn = document.getElementById('import-bookmarks');
  const clearAllBookmarksBtn = document.getElementById('clear-all-bookmarks');
  const bookmarksSearchInput = document.getElementById('bookmarks-search');
  
  if (exportAllBookmarksBtn) {
    exportAllBookmarksBtn.addEventListener('click', exportAllBookmarks);
  }
  if (importBookmarksBtn) {
    importBookmarksBtn.addEventListener('click', importBookmarks);
  }
  if (clearAllBookmarksBtn) {
    clearAllBookmarksBtn.addEventListener('click', clearAllBookmarks);
  }
  if (bookmarksSearchInput) {
    bookmarksSearchInput.addEventListener('input', () => {
      loadBookmarksManagement(bookmarksSearchInput.value);
    });
  }

  const clearAllNotesBtn = document.getElementById('clear-all-notes');
  const notesSearchInput = document.getElementById('notes-search');
  
  if (clearAllNotesBtn) {
    clearAllNotesBtn.addEventListener('click', clearAllNotes);
  }
  if (notesSearchInput) {
    notesSearchInput.addEventListener('input', () => {
      loadNotesManagement(notesSearchInput.value);
    });
  }

  const saveTranslateBtn = document.getElementById("save-translate");
  if (saveTranslateBtn) {
    saveTranslateBtn.addEventListener("click", saveTranslateSettings);
  }

  const saveAIBtn = document.getElementById("save-ai");
  if (saveAIBtn) {
    saveAIBtn.addEventListener("click", saveAISettings);
  }

  const saveAccessibilityBtn = document.getElementById("save-accessibility");
  if (saveAccessibilityBtn) {
    saveAccessibilityBtn.addEventListener("click", saveAccessibilitySettings);
  }

  const addTemplateBtn = document.getElementById("add-template-btn");
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener("click", () => {
      showTemplateForm(null);
    });
  }

  const saveTemplateBtn = document.getElementById("save-template");
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener("click", saveTemplate);
  }

  const cancelTemplateBtn = document.getElementById("cancel-template");
  if (cancelTemplateBtn) {
    cancelTemplateBtn.addEventListener("click", hideTemplateForm);
  }
  
  const languageSelector = document.getElementById("language-selector");
  if (languageSelector) {
    languageSelector.addEventListener("change", (e) => {
      const lang = e.target.value;
      i18n.setLanguage(lang);
      currentLanguage = lang;
      updateLanguage();
      loadTemplates();
    });
  }
}

function saveTranslateSettings() {
  const settings = {
    defaultTo: document.getElementById("default-to-lang").value,
    russianTo: document.getElementById("russian-to-lang").value
  };

  chrome.storage.sync.set({ translateSettings: settings }, () => {
    showStatus(i18n.t('settings.saved'), false);
  });
}

function saveAISettings() {
  const model = document.getElementById("ai-model").value;
  const deepseekApiKey = document.getElementById("deepseek-api-key").value.trim();
  const chatgptApiKey = document.getElementById("chatgpt-api-key").value.trim();
  const deepseekTemperature = parseFloat(document.getElementById("deepseek-temperature").value);
  const chatgptTemperature = parseFloat(document.getElementById("chatgpt-temperature").value);
  const systemPrompt = document.getElementById("system-prompt").value.trim();
  const developerMode = document.getElementById("developer-mode").checked;

  if (isNaN(deepseekTemperature) || deepseekTemperature < 0 || deepseekTemperature > 2) {
    showStatus(i18n.t('settings.temperature') + " (DeepSeek) " + i18n.t('settings.error'), true);
    return;
  }

  if (isNaN(chatgptTemperature) || chatgptTemperature < 0 || chatgptTemperature > 2) {
    showStatus(i18n.t('settings.temperature') + " (ChatGPT) " + i18n.t('settings.error'), true);
    return;
  }

  const settings = {
    model: model,
    deepseekApiKey: deepseekApiKey,
    chatgptApiKey: chatgptApiKey,
    deepseekTemperature: deepseekTemperature,
    chatgptTemperature: chatgptTemperature,
    systemPrompt: systemPrompt,
    developerMode: developerMode
  };

  if (model === "chatgpt") {
    settings.chatgptModel = document.getElementById("chatgpt-model").value;
  }

  chrome.storage.sync.set({ aiSettings: settings }, () => {
    showStatus(i18n.t('settings.saved'), false);
  });
}

function showStatus(message, isError) {
  const statusDiv = document.getElementById("save-status");
  statusDiv.textContent = message;
  statusDiv.className = isError ? "error" : "";

  setTimeout(() => {
    statusDiv.textContent = "";
  }, 3000);
}

function saveAccessibilitySettings() {
  const epilepsyMode = document.getElementById("epilepsy-mode").checked;

  const settings = {
    epilepsyMode: epilepsyMode
  };

  chrome.storage.sync.set({ accessibilitySettings: settings }, () => {
    applyEpilepsyMode(epilepsyMode);
    showStatus(i18n.t('settings.saved'), false);
  });
}

function applyEpilepsyMode(enabled) {
  if (enabled) {
    document.documentElement.classList.add('epilepsy-mode');
    document.body.classList.add('epilepsy-mode');
  } else {
    document.documentElement.classList.remove('epilepsy-mode');
    document.body.classList.remove('epilepsy-mode');
  }
}

let editingTemplateId = null;

async function initTemplates() {
  await loadTemplates();
}

async function loadTemplates() {
  const templates = await PromptTemplates.loadTemplates();
  const templatesList = document.getElementById("templates-list");
  
  if (templates.length === 0) {
    templatesList.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${i18n.t('settings.templateEmpty')}</p>`;
    return;
  }

  const validTemplates = templates.filter(template => 
    template && 
    template.id && 
    template.name && 
    template.prompt
  );

  if (validTemplates.length === 0) {
    templatesList.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${i18n.t('settings.templateEmpty')}</p>`;
    return;
  }

  templatesList.innerHTML = validTemplates.map(template => `
    <div class="template-item" data-template-id="${template.id}">
      <div class="template-header">
        <h4>${escapeHtml(template.name || i18n.t('settings.templateNew'))}</h4>
        <div class="template-actions">
          <button class="edit-template-btn" data-id="${template.id}" title="${i18n.t('settings.edit') || 'Редактировать'}">✏️</button>
          ${template.id && template.id.startsWith('custom-') ? `<button class="delete-template-btn" data-id="${template.id}" title="${i18n.t('settings.delete') || 'Удалить'}">🗑️</button>` : ''}
        </div>
      </div>
      <p class="template-description">${escapeHtml(template.description || '')}</p>
      ${template.shortName ? `<p class="template-short-name"><strong>${i18n.t('settings.templateShortName')}:</strong> ${escapeHtml(template.shortName)}</p>` : ''}
      <div class="template-preview">
        <code>${escapeHtml(template.prompt || '')}</code>
      </div>
    </div>
    `).join('');

  templatesList.querySelectorAll('.edit-template-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const templateId = e.target.dataset.id;
      editTemplate(templateId);
    });
  });

  templatesList.querySelectorAll('.delete-template-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateId = e.target.dataset.id;
      if (confirm(i18n.t('settings.templateDeleteConfirm'))) {
        await PromptTemplates.deleteTemplate(templateId);
        await loadTemplates();
        showStatus(i18n.t('settings.templateDeleted'), false);
      }
    });
  });
}

function showTemplateForm(templateId = null) {
  if (!templateId) {
    editingTemplateId = null;
  } else {
    editingTemplateId = templateId;
  }
  
  const form = document.getElementById("template-form");
  const title = document.getElementById("template-form-title");
  const nameInput = document.getElementById("template-name");
  const promptInput = document.getElementById("template-prompt");
  const descInput = document.getElementById("template-description");
  const shortNameInput = document.getElementById("template-short-name");

  if (!form || !title || !nameInput || !promptInput || !descInput || !shortNameInput) {
    console.error('Не найдены элементы формы шаблона');
    return;
  }

  if (templateId != null) {
    title.textContent = i18n.t('settings.templateEdit');
    PromptTemplates.getTemplate(templateId).then(template => {
      if (!template) {
        showStatus(i18n.t('settings.templateNotFound') || "Шаблон не найден", true);
        hideTemplateForm();
        return;
      }
      nameInput.value = template.name || '';
      promptInput.value = template.prompt || '';
      descInput.value = template.description || '';
      shortNameInput.value = template.shortName || '';
    }).catch(error => {
      console.error('Ошибка загрузки шаблона:', error);
      showStatus(i18n.t('settings.templateLoadError') || "Ошибка загрузки шаблона", true);
      hideTemplateForm();
    });
  } else {
    editingTemplateId = null;
    title.textContent = i18n.t('settings.templateNew');
    nameInput.value = '';
    promptInput.value = '';
    descInput.value = '';
    shortNameInput.value = '';
  }

  form.style.display = "block";
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideTemplateForm() {
  document.getElementById("template-form").style.display = "none";
  editingTemplateId = null;
}

async function saveTemplate() {
  const name = document.getElementById("template-name").value.trim();
  const prompt = document.getElementById("template-prompt").value.trim();
  const description = document.getElementById("template-description").value.trim();
  const shortName = document.getElementById("template-short-name").value.trim();

  if (!name || !prompt) {
    showStatus(i18n.t('settings.templateFillRequired'), true);
    return;
  }

  if (shortName && shortName.length > 15) {
    showStatus(i18n.t('settings.templateShortNameTooLong'), true);
    return;
  }

  try {
    const isEditing = editingTemplateId && editingTemplateId !== null && editingTemplateId !== undefined;
    
    if (isEditing) {
      await PromptTemplates.updateTemplate(editingTemplateId, {
        name,
        prompt,
        description,
        shortName: shortName || undefined
      });
      showStatus(i18n.t('settings.templateUpdated'), false);
    } else {
      await PromptTemplates.addTemplate({
        name,
        prompt,
        description,
        shortName: shortName || undefined
      });
      showStatus(i18n.t('settings.templateAdded'), false);
    }

    hideTemplateForm();
    await loadTemplates();
  } catch (error) {
    console.error('Ошибка при сохранении шаблона:', error);
    showStatus(i18n.t('settings.templateSaveError') || "Ошибка при сохранении шаблона: " + error.message, true);
  }
}

async function editTemplate(templateId) {
  showTemplateForm(templateId);
}

// Используем функцию из utils.js
let escapeHtml;
if (typeof window !== 'undefined' && window.utils && window.utils.escapeHtml) {
  escapeHtml = window.utils.escapeHtml;
} else {
  escapeHtml = function(text) {
    if (text == null) return '';
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  };
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

async function loadBookmarksManagement(searchQuery = '') {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      let bookmarks = result.bookmarks || [];
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        bookmarks = bookmarks.filter(bookmark => {
          const titleMatch = bookmark.title.toLowerCase().includes(query);
          const descMatch = (bookmark.description || '').toLowerCase().includes(query);
          const tagsMatch = (bookmark.tags || []).some(tag => tag.toLowerCase().includes(query));
          const urlMatch = bookmark.url.toLowerCase().includes(query);
          return titleMatch || descMatch || tagsMatch || urlMatch;
        });
      }
      
      bookmarks.sort((a, b) => b.createdAt - a.createdAt);
      
      renderBookmarksManagement(bookmarks);
      resolve();
    });
  });
}

function renderBookmarksManagement(bookmarks) {
  const list = document.getElementById('bookmarks-management-list');
  if (!list) return;
  
  if (bookmarks.length === 0) {
    list.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${i18n.t('popup.noBookmarks')}</p>`;
    return;
  }
  
  list.innerHTML = bookmarks.map(bookmark => {
    const tagsHtml = (bookmark.tags || []).map(tag => 
      `<span class="bookmark-tag">${escapeHtml(tag)}</span>`
    ).join('');
    
    const date = new Date(bookmark.createdAt).toLocaleString('ru-RU');
    
    return `
      <div class="management-item" data-bookmark-id="${bookmark.id}">
        <div class="management-item-header">
          <div class="management-item-title">
            <a href="${escapeHtml(bookmark.url)}" target="_blank" class="bookmark-link">${escapeHtml(bookmark.title)}</a>
            <span class="management-item-date">${date}</span>
          </div>
          <div class="management-item-actions">
            <button class="edit-item-btn" data-id="${bookmark.id}" title="Редактировать">✏️</button>
            <button class="delete-item-btn" data-id="${bookmark.id}" title="Удалить">🗑️</button>
          </div>
        </div>
        ${bookmark.description ? `<div class="management-item-description">${escapeHtml(bookmark.description)}</div>` : ''}
        ${tagsHtml ? `<div class="management-item-tags">${tagsHtml}</div>` : ''}
        <div class="management-item-url">${escapeHtml(bookmark.url)}</div>
      </div>
    `;
  }).join('');
  
  // Обработчики событий
  list.querySelectorAll('.edit-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const bookmarkId = e.target.dataset.id;
      await editBookmark(bookmarkId);
    });
  });
  
  list.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const bookmarkId = e.target.dataset.id;
      if (confirm('Удалить закладку?')) {
        await deleteBookmark(bookmarkId);
        await loadBookmarksManagement(document.getElementById('bookmarks-search')?.value || '');
      }
    });
  });
}

async function editBookmark(bookmarkId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      const bookmarks = result.bookmarks || [];
      const bookmark = bookmarks.find(b => b.id === bookmarkId);
      
      if (!bookmark) {
        alert('Закладка не найдена');
        resolve();
        return;
      }
      
      const title = prompt('Название:', bookmark.title || '');
      if (!title) {
        resolve();
        return;
      }
      
      const tagsInput = prompt('Теги (через запятую):', (bookmark.tags || []).join(', '));
      const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
      
      const description = prompt('Описание:', bookmark.description || '');
      
      bookmark.title = title.trim();
      bookmark.tags = tags;
      bookmark.description = description ? description.trim() : '';
      bookmark.updatedAt = Date.now();
      
      chrome.storage.local.set({ bookmarks: bookmarks }, async () => {
        await loadBookmarksManagement(document.getElementById('bookmarks-search')?.value || '');
        showStatus('Закладка обновлена', false);
        resolve();
      });
    });
  });
}

async function deleteBookmark(bookmarkId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      const bookmarks = (result.bookmarks || []).filter(b => b.id !== bookmarkId);
      chrome.storage.local.set({ bookmarks: bookmarks }, () => {
        showStatus('Закладка удалена', false);
        resolve();
      });
    });
  });
}

async function exportAllBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      const bookmarks = result.bookmarks || [];
      const dataStr = JSON.stringify(bookmarks, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showStatus('Закладки экспортированы', false);
      resolve();
    });
  });
}

async function importBookmarks() {
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
      
      chrome.storage.local.get(['bookmarks'], (result) => {
        const existingBookmarks = result.bookmarks || [];
        const mergedBookmarks = [...existingBookmarks];
        
        importedBookmarks.forEach(imported => {
          const exists = mergedBookmarks.find(b => b.id === imported.id || normalizeUrl(b.url) === normalizeUrl(imported.url));
          if (!exists) {
            mergedBookmarks.push({
              ...imported,
              id: imported.id || 'bookmark-' + Date.now() + '-' + Math.random()
            });
          }
        });
        
        chrome.storage.local.set({ bookmarks: mergedBookmarks }, async () => {
          await loadBookmarksManagement();
          showStatus('Закладки импортированы', false);
        });
      });
    } catch (error) {
      showStatus('Ошибка импорта: ' + error.message, true);
    }
  };
  input.click();
}

async function clearAllBookmarks() {
  if (!confirm('Вы уверены, что хотите удалить все закладки? Это действие нельзя отменить.')) {
    return;
  }
  
  chrome.storage.local.set({ bookmarks: [] }, async () => {
    await loadBookmarksManagement();
    showStatus('Все закладки удалены', false);
  });
}

async function loadNotesManagement(searchQuery = '') {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pageNotes'], (result) => {
      const allNotes = result.pageNotes || {};
      let notesList = [];
      
      Object.keys(allNotes).forEach(url => {
        allNotes[url].forEach(note => {
          notesList.push({
            ...note,
            url: url
          });
        });
      });
      
      // Фильтрация по поисковому запросу
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        notesList = notesList.filter(note => {
          const textMatch = note.text.toLowerCase().includes(query);
          const urlMatch = note.url.toLowerCase().includes(query);
          return textMatch || urlMatch;
        });
      }
      
      notesList.sort((a, b) => b.createdAt - a.createdAt);
      
      renderNotesManagement(notesList);
      resolve();
    });
  });
}

function renderNotesManagement(notesList) {
  const list = document.getElementById('notes-management-list');
  if (!list) return;
  
  if (notesList.length === 0) {
    list.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${i18n.t('popup.noNotes')}</p>`;
    return;
  }
  
  list.innerHTML = notesList.map(note => {
    const date = new Date(note.createdAt).toLocaleString('ru-RU');
    const urlDisplay = note.url.length > 60 ? note.url.substring(0, 60) + '...' : note.url;
    
    return `
      <div class="management-item" data-note-id="${note.id}" data-note-url="${escapeHtml(note.url)}">
        <div class="management-item-header">
          <div class="management-item-title">
            <span class="note-preview">${escapeHtml(note.text.length > 100 ? note.text.substring(0, 100) + '...' : note.text)}</span>
            <span class="management-item-date">${date}</span>
          </div>
          <div class="management-item-actions">
            <button class="edit-item-btn" data-id="${note.id}" data-url="${escapeHtml(note.url)}" title="Редактировать">✏️</button>
            <button class="delete-item-btn" data-id="${note.id}" data-url="${escapeHtml(note.url)}" title="Удалить">🗑️</button>
          </div>
        </div>
        <div class="management-item-url">${escapeHtml(urlDisplay)}</div>
      </div>
    `;
  }).join('');
  
  // Обработчики событий
  list.querySelectorAll('.edit-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const noteId = e.target.dataset.id;
      const url = e.target.dataset.url;
      await editNote(noteId, url);
    });
  });
  
  list.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const noteId = e.target.dataset.id;
      const url = e.target.dataset.url;
      if (confirm('Удалить заметку?')) {
        await deleteNote(noteId, url);
        await loadNotesManagement(document.getElementById('notes-search')?.value || '');
      }
    });
  });
}

async function editNote(noteId, url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pageNotes'], (result) => {
      const allNotes = result.pageNotes || {};
      const notes = allNotes[url] || [];
      const note = notes.find(n => n.id === noteId);
      
      if (!note) {
        alert('Заметка не найдена');
        resolve();
        return;
      }
      
      const text = prompt('Текст заметки:', note.text || '');
      if (!text || text.trim() === note.text) {
        resolve();
        return;
      }
      
      note.text = text.trim();
      note.updatedAt = Date.now();
      
      chrome.storage.local.set({ pageNotes: allNotes }, async () => {
        await loadNotesManagement(document.getElementById('notes-search')?.value || '');
        showStatus('Заметка обновлена', false);
        resolve();
      });
    });
  });
}

async function deleteNote(noteId, url) {
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
        showStatus('Заметка удалена', false);
        resolve();
      });
    });
  });
}

async function clearAllNotes() {
  if (!confirm('Вы уверены, что хотите удалить все заметки? Это действие нельзя отменить.')) {
    return;
  }
  
  chrome.storage.local.set({ pageNotes: {} }, async () => {
    await loadNotesManagement();
    showStatus('Все заметки удалены', false);
  });
}

