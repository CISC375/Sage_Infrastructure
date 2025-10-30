const google = require("../../commands/staff/google").default;

describe("google Command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new google();
	});

	test("calls reply with correct response and Google URL", async () => {
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const searchTerm = "test search";
		const expectedUrl = `https://letmegooglethat.com/?q=${encodeURIComponent(searchTerm)}`;
		const interaction = {
			reply: mockReply,
			options: {
				getString: jest.fn().mockReturnValue(searchTerm),
			},
		};

		const result = await cmd.run(interaction);

		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
		
		const callArg = mockReply.mock.calls[0][0];
		expect(callArg).toBeDefined();
		expect(Array.isArray(callArg.embeds)).toBe(true);
		expect(callArg.embeds).toHaveLength(1);
		const embed = callArg.embeds[0].data;
		expect(embed).toBeDefined();
		expect(embed.title).toBe("Let me Google that for you!");
		expect(embed.url).toBe(expectedUrl);
		expect(embed.color).toBe(15277667); // LuminousVividPink

		expect(result).toBe(mockReplyResult);
	});

	test("propogates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const searchTerm = "test search";
		const interaction = {
			reply: mockReply,
			options: {
				getString: jest.fn().mockReturnValue(searchTerm),
			},
		};
		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		expect(mockReply).toHaveBeenCalledTimes(1);
	});
});