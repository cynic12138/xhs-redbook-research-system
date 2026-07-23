import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopStorage", {
  selectLegacyDataDirectory: (): Promise<string | undefined> =>
    ipcRenderer.invoke("storage:select-legacy-data-directory"),
  selectMigrationPackageDestination: (): Promise<string | undefined> =>
    ipcRenderer.invoke("storage:select-migration-package-destination"),
  selectMigrationPackageFile: (): Promise<string | undefined> =>
    ipcRenderer.invoke("storage:select-migration-package-file"),
  openBackupsDirectory: (): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("storage:open-backups-directory"),
  applyPreparedRestore: (restoreId: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("storage:apply-prepared-restore", restoreId)
});

contextBridge.exposeInMainWorld("desktopExtension", {
  openInstallDirectory: (): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("extension:open-install-directory")
});
