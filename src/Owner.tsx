import { useCallback, useEffect, useRef, useState } from 'react';
import { blankDraft, calculatePrice, publicationErrors, type DraftInput, type OwnerRequest, type RequestSummary, type Settings, type Snapshot } from '../shared/domain';
import { api, ApiError, dateOnly, dateTime, downloadExport, downloadText, messageOf, money } from './api';
import { CopyButton, Dialog, Field, Icon, Protection } from './components';
import { Editor, safePrice } from './Editor';
import { Status, WorkDocument } from './Document';

export interface Workspace { id: string; createdAt: string; settings: Settings }
export interface AppConfig { turnstileSiteKey: string | null; protectionRequired: boolean; retentionDays: number; defaultExpiryDays: number }
type View = 'compose' | 'ledger' | 'settings' | 'record';

function snapshotOf(draft: DraftInput): Snapshot {
  const { privateNotes, ...visible } = draft;
  void privateNotes;
  return { ...visible, ...calculatePrice(draft) };
}

export function Owner({ initialWorkspace, config, notice = '' }: { initialWorkspace: Workspace | null; config: AppConfig; notice?: string }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [view, setView] = useState<View>(initialWorkspace ? 'ledger' : 'compose');
  const [draft, setDraft] = useState<DraftInput>(() => blankDraft(initialWorkspace?.settings));
  const [request, setRequest] = useState<OwnerRequest | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [refreshedAt, setRefreshedAt] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [managementLink, setManagementLink] = useState('');
  const [customerLink, setCustomerLink] = useState('');
  const [expiryDays, setExpiryDays] = useState(initialWorkspace?.settings.defaultExpiryDays ?? config.defaultExpiryDays);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [protectionCycle, setProtectionCycle] = useState(0);
  const [settings, setSettings] = useState<Settings>(initialWorkspace?.settings ?? { businessName: '', businessContact: '', defaultExpiryDays: 7 });
  const [savedSettings, setSavedSettings] = useState(false);
  const [deleting, setDeleting] = useState<'request' | 'workspace' | 'sessions' | 'revoke' | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [historyVersion, setHistoryVersion] = useState<number | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const createKey = useRef(crypto.randomUUID());
  const publishKey = useRef(crypto.randomUUID());
  const latest = request?.versions.reduce((a, b) => a.versionNumber > b.versionNumber ? a : b, request.versions[0]);
  const shownVersion = request?.versions.find(v => v.versionNumber === historyVersion) ?? latest;

  const refresh = useCallback(async () => {
    if (!workspace) return;
    try {
      setLedgerLoading(true);
      const result = await api<{ requests: RequestSummary[]; refreshedAt: string }>('/api/requests');
      setRequests(result.requests);
      setRefreshedAt(result.refreshedAt);
      if (view === 'record' && request) {
        const details = await api<{ request: OwnerRequest }>(`/api/requests/${request.id}`);
        setRequest(details.request);
      }
    } catch (err) { setError(messageOf(err)); }
    finally { setLedgerLoading(false); }
  }, [workspace, view, request?.id]); // Refreshing published records never overwrites a composing draft.

  useEffect(() => { if (workspace) void refresh(); }, [workspace?.id, view]);
  useEffect(() => {
    if (!workspace || (view !== 'ledger' && view !== 'record')) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [workspace, view, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);

  function resetProtection() { setTurnstileToken(''); setProtectionCycle(value => value + 1); }
  function changeDraft(value: DraftInput) { setDraft(value); setDirty(true); setPrepared(false); setError(''); setValidation([]); publishKey.current = crypto.randomUUID(); }
  function navigate(next: View) {
    if (dirty && next !== 'compose' && !window.confirm('Leave this draft? Changes since your last save will be lost.')) return;
    setView(next); setError(''); setDirty(false); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function newRequest(linkedRequestId?: string) {
    if (dirty && !window.confirm('Start another request? Changes since your last save will be lost.')) return;
    setDraft({ ...blankDraft(workspace?.settings), ...(linkedRequestId ? { linkedRequestId, businessName: draft.businessName, businessContact: draft.businessContact, customerName: draft.customerName, customerContact: draft.customerContact, jobTitle: draft.jobTitle, jobReference: draft.jobReference, serviceAddress: draft.serviceAddress } : {}) });
    setRequest(null); setHistoryVersion(null); setDirty(false); setError(''); setValidation([]); setPrepared(false); setView('compose'); createKey.current = crypto.randomUUID(); publishKey.current = crypto.randomUUID(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function saveDraft(): Promise<OwnerRequest | null> {
    setBusy(true); setError('');
    try {
      if (!workspace) {
        if (config.protectionRequired && !turnstileToken) throw new Error('Complete the security check before saving your first draft.');
        const created = await api<{ workspace: Workspace; managementLink: string }>('/api/workspaces', 'POST', { turnstileToken });
        setWorkspace(created.workspace); setSettings(created.workspace.settings); setManagementLink(created.managementLink); resetProtection();
      }
      const result = request
        ? await api<{ request: OwnerRequest }>(`/api/requests/${request.id}`, 'PUT', { draft, revision: request.revision })
        : await api<{ request: OwnerRequest }>('/api/requests', 'POST', { draft, idempotencyKey: createKey.current });
      setRequest(result.request); setDraft(result.request.draft); setDirty(false); publishKey.current = crypto.randomUUID();
      return result.request;
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? `${messageOf(err)} Reopen this request from the ledger to load the latest saved state. Your current entries have been kept here.` : messageOf(err));
      return null;
    } finally { setBusy(false); }
  }
  function openPreview() { if (!safePrice(draft)) { setError('Correct the line-item quantities and amounts before previewing.'); return; } setPreview(true); setPrepared(false); setError(''); setValidation([]); }
  async function preparePublication() {
    const errors = publicationErrors(draft);
    if (errors.length) { setValidation(errors); return; }
    const saved = !request || dirty ? await saveDraft() : request;
    if (saved) { setPrepared(true); setValidation([]); }
  }
  async function publish() {
    if (!request) return;
    setBusy(true); setError('');
    try {
      if (config.protectionRequired && !turnstileToken) throw new Error('Complete the security check before publishing.');
      const result = await api<{ request: OwnerRequest; customerLink: string }>(`/api/requests/${request.id}/publish`, 'POST', { revision: request.revision, expiryDays, idempotencyKey: publishKey.current, turnstileToken });
      setRequest(result.request); setCustomerLink(result.customerLink); setPreview(false); setPrepared(false); setView('record'); setHistoryVersion(null); setDirty(false); resetProtection();
    } catch (err) { setError(messageOf(err)); resetProtection(); }
    finally { setBusy(false); }
  }
  async function openRequest(id: string) {
    setBusy(true); setError('');
    try { const result = await api<{ request: OwnerRequest }>(`/api/requests/${id}`); setRequest(result.request); setDraft(result.request.draft); setDirty(false); setHistoryVersion(null); setView(result.request.currentVersion ? 'record' : 'compose'); window.scrollTo({ top: 0, behavior: 'instant' }); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function rotateCustomerLink() {
    if (!request) return;
    setBusy(true); setError('');
    try { const result = await api<{ request: OwnerRequest; customerLink: string }>(`/api/requests/${request.id}/link/rotate`, 'POST', { revision: request.revision }); setRequest(result.request); setCustomerLink(result.customerLink); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function action(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (err) { setError(messageOf(err)); } finally { setBusy(false); } }
  async function confirmDestructive() {
    await action(async () => {
      if (deleting === 'revoke' && request) { const result = await api<{ request: OwnerRequest }>(`/api/requests/${request.id}/revoke`, 'POST', { revision: request.revision }); setRequest(result.request); setCustomerLink(''); }
      if (deleting === 'request' && request) { await api(`/api/requests/${request.id}`, 'DELETE', { revision: request.revision }); setRequest(null); setView('ledger'); await refresh(); }
      if (deleting === 'workspace') { await api('/api/workspace', 'DELETE', { confirmation: deleteConfirmation }); window.location.assign('/'); }
      if (deleting === 'sessions') { await api('/api/sessions/revoke', 'POST', {}); window.location.assign('/'); }
      setDeleting(null); setDeleteConfirmation('');
    });
  }

  return <>
    <header className="app-header"><button className="brand" onClick={() => workspace ? navigate('ledger') : undefined}><span className="brand-mark">E<span>+</span></span><span>Extra Work Approval<small>BY CYBER PIRATE LABS</small></span></button><nav aria-label="Notebook navigation">{workspace && <button className={view === 'ledger' ? 'nav-active' : ''} onClick={() => navigate('ledger')}><Icon name="book" size={17} /><span>Ledger</span></button>}<button className={view === 'compose' ? 'nav-active' : ''} onClick={() => newRequest()}><Icon name="plus" size={17} /><span>New request</span></button>{workspace && <button className={view === 'settings' ? 'nav-active' : ''} onClick={() => navigate('settings')} aria-label="Workspace settings"><Icon name="settings" size={18} /><span className="settings-nav-label">Settings</span></button>}</nav></header>
    <main id="main-content" className={`owner-main view-${view}`}>
      {notice && <p className="success-note" role="status"><Icon name="check" />{notice}</p>}
      {view === 'compose' && <Editor draft={draft} request={request} onChange={changeDraft} onSave={() => void saveDraft()} onPreview={openPreview} onPublish={openPreview} busy={busy} dirty={dirty} error={error} validation={validation} firstTime={!workspace}>{!workspace && <div className="first-save-note"><Icon name="lock" size={17} /><p>Your first save creates a private workspace on this device. You’ll receive a separate recovery link to keep. Hosted records are retained for {config.retentionDays} days.</p></div>}{!workspace && !preview && config.protectionRequired && <Protection action="create" key={protectionCycle} siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />}</Editor>}
      {view === 'ledger' && <div className="ledger"><div className="page-heading"><div><p className="eyebrow">Your private notebook</p><h1>The job ledger.</h1><p>Each request, its exact versions, and the response that came back.</p></div><button className="button primary" onClick={() => newRequest()}><Icon name="plus" />New request</button></div><div className="ledger-toolbar"><span><Icon name="lock" size={14} />Only your workspace</span><button className="text-button" disabled={ledgerLoading} onClick={() => void refresh()}><Icon name="refresh" size={15} />{ledgerLoading ? 'Refreshing…' : 'Refresh'}</button></div>{error && <p className="form-error" role="alert">{error}</p>}{requests.length ? <div className="ledger-table-wrap"><table className="ledger-table"><thead><tr><th>Reference / date</th><th>Job / customer</th><th className="amount-cell">Added amount</th><th>Response</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{requests.map(item => <tr key={item.id}><td><span className="mono reference">{item.reference}</span><small>{dateOnly(item.createdAt)}</small></td><td><button className="ledger-job" onClick={() => void openRequest(item.id)}>{item.jobTitle || 'Untitled draft'}</button><small>{item.customerName || 'Customer not entered'}</small></td><td className="amount-cell numeric">{money(item.totalCents)}<small>additional · USD</small></td><td><Status status={item.status} /></td><td><button className="icon-button" aria-label={`Open ${item.jobTitle || item.reference}`} onClick={() => void openRequest(item.id)}><Icon name="arrow" /></button></td></tr>)}</tbody></table></div> : <div className="empty-ledger"><Icon name="book" size={42} /><h2>A clean page.</h2><p>Save your first request and it will appear here.<br />Your customer’s response will stay with the work.</p><button className="button secondary" onClick={() => newRequest()}>Write a request<Icon name="arrow" /></button></div>}<div className="ledger-footer"><span>{refreshedAt ? `Last refreshed ${dateTime(refreshedAt)}` : 'Loading your private records…'}</span><span>Refreshes every 30 seconds while visible.</span></div></div>}
      {view === 'record' && request && shownVersion && <><div className="record-toolbar no-print"><button className="text-button" onClick={() => navigate('ledger')}>← Back to ledger</button><div className="action-row"><button className="button quiet" disabled={busy} onClick={() => void action(() => downloadExport(`/api/requests/${request.id}/export`, `${request.reference}-record.json`))}><Icon name="download" />Export record</button><button className="button secondary" onClick={() => window.print()}><Icon name="print" />Print / Save as PDF</button></div></div><div className="record-controls no-print"><div><p className="eyebrow">Private owner record</p><p>{latest?.decision ? 'The response below is stored with this exact version.' : 'Share the customer link, then refresh here for the recorded response.'}</p></div><div className="action-row">{request.status === 'awaiting' && <button className="button primary" disabled={busy} onClick={() => void rotateCustomerLink()}><Icon name="copy" />Issue customer link</button>}{request.status === 'approved' ? <button className="button secondary" onClick={() => newRequest(request.id)}>Create linked change<Icon name="plus" /></button> : <button className="button secondary" onClick={() => { setView('compose'); setPrepared(false); }}>Prepare revised version<Icon name="arrow" /></button>}</div></div>{error && <p className="form-error no-print" role="alert">{error}</p>}<div className="version-bar no-print"><label>Published version <select aria-label="Published version" value={shownVersion.versionNumber} onChange={e => setHistoryVersion(Number(e.target.value))}>{[...request.versions].sort((a,b) => b.versionNumber - a.versionNumber).map(v => <option key={v.id} value={v.versionNumber}>Version {v.versionNumber} · {v.versionNumber === latest?.versionNumber ? 'latest' : 'historical'}</option>)}</select></label><button className="text-button" disabled={ledgerLoading} onClick={() => void refresh()}><Icon name="refresh" size={15} />Refresh response</button></div><WorkDocument snapshot={shownVersion.snapshot} version={shownVersion} reference={request.reference} retainUntil={request.retainUntil} />{request.draft.privateNotes && <details className="private-notes owner-record-notes no-print"><summary><Icon name="lock" size={15} />Private owner notes</summary><p className="preserve">{request.draft.privateNotes}</p></details>}<div className="record-bottom no-print"><span>{refreshedAt ? `Last refreshed ${dateTime(refreshedAt)}` : ''}</span><div className="action-row"><button className="text-button" disabled={busy} onClick={() => setDeleting('revoke')}>Revoke customer access</button><button className="text-button danger-text" disabled={busy} onClick={() => setDeleting('request')}>Delete record</button></div></div></>}
      {view === 'settings' && workspace && <div className="settings-page"><div className="page-heading"><div><p className="eyebrow">Your private workspace</p><h1>Good records start here.</h1><p>Business defaults, access, and the lifetime of your work.</p></div><Icon name="settings" size={32} /></div><section className="settings-section"><h2>Business details</h2><p>Used to prefill new requests. Published versions keep the details originally shared.</p><form onSubmit={e => { e.preventDefault(); void action(async () => { const result = await api<{ workspace: Workspace }>('/api/settings', 'PUT', settings); setWorkspace(result.workspace); setSettings(result.workspace.settings); setExpiryDays(result.workspace.settings.defaultExpiryDays); setSavedSettings(true); }); }}><div className="field-grid"><Field label="Business name"><input value={settings.businessName} maxLength={200} onChange={e => { setSettings({ ...settings, businessName: e.target.value }); setSavedSettings(false); }} /></Field><Field label="Business contact"><input value={settings.businessContact} maxLength={500} onChange={e => { setSettings({ ...settings, businessContact: e.target.value }); setSavedSettings(false); }} /></Field></div><Field label="Default customer link expiry" hint="Days after publication, always limited by the record’s retention date."><select value={settings.defaultExpiryDays} onChange={e => { setSettings({ ...settings, defaultExpiryDays: Number(e.target.value) }); setSavedSettings(false); }}>{[1,3,7,14,30,60,90].map(days => <option value={days} key={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}</select></Field><div className="action-row"><button className="button secondary" disabled={busy}>Save settings</button>{savedSettings && <span className="save-state" role="status"><Icon name="check" />Settings saved</span>}</div></form></section><section className="settings-section"><span className="eyebrow private-label"><Icon name="lock" size={13} />PRIVATE MANAGEMENT ACCESS</span><h2>Your recovery link is your key.</h2><p>Anyone holding it can manage this workspace. Never send it to a customer. There is no identity-based recovery without that link or an active owner session.</p><div className="action-row"><button className="button secondary" disabled={busy} onClick={() => void action(async () => { const result = await api<{ managementLink: string }>('/api/recovery/rotate', 'POST', {}); setManagementLink(result.managementLink); })}>Reissue private recovery link</button><button className="button quiet" disabled={busy} onClick={() => setDeleting('sessions')}>Revoke all owner sessions</button></div><p className="field-hint">Reissuing invalidates the old recovery link. Revoking sessions signs out every owner device; your recovery link remains valid.</p></section><section className="settings-section"><h2>Keep your own copy.</h2><p>Records are hosted for {config.retentionDays} days from creation. Each request shows its exact retain-until date. Expiring a review link closes access; deleting a record removes it from the application. Provider backups may persist under provider retention practices.</p><div className="action-row"><button className="button secondary" disabled={busy} onClick={() => void action(() => downloadExport('/api/workspace/export', 'extra-work-approval-workspace.json'))}><Icon name="download" />Export workspace</button><button className="button quiet danger-text" onClick={() => setDeleting('workspace')} disabled={busy}>Delete workspace & records</button></div></section>{error && <p className="form-error" role="alert">{error}</p>}</div>}
    </main>
    <footer className="app-footer no-print"><span>Made for the work between the lines.</span><span>Extra Work Approval <span className="footer-divider">/</span> By Cyber Pirate Labs</span></footer>
    {managementLink ? <Dialog title="Keep your private workspace key." onClose={() => setManagementLink('')}><div className="dialog-content"><span className="eyebrow private-label"><Icon name="lock" size={14} />PRIVATE — MANAGEMENT ACCESS</span><p>This link opens and manages your entire workspace on another device. <strong>Never send it to a customer.</strong></p><p>Keep a copy now. The full link is shown only when it is issued. Without it or an active session, there is no identity-based recovery.</p><label className="field"><span className="field-label">Private management / recovery link</span><textarea className="secret-link" value={managementLink} readOnly rows={3} spellCheck={false} onFocus={e => e.target.select()} /></label><div className="action-row"><CopyButton value={managementLink} label="Copy PRIVATE recovery link" /><button className="button quiet" onClick={() => downloadText(`PRIVATE WORKSPACE MANAGEMENT LINK\nNever send this link to customers. Anyone holding it can manage your workspace.\n\n${managementLink}\n\nStore securely. Reissue it from Settings if exposed.`, 'PRIVATE-extra-work-workspace-key.txt', 'text/plain')}><Icon name="download" />Download key</button></div><button className="button primary full-width" onClick={() => setManagementLink('')}>I’ve kept my private link<Icon name="check" /></button></div></Dialog> : customerLink ? <Dialog title="Ready for your customer." onClose={() => setCustomerLink('')}><div className="dialog-content"><span className="eyebrow">CUSTOMER REVIEW LINK</span><p>The published version is stored. Copy this link into your existing text or email conversation. Creating a link does not send a message.</p><Field label="Customer review link" hint="This link opens only this published request. Its holder can respond; it can be forwarded."><textarea className="secret-link" value={customerLink} readOnly rows={3} spellCheck={false} onFocus={e => e.target.select()} /></Field><CopyButton value={customerLink} label="Copy customer link" className="button primary" />{latest && <p className="field-hint">Expires {dateTime(latest.expiresAt)}. Issuing another customer link invalidates the previous link.</p>}<button className="button quiet full-width" onClick={() => setCustomerLink('')}>Back to the record<Icon name="arrow" /></button></div></Dialog> : preview ? <Dialog title="Review the customer view" onClose={() => !busy && setPreview(false)} wide><div className="preview-notice"><Icon name="lock" size={16} /><span>Read-only preview. Customer response actions are unavailable here.</span></div><WorkDocument snapshot={snapshotOf(draft)} reference={request?.reference} retainUntil={request?.retainUntil} preview /><div className="preview-publish no-print">{validation.length > 0 && <div className="validation" role="alert"><strong>Complete these details to publish:</strong><ul>{validation.map(value => <li key={value}>{value}</li>)}</ul></div>}{error && <p className="form-error" role="alert">{error}</p>}{prepared && request ? <><h3>Publish this exact version</h3><p>Publishing creates an immutable record of the scope, price, timing, and terms above. The customer link grants access to that version.</p><p className="retention-callout">Hosted record available until <strong>{dateOnly(request.retainUntil)}</strong>.</p><Field label="Customer link expires after"><select value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))}>{[1,3,7,14,30,60,90].map(days => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}</select></Field><p className="field-hint">The server limits expiry to the record’s retain-until date.</p>{config.protectionRequired && <Protection action="publish" key={protectionCycle} siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />}<div className="action-row"><button className="button secondary" disabled={busy} onClick={() => setPreview(false)}>Back to editing</button><button className="button primary" disabled={busy || (config.protectionRequired && !turnstileToken)} onClick={() => void publish()}>{busy ? 'Publishing…' : 'Publish request'}<Icon name="arrow" /></button></div></> : <><p>Review the details above. Save the draft to see its exact retention date before publishing.</p>{!workspace && config.protectionRequired && <Protection action="create" key={`preview-${protectionCycle}`} siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />}<div className="action-row"><button className="button secondary" disabled={busy} onClick={() => setPreview(false)}>Back to editing</button><button className="button primary" disabled={busy} onClick={() => void preparePublication()}>{busy ? 'Saving…' : 'Save & prepare publication'}<Icon name="arrow" /></button></div></>}</div></Dialog> : null}
    {deleting && <Dialog title={deleting === 'workspace' ? 'Delete this workspace?' : deleting === 'sessions' ? 'Sign out every owner device?' : deleting === 'revoke' ? 'Revoke customer access?' : 'Delete this request?'} onClose={() => !busy && setDeleting(null)}><div className="dialog-content"><p>{deleting === 'workspace' ? 'All requests, versions, and responses will be removed from this application. Export what you need first. This cannot be undone here.' : deleting === 'sessions' ? 'All owner sessions, including this one, will end. Keep your private recovery link before continuing; it will be needed to return.' : deleting === 'revoke' ? 'Customer links for this request will stop working. Historical responses, including approvals, remain in your owner record.' : 'This removes the request, its versions, and responses from this application. Export your record first. This cannot be undone here.'}</p>{deleting === 'workspace' && <Field label="Type DELETE to confirm"><input autoComplete="off" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} /></Field>}{error && <p className="form-error" role="alert">{error}</p>}<div className="action-row"><button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="button danger" disabled={busy || (deleting === 'workspace' && deleteConfirmation !== 'DELETE')} onClick={() => void confirmDestructive()}>{busy ? 'Working…' : deleting === 'sessions' ? 'Revoke owner sessions' : deleting === 'revoke' ? 'Revoke customer access' : 'Delete permanently'}</button></div></div></Dialog>}
  </>;
}
