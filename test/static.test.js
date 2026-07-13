const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const models = ['chatgpt', 'claude', 'gemini', 'grok', 'kimi', 'deepseek'];

test('public tests are static-only and never launch Electron or provider webviews', () => {
  const testFiles = fs.readdirSync(path.join(root, 'test')).filter(file => file.endsWith('.js'));
  const contents = testFiles.map(file => read(path.join('test', file))).join('\n');
  const playwrightImport = '@' + 'playwright/test';
  const providerE2EFlag = 'BOARDROOM' + '_E2E';
  const electronLaunch = ['electron', ' .'].join('');

  assert.equal(contents.includes(playwrightImport), false);
  assert.equal(contents.includes(providerE2EFlag), false);
  assert.equal(contents.includes(electronLaunch), false);
});

test('public tree contains only release-bearing categories', () => {
  const forbiddenRoots = [
    'AGENTS.md',
    'CLAUDE.md',
    'CONCEPTS.md',
    'DEVELOPMENT_NOTES.md',
    'STRATEGY.md',
    'commands',
    'docs',
    'test-results'
  ];

  for (const relativePath of forbiddenRoots) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} must not be public`);
  }
});

test('Boardroom shell keeps all six model panels and attachment controls', () => {
  const html = read('src/index.html');

  assert.equal(html.includes('<title>Boardroom</title>'), true);
  for (const model of models) {
    assert.equal(html.includes(`id="${model}-panel"`), true);
    assert.equal(html.includes(`webview id="${model}"`), true);
    assert.equal(html.includes(`partition="persist:${model}"`), true);
  }
  for (const id of ['prompt-input', 'submit-btn', 'attach-btn', 'file-indicator', 'file-remove-btn']) {
    assert.equal(html.includes(`id="${id}"`), true);
  }
});

test('file attachment IPC and the 25 MB boundary are wired end to end', () => {
  const main = read('src/main.js');
  const preload = read('src/lib/preload.js');
  const html = read('src/index.html');

  assert.equal(main.includes("ipcMain.handle('open-file-dialog'"), true);
  assert.equal(main.includes('dialog.showOpenDialog'), true);
  assert.equal(main.includes('MAX_SIZE = 25 * 1024 * 1024'), true);
  assert.equal(preload.includes("openFileDialog: () => ipcRenderer.invoke('open-file-dialog')"), true);
  assert.equal(html.includes('window.electronAPI.openFileDialog()'), true);
});

test('file and file-only sends remain guarded for every visible provider', () => {
  const html = read('src/index.html');

  for (const model of models) {
    assert.equal(html.includes(`if (isModelVisible('${model}'))`), true);
  }
  for (const model of ['Grok', 'Kimi', 'DeepSeek']) {
    assert.equal(html.includes(`async function sendFileOnlyTo${model}()`), true);
    assert.equal(html.includes(`await sendFileOnlyTo${model}();`), true);
  }
  assert.equal(html.includes('const file = attachedFile'), true);
  assert.equal(html.includes('if (!prompt && !file) return;'), true);
  assert.equal(html.includes('await Promise.all(modelPromises)'), true);
});

test('controlled link actions and popup isolation are wired in the main process', () => {
  const main = read('src/main.js');

  assert.equal(main.includes("require('./lib/link-actions')"), true);
  assert.equal(main.includes('buildWebviewContextMenuTemplate('), true);
  assert.equal(main.includes("ipcMain.handle('copy-text'"), true);
  assert.equal(main.includes("ipcMain.handle('open-popup-window'"), true);
  assert.equal(main.includes("popupWindow.loadFile(path.join(__dirname, 'popup.html')"), true);
  assert.equal(main.includes("return { action: 'deny' };"), true);
  assert.equal(main.includes('webviewTag: true'), true);
  assert.equal(main.includes('nodeIntegration: false'), true);
  assert.equal(main.includes('contextIsolation: true'), true);
});

test('preload exposes only narrow named attachment, popup, and link methods', () => {
  const preload = read('src/lib/preload.js');

  assert.equal(preload.includes("openPopupWindow: (url, title, partition) => ipcRenderer.invoke('open-popup-window', url, title, partition)"), true);
  assert.equal(preload.includes("openExternal: (url) => ipcRenderer.invoke('open-external', url)"), true);
  assert.equal(preload.includes("copyText: (text) => ipcRenderer.invoke('copy-text', text)"), true);
  assert.equal(preload.includes('ipcRenderer.send('), false);
});

test('popup shell exposes editable URL controls inside an isolated webview', () => {
  const popup = read('src/popup.html');
  const popupPage = read('src/lib/popup-page.js');

  for (const id of ['address', 'back', 'forward', 'reload', 'copy-url', 'open-url', 'popup-webview']) {
    assert.equal(popup.includes(`id="${id}"`), true);
  }
  assert.equal(popup.includes('<webview id="popup-webview" allowpopups>'), true);
  assert.equal(popup.includes("script-src 'self'"), true);
  assert.equal(popupPage.includes("webview.setAttribute('partition', partition)"), true);
  assert.equal(popupPage.includes('event.preventDefault();'), true);
  assert.equal(popupPage.includes('webview.loadURL(result.url)'), true);
  assert.equal(popupPage.includes('window.electronAPI.openExternal(result.url)'), true);
});

test('every provider routes clicked links through the controlled popup path', () => {
  const html = read('src/index.html');

  assert.equal(html.includes('const webviews = [chatgptView, claudeView, geminiView, grokView, kimiView, deepseekView];'), true);
  assert.equal(html.includes("webview.addEventListener('new-window'"), true);
  assert.equal(html.includes("window.electronAPI.openPopupWindow(url, `${name} - Popup`, webview.getAttribute('partition'))"), true);
  assert.equal(html.includes('window.electronAPI.openExternal(url).catch'), true);
  assert.equal((html.match(/allowpopups/g) || []).length, 6);
});

test('all synchronized runtime helpers exist and resolve without Electron', () => {
  for (const relativePath of [
    'src/lib/link-actions.js',
    'src/lib/popup-controls.js',
    'src/lib/popup-page.js',
    'src/lib/url-utils.js',
    'src/popup.html'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} is required`);
  }

  assert.doesNotThrow(() => require('../src/lib/link-actions'));
  assert.doesNotThrow(() => require('../src/lib/popup-controls'));
});
