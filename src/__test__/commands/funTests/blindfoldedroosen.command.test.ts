/**
 * Tests for the `/blindfoldedroosen` mini-game command. The command randomly
 * decides whether the user defeats "blindfolded Roosen", so the tests document
 * how we coerce Math.random to explore both branches and how we assert against
 * the embeds that explain the outcome to Discord users.
 */
const BlindfoldCommand = require("../../../commands/fun/blindfoldedroosen").default;

/**
 * Suite scope: ensure BlindfoldCommand embeds reflect win/loss outcomes and
 * that Discord errors bubble up.
 */
describe("BlindfoldCommand", () => {
    let cmd;
    let mockRandom;

    /**
     * Each spec starts with a fresh command instance and a Math.random spy. We
     * do not immediately set the return value so individual tests can document
     * the exact roll that leads to their scenario.
     */
    beforeEach(() => {
        cmd = new BlindfoldCommand();
        // Spy on Math.random to control outcomes
        mockRandom = jest.spyOn(Math, 'random');
    });

    /**
     * The real Math.random must be restored so that other suites and even other
     * tests in this file are not forced into the previously configured branch.
     */
    afterEach(() => {
        // Restore the original implementation
        mockRandom.mockRestore();
    });

    /**
     * A roll that is not equal to 5 signals victory. Rather than rely on real
     * randomness, we inject a deterministic 0 so the suite clearly documents the
     * happy path and asserts on the exact success embed.
     */
    describe("when Math.random results in a win", () => {
        /**
         * The main contract is the embed contents plus the fact that run() returns
         * the promise provided by interaction.reply. Interactions are represented
         * by simple objects to keep the test focused on command behavior.
         */
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

    /**
     * Rolling a 5 is the only failure case. We force Math.random to produce a
     * number that Math.floor maps to 5 to make that branch explicit.
     */
    describe("when Math.random results in a loss", () => {
        /**
         * Just like the win scenario we validate the embed title, color, and
         * description so copy tweaks never sneak in unnoticed.
         */
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

    /**
     * The command performs side effects, so errors from Discord need to bubble up.
     * This spec ensures the promise rejects when interaction.reply rejects.
     */
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
