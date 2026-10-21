import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function encodeFrame(op, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(op, 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

export function ipcPaths() {
  if (process.platform === 'win32') return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  const roots = [...new Set([process.env.XDG_RUNTIME_DIR, process.env.TMPDIR, process.env.TMP, process.env.TEMP, os.tmpdir()].filter(Boolean))];
  return roots.flatMap(root => Array.from({ length: 10 }, (_, i) => path.join(root, `discord-ipc-${i}`)));
}

export class Discord {
  constructor(clientId) {
    this.clientId = clientId;
    this.pending = new Map();
    this.ready = false;
  }

  async connect() {
    if (this.ready) return;
    for (const address of ipcPaths()) {
      try {
        await this.open(address);
        return;
      } catch { this.close(); }
    }
    throw new Error('Discord unavailable. Open Discord desktop and enable Activity sharing.');
  }

  open(address) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(address);
      this.socket = socket;
      let buffer = Buffer.alloc(0);
      const timer = setTimeout(() => { reject(new Error('Discord handshake timed out')); socket.destroy(); }, 1500);
      const fail = error => {
        clearTimeout(timer);
        this.ready = false;
        for (const request of this.pending.values()) request.reject(error);
        this.pending.clear();
        reject(error);
      };
      socket.on('error', fail);
      socket.on('close', () => fail(new Error('Discord disconnected')));
      socket.on('connect', () => socket.write(encodeFrame(0, { v: 1, client_id: this.clientId })));
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        try {
          while (buffer.length >= 8) {
            const op = buffer.readUInt32LE(0);
            const size = buffer.readUInt32LE(4);
            if (size > 1024 * 1024) throw new Error('Discord frame too large');
            if (buffer.length < size + 8) break;
            const payload = JSON.parse(buffer.subarray(8, 8 + size).toString());
            buffer = buffer.subarray(8 + size);
            if (op === 3) socket.write(encodeFrame(4, payload));
            if (op === 2) throw new Error(payload.message ?? 'Discord closed connection');
            if (op !== 1) continue;
            if (payload.evt === 'READY') {
              clearTimeout(timer);
              this.ready = true;
              resolve();
            }
            const request = this.pending.get(payload.nonce);
            if (request) {
              this.pending.delete(payload.nonce);
              if (payload.evt === 'ERROR') request.reject(new Error(payload.data?.message ?? 'Discord RPC error'));
              else request.resolve(payload);
            }
          }
        } catch (error) { fail(error); socket.destroy(); }
      });
    });
  }

  setActivity(activity) {
    return new Promise((resolve, reject) => {
      if (!this.ready) return reject(new Error('Discord not connected'));
      const nonce = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error('Discord RPC timed out'));
      }, 5000);
      this.pending.set(nonce, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      this.socket.write(encodeFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce }));
    });
  }

  close() {
    this.ready = false;
    this.socket?.destroy();
  }
}
