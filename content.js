let searchResults = [];

const searchHighlightStyle = `
  .search-highlight {
    background-color: yellow !important;
    color: black !important;
    padding: 2px 0 !important;
  }
  .search-highlight.current {
    background-color: #ffeb3b !important;
    box-shadow: 0 0 5px rgba(255, 235, 59, 0.8) !important;
  }
`;

if (!document.getElementById('search-highlight-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'search-highlight-styles';
  styleSheet.textContent = searchHighlightStyle;
  document.head.appendChild(styleSheet);
}

function getBaseForm(word) {
  if (!word || word.length < 3) return word.toLowerCase();
  
  const lowerWord = word.toLowerCase();
  const nounEndings = [
    'ами', 'ами', 'ах', 'ей', 'ем', 'ею', 'ие', 'ий', 'им', 'ими', 'их',
    'ой', 'ом', 'ому', 'ою', 'ую', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие',
    'ый', 'ий', 'ой', 'ов', 'ев', 'ин', 'ын', 'ых', 'ам', 'ах', 'ами',
    'ой', 'ей', 'ом', 'ем', 'ую', 'юю', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие',
    'ый', 'ий', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие',
    'ская', 'ского', 'ской', 'скому', 'ским', 'ском', 'ские', 'ских', 'скими',
    'ская', 'ское', 'ского', 'ской', 'скому', 'ским', 'ском',
    'ский', 'ского', 'скому', 'ским', 'ском'
  ];
  
  const sortedEndings = [...new Set(nounEndings)].sort((a, b) => b.length - a.length);
  
  for (const ending of sortedEndings) {
    if (lowerWord.endsWith(ending) && lowerWord.length > ending.length + 2) {
      const base = lowerWord.slice(0, -ending.length);
      if (base.length >= 3) {
        return base;
      }
    }
  }
  
  return lowerWord;
}

function wordsMatch(word1, word2) {
  const base1 = getBaseForm(word1);
  const base2 = getBaseForm(word2);
  
  if (base1 === base2) return true;
  
  const normalizeBase = (base) => {
    return base
      .replace(/овск/g, 'овск')
      .replace(/овк/g, 'овк')
      .replace(/ск/g, 'ск')
      .replace(/цк/g, 'цк')
      .replace(/чк/g, 'чк');
  };
  
  const norm1 = normalizeBase(base1);
  const norm2 = normalizeBase(base2);
  
  if (norm1 === norm2) return true;
  
  const minLen = Math.min(base1.length, base2.length);
  if (minLen >= 4) {
    const shorter = base1.length < base2.length ? base1 : base2;
    const longer = base1.length >= base2.length ? base1 : base2;
    const prefixLen = Math.min(4, shorter.length);
    if (longer.substring(0, prefixLen) === shorter.substring(0, prefixLen)) {
      if (shorter.length >= longer.length - 3) {
        return true;
      }
    }
  }
  
  return false;
}

function isLetter(char) {
  return /[а-яёa-z]/i.test(char);
}

function findMorphologyMatches(text, searchWord) {
  const matches = [];
  const lowerText = text.toLowerCase();
  const lowerSearch = searchWord.toLowerCase();
  const wordRegex = /[а-яё]+/gi;
  const allWords = [];
  let match;
  
  while ((match = wordRegex.exec(text)) !== null) {
    allWords.push({
      word: match[0],
      index: match.index,
      lowerWord: match[0].toLowerCase()
    });
  }
  
  const exactMatches = new Set();
  for (const wordInfo of allWords) {
    if (wordInfo.lowerWord === lowerSearch) {
      const before = text[wordInfo.index - 1] || ' ';
      const after = text[wordInfo.index + searchWord.length] || ' ';
      if (!isLetter(before) && !isLetter(after)) {
        exactMatches.add(wordInfo.index);
        matches.push({ index: wordInfo.index, length: searchWord.length });
      }
    }
  }
  
  for (const wordInfo of allWords) {
    if (exactMatches.has(wordInfo.index)) continue;
    
    if (wordsMatch(wordInfo.word, searchWord)) {
      const before = text[wordInfo.index - 1] || ' ';
      const after = text[wordInfo.index + wordInfo.word.length] || ' ';
      if (!isLetter(before) && !isLetter(after)) {
        const overlaps = matches.some(m => 
          (wordInfo.index >= m.index && wordInfo.index < m.index + m.length) ||
          (m.index >= wordInfo.index && m.index < wordInfo.index + wordInfo.word.length)
        );
        if (!overlaps) {
          matches.push({ index: wordInfo.index, length: wordInfo.word.length });
        }
      }
    }
  }
  
  return matches.sort((a, b) => a.index - b.index);
}

function searchOnPage(searchText, exactMatch, useMorphology, useRegex) {
  clearHighlights();
  
  if (!searchText || !searchText.trim()) {
    return { success: true, count: 0 };
  }
  
  if (useRegex) {
    try {
      const regex = new RegExp(searchText, 'g');
      return searchWithRegex(regex);
    } catch (e) {
      return { success: false, error: 'Ошибка регулярного выражения: ' + e.message };
    }
  }
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const style = window.getComputedStyle(node.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );
  
  const results = [];
  let node;
  const lowerSearch = searchText.toLowerCase();
  
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    if (!text || text.trim().length === 0) continue;
    
    if (exactMatch) {
      const lowerText = text.toLowerCase();
      let startIndex = 0;
      
      while ((startIndex = lowerText.indexOf(lowerSearch, startIndex)) !== -1) {
        results.push({
          node: node,
          index: startIndex,
          length: searchText.length,
          text: text
        });
        startIndex += 1;
      }
    } else {
      if (useMorphology) {
        const searchWords = searchText.match(/[а-яё]+/gi) || [];
        
        if (searchWords.length === 0) {
          const lowerText = text.toLowerCase();
          let startIndex = 0;
          
          while ((startIndex = lowerText.indexOf(lowerSearch, startIndex)) !== -1) {
            results.push({
              node: node,
              index: startIndex,
              length: searchText.length,
              text: text
            });
            startIndex += 1;
          }
        } else {
          for (const searchWord of searchWords) {
            const matches = findMorphologyMatches(text, searchWord);
            for (const match of matches) {
              results.push({
                node: node,
                index: match.index,
                length: match.length,
                text: text
              });
            }
          }
        }
      } else {
        const lowerText = text.toLowerCase();
        let startIndex = 0;
        
        while ((startIndex = lowerText.indexOf(lowerSearch, startIndex)) !== -1) {
          results.push({
            node: node,
            index: startIndex,
            length: searchText.length,
            text: text
          });
          startIndex += 1;
        }
      }
    }
  }
  
  highlightResults(results, searchText, exactMatch);
  searchResults = results;
  return { success: true, count: results.length };
}

