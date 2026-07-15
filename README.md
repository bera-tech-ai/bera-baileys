# bera-baileys

**bera-baileys** is a lightweight, no-browser TypeScript/JavaScript library for interacting with the WhatsApp Web multi-device API. It is a rebranded fork of the excellent [Baileys](https://github.com/WhiskeySockets/Baileys) project, with an added built-in module for sending interactive **button** and **list** messages.

> This library connects directly to WhatsApp's WebSocket servers — no Selenium, Puppeteer, or headless browser required.

## Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Sending messages](#sending-messages)
- [Interactive buttons & lists](#interactive-buttons--lists)
- [Handling incoming events](#handling-incoming-events)
- [Group management](#group-management)
- [Auth state persistence](#auth-state-persistence)
- [Full example](#full-example)
- [API reference](#api-reference)
  - [Top-level exports](#top-level-exports)
  - [Module map](#module-map)
- [Caveats](#caveats)
- [Credits](#credits)
- [License](#license)

## Features

- Connect to WhatsApp Web via QR code or pairing code
- Send and receive text, image, video, audio, document, and sticker messages
- Send interactive **button** and **list** messages (quick replies, URL buttons, call buttons, copy-code buttons, and list menus)
- Group management (create, add/remove participants, promote/demote, settings)
- Community and newsletter (channel) support
- Read receipts, presence updates, typing indicators
- Multi-device support with in-memory or file-based auth state persistence
- Polls, reactions, ephemeral/disappearing messages, message edits & deletes
- Written entirely in TypeScript with full type definitions

## Install

```bash
npm install bera-baileys
```

or with yarn/pnpm:

```bash
yarn add bera-baileys
# or
pnpm add bera-baileys
```

`bera-baileys` has a few optional peer dependencies depending on what you use:

```bash
npm install jimp link-preview-js sharp audio-decode
```

| Package | Needed for |
|---|---|
| `jimp` / `sharp` | Auto-generated image thumbnails |
| `link-preview-js` | Auto-generated link previews |
| `audio-decode` | Voice-note waveform generation |

## Quick start

```ts
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from 'bera-baileys'
import { Boom } from '@hapi/boom'

async function startSock() {
	// persists login credentials to a local folder so you don't have to re-scan the QR code every run
	const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: true // scan this QR code with WhatsApp > Linked Devices
	})

	sock.ev.on('creds.update', saveCreds)

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect } = update

		if (connection === 'close') {
			const shouldReconnect =
				(lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut

			console.log('connection closed, reconnecting:', shouldReconnect)
			if (shouldReconnect) startSock()
		} else if (connection === 'open') {
			console.log('connected to WhatsApp!')
		}
	})

	sock.ev.on('messages.upsert', async ({ messages, type }) => {
		if (type !== 'notify') return

		for (const msg of messages) {
			if (!msg.key.fromMe && msg.message) {
				console.log('received message:', msg.message)

				// echo it back
				await sock.sendMessage(msg.key.remoteJid!, { text: 'Hey there! 👋' })
			}
		}
	})

	return sock
}

startSock()
```

Run it, scan the printed QR code with **WhatsApp → Linked Devices → Link a Device**, and you're connected.

### Logging in with a pairing code instead of a QR code

```ts
if (!sock.authState.creds.registered) {
	const phoneNumber = '15551234567' // in international format, no + or spaces
	const code = await sock.requestPairingCode(phoneNumber)
	console.log('Your pairing code:', code)
}
```

### Picking a WhatsApp Web version

```ts
import makeWASocket, { fetchLatestBeraBaileysVersion, useMultiFileAuthState } from 'bera-baileys'

const { state } = await useMultiFileAuthState('auth_info_baileys')
const { version, isLatest } = await fetchLatestBeraBaileysVersion()

const sock = makeWASocket({ version, auth: state })
```

## Sending messages

```ts
// plain text
await sock.sendMessage(jid, { text: 'Hello there!' })

// reply / quote a message
await sock.sendMessage(jid, { text: 'Hello there!' }, { quoted: someMessage })

// image
await sock.sendMessage(jid, {
	image: { url: './my-image.png' },
	caption: 'Check this out'
})

// video
await sock.sendMessage(jid, { video: fs.readFileSync('./video.mp4'), caption: 'A video!' })

// audio / voice note
await sock.sendMessage(jid, { audio: { url: './audio.mp3' }, ptt: true })

// document
await sock.sendMessage(jid, {
	document: { url: './file.pdf' },
	mimetype: 'application/pdf',
	fileName: 'report.pdf'
})

// sticker
await sock.sendMessage(jid, { sticker: { url: './sticker.webp' } })

// poll
await sock.sendMessage(jid, {
	poll: { name: 'Pick a lunch spot', values: ['Tacos', 'Pizza', 'Sushi'], selectableCount: 1 }
})

// mention someone in a group
await sock.sendMessage(groupJid, {
	text: '@1234567890 check this out',
	mentions: ['1234567890@s.whatsapp.net']
})

// react to a message
await sock.sendMessage(jid, { react: { text: '🔥', key: someMessage.key } })

// edit a message you sent
await sock.sendMessage(jid, { text: 'edited text', edit: someMessage.key })

// delete a message you sent
await sock.sendMessage(jid, { delete: someMessage.key })
```

`jid` is the WhatsApp ID of the chat — `<number>@s.whatsapp.net` for a direct message, or `<id>@g.us` for a group.

## Interactive buttons & lists

`bera-baileys` ships a dedicated `Buttons` module for sending interactive quick-reply, URL, call, and copy-code buttons, as well as list/menu messages — something the upstream Baileys library dropped official support for.

### Button message

```ts
import { sendButtonMessage } from 'bera-baileys'

await sendButtonMessage(sock, jid, {
	text: 'How can I help you today?',
	footer: 'Powered by bera-baileys',
	header: { title: 'Support Menu' },
	buttons: [
		{ type: 'reply', displayText: '📦 Track order', id: 'track_order' },
		{ type: 'reply', displayText: '💬 Talk to a human', id: 'talk_human' },
		{ type: 'url', displayText: '🌐 Visit our site', url: 'https://example.com' },
		{ type: 'call', displayText: '📞 Call us', phoneNumber: '+15551234567' },
		{ type: 'copy', displayText: '📋 Copy discount code', copyCode: 'SAVE20' }
	]
})
```

Supported button types:

| Type | Fields | Behavior |
|---|---|---|
| `reply` | `displayText`, `id` | Sends the given `id` back to your bot as a plain reply when tapped |
| `url` | `displayText`, `url`, `merchantUrl?` | Opens a link in the browser |
| `call` | `displayText`, `phoneNumber` | Starts a phone call |
| `copy` | `displayText`, `copyCode` | Copies text to the recipient's clipboard |

You can also attach an image header:

```ts
await sendButtonMessage(sock, jid, {
	text: 'New arrivals just dropped!',
	header: { imageUrl: 'https://example.com/banner.png', title: 'New Collection' },
	buttons: [{ type: 'url', displayText: 'Shop now', url: 'https://example.com/shop' }]
})
```

Only building the message (without sending) is also available, e.g. to forward or queue it:

```ts
import { generateButtonMessage } from 'bera-baileys'

const message = await generateButtonMessage(sock, {
	text: 'Choose an option',
	buttons: [{ type: 'reply', displayText: 'Option A', id: 'opt_a' }]
})
```

### List message

```ts
import { sendListMessage } from 'bera-baileys'

await sendListMessage(sock, jid, {
	text: 'Please choose a department:',
	footer: 'We reply within a few minutes',
	buttonText: 'View departments',
	sections: [
		{
			title: 'Sales',
			rows: [
				{ title: 'New purchase', description: 'Talk to sales about a new order', id: 'sales_new' },
				{ title: 'Existing order', description: 'Questions about an order you placed', id: 'sales_existing' }
			]
		},
		{
			title: 'Support',
			rows: [
				{ title: 'Technical issue', description: 'Something is not working', id: 'support_tech' },
				{ title: 'Billing', description: 'Questions about your invoice', id: 'support_billing' }
			]
		}
	]
})
```

`generateListMessage(sock, options)` is the build-only counterpart, mirroring `generateButtonMessage`.

### Reading a button/list reply

Replies come back through the normal `messages.upsert` event, inside `nativeFlowResponseMessage`:

```ts
sock.ev.on('messages.upsert', ({ messages }) => {
	for (const msg of messages) {
		const response = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage
		if (response?.paramsJson) {
			const { id } = JSON.parse(response.paramsJson)
			console.log('user tapped button/row with id:', id)
		}
	}
})
```

## Handling incoming events

`bera-baileys` exposes an event emitter (`sock.ev`) with granular events, or you can process them in an efficient batch via `sock.ev.process`:

```ts
sock.ev.process(async (events) => {
	if (events['connection.update']) {
		console.log('connection update', events['connection.update'])
	}

	if (events['creds.update']) {
		await saveCreds()
	}

	if (events['messages.upsert']) {
		console.log('new messages', events['messages.upsert'].messages)
	}

	if (events['messages.update']) {
		console.log('messages updated', events['messages.update'])
	}

	if (events['presence.update']) {
		console.log('presence update', events['presence.update'])
	}

	if (events['group-participants.update']) {
		console.log('group membership changed', events['group-participants.update'])
	}
})
```

Full list of events you can listen for (via `sock.ev.on(name, handler)` or inside `sock.ev.process`): `connection.update`, `creds.update`, `messaging-history.set`, `chats.upsert`, `chats.update`, `chats.delete`, `presence.update`, `contacts.upsert`, `contacts.update`, `messages.upsert`, `messages.update`, `messages.delete`, `messages.reaction`, `message-receipt.update`, `groups.upsert`, `groups.update`, `group-participants.update`, `group.member-tag.update`, `blocklist.set`, `blocklist.update`, `call`, `labels.association`, `labels.edit`.

## Group management

```ts
// create a group
const group = await sock.groupCreate('Weekend Trip', ['1234567890@s.whatsapp.net'])

// add / remove / promote / demote participants
await sock.groupParticipantsUpdate(group.id, ['1234567890@s.whatsapp.net'], 'add')
await sock.groupParticipantsUpdate(group.id, ['1234567890@s.whatsapp.net'], 'remove')
await sock.groupParticipantsUpdate(group.id, ['1234567890@s.whatsapp.net'], 'promote')
await sock.groupParticipantsUpdate(group.id, ['1234567890@s.whatsapp.net'], 'demote')

// rename / re-describe
await sock.groupUpdateSubject(group.id, 'New group name')
await sock.groupUpdateDescription(group.id, 'Trip planning happens here')

// settings
await sock.groupSettingUpdate(group.id, 'announcement') // only admins can send messages
await sock.groupToggleEphemeral(group.id, 7 * 24 * 60 * 60) // 7-day disappearing messages

// invite links
const code = await sock.groupInviteCode(group.id)
console.log(`https://chat.whatsapp.com/${code}`)
await sock.groupRevokeInvite(group.id)

// leave a group
await sock.groupLeave(group.id)

// fetch metadata / all groups you're in
const metadata = await sock.groupMetadata(group.id)
const allGroups = await sock.groupFetchAllParticipating()
```

## Auth state persistence

`useMultiFileAuthState(folder)` is the simplest option — it writes creds/keys to a local folder so a restart doesn't require re-scanning the QR code:

```ts
import { useMultiFileAuthState } from 'bera-baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

For production deployments you typically want to persist to a database instead of the filesystem — implement the `AuthenticationState` (`creds` + `keys` with `get`/`set`) shape yourself and pass it as `auth`. `makeCacheableSignalKeyStore(keys, logger)` wraps any key store with an in-memory cache, which noticeably speeds up encrypt/decrypt on busy chats:

```ts
import { makeCacheableSignalKeyStore } from 'bera-baileys'

const sock = makeWASocket({
	auth: {
		creds: state.creds,
		keys: makeCacheableSignalKeyStore(state.keys, logger)
	}
})
```

## Full example

A complete, runnable connection example (QR/pairing-code login, auto-reconnect, echo bot, poll/history handling) lives in [`Example/example.ts`](./Example/example.ts). Run it with:

```bash
npm run example
# or, to log in with a pairing code instead of a QR code:
npm run example -- --use-pairing-code
# to make the bot echo messages back:
npm run example -- --do-reply
```

## API reference

The full generated API reference (types, socket methods, events) can be built locally with:

```bash
npm run build:docs
```

### Top-level exports

Everything below is importable directly from `'bera-baileys'`:

```ts
import makeWASocket, {
	// connection / auth
	useMultiFileAuthState,
	makeCacheableSignalKeyStore,
	fetchLatestBeraBaileysVersion,
	DisconnectReason,
	DEFAULT_CONNECTION_CONFIG,

	// message utilities
	generateMessageIDV2,
	getAggregateVotesInPollMessage,
	prepareWAMessageMedia,
	downloadMediaMessage,
	extractMessageContent,

	// interactive buttons & lists
	sendButtonMessage,
	generateButtonMessage,
	sendListMessage,
	generateListMessage,

	// jid helpers
	isJidBroadcast,
	isJidGroup,
	isJidNewsletter,
	isJidUser,
	jidNormalizedUser,

	// protobuf + types
	proto,
	WAMessage,
	WAMessageKey,
	WAMessageContent,
	CacheStore
} from 'bera-baileys'
```

`makeWASocket(config)` is the default export and the main entry point — it returns the `WASocket` instance used for everything else in this document (`sock.sendMessage`, `sock.ev`, `sock.groupCreate`, ...).

### Module map

The package re-exports everything from these internal modules (see `src/index.ts`), so you rarely need to reach into subpaths:

| Module | Contains |
|---|---|
| `WAProto` | Generated protobuf types for the WhatsApp wire protocol (`proto.Message`, `proto.WebMessageInfo`, ...) |
| `Utils` | `useMultiFileAuthState`, `makeCacheableSignalKeyStore`, message building/media download helpers, crypto, JID helpers, link previews, history sync, event buffering |
| `Types` | `AuthenticationState`, `SocketConfig`, `WAMessage`, `GroupMetadata`, `Contact`, `Chat`, events map, `DisconnectReason`, and every other public type |
| `Defaults` | `DEFAULT_CONNECTION_CONFIG` and other default values/constants |
| `WABinary` | Low-level binary-node (WhatsApp's XML-like wire format) encode/decode helpers |
| `WAM` | WhatsApp analytics/metrics protobuf helpers |
| `WAUSync` | User-sync protocol helpers (querying contacts' status, business profile, etc.) |
| `Buttons` | `sendButtonMessage`, `sendListMessage`, `generateButtonMessage`, `generateListMessage`, and their supporting types |
| `Socket` (internal, layered) | `makeWASocket` itself, composed from `groups.ts`, `chats.ts`, `messages-send.ts`, `messages-recv.ts`, `business.ts`, `newsletter.ts`, `communities.ts` — these attach `sock.groupCreate`, `sock.sendMessage`, `sock.chatModify`, etc. onto the socket returned by `makeWASocket` |

Key entry points at a glance:

- `makeWASocket(config)` — creates and returns the socket instance
- `useMultiFileAuthState(folder)` — file-based credential/session store
- `sock.sendMessage(jid, content, options?)` — send any regular message type
- `sendButtonMessage(sock, jid, options)` / `sendListMessage(sock, jid, options)` — send interactive buttons/lists
- `sock.ev` — the event emitter for all connection/message/chat events
- `sock.groupCreate`, `sock.groupParticipantsUpdate`, `sock.groupUpdateSubject`, etc. — group management (see [Group management](#group-management))
- `fetchLatestBeraBaileysVersion()` — fetches the latest WhatsApp Web version to connect with

## Caveats

WhatsApp does not officially support third-party clients sending interactive button/list messages. The `Buttons` module works by composing the same binary-node payloads official community workarounds (e.g. `gifted-btns`, `malvin-btns`) use, without patching any core Baileys files. This means:

- It can stop working if WhatsApp changes its client-side validation.
- Heavy/automated use of interactive messages is a pattern WhatsApp's anti-spam systems actively look for — use responsibly, and avoid this on numbers you cannot afford to lose.

More generally, using any unofficial WhatsApp API (including this one) carries a risk of your number being banned if used for spam, bulk messaging, or other behavior that violates WhatsApp's Terms of Service. Use at your own risk.

## Credits

`bera-baileys` is a rebranded, feature-extended fork of [Baileys](https://github.com/WhiskeySockets/Baileys) by [WhiskeySockets](https://github.com/WhiskeySockets) and its contributors, originally created by [Adhiraj Singh](https://github.com/adiwajshing). All core WhatsApp Web protocol work is thanks to the upstream project — this fork focuses on the interactive buttons/list module and rebranding.

## License

MIT
