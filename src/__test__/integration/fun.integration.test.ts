/**
 * Covers fun slash commands end to end, including button routing for interactive handlers.
 */
import register from '../../pieces/commandManager';
import * as commandManagerModule from '../../pieces/commandManager';
import interactionRouter from '../../pieces/interactionHandler';
import * as pollModule from '../../commands/fun/poll';
import * as rpsModule from '../../commands/fun/rockpaperscissors';
import { SageInteractionType } from '@lib/types/InteractionType';
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
			Number: 10,
			User: 6,
			Channel: 7,
			Attachment: 11,
			Boolean: 5
		},
		ButtonStyle: { Primary: 1, Secondary: 2 },
		ChannelType: { GuildText: 'GUILD_TEXT' }
	};
});

// Ensures Discord client event handlers flush before expectations run.
const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

/** Minimal role manager adapter so tests can express which roles a fake member holds. */
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

const funCommandNames = getCommandNames('../../commands/fun');

describe('Fun command interaction flows', () => {

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		jest.restoreAllMocks();
	});

	test('slash dispatch handles every fun command', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		// Short-circuit command loading so we can insert mocked commands manually.
		jest.spyOn(commandManagerModule, 'loadCommands').mockImplementation(async (bot: any) => {
			bot.commands = new Collection();
			return Promise.resolve();
		});

		await register(client);

		const commandMap = new Collection<string, Command>();
		// Instantiate the real command classes so behavioral regressions surface when files change.
		const instantiatedFunCommands = funCommandNames.map(fileName => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { default: FunCommand } = require(`../../commands/fun/${fileName}`);
			const instance: Command = new FunCommand();
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

		// Represents a verified user invoking a slash command.
		const makeInteraction = (commandName: string, username: string) => ({
			isChatInputCommand: () => true,
			isContextMenuCommand: () => false,
			isSelectMenu: () => false,
			isModalSubmit: () => false,
			isButton: () => false,
			commandName,
			client,
			channel: { type: ChannelType.GuildText },
			user: { id: `${username}-id`, username },
			member: { roles: createRoleManager(['role-verified']) },
			reply: jest.fn().mockResolvedValue(undefined)
		});

		instantiatedFunCommands.forEach(({ name }) => {
			const interaction = makeInteraction(name, `user-${name}`);
			client.emit('interactionCreate', interaction as any);
		});

		await waitForPromises();

		// Every fun command should run exactly once in response to its interaction.
		instantiatedFunCommands.forEach(({ name, instance }) => {
			expect(instance.run).toHaveBeenCalledTimes(1);
			const [interactionArg] = (instance.run as jest.Mock).mock.calls[0];
			expect(interactionArg.commandName).toBe(name);
		});
	});

	test('interaction handler routes poll and RPS buttons', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		await interactionRouter(client);

		// Confirm the router calls the correct handler based on the customId prefix.
		const pollSpy = jest.spyOn(pollModule, 'handlePollOptionSelect').mockResolvedValue(undefined);
		const rpsSpy = jest.spyOn(rpsModule, 'handleRpsOptionSelect').mockResolvedValue(undefined);

		const pollInteraction = {
			isMessageComponent: () => true,
			isButton: () => true,
			customId: `${SageInteractionType.POLL}_choice`,
			reply: jest.fn(),
			user: { id: 'poll-user' }
		};

		const rpsInteraction = {
			isMessageComponent: () => true,
			isButton: () => true,
			customId: `${SageInteractionType.RPS}_data`,
			reply: jest.fn(),
			user: { id: 'rps-user' }
		};

		client.emit('interactionCreate', pollInteraction as any);
		client.emit('interactionCreate', rpsInteraction as any);

		await waitForPromises();

		expect(pollSpy).toHaveBeenCalledWith(client, pollInteraction);
		expect(rpsSpy).toHaveBeenCalledWith(rpsInteraction);

		pollSpy.mockRestore();
		rpsSpy.mockRestore();
	});
});
