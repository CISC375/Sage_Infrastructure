// adjust the import path to the file that exports the command class
const DoubtCommand = require("../../commands/fun/doubt").default; // ⚠️ Adjust this path

describe("DoubtCommand", () => {
    let cmd;

    beforeEach(() => {
        cmd = new DoubtCommand();
    });

    test("calls reply with correct content and file", async () => {
        const mockReplyResult = { mocked: true };
        const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
        const mockTarget = { user: { username: "TargetUser" } };
        const mockGetMember = jest.fn().mockReturnValue(mockTarget);

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
        expect(callArg.content).toBe("TestUser pressed X to doubt TargetUser");

        // Check the file
        expect(Array.isArray(callArg.files)).toBe(true);
        expect(callArg.files).toHaveLength(1);
        const file = callArg.files[0];
        expect(file).toBeDefined();
        expect(file.name).toBe("doubt.jpg");
        expect(file.attachment).toContain("assets/images/doubt.jpg");

        // run should resolve to whatever reply resolves to
        expect(result).toBe(mockReplyResult);
    });

    test("propagates errors from interaction.reply", async () => {
        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const mockTarget = { user: { username: "TargetUser" } };
        const mockGetMember = jest.fn().mockReturnValue(mockTarget); // Must mock this since it's accessed before .reply

        const interaction = {
            reply: mockReply,
            user: { username: "TestUser" },
            options: { getMember: mockGetMember },
        };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
    });
});