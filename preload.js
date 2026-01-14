/**
 * Electron Preload Script - Fast Drive
 *
 * Bridge segura entre o processo principal e o renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expor API segura para o renderer
contextBridge.exposeInMainWorld('fastDrive', {
  // Obter dados
  getStatus: () => ipcRenderer.invoke('get-status'),
  getStatistics: () => ipcRenderer.invoke('get-statistics'),
  getBatteryHistory: (hours) => ipcRenderer.invoke('get-battery-history', hours),
  getChargingHistory: (limit) => ipcRenderer.invoke('get-charging-history', limit),
  getUsageHistory: (limit) => ipcRenderer.invoke('get-usage-history', limit),

  // Event listeners
  onDeviceConnected: (callback) => {
    ipcRenderer.on('device-connected', (event, data) => callback(data));
  },
  onDeviceDisconnected: (callback) => {
    ipcRenderer.on('device-disconnected', (event, data) => callback(data));
  },
  onBatteryChange: (callback) => {
    ipcRenderer.on('battery-change', (event, data) => callback(data));
  },
  onChargingStarted: (callback) => {
    ipcRenderer.on('charging-started', (event, data) => callback(data));
  },
  onChargingStopped: (callback) => {
    ipcRenderer.on('charging-stopped', (event, data) => callback(data));
  },
  onCallStateChange: (callback) => {
    ipcRenderer.on('call-state-change', (event, data) => callback(data));
  },
  onMuteChange: (callback) => {
    ipcRenderer.on('mute-change', (event, data) => callback(data));
  },

  // Remover listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
