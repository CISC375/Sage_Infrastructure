/**
 * Tests for the `/doubt` meme command which tags another member and attaches
 * the "X to doubt" image. These tests emphasize documenting the interplay
 * between interaction options, attachment payloads, and error propagation.
 */
const DoubtCommand = require("../../../commands/fun/doubt").default;

/**
 * Suite scope: DoubtCommand should resolve the target, attach the meme image,
 * and surface reply errors.
 */
describe("DoubtCommand", () => {
    let cmd;

    /**
     * The command is stateless so a simple re-instantiation keeps each test
     * self-contained.
     */
    beforeEach(() => {
        cmd = new DoubtCommand();
    });

    /**
     * Happy path: selecting a target should yield a descriptive string and the
     * JPEG attachment Discord expects. We mirror the user mentions and file
     * metadata to keep the contract obvious to future readers.
     */
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

    /**
     * Defensive coverage: even though attachments load from disk, the command
     * still needs to surface Discord errors. We reuse the happy-path mocks for
     * interaction options to reach the reply call.
     */
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
