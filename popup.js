let currentLang = 'ru';

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await i18n.init();
    currentLang = i18n.getCurrentLang();
    updateLanguage();
    
    // Загружаем состояние расширения только если есть соответствующие элементы
    const extensionToggle = document.getElementById("extension-toggle");
    if (extensionToggle) {
      loadExtensionState();
    }
    
    try {
      chrome.runtime.sendMessage({ action: "recreateContextMenus" }).catch(() => {});
    } catch (e) {}
    
    setupEventListeners();
    setupSearchListeners();
    
    // Инициализация заметок и закладок после загрузки всех скриптов
    setTimeout(() => {
      if (typeof NotesManager !== 'undefined' && NotesManager.init) {
        NotesManager.init().catch(err => {
          console.error('Ошибка инициализации заметок:', err);
          // Скрываем секцию заметок при ошибке на chrome:// страницах
          const notesSection = document.getElementById('notesSection');
          if (notesSection && err.message && err.message.includes('chrome://')) {
            notesSection.style.display = 'none';
          }
        });
      }
      if (typeof BookmarksManager !== 'undefined' && BookmarksManager.init) {
        BookmarksManager.init().catch(err => console.error('Ошибка инициализации закладок:', err));
      }
    }, 100);
  } catch (error) {
    console.error('Ошибка инициализации popup:', error);
    // Показываем сообщение об ошибке пользователю
    const popupContent = document.querySelector('.popup-content');
    if (popupContent && error.message && error.message.includes('chrome://')) {
      const errorMsg = document.createElement('div');
      errorMsg.style.padding = '16px';
      errorMsg.style.color = '#616161';
      errorMsg.style.textAlign = 'center';
      errorMsg.textContent = 'Некоторые функции недоступны на этой странице. Откройте обычную веб-страницу.';
      popupContent.insertBefore(errorMsg, popupContent.firstChild);
    }
  }
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
}

let currentMatchIndex = -1;
let totalMatches = 0;

function loadExtensionState() {
  chrome.storage.sync.get(["extensionEnabled"], (result) => {
    const isEnabled = result.extensionEnabled !== false;
    const toggle = document.getElementById("extension-toggle");
    const status = document.getElementById("toggle-status");
    
    if (toggle) {
      toggle.checked = isEnabled;
    }
    
    if (status) {
      if (isEnabled) {
        status.textContent = i18n.t('popup.enabled');
        status.className = "toggle-status enabled";
      } else {
        status.textContent = i18n.t('popup.disabled');
        status.className = "toggle-status disabled";
      }
    }
  });
}

function setupEventListeners() {
  const extensionToggle = document.getElementById("extension-toggle");
  if (extensionToggle) {
    extensionToggle.addEventListener("change", (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.sync.set({ extensionEnabled: isEnabled }, () => {
        const toggle = document.getElementById("extension-toggle");
        const status = document.getElementById("toggle-status");
        if (toggle) {
          toggle.checked = isEnabled;
        }
        if (status) {
          if (isEnabled) {
            status.textContent = i18n.t('popup.enabled');
            status.className = "toggle-status enabled";
          } else {
            status.textContent = i18n.t('popup.disabled');
            status.className = "toggle-status disabled";
          }
        }
        updateContextMenus(isEnabled);
      });
    });
  }

  const openChatBtn = document.getElementById("open-chat");
  if (openChatBtn) {
    openChatBtn.addEventListener("click", () => {
      openAIChat();
    });
  }

  const openSettingsBtn = document.getElementById("open-settings");
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch (error) {
    return null;
  }
}

