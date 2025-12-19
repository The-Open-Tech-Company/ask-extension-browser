# Browser Assistant - Chrome/Chromium Extension

A comprehensive browser extension for Chromium-based browsers that helps speed up your work with text translation, on-page search, and AI-powered explanations.

## Features

### 1. On-Page Text Search
- Open the extension popup
- Enter text to search in the search field
- Configure search parameters:
  - **Exact match** - finds only 100% matches
  - **Morphology aware** - considers word declensions and conjugations (for Russian language)
- Click "Search" to find matches
- Use "Back" and "Forward" buttons to navigate through results
- Click "Clear highlights" to remove all highlights

### 2. Text Translation
- Select text on any web page
- Right-click → Extension → **Translate**
- A popup window with translation will appear next to the text

**Translation Settings:**
- By default, all foreign languages are translated to Russian
- Russian is translated to English (configurable)
- Settings can be changed in the extension options

### 3. Full Page Translation
- Click the extension icon
- Click "Translate Page" in the popup
- The entire page will be translated using Google Translate

### 4. AI-Powered Text Explanation
- Select text on any web page
- Right-click → Extension → **Explain**
- A new window with AI chat will open, explaining the text and answering questions
- Or open the chat via popup → "Open AI Chat"

**AI Settings:**
- Model selection: **DeepSeek** (with web search and thinking support) or **ChatGPT** from OpenAI
- API key configuration
- Response temperature setting (0.0 - 2.0)
- System prompt (optional)
- Developer mode for token usage information

**DeepSeek Features:**
- In the chat, buttons are available to enable:
  - **Web Search** - allows AI to search for information on the internet
  - **Thinking** - enables extended thinking for complex tasks

**ChatGPT Models:**
- GPT-4
- GPT-4 Turbo
- GPT-3.5 Turbo
- GPT-4o
- GPT-4o Mini

### 5. Prompt Templates
- Pre-configured templates for quick AI interactions
- Custom templates support
- Quick access via short names
- Templates can be edited and deleted (custom templates only)

## Installation

1. Download or clone the repository
2. Create extension icons (see "Icon Creation" section)
3. Open Chrome/Chromium browser
4. Navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
5. Enable "Developer mode" (Developer mode)
6. Click "Load unpacked extension" (Load unpacked)
7. Select the extension folder

## Icon Creation

The extension requires icons sized 16x16, 48x48, and 128x128 pixels in PNG format.

You can:
1. Use online icon generators
2. Create icons in a graphics editor
3. Use ready-made icons from the internet

Place the files:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

## Configuration

### Translation Settings
1. Click the extension icon in the toolbar
2. Go to the "Translation" tab
3. Select the default translation language for foreign languages
4. Select the translation language from Russian
5. Click "Save"

### AI Settings
1. Click the extension icon in the toolbar
2. Go to the "AI Settings" tab
3. Select the AI model (DeepSeek or ChatGPT)
4. If ChatGPT model is selected, choose a specific model from the list
5. Enter API key:
   - For DeepSeek: get key at https://platform.deepseek.com/api_keys
   - For ChatGPT: get key at https://platform.openai.com/api-keys
6. Configure response temperature (0.0 - 2.0)
7. Optionally enter a system prompt
8. Enable developer mode if needed (shows token usage)
9. Click "Save"

### Prompt Templates
1. Click the extension icon in the toolbar
2. Go to the "Templates" tab
3. Click "Add Template" to create a new template
4. Fill in:
   - Name (required)
   - Prompt (required)
   - Description (optional)
   - Short name (optional, max 15 characters)
5. Click "Save"
6. Edit or delete custom templates as needed

## Usage

### On-Page Search
1. Click the extension icon in the toolbar
2. In the popup, enter text to search
3. Configure search parameters (exact match, morphology)
4. Click "Search" to find matches
5. Use navigation buttons to move between results
6. Click "Clear highlights" to remove all highlights

### Text Translation
1. Select text on any web page
2. Right-click
3. In the context menu, select "Extension" → "Translate"
4. A popup window with translation will appear next to the text

### Full Page Translation
1. Click the extension icon
2. Click "Translate Page" in the popup
3. Wait for the page to be translated

### Text Explanation
1. Select text on any web page
2. Right-click
3. In the context menu, select "Extension" → "Explain"
4. A chat window with AI will open
5. AI will automatically explain the selected text
6. You can ask additional questions in the chat
7. For DeepSeek, you can enable "Web Search" and "Thinking" features

### Extension Management
1. Click the extension icon in the toolbar
2. Use the toggle to enable/disable the extension
3. Click "Open AI Chat" to open chat without selected text
4. Click "Settings" to configure translation and AI settings

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, Opera, etc.)
- API key for the selected AI model (DeepSeek or OpenAI)
- Internet connection for translation and AI functions

## Технические детали

- **Версия манифеста**: 3
- **Версия расширения**: 2.3.5
- **Перевод**: Использует публичный API Google Translate
- **DeepSeek API**: https://api.deepseek.com/v1/chat/completions
- **OpenAI API**: https://api.openai.com/v1/chat/completions
- **Хранилище**: Использует `chrome.storage.sync` для настроек и `chrome.storage.local` для истории чатов и шаблонов

## Troubleshooting

### "Functions unavailable. Check API key"
- Make sure you entered the correct API key in settings
- Check that the key is active and has necessary permissions
- For DeepSeek, make sure you're using the correct key format

### Translation doesn't work
- Check internet connection
- Make sure the site doesn't block requests to Google Translate
- Try selecting text again

### Chat window doesn't open
- Make sure the browser allows popups for this site
- Check popup blocking settings in the browser

### Search doesn't work
- Make sure the extension is enabled (check the toggle in popup)
- Try refreshing the page
- Check that content scripts are loaded (open browser console)

### AI responses are slow
- Check your internet connection
- Verify API key is correct
- For ChatGPT, check if you're using the correct model and have sufficient credits

## License

This project is created for personal use.

## Author

Created by [The Open Tech Company](https://github.com/The-Open-Tech-Company/ask-extension-browser)
