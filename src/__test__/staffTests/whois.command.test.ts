import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	GuildMember,
	User,
	Role,
	Collection,
	Guild,
	InteractionResponse,
	ApplicationCommandOptionType,
} from 'discord.js';
// Adjust import path
import WhoisCommand from '../../commands/staff/whois'; // Adjust path if needed
import prettyMilliseconds from 'pretty-ms';
import { STAFF_PERMS, ADMIN_PERMS } from '@lib/permissions';
import { ROLES, BOT } from '@root/config'; // Needed for base Command

// --- Mocks ---

// Mock discord.js
jest.mock('discord.js', () => {
	const MockEmbedBuilder = jest.fn(() => ({
		setAuthor: jest.fn().mockReturnThis(),
		setColor: jest.fn().mockReturnThis(),
		setTimestamp: jest.fn().mockReturnThis(),
		setFooter: jest.fn().mockReturnThis(),
		addFields: jest.fn().mockReturnThis(),
	}));
	// Use actual Collection for roles.cache simulation
	const ActualCollection = jest.requireActual('discord.js').Collection;
	return {
		EmbedBuilder: MockEmbedBuilder,
		ChatInputCommandInteraction: jest.fn(),
		GuildMember: jest.fn(),
		User: jest.fn(),
		Role: jest.fn(),
		Guild: jest.fn(),
		Collection: ActualCollection, // Use actual Collection
		InteractionResponse: jest.fn(),
		ApplicationCommandOptionType: {
			User: 6,
		},
		ApplicationCommandPermissionType: { Role: 2 }, // Needed for base Command
	};
});

// Mock pretty-ms
jest.mock('pretty-ms', () => jest.fn((ms) => `${ms / 1000}s ago`)); // Simple mock

// Mock permissions
jest.mock('@lib/permissions', () => ({
	STAFF_PERMS: { id: 'staff-perm-id', type: 1, permission: true },
	ADMIN_PERMS: { id: 'admin-perm-id', type: 1, permission: true },
}));

// Mock config for base Command
jest.mock('@root/config', () => ({
	ROLES: { VERIFIED: 'mock-verified-role-id' },
	BOT: { NAME: 'TestBot' },
}));

// --- Typed Mocks ---
const mockedPrettyMilliseconds = prettyMilliseconds as jest.Mock;

