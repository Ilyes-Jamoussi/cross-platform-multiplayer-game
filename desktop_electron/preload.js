const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    detachChat: () => ipcRenderer.send('detach-chat'),
    closeChatWindow: () => ipcRenderer.send('close-chat-window'),
    focusChatWindow: () => ipcRenderer.send('focus-chat-window'),
    onChatDetached: (callback) => ipcRenderer.on('chat-detached', () => callback()),
    onChatReattached: (callback) => ipcRenderer.on('chat-reattached', () => callback()),
    isChatDetached: () => ipcRenderer.invoke('is-chat-detached'),
    isDetachedWindow: () => ipcRenderer.invoke('is-detached-window'),
    onAppQuitting: (callback) => ipcRenderer.on('app-quitting', () => callback()),
});
