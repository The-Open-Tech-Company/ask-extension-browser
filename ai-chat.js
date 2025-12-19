let aiSettings = {};
let initialText = "";
let chatHistory = [];
let currentChatId = null;
let developerMode = false;
let currentLang = 'ru';

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

async function initChat(text, settings) {
  await i18n.init();
  currentLang = i18n.getCurrentLang();
  
  initialText = text;
  aiSettings = settings || {
    model: "deepseek",
    deepseekApiKey: "",
    chatgptApiKey: "",
    deepseekTemperature: 0.7,
    chatgptTemperature: 0.7,
    systemPrompt: "",
    developerMode: false
  };

  migrateAISettings(aiSettings);
  
  developerMode = aiSettings.developerMode || false;

  if (aiSettings.model === "deepseek") {
    showDeepSeekOptions();
  }

  const apiKey = aiSettings.model === "deepseek" 
    ? (aiSettings.deepseekApiKey || "")
    : (aiSettings.chatgptApiKey || "");

  if (!apiKey || apiKey.trim() === "") {
    addMessage("assistant", i18n.t('chat.noApiKey'), true);
  } else if (text && text.trim() !== "") {
    const explainText = i18n.t('chat.explainText');
    addMessage("user", `${explainText} "${text}"`);
    sendMessage(`${explainText} "${text}"`);
  } else {
    addMessage("assistant", i18n.t('chat.hello'));
  }
  
  updateUITexts();

  document.getElementById("send-message").addEventListener("click", handleSend);
  
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  setupChatHistoryHandlers();
  setupPromptMenuHandlers();
  loadQuickPrompts();
}

function showDeepSeekOptions() {
  const optionsContainer = document.getElementById("chat-options");
  optionsContainer.innerHTML = `
    <button class="option-button" id="option-web-search" data-option="web_search">${currentLang === 'en' ? 'Web Search' : 'Поиск в интернете'}</button>
    <button class="option-button" id="option-thinking" data-option="thinking">${currentLang === 'en' ? 'Thinking' : 'Мышление'}</button>
  `;

  document.getElementById("option-web-search").addEventListener("click", toggleOption);
  document.getElementById("option-thinking").addEventListener("click", toggleOption);
}

function updateUITexts() {
  const chatInput = document.getElementById("chat-input");
  if (chatInput) {
    chatInput.placeholder = i18n.t('chat.placeholder');
  }
  
  const title = document.querySelector('.ai-chat-header h2');
  if (title) {
    title.textContent = i18n.t('chat.title');
  }
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.hasAttribute('data-i18n-html')) {
      el.innerHTML = i18n.t(key);
    } else {
      el.textContent = i18n.t(key);
    }
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = i18n.t(key);
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = i18n.t(key);
  });
}

function toggleOption(e) {
  e.target.classList.toggle("active");
}

function getActiveOptions() {
  const activeButtons = document.querySelectorAll(".option-button.active");
  return Array.from(activeButtons).map(btn => btn.dataset.option);
}

function handleSend() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  
  if (!message) return;

  const apiKey = aiSettings.model === "deepseek" 
    ? (aiSettings.deepseekApiKey || "")
    : (aiSettings.chatgptApiKey || "");

  if (!apiKey || apiKey.trim() === "") {
    addMessage("assistant", i18n.t('chat.noApiKeyShort'), true);
    return;
  }

  let userTokenInfo = null;
  if (developerMode) {
    const estimatedTokens = Math.ceil(message.length / 4);
    userTokenInfo = {
      prompt_tokens: estimatedTokens,
      completion_tokens: 0,
      total_tokens: estimatedTokens
    };
  }
  
  addMessage("user", message, false, false, null, userTokenInfo);
  input.value = "";
  
  sendMessage(message);
}

function updateLoadingMessage(status) {
  const loadingMessages = document.querySelectorAll(".message.loading");
  if (loadingMessages.length > 0) {
    const lastMessage = loadingMessages[loadingMessages.length - 1];
    const contentDiv = lastMessage.querySelector(".message-content");
    if (contentDiv) {
      contentDiv.textContent = status;
    }
  }
}

