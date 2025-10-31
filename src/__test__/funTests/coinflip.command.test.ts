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
    });
});