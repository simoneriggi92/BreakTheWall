/** A provider-neutral request: each route maps it to its own API and schema mechanism. */
export interface CompletionRequest {
  model: string;
  instructions: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  schemaName: string;
  schema: Record<string, unknown>;
  /** Output cap for short probes; generation leaves it to the route. */
  maxTokens?: number;
}
export interface Completer { complete(request: CompletionRequest, signal: AbortSignal, onProgress: (received: number) => void): Promise<string> }