async function sendMessage(message) {
  addMessage("assistant", i18n.t('chat.loading'), false, true);

  try {
    let response;
    
    if (aiSettings.model === "deepseek") {
      response = await callDeepSeekAPI(message);
    } else if (aiSettings.model === "chatgpt") {
      response = await callChatGPTAPI(message);
    } else {
      throw new Error("Неизвестная модель");
    }

    removeLastLoadingMessage();
    
    const tokenInfo = typeof response === "object" ? response.tokenInfo : null;
    if (typeof response === "object" && response.thinking) {
      addMessage("assistant", response.content, false, false, response.thinking, tokenInfo);
    } else {
      const content = typeof response === "object" ? response.content : response;
      addMessage("assistant", content, false, false, null, tokenInfo);
    }
  } catch (error) {
    removeLastLoadingMessage();
    const errorMessage = error.message.toLowerCase();
    const isAuthError = error.status === 401 || 
                        error.status === 403 ||
                        errorMessage.includes('unauthorized') || 
                        errorMessage.includes('api key') ||
                        errorMessage.includes('invalid') ||
                        errorMessage.includes('authentication') ||
                        errorMessage.includes('forbidden');
    
    if (isAuthError) {
      addMessage("assistant", i18n.t('chat.noApiKeyShort'), true);
    } else {
      addMessage("assistant", `${i18n.t('chat.error')} ${error.message}`, true);
    }
  }
}

async function callDeepSeekAPI(message) {
  const activeOptions = getActiveOptions();
  const hasWebSearch = activeOptions.includes("web_search");
  const hasThinking = activeOptions.includes("thinking");

  let messages = [
    ...chatHistory,
    { role: "user", content: message }
  ];

  if (aiSettings.systemPrompt) {
    messages.unshift({ role: "system", content: aiSettings.systemPrompt });
  }

  const model = (hasThinking || hasWebSearch) ? "deepseek-reasoner" : "deepseek-chat";

  const apiKey = aiSettings.deepseekApiKey || "";
  const temperature = aiSettings.deepseekTemperature || 0.7;

  const requestBody = {
    model: model,
    messages: messages,
    temperature: temperature
  };

  if (hasWebSearch) {
    requestBody.tools = [{
      type: "function",
      function: {
        name: "web_search",
        description: "Perform a web search to get up-to-date information from the internet.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query string"
            }
          },
          required: ["query"]
        }
      }
    }];
  }

  updateLoadingMessage(i18n.t('chat.loading'));
  
  let response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
    const error = new Error(errorMsg);
    error.status = response.status;
    throw error;
  }

  let data = await response.json();
  
  if (!data.choices || !data.choices[0]) {
    throw new Error("Неожиданный формат ответа от API");
  }

  let choice = data.choices[0];
  let messageData = choice.message || {};
  let thinkingContent = null;
  let firstRequestTokens = null;

  if (messageData.reasoning_content) {
    thinkingContent = messageData.reasoning_content;
  } else if (choice.reasoning_content) {
    thinkingContent = choice.reasoning_content;
  } else if (messageData.reasoning) {
    thinkingContent = messageData.reasoning;
  }
  
  if (data.usage) {
    firstRequestTokens = {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0
    };
  }

  if (messageData.tool_calls && messageData.tool_calls.length > 0) {
    updateLoadingMessage(i18n.t('chat.webSearch'));
    
    const assistantMessageForHistory = {
      role: "assistant",
      content: messageData.content || null,
      tool_calls: messageData.tool_calls
    };
    
    if (messageData.reasoning_content) {
      assistantMessageForHistory.reasoning_content = messageData.reasoning_content;
      if (!thinkingContent) {
        thinkingContent = messageData.reasoning_content;
      }
    } else if (choice.reasoning_content) {
      assistantMessageForHistory.reasoning_content = choice.reasoning_content;
      if (!thinkingContent) {
        thinkingContent = choice.reasoning_content;
      }
    }
    
    messages.push(assistantMessageForHistory);

    for (const toolCall of messageData.tool_calls) {
      if (toolCall && toolCall.function && toolCall.function.name === "web_search") {
        try {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id || `call_${Date.now()}`,
            name: toolCall.function.name,
            content: `Поиск выполнен для запроса: "${args.query || ""}"`
          });
        } catch (e) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id || `call_${Date.now()}`,
            name: toolCall.function?.name || "web_search",
            content: "Поиск выполнен"
          });
        }
      }
    }

    updateLoadingMessage(i18n.t('chat.generating'));
    
    const secondRequestBody = {
      model: model,
      messages: messages,
      temperature: temperature
    };

    response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(secondRequestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      throw error;
    }

    data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error("Неожиданный формат ответа от API");
    }

    choice = data.choices[0];
    messageData = choice.message || {};
    
    if (messageData.reasoning_content) {
      thinkingContent = thinkingContent 
        ? thinkingContent + "\n\n" + messageData.reasoning_content
        : messageData.reasoning_content;
    } else if (choice.reasoning_content) {
      thinkingContent = thinkingContent 
        ? thinkingContent + "\n\n" + choice.reasoning_content
        : choice.reasoning_content;
    }
  }

  const finalMessage = messageData.content || "";
  
  let tokenInfo = null;
  if (data.usage) {
    if (firstRequestTokens) {
      tokenInfo = {
        prompt_tokens: firstRequestTokens.prompt_tokens + (data.usage.prompt_tokens || 0),
        completion_tokens: firstRequestTokens.completion_tokens + (data.usage.completion_tokens || 0),
        total_tokens: firstRequestTokens.total_tokens + (data.usage.total_tokens || 0)
      };
    } else {
      tokenInfo = {
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        total_tokens: data.usage.total_tokens || 0
      };
    }
  } else if (firstRequestTokens) {
    tokenInfo = firstRequestTokens;
  }
  
  updateLoadingMessage(i18n.t('chat.done'));
  await new Promise(resolve => setTimeout(resolve, 300));

  chatHistory.push({ role: "user", content: message });
  chatHistory.push({ role: "assistant", content: finalMessage });
  
  return {
    content: finalMessage,
    thinking: thinkingContent,
    tokenInfo: tokenInfo
  };
}

