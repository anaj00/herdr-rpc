import test from 'node:test';
import assert from 'node:assert/strict';
import { makeActivity, unwrapSnapshot, clean } from '../src/presence.js';
import { encodeFrame } from '../src/discord.js';

const snapshot = {
  focused_workspace_id: 'w1', focused_pane_id: 'w1:p1',
  workspaces: [{ workspace_id: 'w1', label: 'my-project', focused: true }],
  agents: [{ workspace_id: 'w1', pane_id: 'w1:p1', agent: 'opencode', agent_status: 'working', cwd: 'C:\\private\\my-project', title: 'private prompt' }],
};
test('focused project and semantic agent state, without private content', () => {
  const activity = makeActivity(snapshot, { showProject: true }, 123);
  assert.equal(activity.details, 'my-project · opencode · Working');
  assert.equal(activity.state, '1 agent · 1 working');
  assert.equal(activity.timestamps.start, 123);
  assert.deepEqual(activity.buttons, [{ label: 'Annoy Jana', url: 'https://team-brain.com/s/home-798b26' }]);
  assert.ok(!JSON.stringify(activity).includes('C:\\private'));
  assert.ok(!JSON.stringify(activity).includes('private prompt'));
});
test('privacy switch and blocked status', () => {
  const data = structuredClone(snapshot);
  data.agents[0].agent_status = 'blocked';
  const activity = makeActivity(data, { showProject: false }, 123);
  assert.equal(activity.details, 'opencode · Needs input');
  assert.equal(activity.state, '1 agent · 0 working');
});
test('non-agent focused pane does not select a random agent', () => {
  const activity = makeActivity({ ...snapshot, focused_pane_id: 'w1:p2' }, { showProject: true }, 123);
  assert.equal(activity.details, 'my-project · Managing workspaces');
  assert.equal(activity.state, '1 agent · 1 working');
});
test('agent names distinguish instances and counts include all workspaces', () => {
  const data = structuredClone(snapshot);
  data.agents[0].name = 'frontend';
  data.agents.push({ workspace_id: 'w2', pane_id: 'w2:p1', agent: 'claude', agent_status: 'idle' });
  const activity = makeActivity(data, { showProject: true }, 123);
  assert.equal(activity.details, 'my-project · opencode: frontend · Working');
  assert.equal(activity.state, '2 agents · 1 working');
  data.focused_workspace_id = 'w2';
  data.focused_pane_id = 'w2:p1';
  assert.equal(makeActivity(data, { showProject: true }, 123).details, 'my-project · claude · Idle');
});
test('long labels stay compact while counts have their own line', () => {
  const data = structuredClone(snapshot);
  data.workspaces[0].label = 'project'.repeat(30);
  data.agents[0].cwd = '/private/' + 'project'.repeat(30);
  data.agents[0].name = 'frontend'.repeat(30);
  const activity = makeActivity(data, { showProject: true }, 123);
  assert.ok(Array.from(activity.details).length <= 62);
  assert.ok(activity.details.includes('…'));
  assert.equal(activity.state, '1 agent · 1 working');
});
test('focused foreground folder takes priority over workspace label and agent cwd', () => {
  const data = structuredClone(snapshot);
  data.workspaces[0].label = 'herdr-rpc';
  data.panes = [{ pane_id: 'w1:p1', foreground_cwd: 'E:\\Projects\\actual-app\\', cwd: 'E:\\Projects\\old-app' }];
  assert.equal(makeActivity(data, { showProject: true }, 123).details, 'actual-app · opencode · Working');
  assert.equal(makeActivity(data, { showProject: false }, 123).details, 'opencode · Working');
});
test('snapshot response wrappers and errors', () => {
  assert.equal(unwrapSnapshot({ result: { snapshot } }), snapshot);
  assert.equal(unwrapSnapshot(snapshot), snapshot);
  assert.throws(() => unwrapSnapshot({ error: { message: 'offline' } }), /offline/);
  assert.throws(() => unwrapSnapshot({}), /Unsupported/);
});
test('sanitize and limit public strings', () => {
  assert.equal(clean(' hi\n\tthere '), 'hi there');
  assert.equal(Array.from(clean('😀'.repeat(200))).length, 128);
});
test('Discord IPC framing uses byte lengths', () => {
  const frame = encodeFrame(1, { text: '😀' });
  assert.equal(frame.readUInt32LE(0), 1);
  assert.equal(frame.readUInt32LE(4), frame.length - 8);
  assert.deepEqual(JSON.parse(frame.subarray(8).toString()), { text: '😀' });
});
