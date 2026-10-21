export interface RuntimeInfo { platform: string; mode: 'desktop' | 'browser'; }
export interface DesktopBridge { getRuntime(): Promise<RuntimeInfo>; }

declare global {
  interface Window { breakTheWall?: DesktopBridge; }
}