async function callChatGPTAPI(message) {
  const apiKey = aiSettings.chatgptApiKey || "";
  const temperature = aiSettings.chatgptTemperature || 0.7;
  
  const messages = [
    ...chatHistory,
    { role: "user", content: message }
  ];

  if (aiSettings.systemPrompt) {
    messages.unshift({ role: "system", content: aiSettings.systemPrompt });
  }

  const model = aiSettings.chatgptModel || "gpt-3.5-turbo";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const assistantMessage = data.choices[0].message.content;
    
    let tokenInfo = null;
    if (data.usage) {
      tokenInfo = {
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        total_tokens: data.usage.total_tokens || 0
      };
    }
    
    chatHistory.push({ role: "user", content: message });
    chatHistory.push({ role: "assistant", content: assistantMessage });
    
    return {
      content: assistantMessage,
      tokenInfo: tokenInfo
    };
  }

  throw new Error("Неожиданный формат ответа от API");
}

function markdownToHtml(text) {
  if (!text) return "";
  
  let html = escapeHtml(text);
  
  // Заголовки
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Жирный текст
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Курсив
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Код
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Блоки кода
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  
  // Ссылки
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Списки
  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^\+ (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');
  
  // Обернуть списки в ul/ol
  html = html.replace(/(<li>.*<\/li>)/s, function(match) {
    return '<ul>' + match + '</ul>';
  });
  
  // Цитаты
  html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');
  
  // Параграфы
  html = html.split('\n\n').map(para => {
    if (para.trim() && !para.match(/^<(h[1-6]|ul|ol|pre|blockquote)/)) {
      return '<p>' + para.trim() + '</p>';
    }
    return para;
  }).join('\n');
  
  return html;
}

function addMessage(role, content, isError = false, isLoading = false, thinking = null, tokenInfo = null) {
  const messagesContainer = document.getElementById("chat-messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}${isError ? " error" : ""}${isLoading ? " loading" : ""}`;
  
  const label = role === "user" ? (currentLang === 'en' ? "You" : "Вы") : (currentLang === 'en' ? "AI" : "ИИ");
  
  let contentHtml = isLoading ? escapeHtml(content) : markdownToHtml(content);
  
  if (thinking && !isLoading) {
    const thinkingHtml = markdownToHtml(thinking);
    contentHtml = `
      <div class="thinking-content">
        <span class="thinking-label">💭 ${i18n.t('chat.thinking')}</span>
        ${thinkingHtml}
      </div>
      <div style="margin-top: 12px;">
        ${contentHtml}
      </div>
    `;
  }
  
  let tokenHtml = "";
  if (developerMode && tokenInfo && !isLoading) {
    const promptTokens = tokenInfo.prompt_tokens || tokenInfo.promptTokens || 0;
    const completionTokens = tokenInfo.completion_tokens || tokenInfo.completionTokens || 0;
    const totalTokens = tokenInfo.total_tokens || tokenInfo.totalTokens || (promptTokens + completionTokens);
    
    tokenHtml = `
      <div class="token-info" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 11px; color: #666;">
        <strong>${i18n.t('chat.tokens')}</strong> ${i18n.t('chat.tokensPrompt')}: ${promptTokens} | ${i18n.t('chat.tokensResponse')}: ${completionTokens} | ${i18n.t('chat.tokensTotal')}: ${totalTokens}
      </div>
    `;
  }
  
  messageDiv.innerHTML = `
    <div class="message-label">${label}</div>
    <div class="message-content">${contentHtml}${tokenHtml}</div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeLastLoadingMessage() {
  const messages = document.querySelectorAll(".message.loading");
  if (messages.length > 0) {
    messages[messages.length - 1].remove();
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ========== ИСТОРИЯ ЧАТОВ ==========

// Настройка обработчиков истории чатов
function setupChatHistoryHandlers() {
  document.getElementById("chat-history-btn").addEventListener("click", toggleChatHistory);
  document.getElementById("close-history-btn").addEventListener("click", toggleChatHistory);
  document.getElementById("save-chat-btn").addEventListener("click", saveCurrentChat);
  document.getElementById("clear-chat-btn").addEventListener("click", clearCurrentChat);
}

function toggleChatHistory() {
  const panel = document.getElementById("chat-history-panel");
  const isVisible = panel.style.display !== "none";
  panel.style.display = isVisible ? "none" : "block";
  
  if (!isVisible) {
    loadChatHistory();
  }
}

// Сохранить текущий чат
async function saveCurrentChat() {
  if (chatHistory.length === 0) {
    alert(i18n.t('chat.noMessages'));
    return;
  }

  const chatTitle = prompt(i18n.t('chat.saveTitle'), `${currentLang === 'en' ? 'Chat' : 'Чат'} ${new Date().toLocaleString(currentLang === 'en' ? 'en-US' : 'ru-RU')}`);
  if (!chatTitle) return;

  const chatData = {
    id: currentChatId || 'chat-' + Date.now(),
    title: chatTitle,
    history: [...chatHistory],
    settings: { ...aiSettings },
    initialText: initialText,
    createdAt: currentChatId ? (await getChatById(currentChatId))?.createdAt || Date.now() : Date.now(),
    updatedAt: Date.now()
  };

  await saveChatToStorage(chatData);
  currentChatId = chatData.id;
  
  const btn = document.getElementById("save-chat-btn");
  const originalText = btn.innerHTML;
  btn.innerHTML = i18n.t('chat.saved');
  btn.style.background = "#4caf50";
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.style.background = "";
  }, 2000);

  await loadChatHistory();
}

function clearCurrentChat() {
  if (confirm(i18n.t('chat.clearConfirm'))) {
    chatHistory = [];
    currentChatId = null;
    const messagesContainer = document.getElementById("chat-messages");
    messagesContainer.innerHTML = "";
    addMessage("assistant", i18n.t('chat.cleared'));
  }
}

async function saveChatToStorage(chatData) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatHistory'], (result) => {
      const chats = result.chatHistory || [];
      
      const index = chats.findIndex(c => c.id === chatData.id);
      if (index !== -1) {
        chats[index] = chatData;
      } else {
        chats.push(chatData);
      }

      if (chats.length > 50) {
        chats.sort((a, b) => b.updatedAt - a.updatedAt);
        chats.splice(50);
      }

      chrome.storage.local.set({ chatHistory: chats }, () => {
        resolve();
      });
    });
  });
}

async function loadChatHistory() {
  const chats = await getChatHistory();
  const historyList = document.getElementById("chat-history-list");

  if (chats.length === 0) {
    historyList.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">${i18n.t('chat.empty')}</p>`;
    return;
  }

  chats.sort((a, b) => b.updatedAt - a.updatedAt);

  historyList.innerHTML = chats.map(chat => {
    const date = new Date(chat.updatedAt).toLocaleString('ru-RU');
    const isActive = chat.id === currentChatId ? 'active' : '';
    return `
      <div class="chat-history-item ${isActive}" data-chat-id="${chat.id}">
        <div class="chat-history-item-header">
          <h4>${escapeHtml(chat.title)}</h4>
          <div class="chat-history-item-actions">
            <button class="load-chat-btn" data-id="${chat.id}" title="${i18n.t('chat.load')}">📂</button>
            <button class="delete-chat-btn" data-id="${chat.id}" title="${i18n.t('chat.delete')}">🗑️</button>
          </div>
        </div>
        <p class="chat-history-item-date">${date}</p>
        <p class="chat-history-item-preview">${chat.history.length} ${i18n.t('chat.messages')}</p>
      </div>
    `;
  }).join('');

  historyList.querySelectorAll('.load-chat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const chatId = e.target.dataset.id;
      await loadChat(chatId);
      toggleChatHistory();
    });
  });

  historyList.querySelectorAll('.delete-chat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const chatId = e.target.dataset.id;
      if (confirm(i18n.t('chat.deleteConfirm'))) {
        await deleteChat(chatId);
        await loadChatHistory();
      }
    });
  });
}