function isPageAccessible(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const blockedSchemes = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'];
    return !blockedSchemes.some(scheme => urlObj.protocol.startsWith(scheme));
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId) {
  try {
    // Сначала проверяем, доступна ли страница для загрузки скриптов
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !isPageAccessible(tab.url)) {
      return false;
    }
    
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    // Если страница недоступна, не пытаемся загружать скрипт
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab || !tab.url || !isPageAccessible(tab.url)) {
        return false;
      }
    } catch {
      return false;
    }
    
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      }).catch(() => {
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return true;
      } catch (pingError) {
        console.error('Content script не отвечает после загрузки:', pingError);
        return false;
      }
    } catch (injectError) {
      console.error('Не удалось загрузить content script:', injectError);
      return false;
    }
  }
}

function updateContextMenus(isEnabled) {
  try {
    if (isEnabled) {
      chrome.contextMenus.update("translate-text", { enabled: true });
      chrome.contextMenus.update("explain-text", { enabled: true });
      chrome.contextMenus.update("quick-explain", { enabled: true });
      chrome.contextMenus.update("extract-facts", { enabled: true });
      chrome.contextMenus.update("generate-questions", { enabled: true });
      chrome.contextMenus.update("add-bookmark", { enabled: true });
      chrome.contextMenus.update("add-note", { enabled: true });
    } else {
      chrome.contextMenus.update("translate-text", { enabled: false });
      chrome.contextMenus.update("explain-text", { enabled: false });
      chrome.contextMenus.update("quick-explain", { enabled: false });
      chrome.contextMenus.update("extract-facts", { enabled: false });
      chrome.contextMenus.update("generate-questions", { enabled: false });
      chrome.contextMenus.update("add-bookmark", { enabled: false });
      chrome.contextMenus.update("add-note", { enabled: false });
    }
  } catch (error) {}
}

// Используем функцию из utils.js
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

function openAIChat() {
  chrome.storage.sync.get(["aiSettings"], (result) => {
    let aiSettings = result.aiSettings || {
      model: "deepseek",
      deepseekApiKey: "",
      chatgptApiKey: "",
      deepseekTemperature: 0.7,
      chatgptTemperature: 0.7,
      systemPrompt: "",
      developerMode: false
    };

    migrateAISettings(aiSettings);

    const chatUrl = chrome.runtime.getURL("ai-chat.html") + 
      `?text=&settings=${encodeURIComponent(JSON.stringify(aiSettings))}`;
    
    chrome.tabs.create({ url: chatUrl });
  });
}

