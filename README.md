# Boardroom
https://github.com/user-attachments/assets/1ce84240-710e-418d-ba85-b77e96deba77

A split-screen desktop app for using ChatGPT, Claude, Gemini, Grok, Kimi, and DeepSeek side by side. Type once, send to all.

## Features

- Send one prompt to every visible provider.
- Add file attachments up to 25 MB, including file-only sends.
- Paste an image (for example a screenshot) into the shared prompt box with Cmd+V or Ctrl+V to send it to every visible provider, with a thumbnail preview before sending.
- Drag the divider above the prompt box to resize it.
- Show or hide providers without sending prompts to hidden panels.
- Right-click provider links to copy their URL or open them in your system browser.
- Open clicked links in a controlled Boardroom popup with an editable address bar and the provider's existing session.

## Changes in 1.2.0

- Paste images straight into the shared prompt box; they are attached for every visible provider and shown as a thumbnail.
- More reliable ChatGPT attachments and sending: ChatGPT now enables its Send button for prompts sent from Boardroom.
- Resize the shared prompt box by dragging the divider above it.
- Remove an unused ChatGPT debug button.

## Changes in 1.1.1

- Fix Gemini responses getting stuck after sending a prompt.
- Restore Google sign-in for Claude inside Boardroom.

## Download

Go to [Releases](../../releases/latest) and download:
- **Mac**: `Boardroom-1.2.0-universal.dmg`
- **Windows**: `Boardroom-Setup-1.2.0.exe`

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
