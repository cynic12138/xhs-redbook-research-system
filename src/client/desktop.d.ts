export {};

declare global {
  interface Window {
    desktopStorage?: {
      selectLegacyDataDirectory(): Promise<string | undefined>;
    };
  }
}
