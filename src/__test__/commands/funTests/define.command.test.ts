/**
 * DefineCommand turns a single word into a Merriam-Webster URL. The tests document
 * how we validate the input, encode special characters, and surface errors.
 */
const DefineCommand = require("../../../commands/fun/define").default;

/**
 * Suite scope: map user input to dictionary URLs and handle invalid cases.
 */
describe("DefineCommand", () => {
    let cmd;

    /**
     * Simple stateless setup: recreate the command between specs.
     */
    beforeEach(() => {
        cmd = new DefineCommand();
    });

    /**
     * Single-word happy path variants.
     */
    describe("with a single word", () => {
        /**
         * Baseline: plain ASCII word maps directly into the dictionary URL.
         */
        test("calls interaction.reply with the correct merriam-webster link", async () => {
            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const word = "hello";
            const interaction = {
                reply: mockReply,
                options: {
                    getString: jest.fn().mockReturnValue(word),
                },
            };

            const result = await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // reply called with the correct string
            const expectedLink = `https://www.merriam-webster.com/dictionary/${word}`;
            expect(mockReply).toHaveBeenCalledWith(expectedLink);

            // run should resolve to whatever reply resolves to
            expect(result).toBe(mockReplyResult);
        });

        /**
         * Special characters must be encoded to avoid malformed links.
         */
        test("URL-encodes special characters", async () => {
            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const word = "test's";
            const interaction = {
                reply: mockReply,
                options: {
                    getString: jest.fn().mockReturnValue(word),
                },
            };

            await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // Check that the word was properly encoded
            const encodedWord = encodeURIComponent(word); // "test%27s"
            const expectedLink = `https://www.merriam-webster.com/dictionary/${encodedWord}`;
            expect(mockReply).toHaveBeenCalledWith(expectedLink);
        });
    });

    /**
     * Multi-word inputs are rejected to keep the command simple.
     */
    describe("with multiple words", () => {
        /**
         * We respond with a friendly, ephemeral message rather than a broken link.
         */
        test("calls interaction.reply with an ephemeral error message", async () => {
            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const word = "hello there"; // Contains a space
            const interaction = {
                reply: mockReply,
                options: {
                    getString: jest.fn().mockReturnValue(word),
                },
            };

            const result = await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // reply called with the error message and ephemeral flag
            expect(mockReply).toHaveBeenCalledWith({
                content: 'You can only define one word at a time!',
                ephemeral: true
            });

            // run should resolve to whatever reply resolves to
            expect(result).toBe(mockReplyResult);
        });
    });


    /**
     * Regardless of input, Discord errors should bubble up so upstream logic can
     * observe the rejection.
     */
    test("propagates errors from interaction.reply", async () => {
        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const interaction = {
            reply: mockReply,
            options: {
                // Mock dependencies used before the reply
                getString: jest.fn().mockReturnValue("test"),
            },
        };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
    });
});
