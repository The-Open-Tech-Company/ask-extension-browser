async function createContextMenus() {
  try {
    if (!chrome.contextMenus) {
      return;
    }
    
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['language'], (data) => {
        if (chrome.runtime.lastError) {
          resolve({});
        } else {
          resolve(data);
        }
      });
    });
    
    const lang = result.language || 'ru';
    
    await new Promise((resolve) => {
      chrome.contextMenus.removeAll(() => {
        resolve();
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const menuItems = [
      {
        id: "translate-text",
        title: lang === 'en' ? "Translate" : "Перевести",
        contexts: ["selection"]
      },
      {
        id: "explain-text",
        title: lang === 'en' ? "Explain" : "Объяснить",
        contexts: ["selection"]
      },
      {
        id: "quick-explain",
        title: lang === 'en' ? "Quick Explanation" : "Быстрое объяснение",
        contexts: ["selection"]
      },
      {
        id: "extract-facts",
        title: lang === 'en' ? "Extract Facts" : "Извлечь факты",
        contexts: ["selection"]
      },
      {
        id: "generate-questions",
        title: lang === 'en' ? "Generate Questions" : "Создать вопросы",
        contexts: ["selection"]
      },
      {
        id: "separator-1",
        type: "separator",
        contexts: ["page", "selection"]
      },
      {
        id: "add-bookmark",
        title: lang === 'en' ? "Add Bookmark" : "Добавить закладку",
        contexts: ["page"]
      },
      {
        id: "add-note",
        title: lang === 'en' ? "Add Note" : "Добавить заметку",
        contexts: ["page"]
      }
    ];
    
    // Создаем все пункты меню
    let createdCount = 0;
    for (const item of menuItems) {
      await new Promise((resolve) => {
        chrome.contextMenus.create(item, () => {
          if (chrome.runtime.lastError) {
            console.error(`Ошибка при создании меню ${item.id}:`, chrome.runtime.lastError);
          } else {
            createdCount++;
            console.log(`Меню создано: ${item.id} - ${item.title}`);
          }
          resolve();
        });
      });
    }
    
    console.log(`=== Контекстное меню создано успешно. Создано пунктов: ${createdCount}/${menuItems.length} ===`);
  } catch (error) {
    console.error('Критическая ошибка при создании контекстного меню:', error);
    console.error('Стек ошибки:', error.stack);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.language) {
    createContextMenus().catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await createContextMenus();

  chrome.storage.sync.get(null, (items) => {
    if (!items.translateSettings) {
      chrome.storage.sync.set({
        translateSettings: {
          defaultFrom: "auto",
          defaultTo: "ru",
          russianTo: "en"
        }
      });
    }
    if (!items.aiSettings) {
      chrome.storage.sync.set({
        aiSettings: {
          model: "deepseek",
          deepseekApiKey: "",
          chatgptApiKey: "",
          deepseekTemperature: 0.7,
          chatgptTemperature: 0.7,
          systemPrompt: ""
        }
      });
    }
    if (items.extensionEnabled === undefined) {
      chrome.storage.sync.set({
        extensionEnabled: true
      });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus().catch(err => console.error('Ошибка при создании меню при запуске:', err));
});

// Создаем меню при активации service worker (важно для Manifest V3)
createContextMenus().catch(err => console.error('Ошибка при создании меню при загрузке:', err));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const result = await new Promise(resolve => chrome.storage.sync.get(["extensionEnabled"], resolve));
  const isEnabled = result.extensionEnabled !== false;
  
  if (!isEnabled) {
    return;
  }
  
  if (info.menuItemId === "translate-text") {
    await sendMessageToTab(tab, {
      action: "translate",
      text: info.selectionText
    });
  } else if (info.menuItemId === "explain-text") {
    await sendMessageToTab(tab, {
      action: "explain",
      text: info.selectionText
    });
  } else if (info.menuItemId === "quick-explain") {
    await sendMessageToTab(tab, {
      action: "quickExplain",
      text: info.selectionText
    });
  } else if (info.menuItemId === "extract-facts") {
    if (!info.selectionText || !info.selectionText.trim()) {
      return;
    }
    await sendMessageToTab(tab, {
      action: "extractFacts",
      text: info.selectionText
    });
  } else if (info.menuItemId === "generate-questions") {
    await sendMessageToTab(tab, {
      action: "generateQuestions",
      text: info.selectionText
    });
  } else if (info.menuItemId === "add-bookmark") {
    handleAddBookmark(tab);
  } else if (info.menuItemId === "add-note") {
    handleAddNote(tab);
  }
});

async function handleAddBookmark(tab) {
  if (!tab || !tab.url || !tab.title) return;
  
  try {
    const urlObj = new URL(tab.url);
    const blockedSchemes = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'];
    if (blockedSchemes.some(scheme => urlObj.protocol.startsWith(scheme))) {
      return;
    }
  } catch {
    return;
  }
  
  const dialogUrl = chrome.runtime.getURL('bookmark-dialog.html') + 
    `?title=${encodeURIComponent(tab.title || '')}&url=${encodeURIComponent(tab.url)}`;
  
  chrome.windows.create({
    url: dialogUrl,
    type: 'popup',
    width: 450,
    height: 400,
    focused: true
  });
}

async function handleAddNote(tab) {
  if (!tab || !tab.url) return;
  
  try {
    const urlObj = new URL(tab.url);
    const blockedSchemes = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'];
    if (blockedSchemes.some(scheme => urlObj.protocol.startsWith(scheme))) {
      return;
    }
  } catch {
    return;
  }
  
  const dialogUrl = chrome.runtime.getURL('note-dialog.html') + 
    `?url=${encodeURIComponent(tab.url)}`;
  
  chrome.windows.create({
    url: dialogUrl,
    type: 'popup',
    width: 450,
    height: 300,
    focused: true
  });
}

function handleSaveBookmarkFromDialog(bookmarkData, sendResponse) {
  chrome.storage.local.get(['bookmarks'], (result) => {
    const bookmarks = result.bookmarks || [];
    
    // Проверяем, не существует ли уже такая закладка
    const normalizedUrl = normalizeUrl(bookmarkData.url);
    const exists = bookmarks.some(b => normalizeUrl(b.url) === normalizedUrl);
    
    if (exists) {
      sendResponse({ success: false, error: 'Эта страница уже добавлена в закладки' });
      return;
    }
    
    const bookmark = {
      id: 'bookmark-' + Date.now(),
      url: bookmarkData.url,
      title: bookmarkData.title,
      tags: bookmarkData.tags || [],
      description: bookmarkData.description || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    bookmarks.push(bookmark);
    
    chrome.storage.local.set({ bookmarks: bookmarks }, () => {
      sendResponse({ success: true });
    });
  });
}

function handleSaveNoteFromDialog(noteText, url, sendResponse) {
  const normalizedUrl = normalizeUrl(url);
  
  chrome.storage.local.get(['pageNotes'], (result) => {
    const allNotes = result.pageNotes || {};
    if (!allNotes[normalizedUrl]) {
      allNotes[normalizedUrl] = [];
    }
    
    const note = {
      id: 'note-' + Date.now(),
      text: noteText,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    allNotes[normalizedUrl].push(note);
    
    chrome.storage.local.set({ pageNotes: allNotes }, () => {
      chrome.tabs.query({ url: url }, (tabs) => {
        if (tabs && tabs.length > 0) {
          sendMessageToTab(tabs[0], {
            action: 'showNotes',
            notes: allNotes[normalizedUrl]
          });
        }
      });
      
      sendResponse({ success: true });
    });
  });
}

async function callAIAPI(model, apiKey, temperature, systemPrompt, messagesData) {
  const url = model === "deepseek" 
    ? "https://api.deepseek.com/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  
  const requestMessages = [...messagesData.messages];
  
  if (systemPrompt) {
    requestMessages.unshift({ role: "system", content: systemPrompt });
  }
  
  const requestBody = {
    model: model === "deepseek" ? "deepseek-chat" : (messagesData.chatgptModel || "gpt-3.5-turbo"),
    messages: requestMessages,
    temperature: temperature || 0.7
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return {
        success: true,
        content: data.choices[0].message.content
      };
    } else {
      throw new Error("Unexpected response format");
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function translateWithGoogleBackground(text, from, to, retries = 3) {
  const maxLength = 4500;
  if (text.length > maxLength) {
    let parts = [];
    let currentPart = '';
    
    const sentences = text.split(/([.!?]\s+)/);
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      if ((currentPart + sentence).length > maxLength && currentPart.length > 0) {
        parts.push(currentPart.trim());
        currentPart = sentence;
      } else {
        currentPart += sentence;
      }
    }
    if (currentPart.trim().length > 0) {
      parts.push(currentPart.trim());
    }
    
    if (parts.length === 0 || parts.some(p => p.length > maxLength)) {
      parts = [];
      const words = text.split(/\s+/);
      currentPart = '';
      for (const word of words) {
        const testLength = currentPart ? (currentPart + ' ' + word).length : word.length;
        if (testLength > maxLength && currentPart.length > 0) {
          parts.push(currentPart.trim());
          currentPart = word;
        } else {
          currentPart = currentPart ? (currentPart + ' ' + word) : word;
        }
      }
      if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim());
      }
    }
    
    const translations = await Promise.all(
      parts.map(part => translateWithGoogleBackground(part, from, to, retries))
    );
    
    return translations.join(' ');
  }
  
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0].map(item => item[0]).join("");
      }
      
      throw new Error("Не удалось получить перевод: неожиданный формат ответа");
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (attempt === retries) {
        let errorMessage = error.message;
        if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('aborted')) {
          errorMessage = 'Превышено время ожидания ответа от сервера перевода';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('network')) {
          errorMessage = 'Не удалось подключиться к серверу перевода. Проверьте интернет-соединение.';
        } else if (error.message.includes('CORS') || error.message.includes('cors')) {
          errorMessage = 'Сервер перевода заблокировал запрос. Попробуйте позже.';
        }
        throw new Error(`Ошибка перевода: ${errorMessage}`);
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
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

async function ensureContentScripts(tab) {
  if (!tab || !tab.id || !chrome.scripting) {
    return false;
  }
  
  if (!isPageAccessible(tab.url)) {
    return false;
  }
  
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    }).catch(() => {});
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['utils.js', 'content.js']
    });
    
    return true;
  } catch (error) {
    console.error('Не удалось инжектировать content scripts:', error);
    return false;
  }
}