async function getChatHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatHistory'], (result) => {
      resolve(result.chatHistory || []);
    });
  });
}

async function getChatById(chatId) {
  const chats = await getChatHistory();
  return chats.find(c => c.id === chatId);
}

async function loadChat(chatId) {
  const chat = await getChatById(chatId);
  if (!chat) {
    alert(i18n.t('chat.notFound'));
    return;
  }

  chatHistory = [...chat.history];
  aiSettings = { ...chat.settings };
  currentChatId = chat.id;
  initialText = chat.initialText || "";

  // Миграция старых настроек
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

  const settingsResult = await new Promise((resolve) => {
    chrome.storage.sync.get(["aiSettings"], resolve);
  });
  
  if (settingsResult.aiSettings && settingsResult.aiSettings.developerMode !== undefined) {
    developerMode = settingsResult.aiSettings.developerMode;
    aiSettings.developerMode = developerMode;
  }
  
  if (settingsResult.aiSettings) {
    if (settingsResult.aiSettings.deepseekApiKey) {
      aiSettings.deepseekApiKey = settingsResult.aiSettings.deepseekApiKey;
    }
    if (settingsResult.aiSettings.chatgptApiKey) {
      aiSettings.chatgptApiKey = settingsResult.aiSettings.chatgptApiKey;
    }
    if (settingsResult.aiSettings.deepseekTemperature !== undefined) {
      aiSettings.deepseekTemperature = settingsResult.aiSettings.deepseekTemperature;
    }
    if (settingsResult.aiSettings.chatgptTemperature !== undefined) {
      aiSettings.chatgptTemperature = settingsResult.aiSettings.chatgptTemperature;
    }
  }

  const messagesContainer = document.getElementById("chat-messages");
  messagesContainer.innerHTML = "";

  if (aiSettings.model === "deepseek") {
    showDeepSeekOptions();
  }

  chatHistory.forEach(msg => {
    if (msg.role === "user") {
      addMessage("user", msg.content);
    } else if (msg.role === "assistant") {
      addMessage("assistant", msg.content);
    }
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function deleteChat(chatId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatHistory'], (result) => {
      const chats = (result.chatHistory || []).filter(c => c.id !== chatId);
      chrome.storage.local.set({ chatHistory: chats }, () => {
        if (currentChatId === chatId) {
          currentChatId = null;
        }
        resolve();
      });
    });
  });
}

