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
import fetch from 'node-fetch';
let consoleLogSpy: jest.SpyInstance;

jest.mock('node-fetch', () => jest.fn());
jest.mock('moment', () => () => ({
	format: () => 'Mocked Date'
}));
const mockedFetch = fetch as unknown as jest.Mock;

// Stabilize config-driven identifiers so fake interactions line up with permission checks.
jest.mock('@root/config', () => ({
	BOT: { NAME: 'IntegrationBot', CLIENT_ID: 'client-id' },
	GUILDS: { MAIN: 'guild-main' },
	DB: { CLIENT_DATA: 'clientData' },
	CHANNELS: { ROLE_SELECT: 'role-select' },
	ROLES: { VERIFIED: 'role-verified' },
	MAINTAINERS: '@Maintainers'
}));

// Provide a trimmed-down Discord.js mock exposing only the APIs hit by fun commands.
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

	class ActionRowBuilder<T = any> {
		components: T[];
		constructor(config?: { components?: T[] }) {
			this.components = config?.components ?? [];
		}
		addComponents(...components: T[]) {
			this.components.push(...components);
			return this;
		}
	}

	class ButtonBuilder {
		data: Record<string, unknown>;
		constructor(config?: Record<string, unknown>) {
			this.data = { ...(config ?? {}) };
		}
		setLabel(label: unknown) { this.data.label = label; return this; }
		setCustomId(id: unknown) { this.data.customId = id; return this; }
		setStyle(style: unknown) { this.data.style = style; return this; }
		setEmoji(emoji: unknown) { this.data.emoji = emoji; return this; }
	}

	class EmbedBuilder {
		data: Record<string, unknown>;
		constructor() {
			this.data = {};
		}
		setColor(color: unknown) { this.data.color = color; return this; }
		setDescription(description: unknown) { this.data.description = description; return this; }
		setFooter(footer: unknown) { this.data.footer = footer; return this; }
		setImage(image: unknown) { this.data.image = image; return this; }
		setTimestamp() { this.data.timestamp = Date.now(); return this; }
		setTitle(title: unknown) { this.data.title = title; return this; }
	}

	return {
		Client,
		Collection,
		ActionRowBuilder,
		ButtonBuilder,
		EmbedBuilder,
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

// Stay aligned with the true fun command directory so coverage evolves automatically.
const funCommandNames = getCommandNames('../../commands/fun');

describe('Fun command interaction flows', () => {

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		mockedFetch.mockReset();
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
		// Each run handler is mocked to isolate dispatch mechanics from command internals.
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
				// Stub run to capture dispatch without executing command internals.
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

	test('xkcd buttons update the active embed via the collector', async () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { default: XkcdCommand } = require('../../commands/fun/xkcd');
		type Comic = { num: number; safe_title: string; alt: string; img: string; year: string; month: string; day: string; transcript: string; link: string; news: string; title: string; };
		const buildComic = (num: number, label: string): Comic => ({
			num,
			safe_title: `${label} Title`,
			alt: `${label} alt`,
			img: `https://example.com/${num}.png`,
			year: '2024',
			month: '1',
			day: `${num}`,
			transcript: '',
			link: '',
			news: '',
			title: label
		});
		const latestComic = buildComic(3, 'Latest');
		const secondComic = buildComic(2, 'Second');
		const firstComic = buildComic(1, 'First');

		mockedFetch.mockImplementation((url: string) => {
			const payloadMap: Record<string, Comic> = {
				'http://xkcd.com/info.0.json': latestComic,
				'http://xkcd.com/2/info.0.json': secondComic,
				'http://xkcd.com/3/info.0.json': latestComic,
				'http://xkcd.com/1/info.0.json': firstComic
			};
			const payload = payloadMap[url];
			if (!payload) throw new Error(`Unexpected xkcd fetch url: ${url}`);
			return Promise.resolve({ json: () => Promise.resolve(payload) });
		});

		const xkcdCommand = new XkcdCommand();
		const reply = jest.fn().mockResolvedValue(undefined);
		const editReply = jest.fn().mockResolvedValue(undefined);
		const fetchReply = jest.fn().mockResolvedValue({ id: 'reply-id' });

		let collectHandler: (interaction: unknown) => Promise<void> = async () => undefined;
		const mockCollector = {
			on: jest.fn((event: string, handler: (interaction: unknown) => Promise<void>) => {
				if (event === 'collect') {
					collectHandler = handler;
				}
			})
		};

		const interaction = {
			options: { getString: jest.fn().mockReturnValue('latest') },
			reply,
			editReply,
			fetchReply,
			channel: { createMessageComponentCollector: jest.fn().mockReturnValue(mockCollector) },
			user: { id: 'comic-user' }
		};

		await xkcdCommand.run(interaction as any);
		await waitForPromises();
		expect(interaction.channel.createMessageComponentCollector).toHaveBeenCalledTimes(1);

		const invokeCollector = async (customId: string) => {
			await collectHandler({
				customId,
				user: { id: 'comic-user' },
				message: { id: 'reply-id' },
				deferUpdate: jest.fn(),
				reply: jest.fn()
			} as any);
			await waitForPromises();
		};

		await invokeCollector('previous');
		expect(editReply).toHaveBeenNthCalledWith(1, expect.objectContaining({
			embeds: [expect.objectContaining({
				data: expect.objectContaining({ title: expect.stringContaining('#2') })
			})]
		}));

		await invokeCollector('next');
		expect(editReply).toHaveBeenNthCalledWith(2, expect.objectContaining({
			embeds: [expect.objectContaining({
				data: expect.objectContaining({ title: expect.stringContaining('#3') })
			})]
		}));

		const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
		await invokeCollector('rand');
		expect(editReply).toHaveBeenNthCalledWith(3, expect.objectContaining({
			embeds: [expect.objectContaining({
				data: expect.objectContaining({ title: expect.stringContaining('#1') })
			})]
		}));
		randomSpy.mockRestore();
	});
});
