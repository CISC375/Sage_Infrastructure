// adjust the import path to the file that exports the command class
const BlindfoldCommand = require("../commands/fun/blindfoldedroosen").default;

describe("BlindfoldCommand", () => {
    let cmd;
    let mockRandom;

    beforeEach(() => {
        cmd = new BlindfoldCommand();
        // Spy on Math.random to control outcomes
        mockRandom = jest.spyOn(Math, 'random');
    });

    afterEach(() => {
        // Restore the original implementation
        mockRandom.mockRestore();
    });

    describe("when Math.random results in a win", () => {
        test("calls interaction.reply with the win embed", async () => {
            // Mock random to return 0. Math.floor(0 * 6) = 0. 0 !== 5 (win)
            mockRandom.mockReturnValue(0);

            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const interaction = { reply: mockReply };

            const result = await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // reply called with proper argument shape
            const callArg = mockReply.mock.calls[0][0];
            expect(callArg).toBeDefined();
            expect(Array.isArray(callArg.embeds)).toBe(true);
            expect(callArg.embeds).toHaveLength(1);

            // Check embed content
            const embed = callArg.embeds[0].data;
            expect(embed).toBeDefined();
            expect(embed.title).toBe('Battle results');
            expect(embed.color).toBe(0x00ff00); // Green
            expect(embed.description).toBe('You\'ve won the fight against blindfolded Roosen. You live another day!');

            // run should resolve to whatever reply resolves to
            expect(result).toBe(mockReplyResult);
        });
    });

    describe("when Math.random results in a loss", () => {
        test("calls interaction.reply with the lose embed", async () => {
            // Mock random to return 0.9. Math.floor(0.9 * 6) = Math.floor(5.4) = 5. 5 === 5 (loss)
            mockRandom.mockReturnValue(0.9);

            const mockReplyResult = { mocked: true };
            const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
            const interaction = { reply: mockReply };

            const result = await cmd.run(interaction);

            // reply was called once
            expect(mockReply).toHaveBeenCalledTimes(1);

            // Check embed content
            const callArg = mockReply.mock.calls[0][0];
            const embed = callArg.embeds[0].data;
            expect(embed.title).toBe('Battle results');
            expect(embed.color).toBe(0xff0000); // Red
            expect(embed.description).toBe('Ooooooooooooh... ouch! Blindfolded Roosen has killed you! You lose.');

            // run should resolve to whatever reply resolves to
            expect(result).toBe(mockReplyResult);
        });
    });

    test("propagates errors from interaction.reply", async () => {
        // Mock random to any value just to let the code run
        mockRandom.mockReturnValue(0);

        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const interaction = { reply: mockReply };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
    });
});