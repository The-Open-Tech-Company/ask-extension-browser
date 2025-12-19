(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const text = urlParams.get('text') || '';
  const settingsJson = urlParams.get('settings') || '{}';
  
  let aiSettings = {};
  try {
    aiSettings = JSON.parse(decodeURIComponent(settingsJson));
  } catch (e) {
    console.error('Ошибка парсинга настроек:', e);
    aiSettings = {
      model: "deepseek",
      apiKey: "",
      temperature: 0.7,
      systemPrompt: "",
      developerMode: false
    };
  }

  function initializeChat() {
    if (window.initChat) {
      window.initChat(text, aiSettings);
    } else {
      setTimeout(initializeChat, 100);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener("load", initializeChat);
  } else {
    initializeChat();
  }
})();