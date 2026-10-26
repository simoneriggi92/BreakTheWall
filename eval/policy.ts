/**
 * The approved plan's budget for ChatGPT evaluation (P-20261024-disassembly v4, D9): every generation spends the
 * owner's plan. 3 setups × 4 public cases × 2 attempts = 24, up to 4 replacements, and up to 2 on the owner's private
 * document; plus up to 4 parts taken apart on demand (v5, D14). The ledger in .local keeps the count across runs.
 */
export const CHATGPT_MAX_ATTEMPTS = 2;
export const CHATGPT_BUDGET = { total: 30, private: 2, expansions: 4 } as const;
export const LEDGER = '.local/eval/chatgpt-budget.jsonl';
export interface LedgerEntry { run: string; case: string; private: boolean; setup: string; at: string; kind?: 'expansion' }

export interface Plan { allowed: boolean; privateAllowed: boolean; attempts: number; publicPlanned: number; privatePlanned: number; expansionsPlanned?: number; used: LedgerEntry[] }
/** Why a ChatGPT evaluation must not start, or undefined when it may. */
export function chatgptRunRefusal({ allowed, privateAllowed, attempts, publicPlanned, privatePlanned, expansionsPlanned = 0, used: ledger }: Plan): string | undefined {
  const used = ledger.filter(x => x.kind !== 'expansion');
  const usedExpansions = ledger.length - used.length;
  if (!allowed) return 'ChatGPT runs spend your plan usage: add --allow-chatgpt to confirm.';
  if (attempts > CHATGPT_MAX_ATTEMPTS) return `The approved plan caps ChatGPT evaluation at ${CHATGPT_MAX_ATTEMPTS} attempts per case and setup.`;
  if (privatePlanned && !privateAllowed) return 'A private case would be sent to OpenAI: add --private-to-chatgpt only after the owner has confirmed that this is allowed.';
  const usedPrivate = used.filter(x => x.private).length;
  if (usedPrivate + privatePlanned > CHATGPT_BUDGET.private) return `The budget allows ${CHATGPT_BUDGET.private} ChatGPT generations on private cases; ${usedPrivate} used, ${privatePlanned} planned.`;
  const publicLimit = CHATGPT_BUDGET.total - CHATGPT_BUDGET.private;
  const usedPublic = used.length - usedPrivate;
  if (usedPublic + publicPlanned > publicLimit) return `The budget allows ${publicLimit} ChatGPT generations on public cases; ${usedPublic} used, ${publicPlanned} planned.`;
  if (usedExpansions + expansionsPlanned > CHATGPT_BUDGET.expansions) return `The budget allows ${CHATGPT_BUDGET.expansions} parts taken apart on ChatGPT; ${usedExpansions} used, ${expansionsPlanned} planned.`;
  return undefined;
}
