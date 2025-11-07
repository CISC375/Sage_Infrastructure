import register from '../../pieces/commandManager';
import * as commandManagerModule from '../../pieces/commandManager';
import { Command } from '@lib/types/Command';
import { ApplicationCommandPermissionType, ChannelType, Collection, Client } from 'discord.js';
import { getCommandNames } from './utils/commandTestUtils';
let consoleLogSpy: jest.SpyInstance;

jest.mock('@root/config', () => ({
	BOT: { NAME: 'IntegrationBot', CLIENT_ID: 'client-id' },
	GUILDS: { MAIN: 'guild-main' },
	DB: { CLIENT_DATA: 'clientData', USERS: 'users' },
	CHANNELS: { ROLE_SELECT: 'role-select' },
	ROLES: {
		VERIFIED: 'role-verified',
		STAFF: 'role-staff',
		ADMIN: 'role-admin',
		MUTED: 'role-muted'
	},
	EMAIL: {
		SENDER: 'test@example.com',
		REPLY_TO: 'test@example.com'
	},
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
			Role: 8,
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

const staffCommandNames = getCommandNames('../../commands/staff');

describe('Staff command interaction flows', () => {

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		jest.restoreAllMocks();
	});

	test('authorized staff member can invoke every staff command', async () => {
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
		const instantiatedStaffCommands = staffCommandNames.map(fileName => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { default: StaffCommand } = require(`../../commands/staff/${fileName}`);
			const instance: Command = new StaffCommand();
			instance.name = fileName;
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
			user: { id: `user-${commandName}`, username: `User ${commandName}` },
			member: { roles: createRoleManager(['role-staff']) },
			reply: jest.fn().mockResolvedValue(undefined)
		});

		instantiatedStaffCommands.forEach(({ name }) => {
			client.emit('interactionCreate', makeInteraction(name) as any);
		});

		await waitForPromises();

		instantiatedStaffCommands.forEach(({ name, instance }) => {
			expect(instance.run).toHaveBeenCalledTimes(1);
			const [interactionArg] = (instance.run as jest.Mock).mock.calls[0];
			expect(interactionArg.commandName).toBe(name);
		});
	});

	test('non-staff member is rejected from staff commands', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		jest.spyOn(commandManagerModule, 'loadCommands').mockImplementation(async (bot: any) => {
			bot.commands = new Collection();
			return Promise.resolve();
		});

		await register(client);

		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { default: StaffCommand } = require('../../commands/staff/mute');
		const instance: Command = new StaffCommand();
		instance.name = 'mute';
		instance.run = jest.fn();

		client.commands = new Collection([[instance.name, instance]]);

		const replyMock = jest.fn().mockResolvedValue(undefined);

		const interaction = {
			isChatInputCommand: () => true,
			isContextMenuCommand: () => false,
			isSelectMenu: () => false,
			isModalSubmit: () => false,
			isButton: () => false,
			commandName: 'mute',
			client,
			channel: { type: ChannelType.GuildText },
			user: { id: 'user-no-role', username: 'NoRole' },
			member: { roles: createRoleManager([]) },
			reply: replyMock
		};

		const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

		client.emit('interactionCreate', interaction as any);
		await waitForPromises();

		expect(instance.run).not.toHaveBeenCalled();
		expect(replyMock).toHaveBeenCalledTimes(1);
		expect(typeof replyMock.mock.calls[0][0]).toBe('string');

		randomSpy.mockRestore();
	});

});
