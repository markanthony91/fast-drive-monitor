/**
 * Electron Main Process - Fast Drive
 *
 * Processo principal do Electron que inicia o servidor API
 * e carrega a interface web.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { ApiServer } = require('./src/api/server');

let mainWindow = null;
let tray = null;
let apiServer = null;

const SERVER_PORT = 18080;

/**
 * Cria a janela principal
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    resizable: true,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Fast Drive Monitor'
  });

  // Carregar interface do servidor local
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

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
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAGASURBVFhH7ZaxTsJAGMe/uwICgou4ODq4OPgKDr6Dg4ODk5ODi4ODg4ODg4ODg4ODg4ODg4ODf9p7tJSjd20vBhK/5EIv9/3+1+u1LWOMYYnxYIn5g8BnwGKxGFwmk8Hj8Xjw3tfX18H7tVpNqtUqhBBwMpnAYDAAS6qsA+/3+4OLxKdSqUC5XIZEIgG7uxfgOM7gcrlcw+l0Cna73cElyXq9Dkej0eDW6/VgtVqFXC4H6XQakskk+L4Pp9MJ9Ho9aLfbMBwOwbIsd7NarUK1WoVCoQDpdBqy2SxkMhlIJBLged7gfD6H4XAIJ5MJDAYDGAwGYNvuwFqtBvV6HWq1GpTLZSgWi5DJZCCdTkMqlYJkMgm+74PneXA+n8P5fA6z2QzG4zGMRiOwbNt1t9vtQqfTgXa7Dc1mE+r1OlQqFSgWi5DL5SCTyUAqlYJEIgGu68LZbAan0ymcTCZwPB7DYDAAy7IddzqdQrvdhlarhVarhWq1CsViEfL5PGSzWUgmk+C6Lniehx/xB5G/tSqNIj+LAAAAAElFTkSuQmCC'
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Fast Drive',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: `Servidor: localhost:${SERVER_PORT}`,
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

  tray.setToolTip('Fast Drive Monitor');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

/**
 * Inicializa servidor API
 */
async function initApiServer() {
  apiServer = new ApiServer({
    port: SERVER_PORT,
    host: 'localhost',
    dataDir: path.join(app.getPath('userData'), 'data')
  });

  await apiServer.initialize();
  console.log(`[Electron] Servidor iniciado em http://localhost:${SERVER_PORT}`);
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    await initApiServer();
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('[Electron] Erro ao iniciar:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // No macOS, manter app rodando em background
  if (process.platform !== 'darwin') {
    // Não fechar, apenas esconder
  }
});

app.on('before-quit', async () => {
  if (apiServer) {
    await apiServer.shutdown();
  }
});
