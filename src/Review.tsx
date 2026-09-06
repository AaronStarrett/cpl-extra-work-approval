import { useEffect, useRef, useState } from 'react';
import type { DecisionInput, ReviewRecord } from '../shared/domain';
import { api, dateTime, downloadExport, messageOf, money } from './api';
import { Dialog, Field, Icon } from './components';
import { statusLabels, WorkDocument } from './Document';

const reviewLoads = new Map<string, Promise<{ review: ReviewRecord }>>();
function loadReview(id: string, token: string) {
  const key = id + (token ? ':entry' : ':session');
  if (!reviewLoads.has(key)) reviewLoads.set(key, token ? api<{ review: ReviewRecord }>(`/api/review/${id}/exchange`, 'POST', { token }) : api<{ review: ReviewRecord }>(`/api/review/${id}`));
  return reviewLoads.get(key)!;
}

export function Review({ versionId, token }: { versionId: string; token: string }) {
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<DecisionInput['action'] | null>(null);
  const [respondentName, setName] = useState('');
  const [comment, setComment] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const key = useRef(crypto.randomUUID());
  const nameRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const exchanged = useRef(false);
  useEffect(() => {
    let active = true;
    void loadReview(versionId, token).then(data => { exchanged.current = true; if (active) setReview(data.review); }).catch(err => { if (active) setError(messageOf(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [versionId, token]);
  useEffect(() => { if (action) nameRef.current?.focus(); }, [action]);

  async function refresh() {
    setBusy(true); setError('');
    try { const result = token && !exchanged.current ? await api<{ review: ReviewRecord }>(`/api/review/${versionId}/exchange`, 'POST', { token }) : await api<{ review: ReviewRecord }>(`/api/review/${versionId}`); exchanged.current = true; setReview(result.review); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  function reviewDecision() {
    setFormError('');
    if (respondentName.trim().length < 2) { setFormError('Enter your name before reviewing your response.'); nameRef.current?.focus(); return; }
    if (action === 'approved' && !acknowledged) { setFormError('Acknowledge the scope, additional amount, and timing before approving.'); return; }
    if (action === 'changes_requested' && comment.trim().length < 10) { setFormError('Describe the changes you need in at least 10 characters.'); return; }
    setConfirm(true);
  }
  async function submitDecision() {
    if (!action) return;
    setBusy(true); setFormError('');
    try {
      const response = await api<{ review: ReviewRecord }>(`/api/review/${versionId}/decision`, 'POST', { action, respondentName, comment, acknowledged: action === 'approved' && acknowledged, idempotencyKey: key.current });
      setReview(response.review); setConfirm(false); setAction(null);
      window.setTimeout(() => receiptRef.current?.focus(), 0);
    } catch (err) { setFormError(`${messageOf(err)} Your response has not been confirmed here. Your entries are preserved. Retry the same response, or refresh to check the recorded state.`); }
    finally { setBusy(false); }
  }
  const labels = { approved: 'Approve extra work', changes_requested: 'Request changes', declined: 'Decline' };

  return <div className="customer-app"><a className="skip-link" href="#customer-document">Skip to request</a><header className="customer-header no-print"><span className="brand-mark small-mark">E<span>+</span></span><span>Extra Work Approval</span><span className="customer-private"><Icon name="lock" size={13} />Private request</span></header><main id="customer-document" className="customer-main">
    {loading ? <div className="loading-state" role="status"><span className="loading-dot" /><p>Opening your private request…</p></div> : !review ? <div className="access-message"><Icon name="lock" size={36} /><p className="eyebrow">Private request</p><h1>This request isn’t available.</h1><p>{error || 'The link may have expired or been revoked. Ask your contractor for a current customer link.'}</p><p className="small">A customer review link opens only the request it was issued for.</p><button className="button secondary" disabled={busy} onClick={() => void refresh()}>Try again<Icon name="refresh" /></button></div> : <>
      <div className="customer-intro no-print"><p className="eyebrow">{review.decision ? 'Your response record' : 'For your review'}</p><p>{review.decision ? 'The response below is recorded with this exact version.' : 'Review the added work, price, and timing. Choose the response that’s right for you.'}</p></div>
      <div ref={receiptRef} tabIndex={-1}><WorkDocument snapshot={review.snapshot} reference={review.reference} version={review} retainUntil={review.retainUntil} /></div>
      {review.status === 'awaiting' && !review.decision ? <section className="decision-section no-print" aria-labelledby="decision-heading"><p className="eyebrow">Your decision</p><h2 id="decision-heading">How would you like to respond?</h2><p>One final response is recorded for version {review.versionNumber}. Requesting changes does not approve the work.</p><div className="decision-options">{(['approved', 'changes_requested', 'declined'] as const).map(value => <button key={value} className={`decision-option ${action === value ? 'chosen' : ''} ${value}`} aria-pressed={action === value} onClick={() => { setAction(value); setFormError(''); key.current = crypto.randomUUID(); }}><span>{value === 'approved' ? <Icon name="check" /> : value === 'changes_requested' ? <Icon name="book" /> : <Icon name="close" />}</span><strong>{labels[value]}</strong><Icon name="arrow" size={16} /></button>)}</div>
        {action && <form className="response-form" onSubmit={e => { e.preventDefault(); reviewDecision(); }}><p className="response-choice">Your selected response: <strong>{labels[action]}</strong></p><Field label="Your name" hint="Typed names are declarations, not verified identity."><input ref={nameRef} value={respondentName} onChange={e => { setName(e.target.value); key.current = crypto.randomUUID(); }} autoComplete="name" maxLength={200} required minLength={2} /></Field><Field label={action === 'changes_requested' ? 'What would you like changed?' : action === 'declined' ? 'Reason for declining' : 'Comment'} optional={action !== 'changes_requested'} hint={action === 'changes_requested' ? 'Give the contractor enough detail to prepare a revised request (at least 10 characters).' : undefined}><textarea value={comment} onChange={e => { setComment(e.target.value); key.current = crypto.randomUUID(); }} rows={3} maxLength={3000} minLength={action === 'changes_requested' ? 10 : undefined} required={action === 'changes_requested'} /></Field>{action === 'approved' && <label className="checkbox-field approval-ack"><input type="checkbox" checked={acknowledged} onChange={e => { setAcknowledged(e.target.checked); key.current = crypto.randomUUID(); }} /><span>I have reviewed and agree to the specific additional scope, <strong>{money(review.snapshot.totalCents)} USD additional amount</strong>, and declared timing shown in <strong>version {review.versionNumber}</strong> above.</span></label>}{formError && <p className="form-error" role="alert">{formError}</p>}<button className="button primary" type="submit">Review my response<Icon name="arrow" /></button></form>}
      </section> : !review.decision ? <div className="unavailable-state no-print"><h2>{statusLabels[review.status]}</h2><p>This version can no longer receive a response. Ask your contractor for a current request if you still need to review the work.</p></div> : <div className="receipt-actions no-print" role="status"><Icon name="check" /><p><strong>Your response is recorded.</strong> Keep a copy of this version and its receipt.</p></div>}
      {error && <p className="form-error no-print" role="alert">{error}</p>}<div className="customer-tools no-print"><button className="button secondary" onClick={() => window.print()}><Icon name="print" />Print / Save as PDF</button><button className="button quiet" disabled={busy} onClick={() => { setBusy(true); void downloadExport(`/api/review/${versionId}/export`, `${review.reference}-v${review.versionNumber}.json`).catch(err => setError(messageOf(err))).finally(() => setBusy(false)); }}><Icon name="download" />Export record</button><button className="text-button" disabled={busy} onClick={() => void refresh()}><Icon name="refresh" size={15} />Refresh</button></div>
    </>}
  </main><footer className="customer-footer no-print">Extra Work Approval <span>/</span> By Cyber Pirate Labs</footer>
    {confirm && review && action && <Dialog title="Confirm your response" onClose={() => !busy && setConfirm(false)}><div className="dialog-content"><p className="eyebrow">{review.reference} · VERSION {review.versionNumber}</p><h3>{labels[action]}</h3><dl className="confirmation-details"><div><dt>Job</dt><dd>{review.snapshot.jobTitle}</dd></div><div><dt>Additional amount</dt><dd>{money(review.snapshot.totalCents)} USD</dd></div><div><dt>Name as entered</dt><dd>{respondentName}</dd></div><div><dt>Declared timing</dt><dd>{review.snapshot.schedule.kind === 'impact' ? review.snapshot.schedule.details : review.snapshot.schedule.kind === 'none' ? 'No schedule impact stated by the contractor.' : 'Timing to be discussed.'}</dd></div></dl>{comment && <p className="preserve confirmation-comment">{comment}</p>}<p className="small">This records one final response to the exact published version. {action === 'approved' ? 'No payment is collected.' : action === 'changes_requested' ? 'The extra work is not approved. Any revised version needs a fresh response.' : 'The extra work is not approved.'}</p><p className="field-hint">Review link expires {dateTime(review.expiresAt)}.</p>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="action-row"><button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Back</button><button className={`button ${action === 'approved' ? 'approve-button' : 'primary'}`} disabled={busy} onClick={() => void submitDecision()}>{busy ? 'Recording response…' : action === 'approved' ? 'Confirm approval' : action === 'declined' ? 'Confirm decline' : 'Confirm change request'}<Icon name="check" /></button></div></div></Dialog>}
  </div>;
}
