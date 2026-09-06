import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../../worker';
import { blankDraft, type OwnerRequest } from '../../shared/domain';

const origin = 'https://example.com';
const syntheticDraft = () => ({ ...blankDraft(), businessName: 'Fictional Fence Co.', businessContact: 'owner@example.test', customerName: 'Sample Customer', jobTitle: 'Side gate', jobReference: 'FICTIONAL-350', reason: 'Customer requested access.', scope: 'Add one side gate.', lineItems: [{ description: 'Gate', quantity: 1, unitPriceCents: 35000 }], schedule: { kind: 'impact', details: 'One additional working day.' } });
let nextClient = 1;
class Client {
  cookie = ''; ip = `198.51.100.${nextClient++}`;
  async call(path: string, method = 'GET', data?: unknown) {
    const result = await SELF.fetch(`${origin}${path}`, { method, headers: { Origin: origin, 'X-CPL-Request': '1', 'Content-Type': 'application/json', 'CF-Connecting-IP': this.ip, Cookie: this.cookie }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    const cookie = result.headers.get('set-cookie'); if (cookie) this.cookie = cookie.split(';')[0]!;
    return result;
  }
}
async function state(workspaceId: string) {
  return {
    workspace: await env.DB.prepare('SELECT * FROM workspaces WHERE id=?').bind(workspaceId).first(),
    requests: (await env.DB.prepare('SELECT * FROM requests WHERE workspace_id=? ORDER BY id').bind(workspaceId).all()).results,
    versions: (await env.DB.prepare('SELECT v.* FROM versions v JOIN requests r ON r.id=v.request_id WHERE r.workspace_id=? ORDER BY v.id').bind(workspaceId).all()).results,
    events: (await env.DB.prepare('SELECT e.* FROM events e JOIN requests r ON r.id=e.request_id WHERE r.workspace_id=? ORDER BY e.id').bind(workspaceId).all()).results,
  };
}

describe('owner commit-time authorization', () => {
  beforeEach(async () => { await env.DB.batch([env.DB.prepare('DELETE FROM workspaces'), env.DB.prepare('DELETE FROM rate_limits')]); });

  it.each(['recovery rotate', 'workspace retry', 'settings', 'session revoke', 'workspace delete', 'request create', 'request create retry', 'request edit', 'request delete', 'request revoke', 'customer link rotate', 'publish', 'publish retry'])(
    'rejects delayed %s after the owner session has been revoked', async operation => {
      const oldOwner = new Client(), otherOwner = new Client();
      const created = await oldOwner.call('/api/workspaces', 'POST', {});
      expect(created.status).toBe(201);
      const workspace = await created.json() as { workspace: { id: string }; managementLink: string };
      expect((await otherOwner.call('/api/recover', 'POST', { token: new URL(workspace.managementLink).hash.slice(1) })).status).toBe(200);
      const createInput = { draft: syntheticDraft(), idempotencyKey: crypto.randomUUID() };
      const saved = await oldOwner.call('/api/requests', 'POST', createInput);
      const draft = (await saved.json() as { request: OwnerRequest }).request;
      const publishInput = { revision: draft.revision, expiryDays: 7, idempotencyKey: crypto.randomUUID() };
      const published = await oldOwner.call(`/api/requests/${draft.id}/publish`, 'POST', publishInput);
      expect(published.status).toBe(200);
      const record = (await published.json() as { request: OwnerRequest }).request;
      const operations: Record<string, { path: string; method: string; input: unknown }> = {
        'recovery rotate': { path: '/api/recovery/rotate', method: 'POST', input: {} },
        'workspace retry': { path: '/api/workspaces', method: 'POST', input: {} },
        settings: { path: '/api/settings', method: 'PUT', input: { businessName: 'Unauthorized change', businessContact: 'changed@example.test', defaultExpiryDays: 3 } },
        'session revoke': { path: '/api/sessions/revoke', method: 'POST', input: {} },
        'workspace delete': { path: '/api/workspace', method: 'DELETE', input: { confirmation: 'DELETE' } },
        'request create': { path: '/api/requests', method: 'POST', input: { draft: syntheticDraft(), idempotencyKey: crypto.randomUUID() } },
        'request create retry': { path: '/api/requests', method: 'POST', input: createInput },
        'request edit': { path: `/api/requests/${record.id}`, method: 'PUT', input: { revision: record.revision, draft: { ...syntheticDraft(), scope: 'Unauthorized change' } } },
        'request delete': { path: `/api/requests/${record.id}`, method: 'DELETE', input: { revision: record.revision } },
        'request revoke': { path: `/api/requests/${record.id}/revoke`, method: 'POST', input: { revision: record.revision } },
        'customer link rotate': { path: `/api/requests/${record.id}/link/rotate`, method: 'POST', input: { revision: record.revision } },
        publish: { path: `/api/requests/${record.id}/publish`, method: 'POST', input: { revision: record.revision, expiryDays: 7, idempotencyKey: crypto.randomUUID() } },
        'publish retry': { path: `/api/requests/${record.id}/publish`, method: 'POST', input: publishInput },
      };
      const target = operations[operation]!;
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      let signalBodyRead!: () => void;
      const bodyRead = new Promise<void>(resolve => { signalBodyRead = resolve; });
      const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; }, pull() { signalBodyRead(); } }, { highWaterMark: 0 });
      const pending = worker.fetch(new Request(`${origin}${target.path}`, { method: target.method, headers: { Origin: origin, 'X-CPL-Request': '1', 'Content-Type': 'application/json', Cookie: oldOwner.cookie, 'CF-Connecting-IP': oldOwner.ip }, body: stream }), env as unknown as Env);
      // highWaterMark=0 signals only after body().read(), which follows owner().
      await bodyRead;
      const before = await state(workspace.workspace.id);
      expect((await otherOwner.call('/api/sessions/revoke', 'POST', {})).status).toBe(200);
      controller.enqueue(new TextEncoder().encode(JSON.stringify(target.input)));
      controller.close();
      const response = await pending;
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain('managementLink');
      expect(await state(workspace.workspace.id)).toEqual(before);
      expect((await env.DB.prepare('SELECT COUNT(*) n FROM owner_mutation_guards').first<{ n: number }>())?.n).toBe(0);
    },
  );

