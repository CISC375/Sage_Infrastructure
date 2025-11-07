/**
 * Tests for the `/8ball` novelty command. While the command itself is simple, the
 * tests double as living documentation for how we mock deterministic randomness
 * and Discord embed replies in this codebase. The guiding principles are:
 *   • Treat every interaction.reply call as the observable contract.
 *   • Stub Math.random so expectations remain deterministic.
 *   • Mirror the user-facing strings so regressions surface immediately.
 */
const Magic8BallCommand = require("../../../commands/fun/8ball").default;

// The real command pulls from the same array, but it is not exported, so we
// mirror the data locally to keep the assertions explicit.
const MAGIC8BALL_RESPONSES = [
    'As I see it, yes.',
    'Ask again later.',
    'Better not tell you now.',
    'Cannot predict now.',
    'Concentrate and ask again.',
    'Don\'t count on it.',
    'It is certain.',
    'It is decidedly so.',
    'Most likely.',
    'My reply is no.',
    'My sources say no.',
    'Outlook not so good.',
    'Outlook good.',
    'Reply hazy, try again.',
    'Signs point to yes.',
    'Very doubtful.',
    'Without a doubt.',
    'Yes.',
    'Yes - definitely.',
    'You may rely on it.'
];

/**
 * Suite-level coverage for Magic8BallCommand: question validation, randomized
 * responses, and error handling.
 */
describe("Magic8BallCommand", () => {
    let cmd;
    let mockRandom;

    /**
     * The command relies on Math.random and caches no state, so a fresh instance
     * per test keeps assertions isolated. We also lock randomness to a fixed value
     * so the embed string picked from MAGIC8BALL_RESPONSES never changes.
     */
    beforeEach(() => {
        cmd = new Magic8BallCommand();
        // Mock Math.random to always return 0, which selects the first response
        mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    /**
     * Jest spies are reset after each spec to avoid cross-test pollution. This is
     * especially important for Math.random because other suites may rely on the
     * original implementation.
     */
    afterEach(() => {
        // Restore the original implementation after each test
        mockRandom.mockRestore();
    });

    /**
     * Happy-path coverage: a well-formed question should yield a themed embed and
     * echo the user's prompt in the footer. We assert against the entire shape of
     * the outgoing payload so changes to colors/titles/descriptions are reviewed.
     */
    describe("with a valid question", () => {
        /**
         * Valid requests are asynchronous because Discord replies return a promise.
         * The test verifies (a) Math.random drives the response message and (b) the
         * command passes through whatever value interaction.reply resolves with.
         */
        test("calls interaction.reply with a random response embed", async () => {
            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const question = "Will this test pass?";
            const username = "TestUser";
            const interaction = {
                reply: mockReply,
                options: {
                    getString: jest.fn().mockReturnValue(question),
                },
                user: {
                    username: username,
                },
            };

            const result = await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // reply called with proper argument shape
            const callArg = mockReply.mock.calls[0][0];
            expect(callArg).toBeDefined();
            expect(Array.isArray(callArg.embeds)).toBe(true);
            expect(callArg.embeds).toHaveLength(1);

            // Check embed content (using .data from EmbedBuilder)
            const embed = callArg.embeds[0].data;
            expect(embed).toBeDefined();
            expect(embed.title).toBe("The magic 8-ball says...");
            expect(embed.color).toBe(0x000000);
            expect(embed.image.url).toBe("https://i.imgur.com/UFPWxHV.png");

            // Check the *specific* response based on mocked Math.random
            // Math.random=0, so index is Math.floor(0 * 20) = 0
            const expectedResponse = MAGIC8BALL_RESPONSES[0];
            expect(embed.description).toBe(expectedResponse);
            expect(embed.footer.text).toBe(`${username} asked: ${question}`);

            // run should resolve to whatever reply resolves to
            expect(result).toBe(mockReplyResult);
        });
    });

    /**
     * Validation coverage: the command is opinionated that a question must contain
     * a question mark. We simulate that branch to guarantee the fallback text
     * stays user-friendly and localized in a single place.
     */
    describe("with an invalid question (no question mark)", () => {
        /**
         * By leaving Math.random mocked we ensure the branch short-circuits before
         * randomness is consulted. The embed copy here is effectively business
         * logic, so we assert against each string literal.
         */
        test("calls interaction.reply with the 'smh' embed", async () => {
            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const question = "This is a statement";
            const username = "TestUser";
            const interaction = {
                reply: mockReply,
                options: {
                    getString: jest.fn().mockReturnValue(question),
                },
                user: {
                    username: username,
                },
            };

            const result = await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // reply called with proper argument shape
            const callArg = mockReply.mock.calls[0][0];
            expect(Array.isArray(callArg.embeds)).toBe(true);
            expect(callArg.embeds).toHaveLength(1);

            // Check embed content
            const embed = callArg.embeds[0].data;
            expect(embed.title).toBe("The magic 8-ball says...");
            // Check the specific 'invalid' response
            expect(embed.description).toBe('The 8-ball only responds to questions smh');
            expect(embed.footer.text).toBe(`${username} asked: ${question}`);

            // run should resolve to whatever reply resolves to
            expect(result).toBe(mockReplyResult);
        });
    });


    /**
     * Defensive coverage: the command should not swallow Discord API failures.
     * Instead, run() should surface the error so the caller (and Jest) can catch it.
     */
    test("propagates errors from interaction.reply", async () => {
        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const interaction = {
            reply: mockReply,
            // Need to mock dependencies used *before* reply is called
            options: {
                getString: jest.fn().mockReturnValue("A valid question?"),
            },
            user: {
                username: "ErrorUser",
            },
        };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
    });
});
