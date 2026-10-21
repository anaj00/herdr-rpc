export function clean(value) {
  return Array.from(String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 128).join('');
}

export function shorten(value, limit) {
  const chars = Array.from(clean(value));
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join('');
}

export function unwrapSnapshot(response) {
  if (response.error) throw new Error(response.error.message ?? 'Herdr API error');
  const result = response.result ?? response;
  const snapshot = result.snapshot ?? result;
  if (!Array.isArray(snapshot.workspaces) || !Array.isArray(snapshot.agents)) {
    throw new Error('Unsupported Herdr snapshot. Herdr 0.9.2 or newer is required.');
  }
  return snapshot;
}

export function makeActivity(snapshot, config, start) {
  const workspace = snapshot.workspaces.find(w => w.workspace_id === snapshot.focused_workspace_id)
    ?? snapshot.workspaces.find(w => w.focused);
  const agent = snapshot.agents.find(a => a.pane_id === snapshot.focused_pane_id)
    ?? snapshot.agents.find(a => a.focused && a.workspace_id === workspace?.workspace_id);
  const pane = snapshot.panes?.find(p => p.pane_id === snapshot.focused_pane_id);
  const cwd = pane?.foreground_cwd ?? agent?.foreground_cwd ?? pane?.cwd ?? agent?.cwd;
  const folder = typeof cwd === 'string'
    ? cwd.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1)
    : undefined;
  const project = folder || workspace?.label;
  const labels = { working: 'Working', blocked: 'Needs input', idle: 'Idle', done: 'Done', unknown: 'Unknown' };
  const total = snapshot.agents.length;
  const working = snapshot.agents.filter(a => a.agent_status === 'working').length;
  const summary = `${total} agent${total === 1 ? '' : 's'} · ${working} working`;
  const agentName = agent?.name
    ? `${agent.agent ?? 'Agent'}: ${agent.name}`
    : agent?.agent ?? 'Agent';
  const activity = {
    details: [
      ...(config.showProject && project ? [shorten(project, 24)] : []),
      agent ? `${shorten(agentName, 20)} · ${labels[agent.agent_status] ?? 'Unknown'}` : 'Managing workspaces',
    ].join(' · '),
    state: summary,
    timestamps: { start },
    buttons: [{ label: 'Annoy Jana', url: 'https://team-brain.com/s/home-798b26' }],
  };
  if (config.largeImage) activity.assets = { large_image: config.largeImage, large_text: 'Herdr — agent runtime' };
  return activity;
}
