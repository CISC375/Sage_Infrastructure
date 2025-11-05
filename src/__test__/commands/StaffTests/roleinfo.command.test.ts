import { Guild } from 'discord.js';

const roleinfo = require("../../../commands/staff/roleinfo").default;

describe("roleinfo command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new roleinfo();
	});

	test("displays role information correctly", async () => {
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockMembers = {memberData: [{user: {username:"member1"}},{user: {username:"member2"}},{user: {username:"member3"}}], size: 3, map: jest.fn(callback => mockMembers.memberData.map(callback))};
		const mockGetRole = jest.fn().mockReturnValue({ id: "9876543210", name: "TestRole", color: "#FF0000", members: mockMembers});
		const interaction = {
			reply: mockReply,
			options: { getRole: mockGetRole },
			guild: {
				roles: {fetch: jest.fn().mockResolvedValue({ mockGetRole})}
			}
		};
		const result = await cmd.run(interaction);
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
		const callArg = mockReply.mock.calls[0][0];
		expect(Array.isArray(callArg.embeds)).toBe(true);

		const embed = callArg.embeds[0].data;
		expect(embed.title).toBe("TestRole | 3 members");
		expect(embed.color).toBe(0xFF0000);
		expect(embed.footer.text).toBe("Role ID: 9876543210");
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockMembers = {memberData: [{user: {username:"member1"}},{user: {username:"member2"}},{user: {username:"member3"}}], size: 3, map: jest.fn(callback => mockMembers.memberData.map(callback))};
		const mockGetRole = jest.fn().mockReturnValue({ id: "9876543210", name: "TestRole", color: "#FF0000", members: mockMembers});
		const interaction = {
			reply: mockReply,
			options: { getRole: mockGetRole },
			guild: {
				roles: {fetch: jest.fn().mockResolvedValue({ mockGetRole})}
			}
		};
		await expect(cmd.run(interaction)).rejects.toThrow(err);
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
	});
});