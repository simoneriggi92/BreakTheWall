export function crc32(bytes: Uint8Array): number;
export function zip(entries: [string, Uint8Array | string][]): Buffer;
export function mcpbManifest(version: string, prompts?: { name: string; description: string; arguments: { name: string }[]; text: string }[]): {
  manifest_version: string; name: string; display_name: string; version: string; description: string;
  author: { name: string; url?: string }; homepage: string; license: string; icon: string;
  server: { type: 'node'; entry_point: string; mcp_config: { command: string; args: string[] } };
  tools: { name: string; description: string }[];
  prompts: { name: string; description: string; arguments: string[]; text: string }[];
  compatibility: { platforms: string[]; runtimes: { node: string } };
};
