export function pluginTag(releaseTag: string, packageVersion: string): { version: string; tag: string };
export function checkMarketplacePin(marketplace: unknown, tag: string): void;
export function packPlugin(options: { from: string; to: string; version: string; notices: string[] }): void;
export function releaseNotes(changelog: string, version: string): { title: string; notes: string };
