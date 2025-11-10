/**
 * Ensures every admin slash command is discovered and enforces the expected permission gates.
 * Covers both successful execution by admin members and rejection for regular users.
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
	CHANNELS: {
		ROLE_SELECT: 'role-select',
		ANNOUNCEMENTS: 'channel-announcements'
	},
	ROLES: {
		VERIFIED: 'role-verified',
		STAFF: 'role-staff',
		ADMIN: 'role-admin',
		MUTED: 'role-muted'
	},
	ROLE_DROPDOWNS: {
		COURSE_ROLES: 'course-dropdown',
		ASSIGN_ROLES: 'assign-dropdown'
	},
	BOTMASTER_PERMS: [],
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
			this.user = { id: 'bot-user', setActivity: jest.fn() };
		}
	}

	class ModalBuilder {
		data;
		constructor() {
			this.data = { components: [] };
		}
		setTitle(title) { this.data.title = title; return this; }
		setCustomId(id) { this.data.customId = id; return this; }
		addComponents(...rows) {
			this.data.components.push(...rows);
			return this;
		}
	}

	class TextInputBuilder {
		data;
		constructor() {
			this.data = {};
		}
		setCustomId(id) { this.data.customId = id; return this; }
		setLabel(label) { this.data.label = label; return this; }
		setStyle(style) { this.data.style = style; return this; }
		setRequired(required) { this.data.required = required; return this; }
		setValue(value) { this.data.value = value; return this; }
	}

	class ActionRowBuilder {
		components;
		constructor() {
			this.components = [];
		}
		addComponents(...components) {
			this.components.push(...components.flat());
			return this;
		}
	}

	class ButtonBuilder {
		data;
		constructor() {
			this.data = {};
		}
		setLabel(label) { this.data.label = label; return this; }
		setCustomId(id) { this.data.customId = id; return this; }
		setStyle(style) { this.data.style = style; return this; }
		setEmoji(emoji) { this.data.emoji = emoji; return this; }
	}

	class EmbedBuilder {
		data;
		constructor() {
			this.data = {};
		}
		setTitle(title) { this.data.title = title; return this; }
		setDescription(desc) { this.data.description = desc; return this; }
		setColor(color) { this.data.color = color; return this; }
		setFooter(footer) { this.data.footer = footer; return this; }
		setFields(fields) { this.data.fields = fields; return this; }
		addFields(...fields) {
			this.data.fields = (this.data.fields || []).concat(fields);
			return this;
		}
		setThumbnail(url) { this.data.thumbnail = url; return this; }
		setTimestamp() { this.data.timestamp = Date.now(); return this; }
	}

	class AttachmentBuilder {
		data;
		constructor(buffer, options) {
			this.data = { buffer, options };
		}
	}

	return {
		Client,
		Collection,
		ModalBuilder,
		TextInputBuilder,
		ActionRowBuilder,
		ButtonBuilder,
		EmbedBuilder,
		AttachmentBuilder,
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
		ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
		ActivityType: { Playing: 0, Streaming: 1, Listening: 2, Watching: 3, Competing: 5 },
		ApplicationCommandType: { ChatInput: 1 },
		ChannelType: { GuildText: 'GUILD_TEXT', GuildCategory: 'GUILD_CATEGORY' }
	};
});

// Flushes queued promises after emitting events on the mocked Discord client.
const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Mocks the GuildMemberRoleManager used in tests so we can simulate different role holdings
 * without pulling in the entire Discord.js role cache implementation.
 */
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

const adminCommandNames = getCommandNames('../../commands/admin');

describe('Admin command interaction flows', () => {

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		jest.restoreAllMocks();
	});

	test('admin commands execute for members with the admin role', async () => {
		const client = new Client({
			intents: [],
			partials: []
		}) as any;

		// Prevent commandManager.loadCommands from loading the actual filesystem; we control the command map.
		jest.spyOn(commandManagerModule, 'loadCommands').mockImplementation(async (bot: any) => {
			bot.commands = new Collection();
			return Promise.resolve();
		});

		await register(client);

		const commandMap = new Collection<string, Command>();
		// Dynamically instantiate every admin command so the test automatically covers new files.
		const instantiatedAdminCommands = adminCommandNames.map(fileName => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { default: AdminCommand } = require(`../../commands/admin/${fileName}`);
			const instance: Command = new AdminCommand();
			instance.name = fileName;
			instance.permissions = [{
				id: 'role-admin',
				type: ApplicationCommandPermissionType.Role,
				permission: true
			}];
			instance.runInGuild = true;
			instance.run = jest.fn().mockResolvedValue(undefined);
			commandMap.set(fileName, instance);
			return { name: fileName, instance };
		});

		client.commands = commandMap;

		// Helper to build a minimal interaction for the targeted command.
		const makeInteraction = (commandName: string) => ({
			isChatInputCommand: () => true,
			isContextMenuCommand: () => false,
			isSelectMenu: () => false,
			isModalSubmit: () => false,
			isButton: () => false,
			commandName,
			client,
			channel: { type: ChannelType.GuildText },
			user: { id: `admin-${commandName}`, username: `Admin ${commandName}` },
			member: { roles: createRoleManager(['role-admin']) },
			reply: jest.fn().mockResolvedValue(undefined)
		});

		instantiatedAdminCommands.forEach(({ name }) => {
			client.emit('interactionCreate', makeInteraction(name) as any);
		});

		await waitForPromises();

		// Each command should have run exactly once with the relevant interaction payload.
		instantiatedAdminCommands.forEach(({ name, instance }) => {
			expect(instance.run).toHaveBeenCalledTimes(1);
			const [interactionArg] = (instance.run as jest.Mock).mock.calls[0];
			expect(interactionArg.commandName).toBe(name);
		});
	});

	test('non-admin users are blocked from admin commands', async () => {
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
		const { default: AdminCommand } = require('../../commands/admin/status');
		const instance: Command = new AdminCommand();
		instance.name = 'status';
		instance.permissions = [{
			id: 'role-admin',
			type: ApplicationCommandPermissionType.Role,
			permission: true
		}];
		instance.run = jest.fn();

		client.commands = new Collection([[instance.name, instance]]);

		const replyMock = jest.fn().mockResolvedValue(undefined);

		// Member without admin role attempting to run an admin-only command.
		const interaction = {
			isChatInputCommand: () => true,
			isContextMenuCommand: () => false,
			isSelectMenu: () => false,
			isModalSubmit: () => false,
			isButton: () => false,
			commandName: 'status',
			client,
			channel: { type: ChannelType.GuildText },
			user: { id: 'user-no-role', username: 'NoRole' },
			member: { roles: createRoleManager([]) },
			reply: replyMock
		};

		const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

		client.emit('interactionCreate', interaction as any);
		await waitForPromises();

		// Command should not run and the user should receive a failure reply.
		expect(instance.run).not.toHaveBeenCalled();
		expect(replyMock).toHaveBeenCalledTimes(1);
		expect(typeof replyMock.mock.calls[0][0]).toBe('string');

		randomSpy.mockRestore();
	});
});
