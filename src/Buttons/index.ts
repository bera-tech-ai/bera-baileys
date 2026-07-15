import { proto } from '../../WAProto/index.js'
import type makeWASocket from '../Socket/index'
import type { WAMessage } from '../Types'
import { generateMessageIDV2 } from '../Utils/generics'
import { prepareWAMessageMedia } from '../Utils/messages'
import { buildInteractiveAdditionalNodes, buildNativeFlowButtons, buildSingleSelectButton } from './native-flow'
import type { ButtonMessageHeader, SendButtonMessageOptions, SendListMessageOptions } from './button-types'

export * from './button-types'
export * from './native-flow'

type WASocket = ReturnType<typeof makeWASocket>

const buildHeader = async (
	sock: WASocket,
	header: ButtonMessageHeader | undefined
): Promise<proto.Message.InteractiveMessage.IHeader | undefined> => {
	if (!header) {
		return undefined
	}

	const { title, subtitle, imageUrl, image } = header
	const media = image || imageUrl

	if (!media) {
		return { title, subtitle, hasMediaAttachment: false }
	}

	const imageMessage = await prepareWAMessageMedia(
		{ image: image ? image : { url: imageUrl! } },
		{ upload: sock.waUploadToServer }
	)

	return {
		title,
		subtitle,
		hasMediaAttachment: true,
		imageMessage: imageMessage.imageMessage
	}
}

const quoteContext = (quoted?: WAMessage) => {
	if (!quoted) {
		return undefined
	}

	return {
		stanzaId: quoted.key.id,
		participant: quoted.key.participant || quoted.key.remoteJid,
		quotedMessage: quoted.message
	}
}

/**
 * Build (but don't send) an interactive message containing quick-reply,
 * url, call and/or copy-code buttons.
 */
export const generateButtonMessage = async (
	sock: WASocket,
	options: SendButtonMessageOptions
): Promise<proto.IMessage> => {
	const header = await buildHeader(sock, options.header)

	return {
		interactiveMessage: {
			header,
			body: { text: options.text },
			footer: options.footer ? { text: options.footer } : undefined,
			nativeFlowMessage: {
				buttons: buildNativeFlowButtons(options.buttons)
			},
			contextInfo: quoteContext(options.quoted)
		}
	}
}

/**
 * Build (but don't send) an interactive message containing a single
 * "open list" button with sections of selectable rows.
 */
export const generateListMessage = async (
	sock: WASocket,
	options: SendListMessageOptions
): Promise<proto.IMessage> => {
	const header = await buildHeader(sock, options.header)

	return {
		interactiveMessage: {
			header,
			body: { text: options.text },
			footer: options.footer ? { text: options.footer } : undefined,
			nativeFlowMessage: {
				buttons: [buildSingleSelectButton(options.buttonText, options.sections)]
			},
			contextInfo: quoteContext(options.quoted)
		}
	}
}

/**
 * Send an interactive button message (quick-reply / url / call / copy-code
 * buttons, with an optional image/title header) to `jid`.
 *
 * WhatsApp does not officially support 3rd-party clients sending these, so
 * this relies on the same binary-node injection trick used by community
 * packages such as gifted-btns/malvin-btns - no Baileys core files are
 * modified. Because it's a workaround rather than an official feature it
 * can break if WhatsApp changes behavior, and heavy use of interactive
 * buttons is a pattern WhatsApp actively looks for, so use with care on
 * numbers you care about.
 */
export const sendButtonMessage = async (sock: WASocket, jid: string, options: SendButtonMessageOptions) => {
	const message = await generateButtonMessage(sock, options)
	const messageId = options.messageId || generateMessageIDV2(sock.user?.id)

	await sock.relayMessage(jid, message, {
		messageId,
		additionalNodes: buildInteractiveAdditionalNodes(jid)
	})

	return {
		key: { remoteJid: jid, fromMe: true, id: messageId },
		message
	}
}

/**
 * Send an interactive list message (single button that opens a list of
 * selectable rows grouped into sections) to `jid`. See `sendButtonMessage`
 * for the same caveats around this being an unofficial workaround.
 */
export const sendListMessage = async (sock: WASocket, jid: string, options: SendListMessageOptions) => {
	const message = await generateListMessage(sock, options)
	const messageId = options.messageId || generateMessageIDV2(sock.user?.id)

	await sock.relayMessage(jid, message, {
		messageId,
		additionalNodes: buildInteractiveAdditionalNodes(jid)
	})

	return {
		key: { remoteJid: jid, fromMe: true, id: messageId },
		message
	}
}
