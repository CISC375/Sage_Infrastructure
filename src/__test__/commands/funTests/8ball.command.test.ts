// adjust the import path to the file that exports the command class
const Magic8BallCommand = require("../../../commands/fun/8ball").default;

// We must define the array here because it is NOT exported from the command file
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

describe("Magic8BallCommand", () => {
    let cmd;
    let mockRandom;

    beforeEach(() => {
        cmd = new Magic8BallCommand();
        // Mock Math.random to always return 0, which selects the first response
        mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        // Restore the original implementation after each test
        mockRandom.mockRestore();
    });

    describe("with a valid question", () => {
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

    describe("with an invalid question (no question mark)", () => {
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