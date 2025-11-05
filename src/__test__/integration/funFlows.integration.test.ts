import register from '../../pieces/commandManager';
import interactionRouter from '../../pieces/interactionHandler';
import * as pollModule from '../../commands/fun/poll';
import * as rpsModule from '../../commands/fun/rockpaperscissors';
import { SageInteractionType } from '@lib/types/InteractionType';
import { Command } from '@lib/types/Command';
import { ApplicationCommandPermissionType, ChannelType, Collection, Client } from 'discord.js';

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
		ChannelType: { GuildText: 'GUILD_TEXT' }
	};
});

const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

class DummyFunCommand extends Command {
	description = 'dummy';
	onRun = jest.fn(async (interaction: any, label: string) => interaction.reply({ content: label }));
	runInGuild = true;

	constructor(private readonly label: string) {
		super();
		this.permissions = [{
			id: 'role-verified',
			type: ApplicationCommandPermissionType.Role,
			permission: true
		}];
	}

	async run(interaction: any) {
		return this.onRun(interaction, this.label);
	}
}

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

describe('Fun command interaction flows', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('slash dispatch handles multiple fun commands', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		const firstCommand = new DummyFunCommand('FIRST');
		const secondCommand = new DummyFunCommand('SECOND');
		firstCommand.name = 'fun-one';
		secondCommand.name = 'fun-two';

		await register(client);
		client.commands = new Collection();
		client.commands.set(firstCommand.name, firstCommand);
		client.commands.set(secondCommand.name, secondCommand);

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

		const firstInteraction = makeInteraction(firstCommand.name, 'UserOne');
		const secondInteraction = makeInteraction(secondCommand.name, 'UserTwo');

		client.emit('interactionCreate', firstInteraction as any);
		client.emit('interactionCreate', secondInteraction as any);

		await waitForPromises();

		expect(firstCommand.onRun).toHaveBeenCalledTimes(1);
		expect(firstCommand.onRun).toHaveBeenCalledWith(firstInteraction, 'FIRST');
		expect(secondCommand.onRun).toHaveBeenCalledTimes(1);
		expect(secondCommand.onRun).toHaveBeenCalledWith(secondInteraction, 'SECOND');
		expect(firstInteraction.reply).toHaveBeenCalledWith({ content: 'FIRST' });
		expect(secondInteraction.reply).toHaveBeenCalledWith({ content: 'SECOND' });
	});

	test('interaction handler routes poll and RPS buttons', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		await interactionRouter(client);

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
