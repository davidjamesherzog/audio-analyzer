import { existsSync } from 'node:fs'

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

import { resolveSidecarDirectory, runSixStemSidecar } from './six-stem-sidecar'

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

const currentDir = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | undefined

ipcMain.handle('six-stem-poc:run', async () => {
  const input = await dialog.showOpenDialog({
    filters: [{ name: 'WAV or MP3 audio', extensions: ['wav', 'mp3'] }],
    properties: ['openFile'],
    title: 'Choose a WAV or MP3 for native six-stem separation',
  })
  if (input.canceled || !input.filePaths[0]) return { canceled: true }

  const output = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose an output directory for the six stems',
  })
  if (output.canceled || !output.filePaths[0]) return { canceled: true }

  const sidecarDirectory = resolveSidecarDirectory({
    isDevelopment: Boolean(process.env.DEV),
    processWorkingDirectory: process.cwd(),
    resourcesPath: process.resourcesPath,
  })
  const environmentPython = path.join(
    sidecarDirectory,
    '.venv',
    platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  )
  const pythonExecutable =
    process.env.AUDIO_ANALYZER_PYTHON ??
    (existsSync(environmentPython) ? environmentPython : platform === 'win32' ? 'python' : 'python3')

  try {
    const result = await runSixStemSidecar({
      inputPath: input.filePaths[0],
      outputDirectory: output.filePaths[0],
      pythonExecutable,
      scriptPath: path.join(sidecarDirectory, 'separate_6stems.py'),
    })
    return { canceled: false, outputDirectory: result.outputDirectory }
  } catch (error) {
    return {
      canceled: false,
      error: error instanceof Error ? error.message : 'Native six-stem separation failed.',
    }
  }
})

async function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(
          process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
          'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION,
        ),
      ),
    },
  })

  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL)
  } else {
    await mainWindow.loadFile('index.html')
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools()
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools()
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

void app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === undefined) {
    void createWindow()
  }
})
