# Herdr RPC — macOS setup

This guide is for people and coding agents setting up this plugin on a Mac.
The plugin implements macOS Discord IPC support, but has not yet been verified
on a physical Mac. Do not claim a successful setup until the checks below pass.

## What this does

Shows the focused Herdr project, agent name/type, status, agent counts, and
elapsed plugin runtime in Discord Rich Presence. It uses Discord's local socket;
no Discord bot token or account credentials are needed.

No dependencies, `npm install`, or build step are required.

## Requirements

- macOS with Node.js **22 or newer** available on `PATH`.
- Herdr **0.9.2 or newer**, with a running session.
- Discord **desktop**, running under the same macOS user as Herdr.
- A Discord application ID from <https://discord.com/developers/applications>.

Check the tools first:

```bash
node --version
herdr --version
```

If either is missing or too old, ask the user to install/update it. Do not
silently install system software or change their shell configuration.

## Setup

Run commands from this repository's root directory. Do not copy the Windows
`E:\...` path from the main README.

### 1. Link this checkout

```bash
herdr plugin link "$PWD"
herdr plugin config-dir herdr-rpc
```

Keep the checkout in this location afterward: this links the folder rather than
installing an independent copy.

### 2. Create the configuration

The second command prints the plugin's configuration directory. Use that exact
path; do not guess a macOS application-support path.

If `config.json` already exists there, read it and preserve the user's settings.
Otherwise, copy `config.example.json` there as `config.json`. For example,
replacing the placeholder path with the directory actually printed:

```bash
cp config.example.json "/actual/config/directory/config.json"
```

Ask the user for their Discord **Application ID** if they have not supplied one.
They can create an application named **Herdr** in the developer portal and copy
the ID from **General Information**. The application name becomes the presence
heading in Discord.

Set `clientId` to that ID, keeping it a quoted string:

```json
{
  "clientId": "123456789012345678",
  "showProject": true,
  "largeImage": "",
  "pollIntervalMs": 15000
}
```

Do not use the example ID as a real credential. Do not request a Discord token.
`DISCORD_CLIENT_ID`, if set in the worker's environment, overrides `clientId`.
Leave `largeImage` empty unless the user has uploaded a matching Rich Presence
asset to their Discord application.

### 3. Start Discord and enable sharing

Open Discord desktop. In **Settings → Activity Privacy**, enable activity
sharing. Browser and mobile Discord do not expose the local socket this needs.

### 4. Start the plugin

For a session that was already running when the plugin was linked:

```bash
herdr plugin action invoke herdr-rpc.start
herdr plugin action invoke herdr-rpc.status
```

New Herdr sessions start the background worker automatically. No plugin tab
needs to stay open. Startup hooks do not run merely because a plugin was linked
or because a client attached to an existing session.

Switch to an agent pane, then switch workspaces once to seed the focus hint.
Allow about **15 seconds** for the Discord presence to update.

## Verify before reporting success

1. Run `npm test` from this checkout to check the automated tests.
2. Run `herdr api snapshot` in the same environment to confirm Herdr is reachable.
3. Run `herdr plugin action invoke herdr-rpc.status` to check the worker.
4. Ask the user to confirm that their Discord profile displays the activity and
   that changing the focused workspace updates it.

Passing tests or a running worker alone does **not** prove Discord received the
presence. If visual confirmation is unavailable, say exactly which checks passed
and that the Discord display is still unverified.

## Stop, restart, and logs

```bash
herdr plugin action invoke herdr-rpc.stop
herdr plugin action invoke herdr-rpc.start
herdr plugin action invoke herdr-rpc.status
herdr plugin log list --plugin herdr-rpc
```

Restart after changing configuration. Start/status action output includes the
path to `background.log` in the plugin state directory.

For visible foreground logs, stop the background worker first, then run:

```bash
herdr plugin action invoke herdr-rpc.stop
herdr plugin pane open --plugin herdr-rpc --entrypoint presence
```

Switch back to the agent pane when checking presence. A focused plugin pane
shows “Managing workspaces”. Close the foreground pane or press Ctrl+C before
starting the background worker again. Do not run both modes together.

The background worker is a detached Node process, **not** a macOS LaunchAgent
or login item. It survives terminal closure, but not a reboot; launching a new
Herdr session starts it again. Stop it before disabling or unlinking the plugin,
because those operations do not stop an already detached worker.

## Troubleshooting on macOS

### Discord is unavailable

- Confirm Discord desktop is open under the same macOS user.
- Confirm activity sharing is enabled.
- Check `background.log` or use foreground mode for the actual error.
- The implementation searches `XDG_RUNTIME_DIR`, `TMPDIR`, `TMP`, `TEMP`, and
  Node's `os.tmpdir()` for `discord-ipc-0` through `discord-ipc-9`. On macOS,
  `TMPDIR` commonly points into `/var/folders/...`; do not hard-code `/tmp`.
- Compare the worker's environment with the environment where Discord runs if
  socket discovery fails. Do not change permissions broadly or run with `sudo`
  as a workaround.

### Herdr is unavailable or the wrong session is shown

Run `herdr api snapshot` from the same environment. Inside Herdr, the plugin
inherits its session environment automatically. For standalone use, set
`HERDR_SESSION` to the intended session before starting the process.

### Standalone debugging

Standalone mode reads `config.json` from this repository instead of the plugin
configuration directory. Do not overwrite an existing local configuration or
commit a user's configuration unnecessarily.

With a local `config.json` prepared, and no other worker running:

```bash
npm start
```

Stop with Ctrl+C. Prefer plugin mode for normal use.

## Privacy and scope

By default, project/workspace labels, agent names, and agent types are visible
on Discord. Full paths, prompts, terminal output, task titles, and session IDs
are not sent. Set `showProject` to `false` to hide project/workspace labels.

The presence also includes an **Annoy Jana** button linking to a public poke
form. See the main [README](README.md#privacy-and-behavior) for its behavior and
privacy details. Do not send a test poke merely to verify installation.

For coding agents: keep setup changes limited to the requested installation.
Do not create login items, LaunchAgents, install packages, alter shell profiles,
or modify the plugin's code unless the user asks or approves a specific fix.
