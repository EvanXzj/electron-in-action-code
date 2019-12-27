const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, dialog } = require("electron");

const windows = new Set();
const openFiles = new Map();

app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") {
    return false;
  }

  app.quit();
});

app.on("activate", (event, hasVisibleWindow) => {
  if (!hasVisibleWindow) {
    createWindow();
  }
});

app.on("will-finish-launching", () => {
  app.on("open-file", (event, file) => {
    const window = createWindow();
    window.once("ready-to-show", () => {
      openFile(window, file);
    });
  });
});

const getFileFromUser = async targetWindow => {
  const result = await dialog.showOpenDialog(targetWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Markdown files",
        extensions: ["md", "markdown", "txt"]
      }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return;
  }

  const file = result.filePaths[0];
  openFile(targetWindow, file);
};

const openFile = (targetWindow, path) => {
  const content = fs.readFileSync(path).toString();
  app.addRecentDocument(path);
  targetWindow.setRepresentedFilename(path);
  targetWindow.webContents.send("file-opened", path, content);
  startWatchingFile(targetWindow, path);
};

const createWindow = () => {
  let x, y;
  const currentWindow = BrowserWindow.getFocusedWindow();

  if (currentWindow) {
    const [cx, cy] = currentWindow.getPosition();
    x = cx + 20;
    y = cy + 20;
  }

  let newWindow = new BrowserWindow({
    x,
    y,
    show: false,
    webPreferences: { nodeIntegration: true }
  });

  newWindow.loadURL(path.join("file://", __dirname, "/index.html"));

  newWindow.once("ready-to-show", () => {
    newWindow.show();
  });

  newWindow.on("close", async event => {
    if (newWindow.isDocumentEdited()) {
      event.preventDefault();

      const result = await dialog.showMessageBox(newWindow, {
        type: "warning",
        title: "Quit with Unsaved Changed?",
        message: "Your changes will be lost permanently if you do not save.",
        buttons: ["Quit Anyway", "Cancel"],
        defaultId: 0,
        cancelId: 1
      });

      if (result.response === 0) {
        newWindow.destroy();
      }
    }
  });

  newWindow.on("closed", () => {
    windows.delete(newWindow);
    stopWatchingFile(newWindow);
    newWindow = null;
  });

  windows.add(newWindow);
  return newWindow;
};

const saveHtml = async (targetWindow, content) => {
  const file = await dialog.showSaveDialog(targetWindow, {
    title: "Save HTML",
    defaultPath: app.getPath("documents"),
    filters: [{ name: "HTML Files", extensions: ["html", "htm"] }]
  });

  if (!file.canceled && file.filePath) {
    fs.writeFileSync(file.filePath, content);
  }
};

const saveMarkdown = async (targetWindow, file, content) => {
  if (!file) {
    file = await dialog.showSaveDialog(targetWindow, {
      title: "Save Markdown",
      defaultPath: app.getPath("documents"),
      filters: [{ name: "Markdown Files", extensions: ["md", "markdown"] }]
    });
  }

  if (typeof file === "string" && !file) {
    return;
  }

  if (typeof file === "object" && (file.canceled || !file.filePath)) {
    return;
  }

  file = typeof file === "object" ? file.filePath : file;
  fs.writeFileSync(file, content);
  openFile(targetWindow, file);
};

const stopWatchingFile = targetWindow => {
  if (openFiles.has(targetWindow)) {
    openFiles.get(targetWindow).close();
    openFiles.delete(targetWindow);
  }
};

const startWatchingFile = (targetWindow, file) => {
  stopWatchingFile(targetWindow);
  const watcher = fs.watch(file, event => {
    if (event === "change") {
      const content = fs.readFileSync(file).toString();
      targetWindow.webContents.send("file-changed", file, content);
    }
  });

  openFiles.set(targetWindow, watcher);
};

exports.getFileFromUser = getFileFromUser;
exports.createWindow = createWindow;
exports.saveHtml = saveHtml;
exports.saveMarkdown = saveMarkdown;
exports.openFile = openFile;
