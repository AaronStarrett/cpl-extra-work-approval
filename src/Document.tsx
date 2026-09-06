import type { Decision, Snapshot, PublishedVersion } from '../shared/domain';
import { LIMITATIONS } from '../shared/domain';
import { dateOnly, dateTime, money } from './api';
import { Icon } from './components';

export const statusLabels: Record<string, string> = { draft: 'Draft', awaiting: 'Awaiting response', approved: 'Approved', declined: 'Declined', changes_requested: 'Changes requested', revoked: 'Access revoked', expired: 'Link expired', superseded: 'Superseded' };

export function Status({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{status === 'approved' && <Icon name="check" size={13} />}{statusLabels[status] || status}</span>;
}

export function Receipt({ decision, reference }: { decision: Decision; reference: string }) {
  return <section className={`receipt receipt-${decision.action}`} aria-label="Recorded response"><div className="receipt-mark"><Icon name={decision.action === 'approved' ? 'check' : 'book'} size={25} /></div><div><p className="eyebrow">Response recorded</p><h2>{statusLabels[decision.action]}</h2><p>By <strong>{decision.respondentName}</strong>, as entered</p><p className="small">{dateTime(decision.decidedAt)}</p><p className="small mono">{reference} · Version {decision.versionNumber}</p>{decision.comment && <div className="receipt-comment"><span className="detail-label">Respondent’s comment</span><p className="preserve">{decision.comment}</p></div>}</div></section>;
}

function TextSection({ title, value }: { title: string; value: string }) {
  if (!value.trim()) return null;
  return <div className="document-text"><h3>{title}</h3><p className="preserve">{value}</p></div>;
}

export function WorkDocument({ snapshot, reference = 'New request', version, retainUntil, preview = false }: { snapshot: Snapshot; reference?: string; version?: PublishedVersion; retainUntil?: string; preview?: boolean }) {
  return <article className="work-document" aria-label={preview ? 'Read-only customer preview' : 'Published extra work request'}>
    <header className="document-header"><div><p className="eyebrow">Extra work request</p><p className="document-business">{snapshot.businessName || 'Your business name'}</p><p className="small preserve">{snapshot.businessContact || 'Your business contact'}</p></div><div className="document-reference"><span className="mono">{reference}</span><span>{version ? `Version ${version.versionNumber}` : 'Unpublished preview'}</span>{version && <Status status={version.status} />}</div></header>
    <div className="document-title"><span className="eyebrow">Prepared for {snapshot.customerName || 'your customer'}</span><h1>{snapshot.jobTitle || 'Your job title'}</h1>{snapshot.customerContact && <p className="small preserve">{snapshot.customerContact}</p>}<p className="small preserve">{[snapshot.jobReference, snapshot.serviceAddress].filter(Boolean).join(' · ') || 'Your job reference or service address'}</p></div>
    <section className="document-section"><div className="section-number">01</div><div><h2>The extra work</h2><TextSection title="Scope of additional work" value={snapshot.scope} /><TextSection title="Reason for the change" value={snapshot.reason} /><TextSection title="Included" value={snapshot.includedWork} /><TextSection title="Not included" value={snapshot.exclusions} /></div></section>
    <section className="document-section"><div className="section-number">02</div><div><h2>Additional price</h2><div className="document-items"><div className="document-item table-labels"><span>Description</span><span>Qty × unit</span><span>Amount</span></div>{snapshot.lineItems.map((line, index) => <div className="document-item" key={index}><span className="preserve">{line.description || 'Line item description'}</span><span className="numeric">{line.quantity} × {money(line.unitPriceCents)}</span><span className="numeric">{money(line.quantity * line.unitPriceCents)}</span></div>)}</div><dl className="document-totals"><div><dt>Subtotal</dt><dd>{money(snapshot.subtotalCents)}</dd></div><div><dt>Tax entered by contractor</dt><dd>{money(snapshot.taxCents)}</dd></div><div className="grand-total"><dt>Total additional amount <span>USD</span></dt><dd>{money(snapshot.totalCents)}</dd></div></dl><p className="field-hint">This is the price of the extra work described here. It is not the total original contract or a payment receipt.</p></div></section>
    <section className="document-section"><div className="section-number">03</div><div><h2>Timing & terms</h2><div className="timing-statement"><span className="detail-label">Contractor’s declared schedule impact</span><p className="preserve">{snapshot.schedule.kind === 'none' ? 'No schedule impact stated by the contractor.' : snapshot.schedule.kind === 'discuss' ? 'Timing to be discussed.' : snapshot.schedule.details}</p></div>{snapshot.schedule.kind !== 'impact' && snapshot.schedule.details && <TextSection title="Timing detail" value={snapshot.schedule.details} />}<TextSection title="Terms supplied by the contractor" value={snapshot.terms} /></div></section>
    {version?.decision && <Receipt decision={version.decision} reference={reference} />}
    <footer className="document-footer">{version && <><p>Published {dateTime(version.publishedAt)}<br />Review link expires {dateTime(version.expiresAt)}.</p><p className="record-hash">Content SHA-256: <span className="mono">{version.contentHash}</span></p></>}{retainUntil && <p>Hosted record available until <strong>{dateOnly(retainUntil)}</strong>. Link expiry is separate from record deletion. Retain your own exported copy.</p>}<p>{LIMITATIONS}</p><div className="document-attribution"><span>Extra Work Approval</span><span>By Cyber Pirate Labs</span></div></footer>
  </article>;
}
