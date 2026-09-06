import { useEffect, useState } from 'react';
import { api, ApiError, messageOf } from './api';
import { Icon } from './components';
import { Owner, type AppConfig, type Workspace } from './Owner';
import { Review } from './Review';

const path = window.location.pathname;
const isRecovery = path === '/recover';
const versionId = path.match(/^\/review\/([a-f0-9-]+)\/?$/i)?.[1];
// Capture capabilities only in transient memory, then remove them before requests or rendering.
const entryToken = (isRecovery || versionId) ? window.location.hash.slice(1) : '';
if (entryToken) window.history.replaceState(null, '', window.location.pathname);
let bootPromise: Promise<{ workspace: Workspace | null; config: AppConfig }> | null = null;

function bootOwner() {
  if (!bootPromise) bootPromise = (async () => {
    const config = await api<AppConfig>('/api/config');
    let workspace: Workspace | null = null;
    if (isRecovery) {
      if (!entryToken) throw new Error('This recovery link is missing its private key. Open the complete private management link you saved.');
      const result = await api<{ workspace: Workspace }>('/api/recover', 'POST', { token: entryToken });
      workspace = result.workspace;
      window.history.replaceState(null, '', '/');
    } else {
      try { const result = await api<{ workspace: Workspace }>('/api/session'); workspace = result.workspace; }
      catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    }
    return { workspace, config };
  })();
  return bootPromise;
}

export default function App() {
  const [state, setState] = useState<{ workspace: Workspace | null; config: AppConfig } | null>(null);
  const [error, setError] = useState('');
  function retry() {
    setError(''); bootPromise = null;
    void bootOwner().then(setState).catch(err => setError(messageOf(err)));
  }
  useEffect(() => {
    if (versionId) return;
    let active = true;
    void bootOwner().then(result => { if (active) setState(result); }).catch(err => { if (active) setError(messageOf(err)); });
    return () => { active = false; };
  }, []);
  if (versionId) return <Review versionId={versionId} token={entryToken} />;
  if (!state) return <div className="boot-screen"><span className="brand-mark">E<span>+</span></span>{error ? <><h1>{isRecovery ? 'Workspace access unavailable.' : 'The notebook couldn’t open.'}</h1><p role="alert">{error}</p><button className="button secondary" onClick={retry}>Try again<Icon name="refresh" /></button>{isRecovery && <a className="text-button" href="/">Open a new blank workspace</a>}</> : <><span className="loading-dot" /><p role="status">Opening Extra Work Approval…</p></>}</div>;
  return <><a className="skip-link" href="#main-content">Skip to content</a><Owner initialWorkspace={state.workspace} config={state.config} notice={isRecovery ? 'Private workspace recovered. You now have management access on this device.' : ''} /></>;
}
