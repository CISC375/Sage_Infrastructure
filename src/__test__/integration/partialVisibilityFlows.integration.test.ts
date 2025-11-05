import register from '../../pieces/commandManager';
import * as commandManagerModule from '../../pieces/commandManager';
import { Command } from '@lib/types/Command';
import { ApplicationCommandPermissionType, ChannelType, Collection, Client } from 'discord.js';
let consoleLogSpy: jest.SpyInstance;

jest.mock('@root/config', () => ({
	BOT: { NAME: 'IntegrationBot', CLIENT_ID: 'client-id' },
	GUILDS: { MAIN: 'guild-main' },
	DB: { CLIENT_DATA: 'clientData', COURSES: 'courses', PVQ: 'pvq', USERS: 'users' },
	CHANNELS: { ROLE_SELECT: 'role-select' },
	ROLES: { VERIFIED: 'role-verified' },
	MAINTAINERS: '@Maintainers'
}));

jest.mock('discord.js', () => {
	const { EventEmitter } = require('events');

	class Collection extends Map {
		find(predicate) {
			for (const [key, value] of this.entries()) {
				if (predicate(value, key, this)) return value;
			}
			return undefined;
		}
	}

	class Client extends EventEmitter {
		constructor() {
			super();
			this.commands = new Collection();
			const guildCommands = {
				fetch: jest.fn().mockResolvedValue(undefined),
				cache: new Collection()
			};
			this.guilds = {
				cache: new Map([['guild-main', { commands: guildCommands }]]),
				fetch: jest.fn().mockResolvedValue({ members: { fetch: jest.fn() } })
			};
			this.channels = { cache: { get: jest.fn() } };
			this.mongo = {
				collection: jest.fn(() => ({
					findOne: jest.fn().mockResolvedValue({ commandSettings: [] })
				}))
			};
			this.user = { id: 'bot-user' };
		}
	}

	class EmbedBuilder {
		data: Record<string, unknown> = {};
		setAuthor(author) { this.data.author = author; return this; }
		setDescription(description) { this.data.description = description; return this; }
		setImage(url) { this.data.image = url; return this; }
	}

	return {
		Client,
		Collection,
		EmbedBuilder,
		ApplicationCommandPermissionType: { Role: 'ROLE', User: 'USER' },
		ApplicationCommandOptionType: {
			String: 3,
			Integer: 4,
			Boolean: 5,
			User: 6,
			Channel: 7,
			Number: 10,
			Attachment: 11
		},
		ButtonStyle: { Primary: 1, Secondary: 2 },
		ChannelType: { GuildText: 'GUILD_TEXT' }
	};
});

const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

function createRoleManager(roleIds: string[]) {
	return {
		cache: {
			find: jest.fn((predicate: (role: { id: string }) => boolean) => {
				for (const id of roleIds) {
					if (predicate({ id })) return { id };
				}
				return undefined;
			})
		}
	};
}

describe('Partial visibility question command flows', () => {
	const pvCommands = [
		'anonymous',
		'archive',
		'private',
		'reply'
	] as const;

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		jest.restoreAllMocks();
	});

	test('verified member can invoke partial visibility commands', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		jest.spyOn(commandManagerModule, 'loadCommands').mockImplementation(async (bot: any) => {
			bot.commands = new Collection();
			return Promise.resolve();
		});

		await register(client);

		const commandMap = new Collection<string, Command>();
		const instantiatedPvCommands = pvCommands.map(fileName => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { default: PvCommand } = require(`../../commands/partial visibility question/${fileName}`);
			const instance: Command = new PvCommand();
			instance.name = fileName;
			instance.permissions = [{
				id: 'role-verified',
				type: ApplicationCommandPermissionType.Role,
				permission: true
			}];
			instance.runInGuild = true;
			instance.run = jest.fn().mockResolvedValue(undefined);
			commandMap.set(fileName, instance);
			return { name: fileName, instance };
		});

		client.commands = commandMap;

		const makeInteraction = (commandName: string) => ({
			isChatInputCommand: () => true,
			isContextMenuCommand: () => false,
			isSelectMenu: () => false,
			isModalSubmit: () => false,
			isButton: () => false,
			commandName,
			client,
			channel: { type: ChannelType.GuildText },
			user: { id: `verified-${commandName}`, username: `Verified ${commandName}` },
			member: { roles: createRoleManager(['role-verified']) },
			reply: jest.fn().mockResolvedValue(undefined)
		});

		instantiatedPvCommands.forEach(({ name }) => {
			client.emit('interactionCreate', makeInteraction(name) as any);
		});

		await waitForPromises();

		instantiatedPvCommands.forEach(({ name, instance }) => {
			expect(instance.run).toHaveBeenCalledTimes(1);
			const [interactionArg] = (instance.run as jest.Mock).mock.calls[0];
			expect(interactionArg.commandName).toBe(name);
		});
	});
});
