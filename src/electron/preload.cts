import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopStorage", {
  selectLegacyDataDirectory: (): Promise<string | undefined> =>
    ipcRenderer.invoke("storage:select-legacy-data-directory")
});

contextBridge.exposeInMainWorld("desktopExtension", {
  openInstallDirectory: (): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("extension:open-install-directory")
});
