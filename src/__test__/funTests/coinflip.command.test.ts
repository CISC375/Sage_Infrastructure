<<<<<<< HEAD
// adjust the import path to the file that exports the command class
const CoinFlipCommand = require("../../commands/fun/coinflip").default;

// We must define the array here because it is NOT exported from the command file
const COIN_FLIP = ['You got: Heads!', 'You got: Tails!'];

describe("CoinFlipCommand", () => {
    let cmd;
    let mockRandom;

    beforeEach(() => {
        cmd = new CoinFlipCommand();
        // Spy on Math.random to control outcomes
        mockRandom = jest.spyOn(Math, 'random');
        // Tell Jest to mock time-based functions
        jest.useFakeTimers();
    });

    afterEach(() => {
        // Restore mocks and real timers
        mockRandom.mockRestore();
        jest.useRealTimers();
    });

    describe("when Math.random results in Heads", () => {
        test("calls reply, then editReply once with Heads and the file", async () => {
            // Mock random to return 0. Math.floor(0 * 2) = 0. COIN_FLIP[0] = Heads
            mockRandom.mockReturnValue(0);

            const mockReply = jest.fn().mockResolvedValue(true);
            const mockEditReply = jest.fn().mockResolvedValue(true);
            const interaction = {
                reply: mockReply,
                editReply: mockEditReply
            };

            await cmd.run(interaction);

            // 1. Check the initial 'Flipping...' reply
            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockReply).toHaveBeenCalledWith('Flipping...');
            expect(mockEditReply).not.toHaveBeenCalled();

            // 2. Run all timers (executes setTimeout)
            jest.runAllTimers();

            // 3. FIX: Run all pending microtasks (flushes the promise queue)
            jest.runAllTicks();

            // 4. Check that editReply was called only ONCE
            expect(mockEditReply).toHaveBeenCalledTimes(1);

            // 5. Check the single call's argument
            const callArg = mockEditReply.mock.calls[0][0];
            expect(callArg).toBeDefined();

            // It should have the text content
            expect(callArg.content).toBe(COIN_FLIP[0]); // "You got: Heads!"

            // It should have the file
            expect(Array.isArray(callArg.files)).toBe(true);
            expect(callArg.files).toHaveLength(1);
            expect(callArg.files[0].name).toBe("steve_heads.png");
            expect(callArg.files[0].attachment).toContain("assets/images/steve_heads.png");
        });
    });

    describe("when Math.random results in Tails", () => {
        test("calls reply, then editReply once with Tails and the file", async () => {
            // Mock random to return 0.5. Math.floor(0.5 * 2) = 1. COIN_FLIP[1] = Tails
            mockRandom.mockReturnValue(0.5);

            const mockReply = jest.fn().mockResolvedValue(true);
            const mockEditReply = jest.fn().mockResolvedValue(true);
            const interaction = {
                reply: mockReply,
                editReply: mockEditReply
            };

            await cmd.run(interaction);

            // 1. Check initial reply
            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockReply).toHaveBeenCalledWith('Flipping...');

            // 2. Run all timers (executes setTimeout)
            jest.runAllTimers();

            // 3. FIX: Run all pending microtasks (flushes the promise queue)
            jest.runAllTicks();

            // 4. Check that editReply was called only ONCE
            expect(mockEditReply).toHaveBeenCalledTimes(1);

            // 5. Check the single call's argument
            const callArg = mockEditReply.mock.calls[0][0];
            expect(callArg).toBeDefined();

            // It should have the text content
            expect(callArg.content).toBe(COIN_FLIP[1]); // "You got: Tails!"

            // It should have the file
            expect(Array.isArray(callArg.files)).toBe(true);
            expect(callArg.files).toHaveLength(1);
            expect(callArg.files[0].name).toBe("steve_tails.png");
            expect(callArg.files[0].attachment).toContain("assets/images/steve_tails.png");
        });
    });

    test("propagates errors from the initial interaction.reply", async () => {
        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const mockEditReply = jest.fn();
        const interaction = {
            reply: mockReply,
            editReply: mockEditReply
        };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");

        // The initial reply failed, so editReply should never be called
        expect(mockReply).toHaveBeenCalledTimes(1);
        expect(mockEditReply).not.toHaveBeenCalled();
=======
import CoinflipCommand from '../../commands/fun/coinflip';
import { ChatInputCommandInteraction } from 'discord.js';

jest.useFakeTimers();

describe('CoinflipCommand', () => {
    let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
    let command: CoinflipCommand;

    beforeEach(() => {
        mockInteraction = {
            reply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
        } as any;

        command = new CoinflipCommand();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should reply with "Flipping..." initially', async () => {
        await command.run(mockInteraction);
        expect(mockInteraction.reply).toHaveBeenCalledWith('Flipping...');
    });

    it('should send heads result with correct attachment', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.1); // force heads
        await command.run(mockInteraction);

        jest.runAllTimers(); // trigger setTimeout

        const expectedAttachment = {
            attachment: expect.stringContaining('assets/images/steve_heads.png'),
            name: 'steve_heads.png'
        };

        expect(mockInteraction.editReply).toHaveBeenCalledWith({
            content: 'You got: Heads!',
            files: [expectedAttachment],
        });
    });

    it('should send tails result with correct attachment', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.9); // force tails
        await command.run(mockInteraction);

        jest.runAllTimers(); // trigger setTimeout

        const expectedAttachment = {
            attachment: expect.stringContaining('assets/images/steve_tails.png'),
            name: 'steve_tails.png'
        };

        expect(mockInteraction.editReply).toHaveBeenCalledWith({
            content: 'You got: Tails!',
            files: [expectedAttachment],
        });
>>>>>>> 35bb007c9c57d52ae04e06953b86aff4b93f5f2e
    });
});