function setupPromptMenuHandlers() {
  const promptMenuBtn = document.getElementById("prompt-menu-btn");
  const promptMenu = document.getElementById("prompt-menu");
  const chatInput = document.getElementById("chat-input");

  promptMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = promptMenu.style.display !== "none";
    promptMenu.style.display = isVisible ? "none" : "block";
    
    if (!isVisible) {
      loadQuickPrompts();
    }
  });

  document.addEventListener("click", (e) => {
    if (!promptMenu.contains(e.target) && e.target !== promptMenuBtn) {
      promptMenu.style.display = "none";
    }
  });

  chatInput.addEventListener("focus", () => {
    promptMenu.style.display = "none";
  });
}

async function loadQuickPrompts() {
  if (typeof PromptTemplates === 'undefined') {
    setTimeout(() => loadQuickPrompts(), 100);
    return;
  }

  await renderQuickPrompts();
}

async function renderQuickPrompts() {
  if (typeof PromptTemplates === 'undefined') {
    console.error('PromptTemplates не загружен');
    return;
  }

  const quickPrompts = await PromptTemplates.getQuickPrompts();
  const menuItems = document.getElementById("prompt-menu-items");

  if (!menuItems) {
    console.error('Элемент prompt-menu-items не найден');
    return;
  }

  if (!quickPrompts || quickPrompts.length === 0) {
    menuItems.innerHTML = `<div class="prompt-menu-empty">${i18n.t('chat.noPrompts')}</div>`;
    return;
  }

  const validPrompts = quickPrompts.filter(template => 
    template && 
    template.id && 
    template.name && 
    template.shortName &&
    template.prompt
  );

  if (validPrompts.length === 0) {
    menuItems.innerHTML = `<div class="prompt-menu-empty">${i18n.t('chat.noPrompts')}</div>`;
    return;
  }

  menuItems.innerHTML = validPrompts.map(template => `
    <div class="prompt-menu-item" data-template-id="${template.id}">
      <span class="prompt-menu-item-name">${escapeHtml(template.shortName || '')}</span>
      <span class="prompt-menu-item-hint">${escapeHtml(template.name || '')}</span>
    </div>
  `).join('');

  menuItems.querySelectorAll('.prompt-menu-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      const templateId = item.dataset.templateId;
      if (templateId) {
        await applyQuickPrompt(templateId);
        const promptMenu = document.getElementById("prompt-menu");
        if (promptMenu) {
          promptMenu.style.display = "none";
        }
      }
    });
  });
}

