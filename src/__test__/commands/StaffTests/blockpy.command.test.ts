jest.mock("nodemailer", () => ({
	createTransport: jest.fn(() => ({
		sendMail: jest.fn().mockResolvedValue(undefined)
	}))
}));

const blockpy = require("../../../commands/staff/blockpy").default;

export default blockpy;

describe("blockpy Command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new blockpy();
	});
	
	test("email was successfully sent", async () => {
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "VerifiedUser", avatarURL: () => "http://avatar.url/image.png"});
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce({
						discordId: "1234567890", tag: "VerifiedUser", pii: true, count: 42, email: "vUser@udel.edu"
						}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
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
		const result =  await  cmd.run(interaction);
		expect(mockReply).toHaveBeenCalledTimes(1);
		const callArg = mockReply.mock.calls[0][0];
		expect(callArg.content).toBe(`An email has been sent to you containing the requested data about \`VerifiedUser\`.`);
		expect(result).toBe(mockReplyResult);
	});

	test("user is unverified", async () => {
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "UnverifiedUser", avatarURL: () => "http://avatar.url/image.png"});
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce(null
						).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
				},)
			}},
			guild: {
					members: {
					fetch: jest.fn().mockResolvedValueOnce({
						id: "1234567890", displayName: "UnverifiedUser"
					})
				}
			},
			// Sender info
			user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" }
		};
		const result =  await  cmd.run(interaction);
		expect(mockReply).toHaveBeenCalledTimes(1);
		const callArg = mockReply.mock.calls[0][0];
		expect(callArg.content).toBe(`User UnverifiedUser has not verified.`);
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "VerifiedUser", avatarURL: () => "http://avatar.url/image.png"});

		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce({
						discordId: "1234567890", tag: "VerifiedUser", pii: true, count: 42, email: "vUser@udel.edu"
						}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
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
