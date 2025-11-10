/**
 * RollCommand supports a surprisingly large set of inputs (custom ranges, dice
 * counts, keep-highest logic). These tests document the validation rules,
 * embed contract, and error handling.
 */
const RollCommand = require("../../../commands/fun/diceroll").default;
// Import the mocked function
const { generateErrorEmbed } = require('@root/src/lib/utils/generalUtils');

// --- Mocks ---
// We must mock the imported utility function
const mockErrorEmbed = { description: 'mocked error embed' };
jest.mock('@root/src/lib/utils/generalUtils', () => ({
    generateErrorEmbed: jest.fn(() => mockErrorEmbed),
}));

// Define constants here since they aren't exported
const DEFAULT_RANGE = [1, 6];
const DEFAULT_ROLLS = 1;
// --- End Mocks ---

/**
 * RollCommand suite
 * Focus: validation messages, deterministic rolls, and Discord reply handling.
 */
describe("RollCommand", () => {
    let cmd;
    let mockRandom;
    let mockReply;
    let mockGetNumber;
    let mockInteraction;

    /**
     * Fresh command + mocked Math.random for every spec guarantees deterministic
     * outcomes. The default interaction simulates a Discord user invoking the
     * slash command without optional arguments.
     */
    beforeEach(() => {
        cmd = new RollCommand();
        // Spy on Math.random to control outcomes
        mockRandom = jest.spyOn(Math, 'random');

        // Set up default interaction mocks
        mockReply = jest.fn().mockResolvedValue(true);
        mockGetNumber = jest.fn();
        mockInteraction = {
            reply: mockReply,
            options: {
                getNumber: mockGetNumber,
            },
            user: {
                username: "TestUser",
            },
        };

        // Default behavior: no options provided
        mockGetNumber.mockReturnValue(null);
        // Clear mock call history
        generateErrorEmbed.mockClear();
    });

    /**
     * Restore Math.random after each test so other suites aren't impacted and
     * wipe any lingering mock call history.
     */
    afterEach(() => {
        // Restore all mocks
        mockRandom.mockRestore();
        jest.clearAllMocks();
    });

    /**
     * Validation ensures players receive actionable feedback before we even hit
     * the RNG. Each test targets a specific guard clause.
     */
    describe("Validation Errors", () => {
        /**
         * Providing only a minimum is ambiguous; we expect a friendly error embed.
         */
        test("handles min without max", async () => {
            mockGetNumber.mockImplementation((name) =>
                name === 'minimum' ? 10 : null
            );

            await cmd.run(mockInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(generateErrorEmbed).toHaveBeenCalledWith('If you provide a minimum, you must also provide a maximum.');
            expect(mockReply).toHaveBeenCalledWith({ embeds: [mockErrorEmbed], ephemeral: true });
        });

        /**
         * Maximum less than minimum is a common typo, so document the response.
         */
        test("handles max < min", async () => {
            mockGetNumber.mockImplementation((name) => {
                if (name === 'minimum') return 10;
                if (name === 'maximum') return 5;
                return null;
            });

            await cmd.run(mockInteraction);

            expect(generateErrorEmbed).toHaveBeenCalledWith('Your maximum must be greater than your minimum.');
            expect(mockReply).toHaveBeenCalledWith({ embeds: [mockErrorEmbed], ephemeral: true });
        });

        /**
         * This command only rolls integers; fractional bounds are rejected.
         */
        test("handles non-integer min/max", async () => {
            mockGetNumber.mockImplementation((name) => {
                if (name === 'minimum') return 1.5;
                if (name === 'maximum') return 5;
                return null;
            });

            await cmd.run(mockInteraction);

            expect(generateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('not whole numbers'));
            expect(mockReply).toHaveBeenCalledWith({ embeds: [mockErrorEmbed], ephemeral: true });
        });

        /**
         * Users cannot spam with too many dice; this ensures the cap works.
         */
        test("handles invalid numRolls (too high)", async () => {
            mockGetNumber.mockImplementation((name) =>
                name === 'numdice' ? 20 : null
            );

            await cmd.run(mockInteraction);

            expect(generateErrorEmbed).toHaveBeenCalledWith('You can only roll between 1 and 10 whole dice.');
            expect(mockReply).toHaveBeenCalledWith({ embeds: [mockErrorEmbed], ephemeral: true });
        });

        /**
         * Keep-highest must be positive to make sense.
         */
        test("handles invalid keepHighest (zero)", async () => {
            mockGetNumber.mockImplementation((name) =>
                name === 'keephighest' ? 0 : null
            );

            await cmd.run(mockInteraction);

            expect(generateErrorEmbed).toHaveBeenCalledWith('The number of dice you keep must be a **positive integer**.');
            expect(mockReply).toHaveBeenCalledWith({ embeds: [mockErrorEmbed], ephemeral: true });
        });

        /**
         * Keeping more dice than rolled should be caught early.
         */
        test("handles keepHighest > numRolls", async () => {
            mockGetNumber.mockImplementation((name) => {
                if (name === 'numdice') return 3;
                if (name === 'keephighest') return 4;
                return null;
            });

            await cmd.run(mockInteraction);

            expect(generateErrorEmbed).toHaveBeenCalledWith('The number of dice you keep must be lower than the number of dice you roll.');
            expect(mockReply).toHaveBeenCalledWith({ embeds: [mockErrorEmbed], ephemeral: true });
        });
    });

    /**
     * Once validation passes we check the embeds rendered for deterministic RNG
     * seeds so copy regressions are caught quickly.
     */
    describe("Successful Rolls", () => {
        /**
         * Default 1d6 roll; demonstrates how we convert Math.random into values.
         */
        test("handles a default roll (1d6)", async () => {
            // (0.5 * (6 - 1 + 1)) + 1 = (0.5 * 6) + 1 = 3 + 1 = 4
            mockRandom.mockReturnValue(0.5);

            await cmd.run(mockInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(generateErrorEmbed).not.toHaveBeenCalled();

            const embed = mockReply.mock.calls[0][0].embeds[0].data;
            expect(embed.title).toBe('Random Integer Generator');
            expect(embed.fields[0].name).toBe('Roll');
            expect(embed.fields[0].value).toBe('Your random number is 4.');
            expect(embed.fields[1].name).toBe('Result');
            expect(embed.fields[1].value).toBe('Your total roll is **4**.');
            expect(embed.footer.text).toBe(`TestUser rolled ${DEFAULT_ROLLS} dice ranging from ${DEFAULT_RANGE[0]} to ${DEFAULT_RANGE[1]}`);
        });

        /**
         * More complex configuration: custom range, multiple dice, and keep-
         * highest logic. The inline math walkthrough makes the expectations clear.
         */
        test("handles a custom roll (3d10 keep 2)", async () => {
            mockGetNumber.mockImplementation((name) => {
                if (name === 'minimum') return 1;
                if (name === 'maximum') return 10;
                if (name === 'numdice') return 3;
                if (name === 'keephighest') return 2;
                return null;
            });

            // (Math.random() * (max - min + 1)) + min
            // (Math.random() * (10 - 1 + 1)) + 1  => (Math.random() * 10) + 1
            // 1. (0.9 * 10) + 1 = 10
            // 2. (0.2 * 10) + 1 = 3
            // 3. (0.7 * 10) + 1 = 8
            mockRandom
                .mockReturnValueOnce(0.9) // 10
                .mockReturnValueOnce(0.2) // 3
                .mockReturnValueOnce(0.7); // 8

            // Results: [10, 3, 8]
            // Sorted: [10, 8, 3]
            // Keep 2: [10, 8]
            // Total: 18

            await cmd.run(mockInteraction);

            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(generateErrorEmbed).not.toHaveBeenCalled();

            const embed = mockReply.mock.calls[0][0].embeds[0].data;
            expect(embed.title).toBe('Random Integer Generator');
            expect(embed.fields[0].name).toBe('Rolls');
            expect(embed.fields[0].value).toBe('Your random numbers are 10, 3, 8.');
            expect(embed.fields[1].name).toBe('Result');
            expect(embed.fields[1].value).toBe('The total of the 2 highest dice is **18**');
            expect(embed.footer.text).toBe('TestUser rolled 3 dice ranging from 1 to 10');
        });
    });

    /**
     * The command ultimately resolves by replying. If that fails we simply pass
     * the rejection through.
     */
    test("propagates errors from interaction.reply", async () => {
        const err = new Error("reply failed");
        mockReply.mockRejectedValue(err);

        // Run a default, valid roll
        mockRandom.mockReturnValue(0.5);

        await expect(cmd.run(mockInteraction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
        expect(generateErrorEmbed).not.toHaveBeenCalled(); // Error is from reply, not validation
    });
});
