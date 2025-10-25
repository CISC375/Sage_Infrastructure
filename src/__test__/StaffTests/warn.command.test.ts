const warn = require("../../commands/staff/warn").default;

// This test suite is not finished yet. It will thusly be disabled for now. 
/**
describe("warn Command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new warn();
	});

	test
	
	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetString = jest.fn().mockReturnValue("msglink");

		const interaction = {
			reply: mockReply,
			options: { getString: mockGetString },
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
			user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" },
			channel:{
				messages: {
					fetch: jest.fn().mockResolvedValueOnce({mockGetString}),
					message: {author: {send: jest.fn().mockResolvedValue(null)}}
				}
			}
		};
		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
	});
});*/