const marked = require("marked");
const path = require("path");
const { remote, ipcRenderer } = require("electron");
const mainProcess = remote.require("./main.js");
const currentWindow = remote.getCurrentWindow();

let filePath = null;
let originalContent = "";

const isDifferentContent = content => content !== markdownView.value;

const markdownView = document.querySelector("#markdown");
const htmlView = document.querySelector("#html");
const newFileButton = document.querySelector("#new-file");
const openFileButton = document.querySelector("#open-file");
const saveMarkdownButton = document.querySelector("#save-markdown");
const revertButton = document.querySelector("#revert");
const saveHtmlButton = document.querySelector("#save-html");
const showFileButton = document.querySelector("#show-file");
const openInDefaultButton = document.querySelector("#open-in-default");

const renderMarkdownToHtml = markdown => {
  htmlView.innerHTML = marked(markdown);
};

markdownView.addEventListener("keyup", event => {
  const content = event.target.value;
  renderMarkdownToHtml(content);
  updateUserInterface(content !== originalContent);
});

openFileButton.addEventListener("click", () => {
  mainProcess.getFileFromUser(currentWindow);
});

ipcRenderer.on("file-opened", async (event, file, content) => {
  if (currentWindow.isDocumentEdited() && isDifferentContent(content)) {
    const result = await remote.dialog.showMessageBox(currentWindow, {
      type: "warning",
      title: "Overwrite Current Unsaved Changes?",
      message:
        "Opening a new file in this window will overwrite your unsaved changes. Open this file anyway?",
      buttons: ["Yes", "Cancel"],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 1) {
      return;
    }
  }

  renderFile(file, content);
});

const renderFile = (file, content) => {
  filePath = file;
  originalContent = content;
  console.log(content);

  markdownView.value = content;
  renderMarkdownToHtml(content);

  updateUserInterface();
};

ipcRenderer.on("file-changed", async (event, file, content) => {
  if (!isDifferentContent(content)) {
    return;
  }

  const result = await remote.dialog.showMessageBox(currentWindow, {
    type: "warning",
    title: "Overwrite Current Unsaved Changes?",
    message: "Another application has changed this file. Load changes?",
    buttons: ["Yes", "Cancel"],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 1) {
    return;
  }

  renderFile(file, content);
});

newFileButton.addEventListener("click", () => {
  mainProcess.createWindow();
});

const updateUserInterface = (isEdited = false) => {
  let title = "Fire Sale";
  if (filePath) {
    title = `${path.basename(filePath)} - ${title}`;
  }

  if (isEdited) {
    title = `${title} (Edited)`;
  }

  currentWindow.setTitle(title);
  currentWindow.setDocumentEdited(isEdited);

  saveMarkdownButton.disabled = !isEdited;
  revertButton.disabled = !isEdited;
};

saveHtmlButton.addEventListener("click", () => {
  mainProcess.saveHtml(currentWindow, htmlView.innerHTML);
});

saveMarkdownButton.addEventListener("click", () => {
  mainProcess.saveMarkdown(currentWindow, filePath, markdownView.value);
});

revertButton.addEventListener("click", () => {
  markdownView.value = originalContent;
  renderMarkdownToHtml(originalContent);
  updateUserInterface();
});

// drag-and-drop feature
document.addEventListener("dragstart", event => event.preventDefault());
document.addEventListener("dragover", event => event.preventDefault());
document.addEventListener("dragleave", event => event.preventDefault());
document.addEventListener("drop", event => event.preventDefault());

const getDraggedFile = event => event.dataTransfer.items[0];
const getDroppedFile = event => event.dataTransfer.files[0];

const fileTypeIsSupported = file => {
  console.log(file);
  return ["text/plain", ""].includes(file.type);
};

markdownView.addEventListener("dragover", event => {
  const file = getDraggedFile(event);

  if (fileTypeIsSupported(file)) {
    markdownView.classList.add("drag-over");
  } else {
    markdownView.classList.add("drag-error");
  }
});

markdownView.addEventListener("dragleave", () => {
  markdownView.classList.remove("drag-over");
  markdownView.classList.remove("drag-error");
});

markdownView.addEventListener("drop", event => {
  const file = getDroppedFile(event);

  if (!fileTypeIsSupported(file)) {
    alert("That file type is not support");
  } else {
    mainProcess.openFile(currentWindow, file.path);
  }

  markdownView.classList.remove("drag-over");
  markdownView.classList.remove("drag-error");
});