function setupSearchListeners() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const exactMatchCheckbox = document.getElementById('exactMatch');
  const morphologyCheckbox = document.getElementById('morphology');
  const useRegexCheckbox = document.getElementById('useRegex');
  const regexError = document.getElementById('regexError');
  const resultsSection = document.getElementById('resultsSection');
  const resultsInfo = document.getElementById('resultsInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Валидация регулярных выражений при вводе
  searchInput.addEventListener('input', () => {
    if (useRegexCheckbox.checked) {
      validateRegex(searchInput.value);
    } else {
      regexError.style.display = 'none';
    }
  });

  useRegexCheckbox.addEventListener('change', () => {
    if (useRegexCheckbox.checked) {
      validateRegex(searchInput.value);
    } else {
      regexError.style.display = 'none';
    }
  });

  function validateRegex(pattern) {
    if (!pattern || !pattern.trim()) {
      regexError.style.display = 'none';
      return true;
    }

    try {
      new RegExp(pattern);
      regexError.style.display = 'none';
      return true;
    } catch (e) {
      regexError.textContent = i18n.t('popup.regexError') + ': ' + e.message;
      regexError.style.display = 'block';
      return false;
    }
  }

  async function sendMessageSafe(tabId, message) {
    try {
      const isLoaded = await ensureContentScript(tabId);
      if (!isLoaded) {
        throw new Error(i18n.t('popup.scriptLoadError') || 'Не удалось загрузить скрипт на страницу. Обновите страницу и попробуйте снова.');
      }
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (error.message && (error.message.includes('Receiving end does not exist') || error.message.includes('Could not establish connection'))) {
        const reloaded = await ensureContentScript(tabId);
        if (reloaded) {
          try {
            return await chrome.tabs.sendMessage(tabId, message);
          } catch (retryError) {
            throw new Error(i18n.t('popup.scriptLoadError') || 'Не удалось загрузить скрипт на страницу. Обновите страницу и попробуйте снова.');
          }
        }
      }
      throw error;
    }
  }

  async function performSearch() {
    const searchText = searchInput.value.trim();
    
    if (!searchText) {
      alert(i18n.t('popup.searchPlaceholder'));
      return;
    }

    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      alert(i18n.t('popup.searchUnavailable') || 'Поиск недоступен на этой странице. Откройте обычную веб-страницу.');
      return;
    }
    
    if (!isPageAccessible(tab.url)) {
      alert(i18n.t('popup.searchUnavailable') || 'Поиск недоступен на этой странице. Откройте обычную веб-страницу.');
      return;
    }

    const exactMatch = exactMatchCheckbox.checked;
    const useMorphology = morphologyCheckbox.checked;
    const useRegex = useRegexCheckbox.checked;

    // Валидация регулярного выражения перед поиском
    if (useRegex && !validateRegex(searchText)) {
      return;
    }

    try {
      const response = await sendMessageSafe(tab.id, {
        action: 'search',
        text: searchText,
        exactMatch: exactMatch,
        useMorphology: useMorphology,
        useRegex: useRegex
      });

      if (response && response.success) {
        totalMatches = response.count;
        currentMatchIndex = response.count > 0 ? 0 : -1;
        
        updateResultsUI();
        
        if (response.count > 0) {
          navigateToMatch(0);
        }
      } else if (response && response.error) {
        alert('Ошибка: ' + response.error);
      }
    } catch (error) {
      console.error('Ошибка при поиске:', error);
      const errorMessage = error.message.includes('Не удалось загрузить') 
        ? error.message 
        : i18n.t('popup.searchError') || 'Ошибка при выполнении поиска. Убедитесь, что вы находитесь на обычной веб-странице и обновите её.';
      alert(errorMessage);
    }
  }

  function updateResultsUI() {
    if (totalMatches > 0) {
      resultsSection.style.display = 'block';
      clearBtn.style.display = 'block';
      resultsInfo.textContent = `${i18n.t('popup.found')} ${totalMatches}`;
      
      prevBtn.disabled = currentMatchIndex <= 0;
      nextBtn.disabled = currentMatchIndex >= totalMatches - 1;
    } else {
      resultsSection.style.display = 'block';
      clearBtn.style.display = 'block';
      resultsInfo.textContent = i18n.t('popup.notFound');
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }
  }

  async function navigateToMatch(index) {
    if (index < 0 || index >= totalMatches) return;

    const tab = await getActiveTab();
    try {
      await sendMessageSafe(tab.id, {
        action: 'navigate',
        index: index
      });
      
      currentMatchIndex = index;
      updateResultsUI();
    } catch (error) {
      console.error('Ошибка при навигации:', error);
    }
  }

  async function clearHighlights() {
    const tab = await getActiveTab();
    try {
      await sendMessageSafe(tab.id, {
        action: 'clear'
      });
      
      resultsSection.style.display = 'none';
      clearBtn.style.display = 'none';
      totalMatches = 0;
      currentMatchIndex = -1;
      searchInput.value = '';
    } catch (error) {}
  }

  searchBtn.addEventListener('click', performSearch);
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentMatchIndex > 0) {
      navigateToMatch(currentMatchIndex - 1);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentMatchIndex < totalMatches - 1) {
      navigateToMatch(currentMatchIndex + 1);
    }
  });

  clearBtn.addEventListener('click', clearHighlights);

  window.addEventListener('beforeunload', async () => {
    try {
      const tab = await getActiveTab();
      if (tab && isPageAccessible(tab.url)) {
        await sendMessageSafe(tab.id, { action: 'clear' });
      }
    } catch (error) {
    }
  });
}