  it.each(['session', 'workspace'])('does not revive a %s that expires while the body is delayed', async expiry => {
    const client = new Client();
    const created = await client.call('/api/workspaces', 'POST', {});
    const workspace = await created.json() as { workspace: { id: string } };
    let controller!: ReadableStreamDefaultController<Uint8Array>, signal!: () => void;
    const ready = new Promise<void>(resolve => { signal = resolve; });
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; }, pull() { signal(); } }, { highWaterMark: 0 });
    const pending = worker.fetch(new Request(`${origin}/api/requests`, { method: 'POST', headers: { Origin: origin, 'X-CPL-Request': '1', 'Content-Type': 'application/json', Cookie: client.cookie }, body: stream }), env as unknown as Env);
    await ready;
    if (expiry === 'session') await env.DB.prepare("UPDATE owner_sessions SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE workspace_id=?").bind(workspace.workspace.id).run();
    else await env.DB.prepare("UPDATE workspaces SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(workspace.workspace.id).run();
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ draft: syntheticDraft(), idempotencyKey: crypto.randomUUID() }))); controller.close();
    expect((await pending).status).toBe(401);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM requests').first<{ n: number }>())?.n).toBe(0);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM owner_mutation_guards').first<{ n: number }>())?.n).toBe(0);
  });

  it('rejects insecure production API traffic before storage or token processing', async () => {
    const request = new Request('http://example.com/api/recover', { method: 'POST', headers: { Origin: 'http://example.com', 'X-CPL-Request': '1', 'Content-Type': 'application/json' }, body: '{}' });
    const response = await worker.fetch(request, { ENVIRONMENT: 'production' } as Env);
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'HTTPS is required for private API access.', code: 'https_required' });
    expect(response.headers.get('cache-control')).toContain('no-store');
    const redirect = await worker.fetch(new Request('http://example.com/recover?discard=private'), { ENVIRONMENT: 'production' } as Env);
    expect(redirect.status).toBe(308); expect(redirect.headers.get('location')).toBe('https://example.com/recover');
  });
});
