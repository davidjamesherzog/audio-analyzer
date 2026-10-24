import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sixStemSeparation', {
  run: () => ipcRenderer.invoke('six-stem-separation:run'),
})
