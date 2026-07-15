import { proto } from '../../WAProto/index.js'
import type { BinaryNode } from '../WABinary'
import { jidDecode } from '../WABinary'
import type { BeraButton } from './button-types'

type NativeFlowButton = proto.Message.InteractiveMessage.NativeFlowMessage.INativeFlowButton

/**
 * Convert our friendlier button definitions into the `native_flow` button
 * shape WhatsApp expects inside an `interactiveMessage`.
 */
export const buildNativeFlowButtons = (buttons: BeraButton[]): NativeFlowButton[] => {
	return buttons.map(button => {
		switch (button.type) {
			case 'reply':
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: button.displayText,
						id: button.id
					})
				}
			case 'url':
				return {
					name: 'cta_url',
					buttonParamsJson: JSON.stringify({
						display_text: button.displayText,
						url: button.url,
						merchant_url: button.merchantUrl || button.url
					})
				}
			case 'call':
				return {
					name: 'cta_call',
					buttonParamsJson: JSON.stringify({
						display_text: button.displayText,
						phone_number: button.phoneNumber
					})
				}
			case 'copy':
				return {
					name: 'cta_copy',
					buttonParamsJson: JSON.stringify({
						display_text: button.displayText,
						copy_code: button.copyCode
					})
				}
			default:
				throw new Error(`Unsupported button type: ${(button as { type: string }).type}`)
		}
	})
}

/**
 * Build the single native_flow button that opens a list/single-select menu.
 */
export const buildSingleSelectButton = (
	buttonText: string,
	sections: { title: string; rows: { title: string; description?: string; id: string }[] }[]
): NativeFlowButton => ({
	name: 'single_select',
	buttonParamsJson: JSON.stringify({
		title: buttonText,
		sections: sections.map(section => ({
			title: section.title,
			rows: section.rows.map(row => ({
				header: '',
				title: row.title,
				description: row.description || '',
				id: row.id
			}))
		}))
	})
})

/**
 * WhatsApp requires extra binary nodes (`biz`, `bot`) alongside interactive
 * messages, otherwise clients silently drop them. Baileys core does not add
 * these on its own since WhatsApp does not officially support 3rd-party
 * clients sending interactive buttons - this replicates the community
 * workaround (as used by packages like gifted-btns/malvin-btns) without
 * touching any core files.
 */
export const buildInteractiveAdditionalNodes = (jid: string): BinaryNode[] => {
	const { server } = jidDecode(jid) || {}
	const isGroup = server === 'g.us'

	const nodes: BinaryNode[] = [
		{
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [
						{
							tag: 'native_flow',
							attrs: { name: 'mixed', v: '1' },
							content: []
						}
					]
				}
			]
		}
	]

	if (!isGroup) {
		nodes.push({
			tag: 'bot',
			attrs: { biz_bot: '1' },
			content: []
		})
	}

	return nodes
}
