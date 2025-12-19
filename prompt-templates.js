const PromptTemplates = {
  async getDefaultTemplates() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['language'], (result) => {
        const lang = result.language || 'ru';
        
        if (typeof i18n !== 'undefined') {
          resolve([
            {
              id: 'explain-simple',
              name: i18n.t('prompt.explainSimple'),
              shortName: i18n.t('prompt.explainSimpleShort'),
              prompt: i18n.t('prompt.explainSimpleText'),
              description: i18n.t('prompt.explainSimpleDesc')
            },
            {
              id: 'paraphrase',
              name: i18n.t('prompt.paraphrase'),
              shortName: i18n.t('prompt.paraphraseShort'),
              prompt: i18n.t('prompt.paraphraseText'),
              description: i18n.t('prompt.paraphraseDesc')
            },
            {
              id: 'find-errors',
              name: i18n.t('prompt.findErrors'),
              shortName: i18n.t('prompt.findErrorsShort'),
              prompt: i18n.t('prompt.findErrorsText'),
              description: i18n.t('prompt.findErrorsDesc')
            },
            {
              id: 'summarize',
              name: i18n.t('prompt.summarize'),
              shortName: i18n.t('prompt.summarizeShort'),
              prompt: i18n.t('prompt.summarizeText'),
              description: i18n.t('prompt.summarizeDesc')
            },
            {
              id: 'extract-facts',
              name: i18n.t('prompt.extractFacts'),
              shortName: i18n.t('prompt.extractFactsShort'),
              prompt: i18n.t('prompt.extractFactsText'),
              description: i18n.t('prompt.extractFactsDesc')
            },
            {
              id: 'generate-questions',
              name: i18n.t('prompt.generateQuestions'),
              shortName: i18n.t('prompt.generateQuestionsShort'),
              prompt: i18n.t('prompt.generateQuestionsText'),
              description: i18n.t('prompt.generateQuestionsDesc')
            }
          ]);
        } else {
          // Fallback если i18n не загружен
          const defaultTemplates = lang === 'en' ? [
            {
              id: 'explain-simple',
              name: 'Explain Simply',
              shortName: 'simplify',
              prompt: 'Explain this text in simple terms so that even a child can understand it:',
              description: 'Simplified explanation of complex text'
            },
            {
              id: 'paraphrase',
              name: 'Paraphrase',
              shortName: 'rephrase',
              prompt: 'Paraphrase this text while preserving the main meaning:',
              description: 'Rewording text with different words'
            },
            {
              id: 'find-errors',
              name: 'Find Errors',
              shortName: 'fix errors',
              prompt: 'Check this text for errors (spelling, grammar, style) and suggest corrections:',
              description: 'Finding and fixing errors in text'
            },
            {
              id: 'summarize',
              name: 'Summarize',
              shortName: 'summarize',
              prompt: 'Make a brief summary of this text, highlighting the main ideas:',
              description: 'Creating a brief summary of text'
            },
            {
              id: 'extract-facts',
              name: 'Extract Facts',
              shortName: 'facts',
              prompt: 'Extract key facts from the following text. Present them as a structured list, where each fact is a separate item. Facts should be brief, accurate and informative:',
              description: 'Automatic extraction of key facts from text'
            },
            {
              id: 'generate-questions',
              name: 'Generate Questions',
              shortName: 'questions',
              prompt: 'Create a list of questions based on the following text for better memorization and understanding of the material. Questions should be of different difficulty levels and cover the main ideas of the text:',
              description: 'Generating questions from text for better memorization'
            }
          ] : [
            {
              id: 'explain-simple',
              name: 'Объяснить простыми словами',
              shortName: 'упрости',
              prompt: 'Объясни этот текст простыми словами, чтобы его понял даже ребенок:',
              description: 'Упрощенное объяснение сложного текста'
            },
            {
              id: 'paraphrase',
              name: 'Перефразировать',
              shortName: 'перепеши по другому',
              prompt: 'Перефразируй этот текст, сохранив основной смысл:',
              description: 'Переформулирование текста другими словами'
            },
            {
              id: 'find-errors',
              name: 'Найти ошибки',
              shortName: 'исправь ошибки',
              prompt: 'Проверь этот текст на наличие ошибок (орфографических, грамматических, стилистических) и предложи исправления:',
              description: 'Поиск и исправление ошибок в тексте'
            },
            {
              id: 'summarize',
              name: 'Резюмировать',
              shortName: 'сократи',
              prompt: 'Сделай краткое резюме этого текста, выделив основные идеи:',
              description: 'Создание краткого содержания текста'
            },
            {
              id: 'extract-facts',
              name: 'Извлечь факты',
              shortName: 'факты',
              prompt: 'Извлеки ключевые факты из следующего текста. Представь их в виде структурированного списка, где каждый факт - это отдельный пункт. Факты должны быть краткими, точными и информативными:',
              description: 'Автоматическое выделение ключевых фактов из текста'
            },
            {
              id: 'generate-questions',
              name: 'Создать вопросы',
              shortName: 'вопросы',
              prompt: 'Создай список вопросов по следующему тексту для лучшего запоминания и понимания материала. Вопросы должны быть разного уровня сложности и охватывать основные идеи текста:',
              description: 'Генерация вопросов по тексту для лучшего запоминания'
            }
          ];
          resolve(defaultTemplates);
        }
      });
    });
  },

  defaultTemplates: [
    {
      id: 'explain-simple',
      name: 'Объяснить простыми словами',
      shortName: 'упрости',
      prompt: 'Объясни этот текст простыми словами, чтобы его понял даже ребенок:',
      description: 'Упрощенное объяснение сложного текста'
    },
    {
      id: 'paraphrase',
      name: 'Перефразировать',
      shortName: 'перепеши по другому',
      prompt: 'Перефразируй этот текст, сохранив основной смысл:',
      description: 'Переформулирование текста другими словами'
    },
    {
      id: 'find-errors',
      name: 'Найти ошибки',
      shortName: 'исправь ошибки',
      prompt: 'Проверь этот текст на наличие ошибок (орфографических, грамматических, стилистических) и предложи исправления:',
      description: 'Поиск и исправление ошибок в тексте'
    },
    {
      id: 'summarize',
      name: 'Резюмировать',
      shortName: 'сократи',
      prompt: 'Сделай краткое резюме этого текста, выделив основные идеи:',
      description: 'Создание краткого содержания текста'
    },
    {
      id: 'extract-facts',
      name: 'Извлечь факты',
      shortName: 'факты',
      prompt: 'Извлеки ключевые факты из следующего текста. Представь их в виде структурированного списка, где каждый факт - это отдельный пункт. Факты должны быть краткими, точными и информативными:',
      description: 'Автоматическое выделение ключевых фактов из текста'
    },
    {
      id: 'generate-questions',
      name: 'Создать вопросы',
      shortName: 'вопросы',
      prompt: 'Создай список вопросов по следующему тексту для лучшего запоминания и понимания материала. Вопросы должны быть разного уровня сложности и охватывать основные идеи текста:',
      description: 'Генерация вопросов по тексту для лучшего запоминания'
    }
  ],

  async loadTemplates() {
    return new Promise(async (resolve) => {
      const defaultTemplates = await this.getDefaultTemplates();
      
      chrome.storage.local.get(['promptTemplates'], (result) => {
        let templates = result.promptTemplates;
        
        if (!Array.isArray(templates)) {
          templates = defaultTemplates;
        } else {
          templates = templates.filter(t => 
            t && 
            typeof t === 'object' && 
            t.id && 
            t.name && 
            t.prompt
          );
          
          if (templates.length === 0) {
            templates = defaultTemplates;
          } else {
            const defaultIds = new Set(defaultTemplates.map(t => t.id));
            const customTemplates = templates.filter(t => !defaultIds.has(t.id));
            templates = [...defaultTemplates, ...customTemplates];
          }
        }
        
        resolve(templates);
      });
    });
  },

  async saveTemplates(templates) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ promptTemplates: templates }, () => {
        resolve();
      });
    });
  },

  async addTemplate(template) {
    if (!template || !template.name || !template.prompt) {
      throw new Error('Шаблон должен содержать название и промпт');
    }
    
    const templates = await this.loadTemplates();
    const newTemplate = {
      id: 'custom-' + Date.now(),
      name: template.name.trim(),
      prompt: template.prompt.trim(),
      description: template.description ? template.description.trim() : '',
      shortName: template.shortName ? template.shortName.trim() : ''
    };
    
    templates.push(newTemplate);
    await this.saveTemplates(templates);
    return newTemplate;
  },

  async deleteTemplate(templateId) {
    const templates = await this.loadTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    await this.saveTemplates(filtered);
  },

  async updateTemplate(templateId, updates) {
    const templates = await this.loadTemplates();
    const index = templates.findIndex(t => t.id === templateId);
    if (index !== -1) {
      if (updates.name !== undefined && !updates.name.trim()) {
        throw new Error('Название шаблона не может быть пустым');
      }
      if (updates.prompt !== undefined && !updates.prompt.trim()) {
        throw new Error('Промпт не может быть пустым');
      }
      
      templates[index] = { 
        ...templates[index], 
        ...updates,
        name: updates.name !== undefined ? updates.name.trim() : templates[index].name,
        prompt: updates.prompt !== undefined ? updates.prompt.trim() : templates[index].prompt,
        description: updates.description !== undefined ? updates.description.trim() : templates[index].description,
        shortName: updates.shortName !== undefined ? (updates.shortName ? updates.shortName.trim() : '') : templates[index].shortName
      };
      await this.saveTemplates(templates);
      return templates[index];
    }
    throw new Error('Шаблон не найден');
  },

  async getTemplate(templateId) {
    const templates = await this.loadTemplates();
    return templates.find(t => t.id === templateId);
  },

  applyTemplate(template, text) {
    if (!template || !template.prompt) {
      throw new Error('Шаблон не найден или не имеет промпта');
    }
    if (template.prompt.endsWith(':')) {
      return `${template.prompt} "${text}"`;
    }
    return `${template.prompt}\n\n"${text}"`;
  },

  async getQuickPrompts() {
    const templates = await this.loadTemplates();
    return templates.filter(t => t.shortName && t.shortName.trim().length > 0);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptTemplates;
} else {
  window.PromptTemplates = PromptTemplates;
}
