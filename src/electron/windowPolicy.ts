export const desktopWebPreferences = Object.freeze({
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true
});

export function isAllowedAppNavigation(targetUrl: string, appUrl: string): boolean {
  try {
    return new URL(targetUrl).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
