export {};

declare global {
  interface Window {
    desktopStorage?: {
      selectLegacyDataDirectory(): Promise<string | undefined>;
      selectMigrationPackageDestination(): Promise<string | undefined>;
      selectMigrationPackageFile(): Promise<string | undefined>;
      openBackupsDirectory(): Promise<{ ok: boolean; message: string }>;
      applyPreparedRestore(restoreId: string): Promise<{ ok: boolean; message: string }>;
    };
    desktopExtension?: {
      openInstallDirectory(): Promise<{ ok: boolean; message: string }>;
    };
  }
}
