import RockPaperScissorsCommand, { handleRpsOptionSelect } from '../../commands/fun/rockpaperscissors';
import { buildCustomId } from '@lib/utils/interactionUtils';
import { SageInteractionType } from '@lib/types/InteractionType';
jest.mock('@root/config', () => ({
	BOT: { NAME: 'IntegrationBot' },
	ROLES: { VERIFIED: 'role-verified' }
}));

jest.mock('discord.js', () => {
	class EmbedBuilder {
		data: Record<string, unknown> = {};
		setTitle(title: string) { this.data = { ...this.data, title }; return this; }
		setColor(color: string) { this.data = { ...this.data, color }; return this; }
		setFooter(footer: { text: string }) { this.data = { ...this.data, footer }; return this; }
	}

	class ButtonBuilder {
		data: any;
		constructor(init: any = {}) { this.data = { ...init }; }
		setLabel(label: string) { this.data.label = label; return this; }
		setCustomId(customId: string) { this.data.customId = customId; return this; }
		setStyle(style: number) { this.data.style = style; return this; }
		setEmoji(emoji: string) { this.data.emoji = emoji; return this; }
	}

	class ActionRowBuilder<T = ButtonBuilder> {
		components: T[] = [];
		constructor(init: { components?: T[] } = {}) {
			this.components = [...(init.components ?? [])];
		}
		addComponents(...components: (T | T[])[]) {
			for (const component of components) {
				if (Array.isArray(component)) {
					this.components.push(...component);
				} else {
					this.components.push(component);
				}
			}
			return this;
		}
	}

	return {
		EmbedBuilder,
		ButtonBuilder,
		ActionRowBuilder,
		ButtonStyle: { Primary: 1 },
		ApplicationCommandPermissionType: { Role: 2, User: 1 },
		ApplicationCommandType: { ChatInput: 1 }
	};
});

describe('RockPaperScissors integration', () => {
	const ownerId = '123456789012345678';
	const timerId = '424242';

	beforeEach(() => {
		jest.restoreAllMocks();
	});

		test('run() replies with three encoded buttons for the command owner', async () => {
			const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((cb: (...args: any[]) => void, _delay?: number, ..._args: any[]) => ({
				[Symbol.toPrimitive]: () => timerId,
				close: jest.fn(),
				hasRef: jest.fn(),
				ref: jest.fn(),
				unref: jest.fn()
		})) as any);
		const command = new RockPaperScissorsCommand();

		const reply = jest.fn().mockResolvedValue(undefined);
		const interaction = {
			user: { id: ownerId, username: 'OwnerUser' },
			reply
		};

		await command.run(interaction as any);

		expect(reply).toHaveBeenCalledTimes(1);
		const payload = reply.mock.calls[0][0];
		expect(payload.components).toHaveLength(1);

		const buttons = payload.components[0].components;
		expect(buttons).toHaveLength(3);
		buttons.forEach((button: { data: { customId: string } }, idx: number) => {
			expect(button.data.customId).toEqual(buildCustomId({
				type: SageInteractionType.RPS,
				commandOwner: ownerId,
				additionalData: [ ['rock', 'paper', 'scissors'][idx], timerId ]
			}));
		});

		setIntervalSpy.mockRestore();
	});

	test('handleRpsOptionSelect rejects non-owners', async () => {
		const customId = buildCustomId({
			type: SageInteractionType.RPS,
			commandOwner: ownerId,
			additionalData: ['rock', timerId]
		});

		const interaction = {
			customId,
			user: { id: '000000000000000000' },
			reply: jest.fn().mockResolvedValue(undefined)
		};

		await handleRpsOptionSelect(interaction as any);

		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
			content: 'You cannot respond to a command you did not execute',
			ephemeral: true
		}));
	});

	test('handleRpsOptionSelect resolves a round for the command owner', async () => {
		const customId = buildCustomId({
			type: SageInteractionType.RPS,
			commandOwner: ownerId,
			additionalData: ['rock', timerId]
		});

		const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
		const randomSpy = jest.spyOn(global.Math, 'random').mockReturnValue(0.66); // bot throws scissors

		const edit = jest.fn().mockResolvedValue(undefined);
		const fetch = jest.fn().mockResolvedValue({ edit });

		const interaction = {
			customId,
			user: { id: ownerId, username: 'OwnerUser' },
			channel: { messages: { fetch } },
			message: { id: 'message-1' },
			deferUpdate: jest.fn().mockResolvedValue(undefined)
		};

		await handleRpsOptionSelect(interaction as any);

		expect(clearIntervalSpy).toHaveBeenCalledWith(Number(timerId));
		expect(fetch).toHaveBeenCalledWith('message-1');
		expect(edit).toHaveBeenCalledTimes(1);
		expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);

		clearIntervalSpy.mockRestore();
		randomSpy.mockRestore();
	});
});
