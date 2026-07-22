export {};

declare global {
  interface Window {
    desktopStorage?: {
      selectLegacyDataDirectory(): Promise<string | undefined>;
    };
    desktopExtension?: {
      openInstallDirectory(): Promise<{ ok: boolean; message: string }>;
    };
  }
}