// =============================
// == WhoisCommand Tests
// =============================
describe('WhoisCommand', () => {
	let command: WhoisCommand;
	let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
	let mockTargetUser: jest.Mocked<User>;
	let mockTargetMember: jest.Mocked<GuildMember>;
	let mockEmbed: any;
	let mockGuild: jest.Mocked<Guild>; // Added mockGuild

	beforeEach(() => {
		jest.clearAllMocks();
		(EmbedBuilder as unknown as jest.Mock).mockClear();

		command = new WhoisCommand();

		// --- Mock Guild ---
		mockGuild = {
			id: 'guild123', // Make sure guild ID matches everyone role ID
			members: {
				fetch: jest.fn(), // fetch method mock
			},
		} as unknown as jest.Mocked<Guild>;

		// --- Mock User ---
		mockTargetUser = {
			id: 'target123',
			username: 'TargetUser',
			displayAvatarURL: jest.fn(() => 'http://avatar.url'),
			createdAt: new Date('2024-01-01T00:00:00.000Z'), // Jan 1st, 2024
			createdTimestamp: new Date('2024-01-01T00:00:00.000Z').getTime(),
		} as unknown as jest.Mocked<User>;

		// --- Mock Roles ---
		// FIX: Add mock guild property to roles
		const mockEveryoneRole = { id: 'guild123', name: '@everyone', guild: mockGuild } as unknown as Role;
		const mockRole1 = { id: 'role1', name: 'RoleA', toString: () => '<@&role1>', guild: mockGuild } as unknown as Role;
		const mockRole2 = { id: 'role2', name: 'RoleB', toString: () => '<@&role2>', guild: mockGuild } as unknown as Role;
		const mockRolesCache = new Collection<string, Role>();
		mockRolesCache.set(mockEveryoneRole.id, mockEveryoneRole);
		mockRolesCache.set(mockRole1.id, mockRole1);
		mockRolesCache.set(mockRole2.id, mockRole2);

		// --- Mock Member ---
		mockTargetMember = {
			id: 'target123',
			user: mockTargetUser,
			displayName: 'TargetNickname',
			displayColor: 0xff00ff, // Mock color
			joinedAt: new Date('2024-06-15T00:00:00.000Z'), // June 15th, 2024
			joinedTimestamp: new Date('2024-06-15T00:00:00.000Z').getTime(),
			roles: {
				cache: mockRolesCache,
			},
			guild: mockGuild, // Assign the mocked guild
		} as unknown as jest.Mocked<GuildMember>;

		// --- Mock Interaction ---
		mockInteraction = {
			user: { id: 'runner123', username: 'RunnerUser' },
			options: {
				getUser: jest.fn().mockReturnValue(mockTargetUser),
			},
			guild: mockGuild, // Assign the mocked guild here too
			reply: jest.fn().mockResolvedValue({} as InteractionResponse),
		} as unknown as jest.Mocked<ChatInputCommandInteraction>;

		// Mock the guild.members.fetch call specifically
		(mockGuild.members.fetch as jest.Mock).mockResolvedValue(mockTargetMember);

		// --- Mock Embed Builder ---
		mockEmbed = {
			setAuthor: jest.fn().mockReturnThis(),
			setColor: jest.fn().mockReturnThis(),
			setTimestamp: jest.fn().mockReturnThis(),
			setFooter: jest.fn().mockReturnThis(),
			addFields: jest.fn().mockReturnThis(),
		};
		(EmbedBuilder as unknown as jest.Mock).mockReturnValue(mockEmbed);
	});

	it('should fetch member info and reply with an embed', async () => {
		// Mock current time for predictable 'ago' calculation
		const now = new Date('2024-10-24T13:00:00.000Z');
		jest.useFakeTimers().setSystemTime(now);

		await command.run(mockInteraction);

		// Check mocks
		expect(mockInteraction.options.getUser).toHaveBeenCalledWith('user');
		expect(mockInteraction.guild.members.fetch).toHaveBeenCalledWith('target123');
		expect(EmbedBuilder).toHaveBeenCalledTimes(1);

		// Check embed content
		expect(mockEmbed.setAuthor).toHaveBeenCalledWith({
			name: 'TargetUser',
			iconURL: 'http://avatar.url',
		});
		expect(mockEmbed.setColor).toHaveBeenCalledWith(0xff00ff);
		expect(mockEmbed.setFooter).toHaveBeenCalledWith({ text: 'Member ID: target123' });

		// Check date calculations (months are 0-indexed in JS Date)
		const expectedCreatedAgo = now.getTime() - mockTargetUser.createdTimestamp;
		const expectedJoinedAgo = now.getTime() - mockTargetMember.joinedTimestamp;

		// Note the extra spaces/newlines from the template literal in the source
		expect(mockEmbed.addFields).toHaveBeenCalledWith([
			{ name: 'Display Name', value: 'TargetNickname (<@target123>)', inline: true },
			{ name: 'Account Created', value: `11/31/2023 \n    (${expectedCreatedAgo / 1000}s ago)`, inline: true },
			{ name: 'Joined Server', value: `5/15/2023\n      (${expectedJoinedAgo / 1000}s ago)`, inline: true },
			{ name: 'Roles', value: '<@&role1> <@&role2>', inline: true }, // Sorted and joined, @everyone filtered
		]);

		expect(mockInteraction.reply).toHaveBeenCalledWith({
			embeds: [mockEmbed],
			ephemeral: true,
		});

		jest.useRealTimers(); // Restore real timers
	});

	it('should display "none" if member only has @everyone role', async () => {
		// Modify mock member to only have @everyone
		const mockEveryoneRole = { id: 'guild123', name: '@everyone', guild: mockGuild } as unknown as Role;
		const rolesCacheOnlyEveryone = new Collection<string, Role>();
		rolesCacheOnlyEveryone.set(mockEveryoneRole.id, mockEveryoneRole);
		(mockTargetMember.roles as any).cache = rolesCacheOnlyEveryone; // Override cache

		await command.run(mockInteraction);

		expect(mockEmbed.addFields).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Roles', value: 'none', inline: true }),
			]),
		);
	});

	it('should handle errors when fetching member', async () => {
		// Arrange: Make fetch fail
		const fetchError = new Error('Could not fetch member');
		(mockInteraction.guild.members.fetch as jest.Mock).mockRejectedValue(fetchError);

		// Act & Assert: Expect error to propagate
		await expect(command.run(mockInteraction)).rejects.toThrow('Could not fetch member');

		// Ensure no reply was sent
		expect(mockInteraction.reply).not.toHaveBeenCalled();
	});
});