let currentLang = 'ru';

document.addEventListener("DOMContentLoaded", async () => {
  await i18n.init();
  currentLang = i18n.getCurrentLang();
  updateLanguage();
  loadExtensionState();
  setupEventListeners();
  setupSearchListeners();
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
    
    toggle.checked = isEnabled;
    
    if (isEnabled) {
      status.textContent = i18n.t('popup.enabled');
      status.className = "toggle-status enabled";
    } else {
      status.textContent = i18n.t('popup.disabled');
      status.className = "toggle-status disabled";
    }
  });
}

function setupEventListeners() {
  document.getElementById("extension-toggle").addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ extensionEnabled: isEnabled }, () => {
      loadExtensionState();
      updateContextMenus(isEnabled);
    });
  });

  document.getElementById("open-chat").addEventListener("click", () => {
    openAIChat();
  });

  document.getElementById("open-settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
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
  if (isEnabled) {
    chrome.contextMenus.update("translate-text", { enabled: true });
    chrome.contextMenus.update("explain-text", { enabled: true });
  } else {
    chrome.contextMenus.update("translate-text", { enabled: false });
    chrome.contextMenus.update("explain-text", { enabled: false });
  }
}

function migrateAISettings(aiSettings) {
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
  const resultsSection = document.getElementById('resultsSection');
  const resultsInfo = document.getElementById('resultsInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const clearBtn = document.getElementById('clearBtn');

  async function sendMessageSafe(tabId, message) {
    const isLoaded = await ensureContentScript(tabId);
    if (!isLoaded) {
      throw new Error('Не удалось загрузить скрипт на страницу. Обновите страницу и попробуйте снова.');
    }
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (error.message && error.message.includes('Receiving end does not exist')) {
        console.warn('Получена ошибка связи, пытаемся перезагрузить content script...');
        const reloaded = await ensureContentScript(tabId);
        if (reloaded) {
          return await chrome.tabs.sendMessage(tabId, message);
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
    
    if (!isPageAccessible(tab.url)) {
      alert(i18n.t('popup.searchUnavailable'));
      return;
    }

    const exactMatch = exactMatchCheckbox.checked;
    const useMorphology = morphologyCheckbox.checked;

    try {
      const response = await sendMessageSafe(tab.id, {
        action: 'search',
        text: searchText,
        exactMatch: exactMatch,
        useMorphology: useMorphology
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
    } catch (error) {
      console.error('Ошибка при очистке:', error);
    }
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