async function applyQuickPrompt(templateId) {
  const template = await PromptTemplates.getTemplate(templateId);
  if (!template || !template.prompt) {
    console.error('Шаблон не найден или не имеет промпта:', templateId);
    return;
  }

  const chatInput = document.getElementById("chat-input");
  if (!chatInput) {
    console.error('Поле ввода не найдено');
    return;
  }

  const currentText = chatInput.value.trim();
  const selectionStart = chatInput.selectionStart;
  const selectionEnd = chatInput.selectionEnd;
  
  const selectedText = selectionStart !== selectionEnd 
    ? currentText.substring(selectionStart, selectionEnd)
    : currentText;

  if (selectedText && selectedText.length > 0) {
    let promptText;
    try {
      promptText = PromptTemplates.applyTemplate(template, selectedText);
    } catch (error) {
      console.error('Ошибка применения шаблона:', error);
      return;
    }
    
    if (selectionStart !== selectionEnd) {
      const beforeText = currentText.substring(0, selectionStart);
      const afterText = currentText.substring(selectionEnd);
      chatInput.value = beforeText + promptText + afterText;
      chatInput.setSelectionRange(beforeText.length + promptText.length, beforeText.length + promptText.length);
    } else {
      chatInput.value = promptText;
      chatInput.setSelectionRange(promptText.length, promptText.length);
    }
  } else {
    const promptText = template.prompt.endsWith(':') 
      ? template.prompt + ' ' 
      : template.prompt + '\n\n';
    chatInput.value = promptText;
    chatInput.setSelectionRange(promptText.length, promptText.length);
  }

  chatInput.focus();
  chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.initChat = initChat;