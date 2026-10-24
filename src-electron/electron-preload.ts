import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sixStemSeparation', {
  run: (stemNames: string[]) => ipcRenderer.invoke('six-stem-separation:run', stemNames),
})
