/**
 * The `/coinflip` command simulates a coin toss with a suspenseful delay. These
 * tests document how we fake timers, control randomness, and assert on the
 * attachment payloads.
 */
import CoinflipCommand from '../../../commands/fun/coinflip';
import { ChatInputCommandInteraction } from 'discord.js';

jest.useFakeTimers();

/**
 * Suite: CoinflipCommand
 * Coverage: initial reply, heads branch, tails branch.
 */
describe('CoinflipCommand', () => {
    let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
    let command: CoinflipCommand;

    /**
     * Every spec uses fresh interaction mocks so reply/edit calls can be counted.
     */
    beforeEach(() => {
        mockInteraction = {
            reply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
        } as any;

        command = new CoinflipCommand();
    });

    /**
     * Clear mock history to avoid crosstalk between specs.
     */
    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Immediately after running, the command should acknowledge the flip.
     */
    it('should reply with "Flipping..." initially', async () => {
        await command.run(mockInteraction);
        expect(mockInteraction.reply).toHaveBeenCalledWith('Flipping...');
    });

    /**
     * Heads branch: Math.random < 0.5 yields the heads asset after the timeout.
     */
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

    /**
     * Tails branch ensures the alternate asset + copy stay accurate.
     */
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
    });
});
