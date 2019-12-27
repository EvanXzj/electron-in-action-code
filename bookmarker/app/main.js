const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

app.on('ready', () => {
    console.log('Hello From Electron');
    mainWindow = new BrowserWindow({webPreferences: {nodeIntegration: true}});
    mainWindow.loadURL(path.join('file://', __dirname, '/index.html'))
})
