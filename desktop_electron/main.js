const path = require('path');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');

let mainWindow = null;
let chatWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    Menu.setApplicationMenu(null);

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.on('close', () => {
        mainWindow.webContents.send('app-quitting');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (chatWindow) {
            chatWindow.close();
            chatWindow = null;
        }
    });
}

function createChatWindow() {
    if (chatWindow) {
        chatWindow.focus();
        return;
    }

    chatWindow = new BrowserWindow({
        width: 450,
        height: 700,
        minWidth: 380,
        minHeight: 500,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        title: 'Chat',
        autoHideMenuBar: true,
    });

    chatWindow.setMenuBarVisibility(false);

    chatWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
        hash: '/chat-external',
    });

    chatWindow.on('closed', () => {
        chatWindow = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat-reattached');
        }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat-detached');
    }
}

ipcMain.on('detach-chat', () => {
    createChatWindow();
});

ipcMain.on('close-chat-window', () => {
    if (chatWindow) {
        chatWindow.close();
    }
});

ipcMain.on('focus-chat-window', () => {
    if (chatWindow) {
        chatWindow.focus();
    }
});

ipcMain.handle('is-chat-detached', () => {
    return chatWindow !== null && !chatWindow.isDestroyed();
});

ipcMain.handle('is-detached-window', (event) => {
    return chatWindow !== null && !chatWindow.isDestroyed() && event.sender === chatWindow.webContents;
});

app.whenReady().then(createWindow);

app.on('before-quit', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-quitting');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
