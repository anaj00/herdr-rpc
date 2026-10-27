import test from 'node:test';
import assert from 'node:assert/strict';
import { eventFocus, withFocus, focusFile } from '../src/focus.js';
import { makeActivity } from '../src/presence.js';

const snapshot = {
  focused_workspace_id: 'wA', focused_pane_id: 'wA:p1',
  workspaces: [
    { workspace_id: 'wA', label: 'herdr-rpc', focused: true, active_tab_id: 'wA:t1' },
    { workspace_id: 'w9', label: 'bi', focused: false, active_tab_id: 'w9:t1' },
  ],
  layouts: [{ workspace_id: 'w9', tab_id: 'w9:t1', focused_pane_id: 'w9:p8' }],
  panes: [{ workspace_id: 'w9', tab_id: 'w9:t1', pane_id: 'w9:p8', cwd: 'E:\\Work\\bi' }],
  agents: [
    { workspace_id: 'wA', pane_id: 'wA:p1', agent: 'opencode', agent_status: 'working', focused: true },
    { workspace_id: 'w9', pane_id: 'w9:p8', agent: 'claude', agent_status: 'idle', focused: false },
  ],
};
test('space focus event overrides stale server focus, including agent selection', () => {
  const focus = eventFocus({ event: 'workspace_focused', data: { type: 'workspace_focused', workspace_id: 'w9' } }, 'workspace.focused');
  const activity = makeActivity(withFocus(snapshot, focus), { showProject: true }, 123);
  assert.equal(activity.details, 'bi · claude · Idle');
  assert.equal(activity.state, 'Herding 2 agents');
  assert.equal(snapshot.focused_workspace_id, 'wA');
});
test('pane events identify exact pane; invalid workspace is ignored', () => {
  const focus = eventFocus({ workspace_id: 'w9', pane_id: 'w9:p8' }, 'pane.focused');
  assert.equal(withFocus(snapshot, focus).focused_pane_id, 'w9:p8');
  assert.equal(withFocus(snapshot, { workspaceId: 'removed' }), snapshot);
  assert.throws(() => eventFocus({}, 'workspace.focused'), /workspace ID/);
});
test('focus files are isolated by Herdr session', () => {
  assert.notEqual(focusFile('state', { HERDR_SOCKET_PATH: 'session-one' }), focusFile('state', { HERDR_SOCKET_PATH: 'session-two' }));
});
