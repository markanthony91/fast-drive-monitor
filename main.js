/**
 * Electron Main Process - Fast Drive
 *
 * Processo principal do Electron que cria a janela
 * e gerencia a comunicação com o processo renderer.
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { FastDriveApp } = require('./src/index');

let mainWindow = null;
let tray = null;
let fastDriveApp = null;

/**
 * Cria a janela principal
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 600,
    minWidth: 350,
    minHeight: 500,
    resizable: true,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Fast Drive - Jabra Monitor'
  });

  mainWindow.loadFile('index.html');

  // Minimizar para tray ao fechar
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // DevTools em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Cria ícone na bandeja do sistema
 */
function createTray() {
  // Criar ícone simples (pode ser substituído por imagem real)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAGASURBVFhH7ZaxTsJAGMe/uwICgou4ODq4OPgKDr6Dg4ODk5ODi4ODg4ODg4ODg4ODg4ODg4ODf9p7tJSjd20vBhK/5EIv9/3+1+u1LWOMYYnxYIn5g8BnwGKxGFwmk8Hj8Xjw3tfX18H7tVpNqtUqhBBwMpnAYDAAS6qsA+/3+4OLxKdSqUC5XIZEIgG7uxfgOM7gcrlcw+l0Cna73cElyXq9Dkej0eDW6/VgtVqFXC4H6XQakskk+L4Pp9MJ9Ho9aLfbMBwOwbIsd7NarUK1WoVCoQDpdBqy2SxkMhlIJBLged7gfD6H4XAIJ5MJDAYDGAwGYNvuwFqtBvV6HWq1GpTLZSgWi5DJZCCdTkMqlYJkMgm+74PneXA+n8P5fA6z2QzG4zGMRiOwbNt1t9vtQqfTgXa7Dc1mE+r1OlQqFSgWi5DL5SCTyUAqlYJEIgGu68LZbAan0ymcTCZwPB7DYDAAy7IddzqdQrvdhlarhVarhWq1CsViEfL5PGSzWUgmk+C6Lniehx/xB5G/tSqNIj+LAAAAAElFTkSuQmCC'
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Fast Drive',
      click: () => mainWindow.show()
    },
    { type: 'separator' },
    {
      label: 'Status',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Fast Drive - Jabra Monitor');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
}

/**
 * Atualiza tooltip do tray com status
 */
function updateTrayTooltip(status) {
  if (!tray) return;

  let tooltip = 'Fast Drive - Jabra Monitor\n';

  if (status.device.isConnected) {
    tooltip += `Bateria: ${status.device.batteryLevel || 0}%`;
    if (status.device.isCharging) tooltip += ' (Carregando)';
    if (status.device.isInCall) tooltip += '\nEm chamada';
  } else {
    tooltip += 'Headset desconectado';
  }

  tray.setToolTip(tooltip);
}

/**
 * Inicializa aplicação Fast Drive
 */
async function initFastDriveApp() {
  fastDriveApp = new FastDriveApp();

  // Encaminhar eventos para renderer
  fastDriveApp.on('deviceConnected', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('device-connected', data);
    }
  });

  fastDriveApp.on('deviceDisconnected', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('device-disconnected', data);
    }
  });

  fastDriveApp.on('batteryChange', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('battery-change', data);
    }
    updateTrayTooltip(fastDriveApp.getStatus());
  });

  fastDriveApp.on('chargingStarted', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('charging-started', data);
    }
  });

  fastDriveApp.on('chargingStopped', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('charging-stopped', data);
    }
  });

  fastDriveApp.on('callStateChange', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('call-state-change', data);
    }
  });

  fastDriveApp.on('muteChange', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('mute-change', data);
    }
  });

  await fastDriveApp.start();
}

// IPC Handlers
ipcMain.handle('get-status', () => {
  return fastDriveApp ? fastDriveApp.getStatus() : null;
});

ipcMain.handle('get-statistics', () => {
  return fastDriveApp ? fastDriveApp.getStatistics() : null;
});

ipcMain.handle('get-battery-history', (event, hours) => {
  return fastDriveApp ? fastDriveApp.getBatteryHistory(hours) : [];
});

ipcMain.handle('get-charging-history', (event, limit) => {
  return fastDriveApp ? fastDriveApp.getChargingHistory(limit) : [];
});

ipcMain.handle('get-usage-history', (event, limit) => {
  return fastDriveApp ? fastDriveApp.getUsageHistory(limit) : [];
});

// App lifecycle
app.whenReady().then(async () => {
  createWindow();
  createTray();
  await initFastDriveApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (fastDriveApp) {
    await fastDriveApp.stop();
  }
});
