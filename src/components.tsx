import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function Icon({ name, size = 18 }: { name: 'arrow' | 'plus' | 'check' | 'lock' | 'copy' | 'print' | 'close' | 'download' | 'refresh' | 'book' | 'settings' | 'trash' | 'external'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" /></>,
    print: <><path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 13h10v8H7zM17 11h.01" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11-2l3 7M4 12l3 7a7 7 0 0 0 11-2" /></>,
    book: <><path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 3v18M11 7h5M11 11h5" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
    external: <><path d="M14 3h7v7M10 14 21 3M10 3H3v18h18v-7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Field({ label, hint, children, className = '', optional = false }: { label: string; hint?: string; children: ReactNode; className?: string; optional?: boolean }) {
  return <label className={`field ${className}`}><span className="field-label">{label}{optional && <span className="optional">optional</span>}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = ref.current;
    const selector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]';
    (el?.querySelector(selector) as HTMLElement | null)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab' && el) {
        const nodes = Array.from(el.querySelectorAll<HTMLElement>(selector)).filter(n => n.offsetParent !== null);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop"><div ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>{children}</div></div>;
}

export function CopyButton({ value, label = 'Copy link', className = 'button secondary' }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setError(''); }
    catch { setError('Clipboard access was unavailable. Select and copy the link below.'); }
  }
  return <><button className={className} onClick={() => void copy()}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied to clipboard' : label}</button><span className="sr-only" role="status">{copied ? 'Link copied to clipboard.' : ''}</span>{error && <p className="form-error" role="alert">{error}</p>}</>;
}

type TurnstileApi = { render: (element: HTMLElement, options: { sitekey: string; action: 'create' | 'publish'; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme: string }) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: TurnstileApi } }
let scriptPromise: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; reject(new Error('Verification could not load. Please check your connection.')); };
    document.head.append(script);
  });
  return scriptPromise;
}

export function Protection({ siteKey, action, onToken }: { siteKey: string | null; action: 'create' | 'publish'; onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onToken);
  callbackRef.current = onToken;
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let widgetId: string | undefined;
    if (!siteKey) return;
    void loadTurnstile().then(() => {
      if (!active || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, { sitekey: siteKey, action, callback: token => callbackRef.current(token), 'expired-callback': () => callbackRef.current(''), 'error-callback': () => { callbackRef.current(''); setError('Verification was interrupted. Please reload to try again.'); }, theme: 'light' });
    }).catch(e => setError(e instanceof Error ? e.message : 'Verification unavailable.'));
    return () => { active = false; if (widgetId) window.turnstile?.remove(widgetId); };
  }, [siteKey, action]);
  return <div className="protection"><p className="field-hint">A quick security check protects this public service.</p>{siteKey ? <div ref={ref} /> : <p className="form-error">Saving is unavailable because server verification has not been configured.</p>}{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
