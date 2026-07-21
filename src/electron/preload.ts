import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopStorage", {
  selectLegacyDataDirectory: (): Promise<string | undefined> =>
    ipcRenderer.invoke("storage:select-legacy-data-directory")
});
