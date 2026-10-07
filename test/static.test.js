const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const models = ['chatgpt', 'claude', 'gemini', 'grok', 'kimi', 'deepseek'];
const releaseTestCommand = 'node --test test/static.test.js test/link-actions.node.test.js test/popup-controls.node.test.js test/popup-page.node.test.js';

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  });
}

test('public tests are static-only and never launch Electron or provider webviews', () => {
  const testFiles = listJavaScriptFiles(path.join(root, 'test'));
  const contents = testFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
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

test('link context actions and popup shell are wired in the main process', () => {
  const main = read('src/main.js');

  assert.equal(main.includes("require('./lib/link-actions')"), true);
  assert.equal(main.includes("require('./lib/popup-routing')"), true);
  assert.equal(main.includes('buildWebviewContextMenuTemplate('), true);
  assert.equal(main.includes("ipcMain.handle('copy-text'"), true);
  assert.equal(main.includes("ipcMain.handle('open-popup-window'"), true);
  assert.equal(main.includes("popupWindow.loadFile(path.join(__dirname, 'popup.html')"), true);
  assert.equal(main.includes('createWindowOpenHandler({'), true);
  assert.equal(main.includes('configurePopupRouting(contents, getPartitionForWebContents(contents))'), true);
  assert.equal(main.includes("contents.on('did-create-window'"), true);
  assert.equal(main.includes('configurePopupRouting(childWindow.webContents, partition)'), true);
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

test('renderer leaves popup routing to the main process', () => {
  const html = read('src/index.html');

  assert.equal(html.includes('const providerWebviews = [chatgptView, claudeView, geminiView, grokView, kimiView, deepseekView];'), true);
  assert.equal(html.includes('providerWebviews.forEach((webview, index) => {'), true);
  assert.equal(/\.addEventListener\(\s*['"]new-window['"]/.test(html), false);

  const allowPopupsCount = (html.match(/allowpopups/g) || []).length;
  assert.equal(allowPopupsCount, 6);
});

test('all synchronized runtime helpers exist and resolve without Electron', () => {
  for (const relativePath of [
    'src/lib/link-actions.js',
    'src/lib/popup-routing.js',
    'src/lib/popup-controls.js',
    'src/lib/popup-page.js',
    'src/lib/url-utils.js',
    'src/popup.html'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} is required`);
  }

  assert.doesNotThrow(() => require('../src/lib/link-actions'));
  assert.doesNotThrow(() => require('../src/lib/popup-routing'));
  assert.doesNotThrow(() => require('../src/lib/popup-controls'));
});

test('v1.1.1 package metadata is coherent and keeps the public build boundary', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));

  assert.equal(pkg.version, '1.1.1');
  assert.equal(lock.version, '1.1.1');
  assert.equal(lock.packages[''].version, '1.1.1');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.scripts.test, releaseTestCommand);
  assert.deepEqual(pkg.build.files, ['src/**/*', 'package.json']);
  assert.equal(pkg.build.nsis.artifactName, '${productName}-Setup-${version}.${ext}');
});

test('CI tests before both platform builds and publishes tags only', () => {
  const workflow = read('.github/workflows/build.yml');

  assert.equal(workflow.includes('workflow_dispatch:'), true);
  assert.equal(workflow.includes('  test:'), true);
  assert.equal(workflow.includes('      - run: npm test'), true);
  assert.equal((workflow.match(/needs: test/g) || []).length, 2);
  assert.equal(workflow.includes("if: startsWith(github.ref, 'refs/tags/v')"), true);
  assert.equal(workflow.includes('needs: [build-mac, build-windows]'), true);
  assert.equal(workflow.includes('Verify tag matches package version'), true);
  assert.equal(workflow.includes('GITHUB_REF_NAME'), true);
});

test('README documents the v1.1.1 features and unsigned-app guidance', () => {
  const readme = read('README.md');

  for (const phrase of [
    'file attachments',
    'Right-click',
    'editable address bar',
    'Boardroom-1.1.1-universal.dmg',
    'Boardroom-Setup-1.1.1.exe',
    'macOS may show a warning',
    'Windows SmartScreen may show a warning',
    'npm ci',
    'MIT'
  ]) {
    assert.equal(readme.includes(phrase), true, `README is missing: ${phrase}`);
  }
});

const { createRequire } = require('node:module');
const vm = require('node:vm');

const mainPath = path.join(__dirname, '../src/main.js');
const mainRequire = createRequire(mainPath);

function runStartup(userAgent) {
  const sessions = new Map();
  const changes = [];
  let ready;
  let identityAtWindowCreation;
  const electron = {
    app: {
      name: 'boardroom',
      on() {},
      whenReady: () => ({ then: (callback) => { ready = callback; } })
    },
    session: {
      fromPartition(partition) {
        if (!sessions.has(partition)) {
          let identity = userAgent;
          sessions.set(partition, {
            on() {},
            getUserAgent: () => identity,
            setUserAgent: (value) => {
              identity = value;
              changes.push(partition);
            }
          });
        }
        return sessions.get(partition);
      }
    },
    BrowserWindow: class {
      constructor() {
        identityAtWindowCreation = electron.session.fromPartition('persist:gemini').getUserAgent();
        this.webContents = { session: { on() {} } };
      }
      loadFile() {}
    },
    ipcMain: { handle() {} },
    Menu: { buildFromTemplate() {}, setApplicationMenu() {} }
  };
  vm.runInNewContext(fs.readFileSync(mainPath, 'utf8'), {
    require: (name) => name === 'electron' ? electron : mainRequire(name),
    __dirname: path.dirname(mainPath),
    process: { platform: 'darwin' },
    console
  });
  assert.deepEqual(changes, [], 'session configuration must wait for Electron readiness');
  ready();
  return { changes, identityAtWindowCreation };
}

test('Gemini starts with a Chrome-compatible identity before any window loads', () => {
  const browserIdentity = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.133 Safari/537.36';
  const electronIdentity = browserIdentity.replace('Chrome/', 'boardroom/1.0.0 Chrome/')
    .replace('Safari/', 'Electron/38.2.2 Safari/');
  const result = runStartup(electronIdentity);
  assert.equal(result.identityAtWindowCreation, browserIdentity);
  assert.deepEqual(result.changes, ['persist:gemini'], 'other provider identities must remain unchanged');
});

test('Gemini identity preserves the installed browser version and platform across upgrades', () => {
  const browserIdentity = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150.0.1234.5 Safari/537.36';
  const result = runStartup(browserIdentity.replace('Chrome/', 'boardroom/2.1.0 Chrome/')
    .replace('Safari/', 'Electron/48.0.0 Safari/'));
  assert.equal(result.identityAtWindowCreation, browserIdentity);
  assert.equal(runStartup(browserIdentity).identityAtWindowCreation, browserIdentity);
});

const {
  createWindowOpenHandler,
  shouldUseNativeAuthPopup
} = require('../src/lib/popup-routing');

test('uses a native child window for Claude Google authentication from Claude', () => {
  assert.equal(shouldUseNativeAuthPopup(
    'persist:claude',
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=example',
    'https://claude.ai/login'
  ), true);
});

test('uses a native child window for Google descendants in the Claude auth chain', () => {
  assert.equal(shouldUseNativeAuthPopup(
    'persist:claude',
    'https://accounts.google.com/gsi/transform',
    'https://accounts.google.com/o/oauth2/v2/auth'
  ), true);
});

test('keeps ordinary Claude links in the controlled popup shell', () => {
  assert.equal(shouldUseNativeAuthPopup(
    'persist:claude',
    'https://support.claude.com/en/articles/example',
    'https://claude.ai/new'
  ), false);
  assert.equal(shouldUseNativeAuthPopup(
    'persist:claude',
    'https://example.com/source',
    'https://claude.ai/new'
  ), false);
});

test('does not grant the Claude authentication route to other providers', () => {
  assert.equal(shouldUseNativeAuthPopup(
    'persist:chatgpt',
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://chatgpt.com/'
  ), false);
  assert.equal(shouldUseNativeAuthPopup(
    'persist:gemini',
    'https://accounts.google.com/gsi/transform',
    'https://gemini.google.com/'
  ), false);
});

test('rejects lookalike and non-HTTPS authentication URLs', () => {
  assert.equal(shouldUseNativeAuthPopup(
    'persist:claude',
    'https://accounts.google.com.evil.example/o/oauth2/v2/auth',
    'https://claude.ai/'
  ), false);
  assert.equal(shouldUseNativeAuthPopup(
    'persist:claude',
    'http://accounts.google.com/o/oauth2/v2/auth',
    'https://claude.ai/'
  ), false);
  assert.equal(shouldUseNativeAuthPopup('persist:claude', 'not a url', 'https://claude.ai/'), false);
});

test('rejects Google authentication popups from non-Claude or untrusted openers', () => {
  const popupUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

  assert.equal(shouldUseNativeAuthPopup('persist:claude', popupUrl, 'https://evil.example/'), false);
  assert.equal(shouldUseNativeAuthPopup('persist:claude', popupUrl, 'https://claude.ai.evil.example/'), false);
  assert.equal(shouldUseNativeAuthPopup('persist:claude', popupUrl, 'http://claude.ai/'), false);
  assert.equal(shouldUseNativeAuthPopup('persist:claude', popupUrl, 'not a url'), false);
});

test('window-open handler returns the complete native auth decision', () => {
  const providerSession = { id: 'claude-session' };
  const opened = [];
  const handler = createWindowOpenHandler({
    partition: 'persist:claude',
    getOpenerUrl: () => 'https://claude.ai/login',
    session: providerSession,
    openControlledPopup: (...args) => opened.push(args)
  });

  assert.deepEqual(handler({
    url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=example'
  }), {
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 800,
      height: 700,
      title: 'Claude sign-in',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        session: providerSession
      }
    }
  });
  assert.deepEqual(opened, []);
});

test('window-open handler denies ordinary Claude links and opens the controlled shell', async () => {
  const opened = [];
  const handler = createWindowOpenHandler({
    partition: 'persist:claude',
    getOpenerUrl: () => 'https://claude.ai/new',
    session: { id: 'claude-session' },
    openControlledPopup: (...args) => {
      opened.push(args);
      return { success: true };
    }
  });
  const url = 'https://support.claude.com/en/articles/example';

  assert.deepEqual(handler({ url }), { action: 'deny' });
  await Promise.resolve();
  assert.deepEqual(opened, [[url, 'persist:claude']]);
});

test('window-open handler keeps other providers in the controlled shell', async () => {
  const opened = [];
  const handler = createWindowOpenHandler({
    partition: 'persist:chatgpt',
    getOpenerUrl: () => 'https://chatgpt.com/',
    session: { id: 'chatgpt-session' },
    openControlledPopup: (...args) => {
      opened.push(args);
      return Promise.resolve({ success: true });
    }
  });
  const url = 'https://accounts.google.com/o/oauth2/v2/auth';

  assert.deepEqual(handler({ url }), { action: 'deny' });
  await Promise.resolve();
  assert.deepEqual(opened, [[url, 'persist:chatgpt']]);
});

test('window-open handler only permits Google descendants from the allowed auth chain', () => {
  const providerSession = { id: 'claude-session' };
  const allowedHandler = createWindowOpenHandler({
    partition: 'persist:claude',
    getOpenerUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    session: providerSession,
    openControlledPopup: () => ({ success: true })
  });
  const controlled = [];
  const maliciousOpenerHandler = createWindowOpenHandler({
    partition: 'persist:claude',
    getOpenerUrl: () => 'https://evil.example/',
    session: providerSession,
    openControlledPopup: (...args) => {
      controlled.push(args);
      return { success: true };
    }
  });
  const popupUrl = 'https://accounts.google.com/gsi/transform';

  const result = allowedHandler({ url: popupUrl });
  assert.equal(result.action, 'allow');
  assert.equal(result.overrideBrowserWindowOptions.webPreferences.session, providerSession);
  assert.deepEqual(maliciousOpenerHandler({ url: popupUrl }), { action: 'deny' });
  assert.deepEqual(controlled, [[popupUrl, 'persist:claude']]);
});

test('window-open handler reports invalid and rejected controlled popup results safely', async () => {
  const messages = [];
  const baseOptions = {
    partition: 'persist:claude',
    getOpenerUrl: () => 'https://claude.ai/new',
    session: { id: 'claude-session' },
    onControlledPopupError: (message) => messages.push(message)
  };
  const invalidResultHandler = createWindowOpenHandler({
    ...baseOptions,
    openControlledPopup: () => ({ success: false, error: 'Unsafe URL\nwas rejected' })
  });
  const rejectedHandler = createWindowOpenHandler({
    ...baseOptions,
    openControlledPopup: () => Promise.reject(new Error('Popup failed\nwithout a window'))
  });

  assert.deepEqual(invalidResultHandler({ url: 'javascript:alert(1)' }), { action: 'deny' });
  assert.deepEqual(rejectedHandler({ url: 'https://example.com/' }), { action: 'deny' });
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(messages, [
    'Unsafe URL was rejected',
    'Popup failed without a window'
  ]);
});
