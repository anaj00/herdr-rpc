import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { Discord } from './discord.js';
import { makeActivity, unwrapSnapshot } from './presence.js';
import { focusFile, withFocus } from './focus.js';

const exec = promisify(execFile);
const configPath = path.join(process.env.HERDR_PLUGIN_CONFIG_DIR ?? process.cwd(), 'config.json');
let config;
try {
  config = JSON.parse(await readFile(configPath, 'utf8'));
} catch (error) {
  console.error(`Cannot read ${configPath}: ${error.message}\nCopy config.example.json there and add your Discord application ID.`);
  process.exit(1);
}
config.clientId = process.env.DISCORD_CLIENT_ID ?? config.clientId;
if (!/^\d{17,20}$/.test(config.clientId ?? '')) {
  console.error('Set clientId to your Discord application ID (17–20 digits). No bot token is needed.');
  process.exit(1);
}
config.showProject ??= true;
if (typeof config.showProject !== 'boolean' || (config.largeImage !== undefined && typeof config.largeImage !== 'string')) {
  console.error('showProject must be a boolean and largeImage must be a string.');
  process.exit(1);
}
const interval = Math.max(15000, Number(config.pollIntervalMs) || 15000);
const discord = new Discord(config.clientId);
const start = Math.floor(Date.now() / 1000);
let stopping = false;
let last = '';
let lastError = '';
const controlPath = process.env.HERDR_RPC_CONTROL_PATH;
const controlToken = process.env.HERDR_RPC_CONTROL_TOKEN;
const focusPath = process.env.HERDR_PLUGIN_STATE_DIR ? focusFile(process.env.HERDR_PLUGIN_STATE_DIR) : undefined;
async function stopRequested() {
  if (!controlPath) return false;
  try {
    const record = JSON.parse(await readFile(controlPath, 'utf8'));
    return record.token !== controlToken || record.stopping;
  } catch (error) {
    // A controller write can briefly leave an incomplete JSON document.
    if (error instanceof SyntaxError) return false;
    return true;
  }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  try { if (discord.ready) await discord.setActivity(null); } catch { /* Connection may already be gone. */ }
  discord.close();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log(controlPath ? 'Herdr RPC running in background mode.' : 'Herdr RPC running. Ctrl+C or close this pane to stop.');
console.log(config.showProject ? 'Public presence includes your workspace label and agent type.' : 'Workspace labels are hidden.');
while (!stopping) {
  if (await stopRequested()) await stop();
  try {
    const { stdout } = await exec(process.env.HERDR_BIN_PATH ?? 'herdr', ['api', 'snapshot'], {
      timeout: 5000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    });
    let snapshot = unwrapSnapshot(JSON.parse(stdout));
    if (focusPath) {
      try { snapshot = withFocus(snapshot, JSON.parse(await readFile(focusPath, 'utf8'))); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const activity = makeActivity(snapshot, config, start);
    const signature = JSON.stringify(activity);
    const reconnecting = !discord.ready;
    await discord.connect();
    if (reconnecting || signature !== last) {
      await discord.setActivity(activity);
      last = signature;
      console.log(`${activity.details} — ${activity.state}`);
    }
    lastError = '';
  } catch (error) {
    if (discord.ready) {
      try { await discord.setActivity(null); } catch { discord.close(); }
    }
    last = '';
    if (error.message !== lastError) console.error(`Waiting: ${error.message}`);
    lastError = error.message;
  }
  for (let elapsed = 0; elapsed < interval && !stopping; elapsed += 1000) {
    await sleep(Math.min(1000, interval - elapsed));
    if (await stopRequested()) await stop();
  }
}
