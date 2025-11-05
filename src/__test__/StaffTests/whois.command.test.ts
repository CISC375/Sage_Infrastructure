<<<<<<< HEAD
const whois = require("../../commands/staff/whois").default;

describe("whois command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new whois();
	});

	test("successfully replies with user info", async () => {
		const mockReplyResult = { mocked:true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockGetUser = jest.fn().mockReturnValue({ user: {id: "1234567890", username: "VerifiedUser"}});
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({ 
						member: {
							roles:{
								cache: {
									filter: jest.fn().mockReturnValue({sort: jest.fn(function() {return this}), values: [{name: "King", id: "4232", guild: {id: 4444}}, {name: "Member", id: "4511", guild: {id: 4444}}, {name: "Admin", id: "6789", guild: {id: 4444} }]}), 
									size: 5
								}
							},
							displayName: "VerifiedUser",
							id: "1234567890",
							joinedAt: new Date("2022-01-01T00:00:00Z"),
							user: {id: "1234567890", username: "VerifiedUser", createdAt: new Date("2021-01-01T00:00:00Z")}
						}
					})
				}
			}
		}
		const result = await cmd.run(interaction);
		expect(mockReply).toHaveBeenCalledTimes(1);
		
		const callArg = mockReply.mock.calls[0][0];
		expect(Array.isArray(callArg.embeds)).toBe(true);
		expect(callArg.embeds).toHaveLength(1);
		const embed = callArg.embeds[0];
		expect(embed.author.name).toBe("VerifiedUser");
		expect(embed.fields).toBe([
				{ name: 'Display Name', value: `VerifiedUser (<@1234567890>)`, inline: true },
				{ name: 'Account Created', value: "", inline: true },
				{ name: 'Joined Server', value: "", inline: true },
				{ name: 'Roles', value: "", inline: true }
			]);
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetUser = jest.fn().mockReturnValue("user");
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({ 
						user: {id: "1234567890", username: "VerifiedUser", createdAt: new Date("2021-01-01T00:00:00Z")}
					}),
					member: {
						roles:{
							cache: {
								get: jest.fn().mockReturnValue({name: "Member"})
							}
						},
						displayName: "VerifiedUser",
						id: "1234567890",
						joinedAt: new Date("2022-01-01T00:00:00Z"),
						cache: { size: 5, filter: jest.fn().mockReturnValue({ size: 4 })}
					}
				}
			}
		}
		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
=======
import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	GuildMember,
	User,
	Role,
	Collection,
	Guild,
	InteractionResponse,
} from 'discord.js';
// Adjust import path
import WhoisCommand from '../../commands/staff/whois'; // Adjust path if needed
import prettyMilliseconds from 'pretty-ms';

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
	const ActualCollection = jest.requireActual('discord.js').Collection;
	return {
		EmbedBuilder: MockEmbedBuilder,
		ChatInputCommandInteraction: jest.fn(),
		GuildMember: jest.fn(),
		User: jest.fn(),
		Role: jest.fn(),
		Guild: jest.fn(),
		Collection: ActualCollection,
		InteractionResponse: jest.fn(),
		ApplicationCommandOptionType: { User: 6 },
		ApplicationCommandPermissionType: { Role: 2 },
	};
});

