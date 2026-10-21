import { createHash } from 'node:crypto';
import path from 'node:path';

export function focusFile(stateDir, env = process.env) {
  const session = env.HERDR_SOCKET_PATH ?? env.HERDR_SESSION ?? 'default';
  const key = createHash('sha256').update(session).digest('hex').slice(0, 16);
  return path.join(stateDir, `focus-${key}.json`);
}

export function eventFocus(event, type) {
  const data = event.data ?? event;
  const workspaceId = data.workspace_id;
  if (typeof workspaceId !== 'string') throw new Error('Focus event has no workspace ID');
  return {
    workspaceId,
    ...(type !== 'workspace.focused' && typeof data.tab_id === 'string' ? { tabId: data.tab_id } : {}),
    ...(type === 'pane.focused' && typeof data.pane_id === 'string' ? { paneId: data.pane_id } : {}),
  };
}

export function withFocus(snapshot, focus) {
  const workspace = snapshot.workspaces.find(w => w.workspace_id === focus?.workspaceId);
  if (!workspace) return snapshot;
  const pane = snapshot.panes?.find(p => p.pane_id === focus.paneId && p.workspace_id === workspace.workspace_id);
  const tabId = pane?.tab_id ?? focus.tabId ?? workspace.active_tab_id;
  const layout = snapshot.layouts?.find(l => l.tab_id === tabId && l.workspace_id === workspace.workspace_id);
  const paneId = pane?.pane_id ?? layout?.focused_pane_id;
  return {
    ...snapshot,
    focused_workspace_id: workspace.workspace_id,
    focused_tab_id: tabId,
    focused_pane_id: paneId,
    workspaces: snapshot.workspaces.map(w => ({ ...w, focused: w.workspace_id === workspace.workspace_id })),
    agents: snapshot.agents.map(a => ({ ...a, focused: a.pane_id === paneId })),
  };
}
