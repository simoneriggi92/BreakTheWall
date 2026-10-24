/** The plan caps ChatGPT evaluation at this many attempts per case: each one spends the owner's plan. */
export const CHATGPT_MAX_RUNS = 2;

/** Why a ChatGPT evaluation must not start, or undefined when it may. */
export function chatgptRunRefusal({ allowed, runs }: { allowed: boolean; runs: number }): string | undefined {
  if (!allowed) return 'ChatGPT runs spend your plan usage: add --allow-chatgpt to confirm.';
  if (runs > CHATGPT_MAX_RUNS) return `The approved plan caps ChatGPT evaluation at ${CHATGPT_MAX_RUNS} attempts per case.`;
  return undefined;
}
