# Boardroom
https://github.com/user-attachments/assets/1ce84240-710e-418d-ba85-b77e96deba77

A split-screen desktop app for using ChatGPT, Claude, Gemini, Grok, Kimi, and DeepSeek side by side. Type once, send to all.

## Features

- Send one prompt to every visible provider.
- Add file attachments up to 25 MB, including file-only sends.
- Show or hide providers without sending prompts to hidden panels.
- Right-click provider links to copy their URL or open them in your system browser.
- Open clicked links in a controlled Boardroom popup with an editable address bar and the provider's existing session.

## Download

Go to [Releases](../../releases/latest) and download:
- **Mac**: `Boardroom-1.1.0-universal.dmg`
- **Windows**: `Boardroom-Setup-1.1.0.exe`

### System Requirements

- macOS 10.15 (Catalina) or later
- Windows 10 or later

## Mac Users

macOS may show a warning since the app is not signed. To open:
1. Right-click the app
2. Select "Open"
3. Click "Open" in the dialog

Or run in Terminal: `xattr -cr /Applications/Boardroom.app`

## Windows Users

Windows SmartScreen may show a warning. Click "More info" then "Run anyway".

## Running from Source

Requires Node.js 18+.

```bash
npm ci
npm start
```

Run the non-launching static and helper tests with `npm test`. These checks do not open Electron or contact any AI provider.

## License

MIT
