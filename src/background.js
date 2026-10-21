import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const stateDir = process.env.HERDR_PLUGIN_STATE_DIR ?? path.join(root, '.rpc-state');
const configDir = process.env.HERDR_PLUGIN_CONFIG_DIR ?? root;
const recordPath = path.join(stateDir, 'background.json');
await mkdir(stateDir, { recursive: true });
const command = process.argv[2] ?? 'status';
let record;
try { record = JSON.parse(await readFile(recordPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}
if (command === 'start') {
  if (record && alive(record.pid)) {
    console.log(record.stopping ? 'Still stopping. Try again in a few seconds.' : 'Herdr RPC is already running in the background.');
    process.exit(0);
  }
  // Validate configuration before launching a process with hidden output.
  const config = JSON.parse(await readFile(path.join(configDir, 'config.json'), 'utf8'));
  if (!/^\d{17,20}$/.test(process.env.DISCORD_CLIENT_ID ?? config.clientId ?? '')) {
    throw new Error('Add a valid Discord application ID to config.json first.');
  }
  if (record) await unlink(recordPath);
  const handle = await open(recordPath, 'wx');
  const token = randomUUID();
  await handle.writeFile(JSON.stringify({ pid: process.pid, token }));
  await handle.close();
  const logPath = path.join(stateDir, 'background.log');
  const log = await open(logPath, 'w');
  try {
    const child = spawn(process.execPath, [path.join(root, 'src/index.js')], {
      cwd: root, detached: true, windowsHide: true,
      stdio: ['ignore', log.fd, log.fd],
      env: {
        ...process.env,
        HERDR_PLUGIN_CONFIG_DIR: configDir,
        HERDR_RPC_CONTROL_PATH: recordPath,
        HERDR_RPC_CONTROL_TOKEN: token,
      },
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    await writeFile(recordPath, JSON.stringify({ pid: child.pid, token }));
    child.unref();
    console.log(`Herdr RPC launched in the background. No tab needed.\nLog: ${logPath}`);
  } catch (error) {
    await unlink(recordPath);
    throw error;
  } finally { await log.close(); }
} else if (command === 'stop') {
  if (!record || !alive(record.pid)) console.log('Herdr RPC is not running in the background.');
  else {
    await writeFile(recordPath, JSON.stringify({ ...record, stopping: true }));
    console.log('Stop requested. Presence will clear within a few seconds.');
  }
} else if (command === 'status') {
  console.log(record && alive(record.pid)
    ? record.stopping ? 'Herdr RPC is stopping.' : `Herdr RPC process is running (PID ${record.pid}).`
    : 'Herdr RPC is not running in the background.');
  console.log(`Log: ${path.join(stateDir, 'background.log')}`);
} else {
  console.error('Usage: node src/background.js start|stop|status');
  process.exitCode = 1;
}
