# Herdr RPC

A dependency-free Discord Rich Presence plugin for Herdr. Shows your focused
workspace, agent type, semantic status, and elapsed runtime. Supports Windows,
macOS, and Linux using Discord's local IPC connection.

Example, on two separate Discord activity lines:

**my-project · opencode: frontend · Working**  
**3 agents · 2 working**

The project shown is the focused pane's current folder (basename only), falling
back to its workspace label if no folder is available. There is no fixed
`herdr-rpc` prefix. Long folder/workspace and agent names are shortened to keep the card compact. Discord
controls the final layout and may still truncate text on narrow screens.
Named agents are distinguished by their Herdr name. Counts include all agents
in the connected session across workspaces; “working” excludes idle or blocked agents.

## Requirements

- Node.js 22 or newer on PATH
- Herdr 0.9.2 or newer, with a running session
- Discord desktop running on the same machine (not browser/mobile)
- A Discord application ID; **no bot, token, or account credentials needed**

## Setup

**On macOS:** use the [macOS setup guide](README.macos.md). It includes commands
for both people and coding agents. The steps below use Windows example paths.

1. Open <https://discord.com/developers/applications>, create an application,
   name it **Herdr**, and copy its **Application ID** under General Information.
   Discord uses this application name for the presence heading.
2. Link this folder:

   ```powershell
   herdr plugin link "E:\03 Code\herdr-rpc"
   herdr plugin config-dir herdr-rpc
   ```

3. Copy `config.example.json` to the config directory printed by the second
   command, naming the copy `config.json`. Replace `YOUR_DISCORD_APPLICATION_ID`
   with the ID, keeping it quoted. For example:

   ```json
   {
     "clientId": "123456789012345678",
     "showProject": true,
     "largeImage": "",
     "pollIntervalMs": 15000
   }
   ```

4. Enable activity sharing in Discord under **Settings → Activity Privacy**.
5. RPC starts automatically in the background when Herdr starts a session.
   No plugin tab needs to stay open. If your session is already running when you
   link the plugin, start it once manually:

   ```powershell
   herdr plugin action invoke herdr-rpc.start
   ```

   No plugin tab needs to stay open. To stop or check it:

   ```powershell
   herdr plugin action invoke herdr-rpc.stop
   herdr plugin action invoke herdr-rpc.status
   ```

   Background output is saved in `background.log` under the plugin state
   directory; the start/status action log includes its path. Herdr records
   action output in `herdr plugin log list --plugin herdr-rpc`.

   Alternatively, for visible logs, open a foreground plugin pane:

   ```powershell
   herdr plugin pane open --plugin herdr-rpc --entrypoint presence
   ```

Switch back to your agent pane so that it becomes focused. The presence updates
within about 15 seconds. A foreground plugin pane shows “Managing workspaces” when
focused; close it or press Ctrl+C inside it to stop that foreground instance.
Stop and restart the background worker (or foreground pane) after editing config.
Stop the foreground instance before starting the background worker.

No `npm install` or build is required. Background mode is a detached Node process,
not a Windows service or login startup task. It survives closing the terminal,
retries when Herdr is unavailable, and starts again when you launch a Herdr
session after rebooting. Startup hooks run on server startup (including live
handoff), not when attaching to an existing session or linking/enabling a plugin.
If the background worker is already running, the startup command leaves it alone.
Disabling/unlinking the plugin does not stop an already detached worker: invoke
the stop action first. Foreground and background instances should not run together.

## Options

| Setting | Purpose |
| --- | --- |
| `clientId` | Your Discord application's public ID |
| `showProject` | Set to `false` to hide workspace labels |
| `largeImage` | Optional uploaded Discord Rich Presence asset key, e.g. `herdr` |
| `pollIntervalMs` | Poll frequency, minimum 15000 ms |

To add a logo, upload an image to your application's Rich Presence assets and
set `largeImage` to its asset key. The plugin does not assume a logo exists.
`DISCORD_CLIENT_ID` can override the configured ID.

## Privacy and behavior

The **Annoy Jana** Discord button opens <https://team-brain.com/s/home-798b26>.
Visitors can send an anonymous poke with an optional message (140 characters).
The private `Annoy Jana` compiled agent in the `anaj00` Team Brain workspace
sends it through `@anaj00Bot` to the existing `telegram:owner` private chat.
Messages are plain notifications, never AI prompts. The bot token stays in
Team Brain's private integration; no Telegram credentials are shipped in RPC or
the public form. Visitor text is present in private Brain run history and Telegram.
Delivery is limited globally to one notification per UTC minute bucket and 20
per UTC day (not a rolling 60-second window). The public endpoint is intentionally
callable by visitors; these limits protect Telegram delivery, not all endpoint traffic.
Agent ID: `b8da40f9-dde4-4014-9bf3-8fca2df89b35`.
Site ID: `36457de5-d300-4bf9-bfcf-4105be571b2e`.
Disable the agent's webhook trigger in Team Brain to stop accepting pokes.

Workspace labels, agent names, and agent types are **public on Discord** with the default
configuration. Prompts, terminal output, agent task titles, session IDs, and full
paths are not sent. The only Herdr operation is the read-only `api snapshot`.
Focus hooks track workspace/tab/pane selections, overriding the server snapshot's
focus when it is stale. After linking or restarting Herdr, switch spaces once
to seed the focus hint. If multiple clients share a session, the last client
selection reported by Herdr wins; Herdr does not identify the client in these events.
Elapsed time measures plugin runtime, not individual task duration.

The plugin retries when Discord or Herdr is unavailable and clears presence on
Herdr errors rather than continuing to display stale activity. It never starts
or modifies your agents. Run one instance per Discord account to avoid instances
overwriting each other's presence.

## Development / standalone use

Place `config.json` in this folder, then run `npm start`. For a named session,
set `HERDR_SESSION` before launching. Inside Herdr, the plugin inherits the
correct session environment automatically.

```powershell
npm test
```

If Discord cannot connect, check that the desktop app is running as the same OS
user and at the same privilege level. Sandboxed Linux Discord installations may
require exposing the Discord IPC socket to the host. If Herdr cannot connect,
check `herdr api snapshot` in the same environment.
