/**
 * Tests for src/commands/serverinfo.ts
 * - Mocks guild members/channels/roles and verifies embed reply
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import ServerInfoCmd from '../../commands/info/serverinfo';

jest.mock('@root/config', () => ({
	ROLES: { VERIFIED: 'role-verified' }
}), { virtual: true });

const coll = <T>(items: T[]) => ({
	filter: (fn: (x: T) => boolean) => {
		const count = items.filter(fn).length;
		return { size: count };
	},
	size: items.length
});

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'reply' | 'guild'>;

describe('serverinfo command', () => {
	test('replies with computed server stats embed', async () => {
		const reply = jest.fn();

		const members = [
			{ user: { bot: false }, roles: { cache: { size: 2 } } },
			{ user: { bot: true }, roles: { cache: { size: 1 } } },
			{ user: { bot: false }, roles: { cache: { size: 3 } } }
		];
		const channels = [
			{ type: 0 }, // ChannelType.GuildText
			{ type: 0 },
			{ type: 2 } // ChannelType.GuildVoice
		];
		const roles = Array.from({ length: 3 }, () => ({}));
		const emojis = Array.from({ length: 2 }, () => ({}));

		const interaction = {
			reply,
			guild: {
				name: 'UD CIS',
				iconURL: () => 'https://cdn.ex/icon.png',
				memberCount: members.length,
				members: { cache: coll(members) },
				channels: { cache: coll(channels) },
				roles: { cache: { size: roles.length } },
				emojis: { cache: { size: emojis.length } }
			}
		} as unknown as MinimalInteraction;

		const cmd = new (ServerInfoCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(reply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
	});
});
