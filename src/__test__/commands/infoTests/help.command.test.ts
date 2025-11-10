/**
 * Tests for src/commands/help.ts
 * - Verifies both branch behaviors: with and without "cmd" argument.
 */
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import HelpCmd from '../../../commands/info/help';

const coll = <T>(items: T[]) => ({
	forEach: (fn: (x: T) => void) => { items.forEach(fn); },
	filter: (fn: (x: T) => boolean) => coll(items.filter(fn)),
	size: items.length
});


jest.mock('@root/config', () => ({
	BOT: { NAME: 'Sage' },
	PREFIX: '/',
	ROLES: { VERIFIED: 'role-verified' }
}), { virtual: true });

jest.mock('@root/src/lib/utils/generalUtils', () => ({
	getCommand: jest.fn()
}), { virtual: true });

const { getCommand } = jest.requireMock('@root/src/lib/utils/generalUtils');

type MinimalInteraction = Pick<
ChatInputCommandInteraction,
'reply' | 'options' | 'client' | 'guild' | 'user'
>;

describe('help command', () => {
	afterEach(() => jest.clearAllMocks());

	test('invalid cmd name replies ephemeral error', async () => {
		getCommand.mockReturnValue(null);

		const reply = jest.fn();
		const interaction = {
			options: { getString: jest.fn().mockReturnValue('badcmd') },
			client: { commands: new Map() },
			reply
		} as unknown as MinimalInteraction;

		const cmd = new (HelpCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: '**badcmd** is not a valid command.',
			ephemeral: true
		});
	});

	test('valid cmd builds embed', async () => {
		getCommand.mockReturnValue({
			name: 'ping',
			description: 'responds pong',
			extendedHelp: 'extra details',
			options: [
				{ name: 'verbose', description: 'extra info', required: true }
			]
		});

		const reply = jest.fn();
		const interaction = {
			options: { getString: jest.fn().mockReturnValue('ping') },
			client: { user: { avatarURL: jest.fn().mockReturnValue('https://cdn.ex/ava.png') }, commands: new Map() },
			reply
		} as unknown as MinimalInteraction;

		const cmd = new (HelpCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(reply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
	});

	test('no cmd argument sends DM help summary', async () => {
		const reply = jest.fn();
		const send = jest.fn().mockResolvedValue(undefined);

		const rolesCache = { find: jest.fn().mockReturnValue({ id: '1' }) };
		const member = { roles: { cache: { has: jest.fn().mockReturnValue(true) } } } as unknown as GuildMember;


		// Use the mini Collection, not Map
		const commands = coll([
			{ category: 'commands', name: 'ping', description: 'responds pong', enabled: true }
		]);

		const interaction = {
			options: { getString: jest.fn().mockReturnValue(null) },
			client: {
				user: { avatarURL: jest.fn().mockReturnValue('https://cdn.ex/ava.png') },
				commands
			},
			guild: { roles: { cache: rolesCache } },
			member,
			user: { send, id: '123' },
			reply
		} as unknown as MinimalInteraction;

		const cmd = new (HelpCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(send).toHaveBeenCalled();
	});
});