function searchWithRegex(regex) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const style = window.getComputedStyle(node.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );
  
  const results = [];
  let node;
  
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    if (!text || text.trim().length === 0) continue;
    
    let match;
    regex.lastIndex = 0; // Сброс индекса для каждого узла
    
    while ((match = regex.exec(text)) !== null) {
      results.push({
        node: node,
        index: match.index,
        length: match[0].length,
        text: text
      });
      
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }
  
  highlightResults(results, '', false);
  searchResults = results;
  return { success: true, count: results.length };
}

function highlightResults(results, searchText, exactMatch) {
  if (results.length === 0) return;
  
  const nodeMap = new Map();
  results.forEach((result, index) => {
    if (!nodeMap.has(result.node)) {
      nodeMap.set(result.node, []);
    }
    nodeMap.get(result.node).push({ ...result, originalIndex: index });
  });
  
  let globalIndex = 0;
  nodeMap.forEach((nodeResults, node) => {
    if (!node.parentNode) return;
    
    const text = node.textContent;
    nodeResults.sort((a, b) => b.index - a.index);
    
    const parent = node.parentNode;
    const fragment = document.createDocumentFragment();
    const parts = [];
    let lastIndex = text.length;
    
    for (const result of nodeResults) {
      if (result.index + result.length <= lastIndex) {
        if (lastIndex < text.length) {
          parts.unshift({
            type: 'text',
            content: text.substring(result.index + result.length, lastIndex)
          });
        }
        
        parts.unshift({
          type: 'highlight',
          content: text.substring(result.index, result.index + result.length),
          index: globalIndex++
        });
        
        lastIndex = result.index;
      }
    }
    
    if (lastIndex > 0) {
      parts.unshift({
        type: 'text',
        content: text.substring(0, lastIndex)
      });
    }
    
    for (const part of parts) {
      if (part.type === 'text') {
        fragment.appendChild(document.createTextNode(part.content));
      } else {
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'search-highlight';
        highlightSpan.setAttribute('data-match-index', part.index);
        highlightSpan.textContent = part.content;
        fragment.appendChild(highlightSpan);
      }
    }
    
    parent.replaceChild(fragment, node);
  });
}

