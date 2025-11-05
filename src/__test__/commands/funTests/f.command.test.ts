// adjust the import path to the file that exports the command class
const RespectsCommand = require("../../../commands/fun/f").default;

describe("RespectsCommand", () => {
    let cmd; // Using 'any' as the type since the interaction mock is complex

    beforeEach(() => {
        cmd = new RespectsCommand();
    });

    test("calls reply with correct content and file when no target is given", async () => {
        const mockReplyResult = { mocked: true };
        const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
        const mockGetMember = jest.fn().mockReturnValue(null); // No target

        const interaction = {
            reply: mockReply,
            user: { username: "TestUser" },
            options: { getMember: mockGetMember },
        };

        const result = await cmd.run(interaction);

        // Check that options.getMember was called
        expect(mockGetMember).toHaveBeenCalledTimes(1);
        expect(mockGetMember).toHaveBeenCalledWith("target");

        // reply was called once
        expect(mockReply).toHaveBeenCalledTimes(1);

        // reply called with proper argument shape
        const callArg = mockReply.mock.calls[0][0];
        expect(callArg).toBeDefined();

        // Check the content string
        expect(callArg.content).toBe("TestUser paid their respects ");

        // Check the file
        expect(Array.isArray(callArg.files)).toBe(true);
        expect(callArg.files).toHaveLength(1);
        const file = callArg.files[0];
        expect(file).toBeDefined();
        expect(file.name).toBe("pay_respects.png");
        expect(file.attachment).toContain("assets/images/f.png");

        // run should resolve to whatever reply resolves to
        expect(result).toBe(mockReplyResult);
    });

    test("calls reply with correct content and file when a target is given", async () => {
        const mockReplyResult = { mocked: true };
        const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
        const mockTarget = { user: { username: "TargetUser" } };
        const mockGetMember = jest.fn().mockReturnValue(mockTarget); // Has target

        const interaction = {
            reply: mockReply,
            user: { username: "TestUser" },
            options: { getMember: mockGetMember },
        };

        const result = await cmd.run(interaction);

        // Check that options.getMember was called
        expect(mockGetMember).toHaveBeenCalledTimes(1);
        expect(mockGetMember).toHaveBeenCalledWith("target");

        // reply was called once
        expect(mockReply).toHaveBeenCalledTimes(1);

        // reply called with proper argument shape
        const callArg = mockReply.mock.calls[0][0];
        expect(callArg).toBeDefined();

        // Check the content string
        expect(callArg.content).toBe("TestUser paid their respects to TargetUser");

        // Check the file (same as other test)
        expect(Array.isArray(callArg.files)).toBe(true);
        const file = callArg.files[0];
        expect(file.name).toBe("pay_respects.png");
        expect(file.attachment).toContain("assets/images/f.png");

        // run should resolve to whatever reply resolves to
        expect(result).toBe(mockReplyResult);
    });

    test("propagates errors from interaction.reply", async () => {
        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const mockGetMember = jest.fn().mockReturnValue(null); // Provide mock for safety

        const interaction = {
            reply: mockReply,
            user: { username: "TestUser" },
            options: { getMember: mockGetMember },
        };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
    });
});