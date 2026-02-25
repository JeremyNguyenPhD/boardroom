const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  writeDebugFile: (data, filename) => ipcRenderer.invoke('write-debug-file', data, filename),
  getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
  openPopupWindow: (url, title) => ipcRenderer.invoke('open-popup-window', url, title),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

