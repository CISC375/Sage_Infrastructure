// adjust the import path to the file that exports the command class
const ThisIsFineCommand = require("../commands/fun/thisisfine").default;

describe("ThisIsFineCommand", () => {
	let cmd;

	beforeEach(() => {
		cmd = new ThisIsFineCommand();
	});

	test("calls interaction.reply with a files array including the image and correct name", async () => {
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const interaction = { reply: mockReply };

		const result = await cmd.run(interaction);

		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);

		// reply called with proper argument shape
		const callArg = mockReply.mock.calls[0][0];
		expect(callArg).toBeDefined();
		expect(Array.isArray(callArg.files)).toBe(true);
		expect(callArg.files).toHaveLength(1);

		const file = callArg.files[0];
		expect(file).toBeDefined();
		// name should match exactly
		expect(file.name).toBe("this_is_fine.png");

		// attachment should point to the image filename somewhere in the path
		expect(typeof file.attachment).toBe("string");
		expect(file.attachment).toContain("assets/images/thisisfine.png");

		// run should resolve to whatever reply resolves to
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const interaction = { reply: mockReply };

		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		expect(mockReply).toHaveBeenCalledTimes(1);
	});
});