function navigateToMatch(index) {
  document.querySelectorAll('.search-highlight.current').forEach(el => {
    el.classList.remove('current');
  });
  
  if (index >= 0 && index < searchResults.length) {
    const highlight = document.querySelector(`.search-highlight[data-match-index="${index}"]`);
    if (highlight) {
      highlight.classList.add('current');
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function clearHighlights() {
  document.querySelectorAll('.search-highlight').forEach(highlight => {
    const parent = highlight.parentNode;
    const text = highlight.textContent;
    const textNode = document.createTextNode(text);
    parent.replaceChild(textNode, highlight);
    parent.normalize();
  });
  
  searchResults = [];
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'getSelection') {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    sendResponse({ text: text });
    return false;
  }
  
  if (request.action === 'showNotes') {
    showNotesOnPage(request.notes);
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'search' || request.action === 'navigate' || request.action === 'clear') {
    chrome.storage.sync.get(["extensionEnabled"], (result) => {
      try {
        const isEnabled = result.extensionEnabled !== false;
        
        if (!isEnabled) {
          sendResponse({ success: false, error: "Расширение выключено" });
          return;
        }
        
        if (request.action === 'search') {
          const searchResult = searchOnPage(request.text, request.exactMatch, request.useMorphology, request.useRegex || false);
          sendResponse(searchResult);
        } else if (request.action === 'navigate') {
          navigateToMatch(request.index);
          sendResponse({ success: true });
        } else if (request.action === 'clear') {
          clearHighlights();
          sendResponse({ success: true });
        }
      } catch (error) {
        try {
          sendResponse({ success: false, error: error.message || "Неизвестная ошибка" });
        } catch (e) {
          console.error('Ошибка при отправке ответа:', e);
        }
      }
    });
    return true;
  } else {
    chrome.storage.sync.get(["extensionEnabled"], (result) => {
      const isEnabled = result.extensionEnabled !== false;
      
      if (!isEnabled) {
        sendResponse({ success: false, error: "Расширение выключено" });
        return;
      }
      
      try {
        if (request.action === "translate") {
          showTranslatePopup(request.text || "");
          sendResponse({ success: true });
        } else if (request.action === "explain") {
          openAIChat(request.text || "");
          sendResponse({ success: true });
        } else if (request.action === "quickExplain") {
          showQuickExplainPopup(request.text || "");
          sendResponse({ success: true });
        } else if (request.action === "extractFacts") {
          if (!request.text || !request.text.trim()) {
            sendResponse({ success: false, error: 'Текст для извлечения фактов не найден' });
            return;
          }
          showExtractFactsPopup(request.text || "").catch(() => {});
          sendResponse({ success: true });
        } else if (request.action === "generateQuestions") {
          showGenerateQuestionsPopup(request.text || "").catch(() => {});
          sendResponse({ success: true });
        } else {
          sendResponse({ success: true });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }
});

async function applyEpilepsyModeToElement(element) {
  const accessibilityResult = await new Promise((resolve) => {
    chrome.storage.sync.get(['accessibilitySettings'], resolve);
  });
  const accessibilitySettings = accessibilityResult.accessibilitySettings || {
    epilepsyMode: false
  };
  
  if (accessibilitySettings.epilepsyMode) {
    element.classList.add('epilepsy-mode');
  }
}

async function showTranslatePopup(text) {
  const existingPopup = document.getElementById("browser-helper-translate-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const langResult = await new Promise((resolve) => {
    chrome.storage.sync.get(['language'], resolve);
  });
  const lang = langResult.language || 'ru';

  const popup = document.createElement("div");
  popup.id = "browser-helper-translate-popup";
  popup.innerHTML = `
    <div class="browser-helper-popup-content">
      <div class="browser-helper-loading">${lang === 'en' ? 'Translating...' : 'Перевод...'}</div>
    </div>
  `;

  await applyEpilepsyModeToElement(popup);
  document.body.appendChild(popup);

  positionPopup(popup, rect);

  translateText(text).then(translation => {
    popup.querySelector(".browser-helper-popup-content").innerHTML = `
      <div class="browser-helper-translation-result">
        <div class="browser-helper-original">${escapeHtml(text)}</div>
        <div class="browser-helper-translated">${escapeHtml(translation.text)}</div>
        <div class="browser-helper-lang-info">${translation.from} → ${translation.to}</div>
      </div>
      <div class="browser-helper-popup-actions">
        <button class="browser-helper-copy-btn" data-copy="translation" title="${lang === 'en' ? 'Copy translation' : 'Копировать перевод'}">
          📋 ${lang === 'en' ? 'Translation' : 'Перевод'}
        </button>
        <button class="browser-helper-copy-btn" data-copy="original" title="${lang === 'en' ? 'Copy original' : 'Копировать оригинал'}">
          📋 ${lang === 'en' ? 'Original' : 'Оригинал'}
        </button>
      </div>
      <button class="browser-helper-close">×</button>
    `;

    const translationText = translation.text;
    const originalText = text;

    popup.querySelectorAll(".browser-helper-copy-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const copyType = btn.dataset.copy;
        const textToCopy = copyType === "translation" ? translationText : originalText;
        
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
          btn.style.background = "#4caf50";
          setTimeout(() => {
            btn.textContent = copyType === "translation" 
              ? `📋 ${lang === 'en' ? 'Translation' : 'Перевод'}`
              : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
            btn.style.background = "";
          }, 2000);
        } catch (error) {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
            btn.style.background = "#4caf50";
            setTimeout(() => {
              btn.textContent = copyType === "translation" 
                ? `📋 ${lang === 'en' ? 'Translation' : 'Перевод'}`
                : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
              btn.style.background = "";
            }, 2000);
          } catch (err) {
            alert(lang === 'en' ? 'Failed to copy text' : 'Не удалось скопировать текст');
          }
          document.body.removeChild(textArea);
        }
      });
    });

    popup.querySelector(".browser-helper-close").addEventListener("click", () => {
      popup.remove();
    });

    setTimeout(() => {
      document.addEventListener("click", function closeHandler(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener("click", closeHandler);
        }
      });
    }, 100);
  }).catch(async (error) => {
    const langResult = await new Promise((resolve) => {
      chrome.storage.sync.get(['language'], resolve);
    });
    const lang = langResult.language || 'ru';
    
    popup.querySelector(".browser-helper-popup-content").innerHTML = `
      <div class="browser-helper-error">${lang === 'en' ? 'Translation error:' : 'Ошибка перевода:'} ${escapeHtml(error.message)}</div>
      <button class="browser-helper-close">×</button>
    `;
    popup.querySelector(".browser-helper-close").addEventListener("click", () => {
      popup.remove();
    });
  });
}

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

