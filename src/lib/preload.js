const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  writeDebugFile: (data, filename) => ipcRenderer.invoke('write-debug-file', data, filename),
  getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
  openPopupWindow: (url, title, partition) => ipcRenderer.invoke('open-popup-window', url, title, partition),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog')
});
