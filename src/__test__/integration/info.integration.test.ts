/**
 * Ensures informational commands are loaded dynamically and callable by verified members.
 */
import register from '../../pieces/commandManager';
import * as commandManagerModule from '../../pieces/commandManager';
import { Command } from '@lib/types/Command';
import { ApplicationCommandPermissionType, ChannelType, Collection, Client } from 'discord.js';
import { getCommandNames } from './utils/commandDirectoryUtils';
let consoleLogSpy: jest.SpyInstance;

jest.mock('@root/config', () => ({
	BOT: { NAME: 'IntegrationBot', CLIENT_ID: 'client-id' },
	GUILDS: { MAIN: 'guild-main' },
	DB: { CLIENT_DATA: 'clientData' },
	CHANNELS: { ROLE_SELECT: 'role-select' },
	ROLES: { VERIFIED: 'role-verified' },
	MAINTAINERS: '@Maintainers'
}));

jest.mock('discord.js', () => {
	const { EventEmitter } = require('events');

	class Collection extends Map {
		find(predicate: (arg0: any, arg1: any, arg2: this) => any) {
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

	return {
		Client,
		Collection,
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

// Gives the event loop a chance to process interaction handlers before assertions.
const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

/** Simplified role manager for assigning the verified role to fake members. */
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

const infoCommandNames = getCommandNames('../../commands/info');

describe('Info command interaction flows', () => {

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		jest.restoreAllMocks();
	});

	test('info commands respond for any verified member', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		// Avoid loading command files twice; we manage the registry by hand for determinism.
		jest.spyOn(commandManagerModule, 'loadCommands').mockImplementation(async (bot: any) => {
			bot.commands = new Collection();
			return Promise.resolve();
		});

		await register(client);

		const commandMap = new Collection<string, Command>();
		// Instantiate every info command so the test automatically tracks new files.
		const instantiatedInfoCommands = infoCommandNames.map(fileName => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { default: InfoCommand } = require(`../../commands/info/${fileName}`);
			const instance: Command = new InfoCommand();
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

		// Interaction factory that mimics a verified user invoking the command.
		const makeInteraction = (commandName: string) => ({
			isChatInputCommand: () => true,
			isContextMenuCommand: () => false,
			isSelectMenu: () => false,
			isModalSubmit: () => false,
			isButton: () => false,
			commandName,
			client,
			channel: { type: ChannelType.GuildText },
			user: { id: `user-${commandName}`, username: `User ${commandName}` },
			member: { roles: createRoleManager(['role-verified']) },
			reply: jest.fn().mockResolvedValue(undefined)
		});

		instantiatedInfoCommands.forEach(({ name }) => {
			client.emit('interactionCreate', makeInteraction(name) as any);
		});

		await waitForPromises();

		// Each command should run once, proving verified users can execute the info suite.
		instantiatedInfoCommands.forEach(({ name, instance }) => {
			expect(instance.run).toHaveBeenCalledTimes(1);
			const [interactionArg] = (instance.run as jest.Mock).mock.calls[0];
			expect(interactionArg.commandName).toBe(name);
		});
	});
});