function openAIChat(text) {
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
      `?text=${encodeURIComponent(text || "")}&settings=${encodeURIComponent(JSON.stringify(aiSettings))}`;
    
    try {
      chrome.runtime.sendMessage({
        action: "openTab",
        url: chatUrl
      }).catch(() => {});
    } catch (e) {}
  });
}

function positionPopup(popup, rect) {
  const popupRect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 10;

  if (left + popupRect.width > viewportWidth + window.scrollX) {
    left = viewportWidth + window.scrollX - popupRect.width - 10;
  }
  if (top + popupRect.height > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - popupRect.height - 10;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function positionPopupDown(popup, rect) {
  const popupRect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 10;

  if (left + popupRect.width > viewportWidth + window.scrollX) {
    left = viewportWidth + window.scrollX - popupRect.width - 10;
  }
  if (top + popupRect.height > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - popupRect.height - 10;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

async function translateText(text) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["translateSettings"], (result) => {
      const settings = result.translateSettings || {
        defaultFrom: "auto",
        defaultTo: "ru",
        russianTo: "en"
      };

      detectLanguage(text).then(lang => {
        let fromLang = "auto";
        let toLang = settings.defaultTo;

        if (lang === "ru") {
          toLang = settings.russianTo;
        }

        translateWithBackground(text, fromLang, toLang)
          .then(translation => {
            resolve({
              text: translation,
              from: lang === "ru" ? "ru" : lang,
              to: toLang
            });
          })
          .catch(reject);
      }).catch(reject);
    });
  });
}

async function detectLanguage(text) {
  if (!text || text.trim().length === 0) {
    return "en";
  }
  
  const cyrillicPattern = /[а-яё]/i;
  const latinPattern = /[a-z]/i;
  
  const cyrillicCount = (text.match(/[а-яё]/gi) || []).length;
  const latinCount = (text.match(/[a-z]/gi) || []).length;
  
  // Если больше кириллицы, то русский
  if (cyrillicCount > latinCount && cyrillicPattern.test(text)) {
    return "ru";
  }
  
  // Если больше латиницы, то английский
  if (latinCount > cyrillicCount && latinPattern.test(text)) {
    return "en";
  }
  
  // По умолчанию проверяем наличие кириллицы
  if (cyrillicPattern.test(text)) {
    return "ru";
  }
  
  return "en";
}

async function translateWithBackground(text, from, to) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({
        action: "translateTextBackground",
        text,
        from,
        to
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.success) {
          reject(new Error(response?.error || "Не удалось получить перевод"));
          return;
        }
        resolve(response.translation);
      });
    } catch (error) {
      reject(error);
    }
  });
}


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

