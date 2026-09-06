import { z } from 'zod';

const text = (max: number) => z.string().max(max);
export const lineItemSchema = z.object({ description: text(500), quantity: z.number().int().min(1).max(999), unitPriceCents: z.number().int().min(0).max(100_000_000) }).strict();
export const draftSchema = z.object({
  businessName: text(200), businessContact: text(500), customerName: text(200), customerContact: text(500),
  jobTitle: text(300), jobReference: text(100), serviceAddress: text(500), reason: text(3000), scope: text(10000), includedWork: text(5000), exclusions: text(5000),
  lineItems: z.array(lineItemSchema).max(20), taxCents: z.number().int().min(0).max(100_000_000), zeroCostConfirmed: z.boolean(),
  schedule: z.object({ kind: z.enum(['none', 'impact', 'discuss']), details: text(2000) }).strict(),
  terms: text(10000), privateNotes: text(10000), linkedRequestId: z.string().uuid().nullable().optional(),
}).strict().superRefine((value,ctx)=>{
  if(value.lineItems.reduce((sum,line)=>sum+line.quantity*line.unitPriceCents,0)+value.taxCents>1_000_000_000)ctx.addIssue({code:'custom',path:['lineItems'],message:'The additional amount must not exceed $10,000,000.'});
});
export type DraftInput = z.infer<typeof draftSchema>;
export const settingsSchema = z.object({ businessName: text(200), businessContact: text(500), defaultExpiryDays: z.number().int().min(1).max(90) }).strict();
export type Settings = z.infer<typeof settingsSchema>;
export const decisionSchema = z.object({ action: z.enum(['approved','declined','changes_requested']), respondentName: z.string().trim().min(2).max(200), comment: text(3000), acknowledged: z.boolean(), idempotencyKey: z.string().uuid() }).strict().superRefine((v,ctx) => {
  if (v.action === 'approved' && !v.acknowledged) ctx.addIssue({code:'custom',path:['acknowledged'],message:'Acknowledge the scope, additional amount, and timing before approving.'});
  if (v.action === 'changes_requested' && v.comment.trim().length < 10) ctx.addIssue({code:'custom',path:['comment'],message:'Describe the requested change in at least 10 characters.'});
});
export type DecisionInput = z.infer<typeof decisionSchema>;
export type RequestStatus = 'draft'|'awaiting'|'approved'|'declined'|'changes_requested'|'revoked'|'expired';
export type VersionStatus = Exclude<RequestStatus,'draft'>|'superseded';
export interface Price { subtotalCents: number; taxCents: number; totalCents: number; currency: 'USD' }
export type Snapshot = Omit<DraftInput,'privateNotes'> & Price;
export interface Decision { action: DecisionInput['action']; respondentName: string; comment: string; acknowledged: boolean; decidedAt: string; timezone: 'UTC'; versionId: string; versionNumber: number; contentHash: string }
export interface PublishedVersion { id: string; versionNumber: number; status: VersionStatus; accessRevoked: boolean; publishedAt: string; expiresAt: string; contentHash: string; snapshot: Snapshot; decision: Decision|null }
export interface RequestSummary { id: string; reference: string; jobTitle: string; customerName: string; status: RequestStatus; createdAt: string; updatedAt: string; retainUntil: string; totalCents: number; currentVersion: number; revision: number }
export interface OwnerRequest extends RequestSummary { draft: DraftInput; versions: PublishedVersion[] }
export interface ReviewRecord extends PublishedVersion { requestId: string; reference: string; retainUntil: string; limitations: string }
export const LIMITATIONS = 'This record captures a response from the holder of a private link. Names and contact details are declarations, not verified identity. It is not proof of payment or certified e-signature software. Review your business terms before contractual reliance and retain your own exported copy.';
export function blankDraft(settings?: Partial<Settings>): DraftInput { return {businessName:settings?.businessName??'',businessContact:settings?.businessContact??'',customerName:'',customerContact:'',jobTitle:'',jobReference:'',serviceAddress:'',reason:'',scope:'',includedWork:'',exclusions:'',lineItems:[{description:'',quantity:1,unitPriceCents:0}],taxCents:0,zeroCostConfirmed:false,schedule:{kind:'discuss',details:''},terms:'',privateNotes:'',linkedRequestId:null}; }
export function calculatePrice(input: Pick<DraftInput,'lineItems'|'taxCents'>): Price {
  const lines = z.array(lineItemSchema).max(20).parse(input.lineItems);
  const taxCents = z.number().int().min(0).max(100_000_000).parse(input.taxCents);
  const subtotalCents = lines.reduce((sum,line)=>sum+line.quantity*line.unitPriceCents,0);
  const totalCents = subtotalCents + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 1_000_000_000) throw new Error('The additional amount must not exceed $10,000,000.');
  return {subtotalCents,taxCents,totalCents,currency:'USD'};
}
export function publicationErrors(input: DraftInput): string[] {
  const errors: string[] = [];
  for (const [field,label] of [['businessName','Business name'],['businessContact','Business contact'],['customerName','Customer name'],['jobTitle','Job title'],['reason','Reason for change'],['scope','Extra scope']] as const) if (!input[field].trim()) errors.push(`${label} is required.`);
  if (!input.serviceAddress.trim() && !input.jobReference.trim()) errors.push('A service address or job reference is required.');
  if (!input.lineItems.length || input.lineItems.some(line=>!line.description.trim())) errors.push('At least one described line item is required.');
  if (input.schedule.kind === 'impact' && !input.schedule.details.trim()) errors.push('Describe the declared timing impact.');
  try { if (calculatePrice(input).totalCents === 0 && !input.zeroCostConfirmed) errors.push('Explicitly confirm this zero-cost scope change.'); } catch(error) { errors.push(error instanceof Error ? error.message : 'Invalid additional amount.'); }
  return errors;
}
export function createSnapshot(input: DraftInput): Snapshot {
  const valid = draftSchema.parse(input); const errors=publicationErrors(valid);
  if (errors.length) throw new Error(errors.join(' '));
  const {privateNotes: _privateNotes,...visible}=valid;
  return {...visible,...calculatePrice(valid)};
}
export function canPublish(status: RequestStatus): boolean { return status !== 'approved'; }
export function money(cents: number): string { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100); }