async function sendMessageToTab(tab, message, { onResponse } = {}) {
  if (!tab || !tab.id) return false;
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (onResponse) {
      onResponse(response);
    }
    return true;
  } catch (error) {
    const messageText = error?.message || '';
    if (messageText.includes('Receiving end does not exist') || messageText.includes('Could not establish connection')) {
      const injected = await ensureContentScripts(tab);
      if (injected) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, message);
          if (onResponse) {
            onResponse(response);
          }
          return true;
        } catch (retryError) {}
      }
    }
  }
  
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openTab") {
    try {
      chrome.tabs.create({ url: request.url });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message || "Не удалось открыть вкладку" });
    }
    return false;
  } else if (request.action === "saveBookmarkFromDialog") {
    handleSaveBookmarkFromDialog(request.bookmark, sendResponse);
    return true;
  } else if (request.action === "saveNoteFromDialog") {
    handleSaveNoteFromDialog(request.noteText, request.url, sendResponse);
    return true;
  } else if (request.action === "getNotesForPage") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = normalizeUrl(tabs[0].url);
        chrome.storage.local.get(['pageNotes'], (result) => {
          const allNotes = result.pageNotes || {};
          sendResponse({ success: true, notes: allNotes[url] || [] });
        });
      } else {
        sendResponse({ success: true, notes: [] });
      }
    });
    return true;
  } else if (request.action === "translatePageProgress") {
    sendResponse({ success: true });
    return false;
  } else if (request.action === "callAIAPI") {
    callAIAPI(
      request.model,
      request.apiKey,
      request.temperature,
      request.systemPrompt,
      request.messages
    ).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message || "Неизвестная ошибка" });
    });
    return true;
  } else if (request.action === "translateTextBackground") {
    translateWithGoogleBackground(
      request.text || "",
      request.from || "auto",
      request.to || "ru"
    ).then(translation => {
      sendResponse({ success: true, translation });
    }).catch(error => {
      sendResponse({ success: false, error: error.message || "Ошибка перевода" });
    });
    return true;
  } else if (request.action === "recreateContextMenus") {
    createContextMenus().then(() => {
      sendResponse({ success: true, message: "Меню пересоздано" });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  return false;
});