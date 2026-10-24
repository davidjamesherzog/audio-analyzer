import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sixStemPoc', {
  run: () => ipcRenderer.invoke('six-stem-poc:run'),
})
