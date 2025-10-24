const warn = require("../../commands/staff/warn").default;

describe("warn Command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new warn();
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