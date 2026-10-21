import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { focusFile, eventFocus } from './focus.js';

const stateDir = process.env.HERDR_PLUGIN_STATE_DIR;
if (!stateDir) throw new Error('Focus hooks must be invoked by Herdr');
const event = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON ?? '{}');
const focus = eventFocus(event, process.env.HERDR_PLUGIN_EVENT);
await mkdir(stateDir, { recursive: true });
const target = focusFile(stateDir);
const temporary = `${target}.${process.pid}.tmp`;
try {
  await writeFile(temporary, JSON.stringify(focus));
  await rename(temporary, target);
} finally {
  await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
