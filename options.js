let currentLanguage = 'ru';

document.addEventListener("DOMContentLoaded", async () => {
  await i18n.init();
  currentLanguage = i18n.getCurrentLang();
  updateLanguage();
  initTabs();
  loadSettings();
  loadAboutInfo();
  setupEventListeners();
  initTemplates();
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

    if (settings.apiKey && !settings.deepseekApiKey && !settings.chatgptApiKey) {
      if (settings.model === "deepseek") {
        settings.deepseekApiKey = settings.apiKey;
      } else {
        settings.chatgptApiKey = settings.apiKey;
      }
    }
    if (settings.temperature && !settings.deepseekTemperature && !settings.chatgptTemperature) {
      settings.deepseekTemperature = settings.temperature;
      settings.chatgptTemperature = settings.temperature;
    }

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
}

function setupEventListeners() {
  document.getElementById("save-translate").addEventListener("click", saveTranslateSettings);
  document.getElementById("save-ai").addEventListener("click", saveAISettings);
  document.getElementById("add-template-btn").addEventListener("click", () => {
    showTemplateForm(null);
  });
  document.getElementById("save-template").addEventListener("click", saveTemplate);
  document.getElementById("cancel-template").addEventListener("click", hideTemplateForm);
  
  document.getElementById("language-selector").addEventListener("change", (e) => {
    const lang = e.target.value;
    i18n.setLanguage(lang);
    currentLanguage = lang;
    updateLanguage();
    loadTemplates();
  });
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
