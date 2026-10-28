import { useEffect, useState } from 'react';
import { Check, Copy, Plug } from 'lucide-react';
import type { AssistantSetup, StudioBridge } from '../core/provider';
import { usePreferences } from './preferences';

/**
 * "Use with Claude" (P-20261028-mcp-integration M4): the switch for the local entry point, the Claude Desktop extension
 * and the Claude Code command. Desktop only.
 */
export function AssistantsMenu({ studio }: { studio?: StudioBridge }) {
  const { t, settings, update } = usePreferences();
  const [setup, setSetup] = useState<AssistantSetup>();
  const [desktop, setDesktop] = useState<'opened' | 'failed'>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void studio?.assistantSetup?.().then(x => { if (active) setSetup(x); }).catch(() => {});
    return () => { active = false; };
  }, [studio]);
  if (!studio?.assistantSetup) return null;
  const a = t.assistants;
  const on = settings?.assistants === true;
  const addToDesktop = async () => setDesktop((await studio.addToClaudeDesktop?.())?.ok ? 'opened' : 'failed');
  const copy = async () => { await studio.copyClaudeCodeCommand?.(); setCopied(true); };

  return <details className="assistants-menu"><summary aria-label={a.label}><Plug size={16}/><span>{a.label}</span></summary><section className="assistants-panel" aria-labelledby="assistants-title">
    <h2 id="assistants-title">{a.title}</h2>
    <p>{a.intro}</p>
    <label className="assistants-switch"><input type="checkbox" checked={on} disabled={!settings} onChange={e => update({ assistants: e.target.checked })}/><span><strong>{a.connect}</strong><small>{on ? a.connectOn : a.connectOff}</small></span></label>
    <div className="assistants-step"><h3>{a.desktopTitle}</h3><p>{a.desktopHint}</p>
      <button className="subtle" disabled={!setup?.desktopExtension} onClick={() => void addToDesktop()}>{a.desktopAdd}</button>
      {setup && !setup.desktopExtension && <p className="micro plain">{a.desktopMissing}</p>}
      {desktop && <p className="micro plain" role="status">{desktop === 'opened' ? a.desktopOpened : a.desktopFailed}</p>}</div>
    <div className="assistants-step"><h3>{a.codeTitle}</h3><p>{a.codeHint}</p>
      {setup && <code className="assistants-command">{setup.claudeCode}</code>}
      <button className="subtle" disabled={!setup} onClick={() => void copy()}>{copied ? <Check size={15}/> : <Copy size={15}/>}{copied ? a.copied : a.copy}</button>
      {setup?.platform === 'win32' && <p className="micro plain">{a.codeWindows}</p>}</div>
    <p className="micro plain">{a.promptHint}</p>
    <p className="micro plain">{a.privacy}</p>
    <p className="micro plain">{a.remove}</p>
  </section></details>;
}