let markdownToHtml;
if (typeof window !== 'undefined' && window.utils && window.utils.markdownToHtml) {
  markdownToHtml = window.utils.markdownToHtml;
} else {
  markdownToHtml = function(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    let html = div.innerHTML;
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const escapedText = escapeHtml(text);
      const escapedUrl = escapeHtml(url);
      if (escapedUrl.match(/^(https?|ftp):\/\//i)) {
        return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedText}</a>`;
      }
      return escapedText;
    });
    html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^\+ (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, function(match) {
      return '<ul>' + match + '</ul>';
    });
    html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');
    html = html.split('\n\n').map(para => {
      if (para.trim() && !para.match(/^<(h[1-6]|ul|ol|pre|blockquote)/)) {
        return '<p>' + para.trim() + '</p>';
      }
      return para;
    }).join('\n');
    return html;
  };
}

async function showQuickExplainPopup(text) {
  const existingPopup = document.getElementById("browser-helper-quick-explain-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const langResult = await new Promise((resolve) => {
    chrome.storage.sync.get(['language'], resolve);
  });
  const lang = langResult.language || 'ru';

  const popup = document.createElement("div");
  popup.id = "browser-helper-quick-explain-popup";
  popup.className = "browser-helper-popup";
  popup.innerHTML = `
    <div class="browser-helper-popup-content">
      <div class="browser-helper-loading">${lang === 'en' ? 'Explaining...' : 'Объясняю...'}</div>
    </div>
  `;

  await applyEpilepsyModeToElement(popup);
  document.body.appendChild(popup);
  positionPopup(popup, rect);

  try {
    const aiSettingsResult = await new Promise((resolve) => {
      chrome.storage.sync.get(["aiSettings"], resolve);
    });
    
    const aiSettings = aiSettingsResult.aiSettings || {
      model: "deepseek",
      deepseekApiKey: "",
      chatgptApiKey: "",
      deepseekTemperature: 0.7,
      chatgptTemperature: 0.7,
      systemPrompt: ""
    };

    migrateAISettings(aiSettings);

    const apiKey = aiSettings.model === "deepseek" 
      ? (aiSettings.deepseekApiKey || "")
      : (aiSettings.chatgptApiKey || "");
    const temperature = aiSettings.model === "deepseek"
      ? (aiSettings.deepseekTemperature || 0.7)
      : (aiSettings.chatgptTemperature || 0.7);

    if (!apiKey || apiKey.trim() === "") {
      popup.querySelector(".browser-helper-popup-content").innerHTML = `
        <div class="browser-helper-error">${lang === 'en' ? 'Features unavailable. Check API key in extension settings' : 'Функции недоступны. Проверьте API ключ в настройках расширения'}</div>
        <button class="browser-helper-close">×</button>
      `;
      popup.querySelector(".browser-helper-close").addEventListener("click", () => {
        popup.remove();
      });
      return;
    }

    const explainPrompt = lang === 'en' 
      ? `Explain this text in simple terms: "${text}"`
      : `Объясни этот текст простыми словами: "${text}"`;

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "callAIAPI",
        model: aiSettings.model,
        apiKey: apiKey,
        temperature: temperature,
        systemPrompt: aiSettings.systemPrompt || "",
        messages: {
          messages: [{ role: "user", content: explainPrompt }],
          chatgptModel: aiSettings.chatgptModel || "gpt-3.5-turbo"
        }
      }, resolve);
    });

    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }

    const explanation = response.content;

    popup.querySelector(".browser-helper-popup-content").innerHTML = `
      <div class="browser-helper-explanation-result">
        <div class="browser-helper-explanation-title">${lang === 'en' ? 'Explanation' : 'Объяснение'}</div>
        <div class="browser-helper-original">${escapeHtml(text)}</div>
        <div class="browser-helper-explanation">${markdownToHtml(explanation)}</div>
      </div>
      <div class="browser-helper-popup-actions">
        <button class="browser-helper-copy-btn" data-copy="explanation" title="${lang === 'en' ? 'Copy explanation' : 'Копировать объяснение'}">
          📋 ${lang === 'en' ? 'Explanation' : 'Объяснение'}
        </button>
        <button class="browser-helper-copy-btn" data-copy="original" title="${lang === 'en' ? 'Copy original' : 'Копировать оригинал'}">
          📋 ${lang === 'en' ? 'Original' : 'Оригинал'}
        </button>
      </div>
      <button class="browser-helper-close">×</button>
    `;

    const explanationText = explanation;
    const originalText = text;

    popup.querySelectorAll(".browser-helper-copy-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const copyType = btn.dataset.copy;
        const textToCopy = copyType === "explanation" ? explanationText : originalText;
        
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
          btn.style.background = "#4caf50";
          setTimeout(() => {
            btn.textContent = copyType === "explanation" 
              ? `📋 ${lang === 'en' ? 'Explanation' : 'Объяснение'}`
              : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
            btn.style.background = "";
          }, 2000);
        } catch (error) {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
            btn.style.background = "#4caf50";
            setTimeout(() => {
              btn.textContent = copyType === "explanation" 
                ? `📋 ${lang === 'en' ? 'Explanation' : 'Объяснение'}`
                : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
              btn.style.background = "";
            }, 2000);
          } catch (err) {
            alert(lang === 'en' ? 'Failed to copy text' : 'Не удалось скопировать текст');
          }
          document.body.removeChild(textArea);
        }
      });
    });

    popup.querySelector(".browser-helper-close").addEventListener("click", () => {
      popup.remove();
    });

    setTimeout(() => {
      document.addEventListener("click", function closeHandler(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener("click", closeHandler);
        }
      });
    }, 100);
  } catch (error) {
    popup.querySelector(".browser-helper-popup-content").innerHTML = `
      <div class="browser-helper-error">${lang === 'en' ? 'Explanation error:' : 'Ошибка объяснения:'} ${escapeHtml(error.message)}</div>
      <button class="browser-helper-close">×</button>
    `;
    popup.querySelector(".browser-helper-close").addEventListener("click", () => {
      popup.remove();
    });
  }
}

async function showExtractFactsPopup(text) {
  if (!text || !text.trim()) {
    return;
  }

  const existingPopup = document.getElementById("browser-helper-extract-facts-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  let rect = { left: window.innerWidth / 2, top: window.innerHeight / 2, bottom: window.innerHeight / 2 };
  try {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range && !range.collapsed) {
        rect = range.getBoundingClientRect();
      }
    }
  } catch (e) {}

  const langResult = await new Promise((resolve) => {
    chrome.storage.sync.get(['language'], resolve);
  });
  const lang = langResult.language || 'ru';

  const popup = document.createElement("div");
  popup.id = "browser-helper-extract-facts-popup";
  popup.className = "browser-helper-popup";
  popup.innerHTML = `
    <div class="browser-helper-popup-content">
      <div class="browser-helper-loading">${lang === 'en' ? 'Extracting facts...' : 'Извлекаю факты...'}</div>
    </div>
  `;

  await applyEpilepsyModeToElement(popup);
  document.body.appendChild(popup);
  positionPopupDown(popup, rect);

  try {
    const aiSettingsResult = await new Promise((resolve) => {
      chrome.storage.sync.get(["aiSettings"], resolve);
    });
    
    const aiSettings = aiSettingsResult.aiSettings || {
      model: "deepseek",
      deepseekApiKey: "",
      chatgptApiKey: "",
      deepseekTemperature: 0.7,
      chatgptTemperature: 0.7,
      systemPrompt: ""
    };

    migrateAISettings(aiSettings);

    const apiKey = aiSettings.model === "deepseek" 
      ? (aiSettings.deepseekApiKey || "")
      : (aiSettings.chatgptApiKey || "");
    const temperature = aiSettings.model === "deepseek"
      ? (aiSettings.deepseekTemperature || 0.7)
      : (aiSettings.chatgptTemperature || 0.7);

    if (!apiKey || apiKey.trim() === "") {
      popup.querySelector(".browser-helper-popup-content").innerHTML = `
        <div class="browser-helper-error">${lang === 'en' ? 'Features unavailable. Check API key in extension settings' : 'Функции недоступны. Проверьте API ключ в настройках расширения'}</div>
        <button class="browser-helper-close">×</button>
      `;
      popup.querySelector(".browser-helper-close").addEventListener("click", () => {
        popup.remove();
      });
      return;
    }

    const extractFactsPrompt = lang === 'en' 
      ? `Extract key facts from the following text. Present them as a structured list, where each fact is a separate item. Facts should be brief, accurate and informative: "${text}"`
      : `Извлеки ключевые факты из следующего текста. Представь их в виде структурированного списка, где каждый факт - это отдельный пункт. Факты должны быть краткими, точными и информативными: "${text}"`;

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Таймаут запроса к ИИ (60 секунд)'));
      }, 60000);

      try {
        chrome.runtime.sendMessage({
          action: "callAIAPI",
          model: aiSettings.model,
          apiKey: apiKey,
          temperature: temperature,
          systemPrompt: aiSettings.systemPrompt || "",
          messages: {
            messages: [{ role: "user", content: extractFactsPrompt }],
            chatgptModel: aiSettings.chatgptModel || "gpt-3.5-turbo"
          }
        }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            console.error('Ошибка chrome.runtime:', chrome.runtime.lastError.message || chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            console.error('Пустой ответ от background script');
            reject(new Error('Пустой ответ от background script'));
            return;
          }
          console.log('Получен ответ от ИИ:', response);
          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error('Ошибка при отправке сообщения:', error);
        reject(error);
      }
    });

    if (!response || !response.success) {
      throw new Error(response?.error || "Unknown error");
    }

    const facts = response.content;
    
    const existingPopupCheck = document.getElementById("browser-helper-extract-facts-popup");
    if (!existingPopupCheck) {
      throw new Error('Popup был удален');
    }
    
    const popupContent = popup.querySelector(".browser-helper-popup-content");
    if (!popupContent) {
      throw new Error('Элемент popup-content не найден');
    }

    popupContent.innerHTML = `
      <div class="browser-helper-explanation-result">
        <div class="browser-helper-explanation-title">${lang === 'en' ? 'Extracted Facts' : 'Извлеченные факты'}</div>
        <div class="browser-helper-original">${escapeHtml(text)}</div>
        <div class="browser-helper-explanation">${markdownToHtml(facts)}</div>
      </div>
      <div class="browser-helper-popup-actions">
        <button class="browser-helper-copy-btn" data-copy="facts" title="${lang === 'en' ? 'Copy facts' : 'Копировать факты'}">
          📋 ${lang === 'en' ? 'Facts' : 'Факты'}
        </button>
        <button class="browser-helper-copy-btn" data-copy="original" title="${lang === 'en' ? 'Copy original' : 'Копировать оригинал'}">
          📋 ${lang === 'en' ? 'Original' : 'Оригинал'}
        </button>
      </div>
      <button class="browser-helper-close">×</button>
    `;
    
    popup.style.display = 'block';
    popup.style.visibility = 'visible';
    popup.style.opacity = '1';
    
    const selection = window.getSelection();
    let newRect = rect;
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        if (range && !range.collapsed) {
          newRect = range.getBoundingClientRect();
        }
      } catch (e) {}
    }
    positionPopupDown(popup, newRect);

    const factsText = facts;
    const originalText = text;

    popup.querySelectorAll(".browser-helper-copy-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const copyType = btn.dataset.copy;
        const textToCopy = copyType === "facts" ? factsText : originalText;
        
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
          btn.style.background = "#4caf50";
          setTimeout(() => {
            btn.textContent = copyType === "facts" 
              ? `📋 ${lang === 'en' ? 'Facts' : 'Факты'}`
              : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
            btn.style.background = "";
          }, 2000);
        } catch (error) {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
            btn.style.background = "#4caf50";
            setTimeout(() => {
              btn.textContent = copyType === "facts" 
                ? `📋 ${lang === 'en' ? 'Facts' : 'Факты'}`
                : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
              btn.style.background = "";
            }, 2000);
          } catch (err) {
            alert(lang === 'en' ? 'Failed to copy text' : 'Не удалось скопировать текст');
          }
          document.body.removeChild(textArea);
        }
      });
    });

    const closeBtn = popup.querySelector(".browser-helper-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        popup.remove();
      });
    }

    setTimeout(() => {
      document.addEventListener("click", function closeHandler(e) {
        const popupCheck = document.getElementById("browser-helper-extract-facts-popup");
        if (popupCheck && !popupCheck.contains(e.target)) {
          popupCheck.remove();
          document.removeEventListener("click", closeHandler);
        }
      });
    }, 100);
  } catch (error) {
    const errorMessage = error.message || 'Неизвестная ошибка';
    
    const errorPopup = document.getElementById("browser-helper-extract-facts-popup");
    if (errorPopup) {
      const popupContent = errorPopup.querySelector(".browser-helper-popup-content");
      if (popupContent) {
        popupContent.innerHTML = `
          <div class="browser-helper-error">${lang === 'en' ? 'Error extracting facts:' : 'Ошибка извлечения фактов:'} ${escapeHtml(errorMessage)}</div>
          <button class="browser-helper-close">×</button>
        `;
        const closeBtn = errorPopup.querySelector(".browser-helper-close");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            errorPopup.remove();
          });
        }
      }
    }
  }
}

async function showGenerateQuestionsPopup(text) {
  if (!text || !text.trim()) {
    return;
  }

  const existingPopup = document.getElementById("browser-helper-generate-questions-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  let rect = { left: window.innerWidth / 2, top: window.innerHeight / 2, bottom: window.innerHeight / 2 };
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    try {
      const range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();
    } catch (e) {}
  }

  const langResult = await new Promise((resolve) => {
    chrome.storage.sync.get(['language'], resolve);
  });
  const lang = langResult.language || 'ru';

  const popup = document.createElement("div");
  popup.id = "browser-helper-generate-questions-popup";
  popup.className = "browser-helper-popup";
  popup.innerHTML = `
    <div class="browser-helper-popup-content">
      <div class="browser-helper-loading">${lang === 'en' ? 'Generating questions...' : 'Создаю вопросы...'}</div>
    </div>
  `;

  await applyEpilepsyModeToElement(popup);
  document.body.appendChild(popup);
  positionPopup(popup, rect);

  try {
    const aiSettingsResult = await new Promise((resolve) => {
      chrome.storage.sync.get(["aiSettings"], resolve);
    });
    
    const aiSettings = aiSettingsResult.aiSettings || {
      model: "deepseek",
      deepseekApiKey: "",
      chatgptApiKey: "",
      deepseekTemperature: 0.7,
      chatgptTemperature: 0.7,
      systemPrompt: ""
    };

    migrateAISettings(aiSettings);

    const apiKey = aiSettings.model === "deepseek" 
      ? (aiSettings.deepseekApiKey || "")
      : (aiSettings.chatgptApiKey || "");
    const temperature = aiSettings.model === "deepseek"
      ? (aiSettings.deepseekTemperature || 0.7)
      : (aiSettings.chatgptTemperature || 0.7);

    if (!apiKey || apiKey.trim() === "") {
      popup.querySelector(".browser-helper-popup-content").innerHTML = `
        <div class="browser-helper-error">${lang === 'en' ? 'Features unavailable. Check API key in extension settings' : 'Функции недоступны. Проверьте API ключ в настройках расширения'}</div>
        <button class="browser-helper-close">×</button>
      `;
      popup.querySelector(".browser-helper-close").addEventListener("click", () => {
        popup.remove();
      });
      return;
    }

    const generateQuestionsPrompt = lang === 'en' 
      ? `Create a list of questions based on the following text for better memorization and understanding of the material. Questions should be of different difficulty levels and cover the main ideas of the text: "${text}"`
      : `Создай список вопросов по следующему тексту для лучшего запоминания и понимания материала. Вопросы должны быть разного уровня сложности и охватывать основные идеи текста: "${text}"`;

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "callAIAPI",
        model: aiSettings.model,
        apiKey: apiKey,
        temperature: temperature,
        systemPrompt: aiSettings.systemPrompt || "",
        messages: {
          messages: [{ role: "user", content: generateQuestionsPrompt }],
          chatgptModel: aiSettings.chatgptModel || "gpt-3.5-turbo"
        }
      }, resolve);
    });

    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }

    const questions = response.content;

    popup.querySelector(".browser-helper-popup-content").innerHTML = `
      <div class="browser-helper-explanation-result">
        <div class="browser-helper-explanation-title">${lang === 'en' ? 'Questions for Memorization' : 'Вопросы для запоминания'}</div>
        <div class="browser-helper-original">${escapeHtml(text)}</div>
        <div class="browser-helper-explanation">${markdownToHtml(questions)}</div>
      </div>
      <div class="browser-helper-popup-actions">
        <button class="browser-helper-copy-btn" data-copy="questions" title="${lang === 'en' ? 'Copy questions' : 'Копировать вопросы'}">
          📋 ${lang === 'en' ? 'Copy' : 'Копировать'}
        </button>
        <button class="browser-helper-copy-btn" data-copy="original" title="${lang === 'en' ? 'Copy original' : 'Копировать оригинал'}">
          📋 ${lang === 'en' ? 'Original' : 'Оригинал'}
        </button>
      </div>
      <button class="browser-helper-close">×</button>
    `;

    const questionsText = questions;
    const originalText = text;

    popup.querySelectorAll(".browser-helper-copy-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const copyType = btn.dataset.copy;
        const textToCopy = copyType === "questions" ? questionsText : originalText;
        
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
          btn.style.background = "#4caf50";
          setTimeout(() => {
            btn.textContent = copyType === "questions" 
              ? `📋 ${lang === 'en' ? 'Copy' : 'Копировать'}`
              : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
            btn.style.background = "";
          }, 2000);
        } catch (error) {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            btn.textContent = `✓ ${lang === 'en' ? 'Copied' : 'Скопировано'}`;
            btn.style.background = "#4caf50";
            setTimeout(() => {
              btn.textContent = copyType === "questions" 
                ? `📋 ${lang === 'en' ? 'Copy' : 'Копировать'}`
                : `📋 ${lang === 'en' ? 'Original' : 'Оригинал'}`;
              btn.style.background = "";
            }, 2000);
          } catch (err) {
            alert(lang === 'en' ? 'Failed to copy text' : 'Не удалось скопировать текст');
          }
          document.body.removeChild(textArea);
        }
      });
    });

    popup.querySelector(".browser-helper-close").addEventListener("click", () => {
      popup.remove();
    });

    setTimeout(() => {
      document.addEventListener("click", function closeHandler(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener("click", closeHandler);
        }
      });
    }, 100);
  } catch (error) {
    popup.querySelector(".browser-helper-popup-content").innerHTML = `
      <div class="browser-helper-error">${lang === 'en' ? 'Error generating questions:' : 'Ошибка генерации вопросов:'} ${escapeHtml(error.message)}</div>
      <button class="browser-helper-close">×</button>
    `;
    popup.querySelector(".browser-helper-close").addEventListener("click", () => {
      popup.remove();
    });
  }
}

function showNotesOnPage(notes) {
  const existingNotes = document.querySelectorAll('.browser-helper-page-note');
  existingNotes.forEach(note => note.remove());

  if (!notes || notes.length === 0) return;

  notes.forEach((note, index) => {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'browser-helper-page-note';
    noteDiv.style.cssText = `
      position: fixed;
      top: ${20 + index * 60}px;
      right: 20px;
      max-width: 300px;
      padding: 12px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-size: 13px;
      color: #333;
      word-wrap: break-word;
    `;
    noteDiv.textContent = note.text;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 4px;
      right: 8px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      line-height: 1;
    `;
    closeBtn.onclick = () => noteDiv.remove();
    noteDiv.appendChild(closeBtn);
    
    document.body.appendChild(noteDiv);
  });
}

function loadNotesForPage() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    console.warn('Chrome storage API недоступен на этой странице');
    return;
  }
  
  function normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  const currentUrl = normalizeUrl(window.location.href);
  
  try {
    chrome.storage.local.get(['pageNotes'], (result) => {
      if (chrome.runtime.lastError) {
        return;
      }
      const allNotes = result.pageNotes || {};
      const notes = allNotes[currentUrl] || [];
      if (notes.length > 0) {
        showNotesOnPage(notes);
      }
    });
  } catch (error) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadNotesForPage, 1000);
  });
} else {
  setTimeout(loadNotesForPage, 1000);
}