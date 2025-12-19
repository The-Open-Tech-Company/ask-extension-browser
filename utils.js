(function() {
  'use strict';
  
  if (typeof window !== 'undefined' && window.utils && 
      window.utils.migrateAISettings && window.utils.escapeHtml && window.utils.markdownToHtml) {
    return;
  }
  function migrateAISettings(aiSettings) {
    if (!aiSettings || typeof aiSettings !== 'object') {
      return aiSettings;
    }
    
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
  }

  // Экранирование HTML для предотвращения XSS
  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  function markdownToHtml(text) {
    if (!text) return "";
    
    let html = escapeHtml(text);
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
    
    // Ссылки (безопасная обработка URL)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const escapedText = escapeHtml(text);
      const escapedUrl = escapeHtml(url);
      // Простая валидация URL
      if (escapedUrl.match(/^(https?|ftp):\/\//i)) {
        return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedText}</a>`;
      }
      return escapedText;
    });
    
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

  // Экспорт для использования в других файлах
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { migrateAISettings, escapeHtml, markdownToHtml };
  } else if (typeof window !== 'undefined') {
    // Создаем объект utils только если его нет
    if (!window.utils) {
      window.utils = {};
    }
    window.utils.migrateAISettings = migrateAISettings;
    window.utils.escapeHtml = escapeHtml;
    window.utils.markdownToHtml = markdownToHtml;
  }
})();

