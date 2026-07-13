const { app, BrowserWindow, ipcMain, Menu, dialog, clipboard, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  buildWebviewContextMenuTemplate,
  isBrowserSafeUrl,
  openBrowserUrlExternal
} = require('./lib/link-actions');

const PROVIDER_PARTITIONS = new Set([
  'persist:chatgpt',
  'persist:claude',
  'persist:gemini',
  'persist:grok',
  'persist:kimi',
  'persist:deepseek'
]);
const FALLBACK_POPUP_PARTITION = 'persist:popup';

function createWindow() {
  const win = new BrowserWindow({
    width: 2400,
    height: 1000,
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'lib', 'preload.js')
    }
  });

  win.loadFile(__dirname + '/index.html');

  // Configure webview settings when they're attached
  // This is necessary for file uploads to work properly in webviews
  win.webContents.session.on('will-attach-webview', (event, webPreferences, params) => {
    // Keep existing security settings
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    
    // Ensure file dialogs can be shown
    delete webPreferences.preload;
  });

  return win;
}

// Create application menu with Edit menu for copy/paste support
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // Edit menu - critical for copy/paste functionality
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        ...(isMac ? [
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [])
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle debug file writing
ipcMain.handle('write-debug-file', async (event, data, filename = 'grok-debug.json') => {
  const debugPath = path.join(__dirname, '..', 'test-results', filename);
  try {
    fs.writeFileSync(debugPath, JSON.stringify(data, null, 2));
    return { success: true, path: debugPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Memory monitoring handler
ipcMain.handle('get-memory-info', async (event) => {
  const memoryInfo = process.memoryUsage();
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    heapUsed: (memoryInfo.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (memoryInfo.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    external: (memoryInfo.external / 1024 / 1024).toFixed(2) + ' MB',
    rss: (memoryInfo.rss / 1024 / 1024).toFixed(2) + ' MB'
  };

  // Append to log file
  const logPath = path.join(__dirname, '..', 'test-results', 'memory-log.jsonl');
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write memory log:', error);
  }

  return logEntry;
});

function getSafePopupPartition(partition) {
  return PROVIDER_PARTITIONS.has(partition) ? partition : FALLBACK_POPUP_PARTITION;
}

function getPartitionForWebContents(contents) {
  for (const partition of PROVIDER_PARTITIONS) {
    if (contents.session === session.fromPartition(partition)) {
      return partition;
    }
  }

  return FALLBACK_POPUP_PARTITION;
}

async function createPopupWindow(url, title, partition) {
  console.log(`Opening popup window: ${title} - ${url}`);

  if (!isBrowserSafeUrl(url)) {
    return { success: false, error: 'Only http:// and https:// URLs can be opened in popup windows.' };
  }

  const popupWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: title || 'Popup',
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'lib', 'preload.js')
    },
    // Make it a modal-like window
    modal: false,
    // Show it on top
    alwaysOnTop: false,
    // Center on parent
    center: true
  });

  await popupWindow.loadFile(path.join(__dirname, 'popup.html'), {
    query: {
      url: String(url),
      title: title || 'Popup',
      partition: getSafePopupPartition(partition)
    }
  });

  // Optional: Auto-close when navigation completes (for OAuth redirects)
  // Uncomment if you want the window to auto-close after successful auth
  // popupWindow.webContents.on('did-navigate', (event, url) => {
  //   if (url.includes('callback') || url.includes('success')) {
  //     setTimeout(() => popupWindow.close(), 2000);
  //   }
  // });

  return { success: true };
}

// Handle popup windows for OAuth and external links
ipcMain.handle('open-popup-window', async (event, url, title, partition) => {
  return createPopupWindow(url, title, partition);
});

ipcMain.handle('copy-text', async (event, text) => {
  clipboard.writeText(String(text || ''));
  return { success: true };
});

// Handle file attachment dialog
ipcMain.handle('open-file-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);

  // Enforce 25MB limit
  const MAX_SIZE = 25 * 1024 * 1024;
  if (stats.size > MAX_SIZE) {
    return { error: 'File too large. Maximum size is 25MB.' };
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Simple mime type detection
  const mimeTypes = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.json': 'application/json', '.js': 'text/javascript', '.py': 'text/x-python',
    '.html': 'text/html', '.css': 'text/css', '.xml': 'text/xml',
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.svg': 'image/svg+xml', '.zip': 'application/zip',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  return { name, path: filePath, base64, size: stats.size, mimeType };
});

// Handle opening URLs in system browser (fallback for popup failures)
ipcMain.handle('open-external', async (event, url) => {
  console.log(`Opening URL in system browser: ${url}`);
  return openBrowserUrlExternal(shell, url);
});

// Handle popups and file dialogs for all web contents (including webviews)
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    console.log('Webview created');

    // Route webview popups through Boardroom's controlled popup shell.
    contents.setWindowOpenHandler(({ url }) => {
      console.log(`Webview opening: ${url}`);
      createPopupWindow(url, 'Popup', getPartitionForWebContents(contents)).catch((error) => {
        console.error('Failed to open controlled popup window:', error);
      });
      return { action: 'deny' };
    });

    // Add right-click context menu for links and copy/paste in webviews
    contents.on('context-menu', (event, params) => {
      const contextMenuTemplate = buildWebviewContextMenuTemplate(params, { clipboard, shell });

      // Show context menu if there are items
      if (contextMenuTemplate.length > 0) {
        const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
        contextMenu.popup();
      }
    });
  }
});

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
