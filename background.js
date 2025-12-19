function createContextMenus() {
  chrome.storage.sync.get(['language'], (result) => {
    const lang = result.language || 'ru';
    
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.warn('Ошибка при удалении меню:', chrome.runtime.lastError);
      }
      
      chrome.contextMenus.create({
        id: "translate-text",
        title: lang === 'en' ? "Translate" : "Перевести",
        contexts: ["selection"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Ошибка при создании меню перевода:', chrome.runtime.lastError);
        }
      });

      chrome.contextMenus.create({
        id: "explain-text",
        title: lang === 'en' ? "Explain" : "Объяснить",
        contexts: ["selection"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Ошибка при создании меню объяснения:', chrome.runtime.lastError);
        }
      });
      
      chrome.contextMenus.create({
        id: "quick-explain",
        title: lang === 'en' ? "Quick Explanation" : "Быстрое объяснение",
        contexts: ["selection"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Ошибка при создании меню быстрого объяснения:', chrome.runtime.lastError);
        }
      });
    });
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.language) {
    createContextMenus();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();

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
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.sync.get(["extensionEnabled"], (result) => {
    const isEnabled = result.extensionEnabled !== false;
    
    if (!isEnabled) {
      return;
    }
    
    if (info.menuItemId === "translate-text") {
      chrome.tabs.sendMessage(tab.id, {
        action: "translate",
        text: info.selectionText
      }).catch((error) => {
        console.warn('Не удалось отправить сообщение для перевода:', error);
      });
    } else if (info.menuItemId === "explain-text") {
      chrome.tabs.sendMessage(tab.id, {
        action: "explain",
        text: info.selectionText
      }).catch((error) => {
        console.warn('Не удалось отправить сообщение для объяснения:', error);
      });
    } else if (info.menuItemId === "quick-explain") {
      chrome.tabs.sendMessage(tab.id, {
        action: "quickExplain",
        text: info.selectionText
      }).catch((error) => {
        console.warn('Не удалось отправить сообщение для быстрого объяснения:', error);
      });
    }
  });
});

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
    const parts = [];
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
      parts.length = 0;
      const words = text.split(/\s+/);
      currentPart = '';
      for (const word of words) {
        if ((currentPart + ' ' + word).length > maxLength && currentPart.length > 0) {
          parts.push(currentPart.trim());
          currentPart = word;
        } else {
          currentPart += (currentPart ? ' ' : '') + word;
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openTab") {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  } else if (request.action === "translatePageProgress") {
    sendResponse({ success: true });
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
      sendResponse({ success: false, error: error.message });
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
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  return true;
});