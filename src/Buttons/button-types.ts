import type { WAMessage } from '../Types'

/** A button that, when tapped, sends a plain reply back with the given id */
export type QuickReplyButton = {
	type: 'reply'
	displayText: string
	/** opaque id you receive back in the reply's `nativeFlowResponseMessage`/interactive response */
	id: string
}

/** A button that opens a URL in the browser */
export type UrlButton = {
	type: 'url'
	displayText: string
	url: string
	/** optional, shown as the "real" merchant url in some clients */
	merchantUrl?: string
}

/** A button that starts a phone call */
export type CallButton = {
	type: 'call'
	displayText: string
	/** E.164 formatted phone number, e.g. +14155552671 */
	phoneNumber: string
}

/** A button that copies text/code to the recipient's clipboard */
export type CopyButton = {
	type: 'copy'
	displayText: string
	copyCode: string
}

export type BeraButton = QuickReplyButton | UrlButton | CallButton | CopyButton

export type ListRow = {
	title: string
	description?: string
	id: string
}

export type ListSection = {
	title: string
	rows: ListRow[]
}

export type ButtonMessageHeader = {
	title?: string
	subtitle?: string
	/** direct https url to an image to use as the header media */
	imageUrl?: string
	/** raw image bytes to use as the header media, alternative to imageUrl */
	image?: Buffer
}

export type BaseInteractiveOptions = {
	text: string
	footer?: string
	header?: ButtonMessageHeader
	/** quote another message */
	quoted?: WAMessage
	/** custom message id override */
	messageId?: string
}

export type SendButtonMessageOptions = BaseInteractiveOptions & {
	buttons: BeraButton[]
}

export type SendListMessageOptions = BaseInteractiveOptions & {
	/** label on the button that opens the list */
	buttonText: string
	sections: ListSection[]
}
