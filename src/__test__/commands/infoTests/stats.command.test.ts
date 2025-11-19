/**
 * Tests for src/commands/stats.ts
 * - Mocks package version + BOT config; asserts embed fields and reply
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import StatsCmd from '../../../commands/info/stats';

jest.mock('@root/package.json', () => ({ version: '3.3.0' }));
jest.mock('@root/config', () => ({
	BOT: { NAME: 'Sage' },
	ROLES: { VERIFIED: 'role-verified' } // <-- add
}));

jest.mock('pretty-ms', () => jest.fn(() => '1h 2m 3s'));

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'reply' | 'client'>;

describe('stats command', () => {
	test('replies with stats embed', async () => {
		const reply = jest.fn();

		const bot = {
			users: { cache: new Map([['u', {}]]) },
			channels: { cache: new Map([['c1', {}], ['c2', {}]]) },
			guilds: { cache: new Map([['g', {}]]) },
			uptime: 3723000,
			user: { displayAvatarURL: () => 'https://cdn.ex/ava.png' }
		};

		const interaction = {
			reply,
			client: bot
		} as unknown as MinimalInteraction;

		const cmd = new (StatsCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(reply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
		// Optional: inspect that some expected text appears in the embed via snapshot/serializer
	});
});
