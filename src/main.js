const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

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

// Handle popup windows for OAuth and external links
ipcMain.handle('open-popup-window', async (event, url, title) => {
  console.log(`Opening popup window: ${title} - ${url}`);

  const popupWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: title || 'Popup',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Allow navigation to the OAuth URL
      sandbox: true
    },
    // Make it a modal-like window
    modal: false,
    // Show it on top
    alwaysOnTop: false,
    // Center on parent
    center: true
  });

  popupWindow.loadURL(url);

  // Optional: Auto-close when navigation completes (for OAuth redirects)
  // Uncomment if you want the window to auto-close after successful auth
  // popupWindow.webContents.on('did-navigate', (event, url) => {
  //   if (url.includes('callback') || url.includes('success')) {
  //     setTimeout(() => popupWindow.close(), 2000);
  //   }
  // });

  return { success: true };
});

// Handle opening URLs in system browser (fallback for popup failures)
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  console.log(`Opening URL in system browser: ${url}`);
  await shell.openExternal(url);
  return { success: true };
});

// Handle popups and file dialogs for all web contents (including webviews)
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    console.log('Webview created');

    // Allow popups (already working for OAuth)
    contents.setWindowOpenHandler(({ url }) => {
      console.log(`Webview opening: ${url}`);
      return { action: 'allow' };
    });

    // Add right-click context menu for copy/paste in webviews
    contents.on('context-menu', (event, params) => {
      const { selectionText, isEditable } = params;

      const contextMenuTemplate = [];

      // Add copy option if text is selected
      if (selectionText) {
        contextMenuTemplate.push({
          label: 'Copy',
          role: 'copy'
        });
      }

      // Add paste option if in an editable field
      if (isEditable) {
        if (contextMenuTemplate.length > 0) {
          contextMenuTemplate.push({ type: 'separator' });
        }
        contextMenuTemplate.push(
          {
            label: 'Cut',
            role: 'cut',
            enabled: selectionText.length > 0
          },
          {
            label: 'Paste',
            role: 'paste'
          }
        );
      }

      // Add select all option
      if (selectionText || isEditable) {
        contextMenuTemplate.push(
          { type: 'separator' },
          {
            label: 'Select All',
            role: 'selectAll'
          }
        );
      }

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
