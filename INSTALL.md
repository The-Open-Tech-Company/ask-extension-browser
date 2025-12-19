# Installation Guide

## Quick Start

### Step 1: Create Icons

Before installing the extension, you need to create icons. You have three options:

#### Option 1: Using HTML Generator (Recommended)
1. Open the `create-icons.html` file in your browser
2. Click the "Download All Icons" button
3. Save the files `icon16.png`, `icon48.png`, `icon128.png` to the `icons/` folder

#### Option 2: Using Python Script
1. Make sure Python 3 is installed
2. Install the Pillow library: `pip install Pillow`
3. Run the script: `python generate_icons.py`
4. Icons will be created in the `icons/` folder

#### Option 3: Manual Creation
Create three PNG files:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

### Step 2: Install Extension

1. Open Chrome/Chromium/Edge browser
2. Navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Other Chromium browsers: `chrome://extensions/` or find in settings
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked extension" (Load unpacked)
5. Select the `browaskelex` folder (folder with extension files)
6. The extension will be installed and ready to use

### Step 3: Configuration

1. Click the extension icon in the browser toolbar
2. Go to the "AI Settings" tab
3. Select AI model (DeepSeek or ChatGPT)
4. Enter API key:
   - **DeepSeek**: https://platform.deepseek.com/api_keys
   - **ChatGPT**: https://platform.openai.com/api-keys
5. Configure temperature and system prompt if needed
6. Click "Save"

### Step 4: Usage

#### Text Translation:
1. Select text on any web page
2. Right-click → "Extension" → "Translate"
3. A translation window will appear next to the text

#### Text Explanation:
1. Select text on any web page
2. Right-click → "Extension" → "Explain"
3. An AI chat window will open
4. AI will automatically explain the text
5. You can ask additional questions

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, Opera, etc.)
- API key for the selected AI model
- Internet connection

## Troubleshooting

### Extension Won't Load
- Make sure all files are in place
- Check that icons are created in the `icons/` folder
- Check browser console for errors (F12)

### Translator Not Working
- Check internet connection
- Make sure the site is not blocking requests
- Try selecting text again

### AI Not Responding
- Check API key correctness
- Make sure the key is active and has balance (for paid APIs)
- Check error message in the chat window

## Version

Current extension version: **2.3.5**
