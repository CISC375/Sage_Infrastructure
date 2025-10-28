import { get } from 'http';

const resetlevel = require("../../commands/staff/resetlevel").default;

describe("resetlevel command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new resetlevel();
	});

	test("Successfully resets user's level.", async () => {
		// Mock interaction object
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", username: "VerifiedUser", avatarURL: () => "http://avatar.url/image.png"});
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser, getInteger: jest.fn().mockReturnValue(12) },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce({
						discordId: "1234567890", tag: "VerifiedUser", pii: true, count: 42, email: "vUser@udel.edu"
						}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"}),
					updateOne: jest.fn().mockResolvedValue({filter:{discordId: 1234567890}, update:{ $set: { count: 12 }}})
				},)
			}},
			guild: {
					members: {
					fetch: jest.fn().mockResolvedValueOnce({
						id: "1234567890", displayName: "VerifiedUser"
					})
				}
			},
			// Sender info
			user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" }
		};
		const result = await cmd.run(interaction);
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
		const callArg = mockReply.mock.calls[0][0];
		expect(callArg).toBeDefined();
		expect(callArg.content).toBe("Set VerifiedUser's message count to 12.");
		// run should resolve to whatever reply resolves to
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "VerifiedUser", avatarURL: () => "http://avatar.url/image.png"});

		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser, getInteger: jest.fn().mockReturnValue(12) },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce({
						discordId: "1234567890", tag: "VerifiedUser", pii: true, count: 42, email: "vUser@udel.edu"
						}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"}),
					updateOne: jest.fn().mockResolvedValue({filter:{discordId: 1234567890}, update:{ $set: { count: 12 }}})
				},)
			}},
			guild: {
					members: {
					fetch: jest.fn().mockResolvedValueOnce({
						id: "1234567890", displayName: "VerifiedUser"
					})
				}
			},
			// Sender info
			user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" }
		};
		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
	});

});