// Mock pretty-ms to return a simple, predictable format without 'ago' suffix
jest.mock('pretty-ms', () => jest.fn((ms) => `${ms / 1000}s`));

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
	let mockGuild: jest.Mocked<Guild>;

	beforeEach(() => {
		jest.clearAllMocks();
		(EmbedBuilder as unknown as jest.Mock).mockClear();
		mockedPrettyMilliseconds.mockClear();

		command = new WhoisCommand();

		// --- Mock Guild ---
		mockGuild = {
			id: 'guild123',
			members: { fetch: jest.fn() },
		} as unknown as jest.Mocked<Guild>;

		// --- Mock User ---
		mockTargetUser = {
			id: 'target123',
			username: 'TargetUser',
			displayAvatarURL: jest.fn(() => 'http://avatar.url'),
			createdAt: new Date('2024-01-01T00:00:00.000Z'), // Jan 1st
			createdTimestamp: new Date('2024-01-01T00:00:00.000Z').getTime(),
		} as unknown as jest.Mocked<User>;

		// --- Mock Roles (Ensure guild property is set) ---
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
			displayColor: 0xff00ff,
			joinedAt: new Date('2024-06-15T00:00:00.000Z'), // June 15th
			joinedTimestamp: new Date('2024-06-15T00:00:00.000Z').getTime(),
			roles: { cache: mockRolesCache },
			guild: mockGuild,
		} as unknown as jest.Mocked<GuildMember>;

		// --- Mock Interaction ---
		mockInteraction = {
			user: { id: 'runner123', username: 'RunnerUser' },
			options: { getUser: jest.fn().mockReturnValue(mockTargetUser) },
			guild: mockGuild,
			reply: jest.fn().mockResolvedValue({} as InteractionResponse),
		} as unknown as jest.Mocked<ChatInputCommandInteraction>;

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
		const now = new Date('2024-10-24T13:00:00.000Z');
		jest.useFakeTimers().setSystemTime(now);

		await command.run(mockInteraction);

		expect(mockInteraction.options.getUser).toHaveBeenCalledWith('user');
		expect(mockInteraction.guild.members.fetch).toHaveBeenCalledWith('target123');
		expect(EmbedBuilder).toHaveBeenCalledTimes(1);

		expect(mockEmbed.setAuthor).toHaveBeenCalledWith({ name: 'TargetUser', iconURL: 'http://avatar.url' });
		expect(mockEmbed.setColor).toHaveBeenCalledWith(0xff00ff);
		expect(mockEmbed.setFooter).toHaveBeenCalledWith({ text: 'Member ID: target123' });

		const expectedCreatedAgoMs = now.getTime() - mockTargetUser.createdTimestamp;
		const expectedJoinedAgoMs = now.getTime() - mockTargetMember.joinedTimestamp;

		// Build date strings exactly like the source (using local getters and exact whitespace)
		const expectedCreatedStr = `${mockTargetUser.createdAt.getMonth()}/${mockTargetUser.createdAt.getDate()}/${mockTargetUser.createdAt.getFullYear()} \n\t\t(${expectedCreatedAgoMs / 1000}s ago)`;
		const expectedJoinedStr = `${mockTargetMember.joinedAt.getMonth()}/${mockTargetMember.joinedAt.getDate()}/${mockTargetMember.joinedAt.getFullYear()}\n\t\t(${expectedJoinedAgoMs / 1000}s ago)`;

		expect(mockEmbed.addFields).toHaveBeenCalledWith([
			{ name: 'Display Name', value: 'TargetNickname (<@target123>)', inline: true },
			{ name: 'Account Created', value: expectedCreatedStr, inline: true },
			{ name: 'Joined Server', value: expectedJoinedStr, inline: true },
			{ name: 'Roles', value: '<@&role1> <@&role2>', inline: true },
		]);

		expect(mockInteraction.reply).toHaveBeenCalledWith({
			embeds: [mockEmbed],
			ephemeral: true,
		});

		jest.useRealTimers();
	});

	it('should display "none" if member only has @everyone role', async () => {
		const mockEveryoneRole = { id: 'guild123', name: '@everyone', guild: mockGuild } as unknown as Role;
		const rolesCacheOnlyEveryone = new Collection<string, Role>();
		rolesCacheOnlyEveryone.set(mockEveryoneRole.id, mockEveryoneRole);
		(mockTargetMember.roles as any).cache = rolesCacheOnlyEveryone;

		await command.run(mockInteraction);

		expect(mockEmbed.addFields).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Roles', value: 'none', inline: true }),
			]),
		);
	});

	it('should handle errors when fetching member', async () => {
		const fetchError = new Error('Could not fetch member');
		(mockInteraction.guild.members.fetch as jest.Mock).mockRejectedValue(fetchError);

		await expect(command.run(mockInteraction)).rejects.toThrow('Could not fetch member');
		expect(mockInteraction.reply).not.toHaveBeenCalled();
>>>>>>> 35bb007c9c57d52ae04e06953b86aff4b93f5f2e
	});

});