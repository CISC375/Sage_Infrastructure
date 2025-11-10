import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction } from 'discord.js';
import CountCategoryChannelsCommand from '../../../commands/admin/count';

// --- MOCK SETUP ---

// Mock a dummy definition for the dependent ADMIN_PERMS
jest.mock('@lib/permissions', () => ({
    ADMIN_PERMS: { id: 'admin_role_id', permission: true, type: 1 },
}));

const MOCK_CATEGORY_ID = '123456789';
const MOCK_CHANNEL_COUNT = 7;

/**
 * Mock helper for CategoryChannel used in the success path
 */
const mockCategoryChannel = (count: number): any => ({
    id: MOCK_CATEGORY_ID,
    name: 'archive-category',
    // Simulate Discord mention format (toString)
    toString: () => `<#${MOCK_CATEGORY_ID}>`,
    // Mock child channels cache size
    children: {
        cache: {
            size: count,
        }
    }
});

/**
 * Mock helper for TextChannel used in the failure path
 * Since children.cache is missing, this triggers an error in the try/catch block
 */
const mockInvalidChannel: any = {
    id: '987654321',
    name: 'general-chat',
    toString: () => `<#987654321>`,
    // Intentionally omit the 'children' property required for CategoryChannel
};


let mockInteraction: ChatInputCommandInteraction;
let command: Command;

beforeEach(() => {
    // Mock the interaction object and its methods
    mockInteraction = {
        options: {
            getChannel: jest.fn(),
        },
        reply: jest.fn(), // Mock reply method
    } as unknown as ChatInputCommandInteraction; 

    // Initialize the command instance
    command = new CountCategoryChannelsCommand();
});

// --- TESTS ---

describe('CountCategoryChannels Command', () => {

    test('should reply with the correct channel count for a valid category', async () => {
        // Setup: return a valid CategoryChannel mock
        const categoryChannelMock = mockCategoryChannel(MOCK_CHANNEL_COUNT);
        (mockInteraction.options.getChannel as jest.Mock).mockReturnValue(categoryChannelMock);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: interaction.reply is called exactly once
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledTimes(1);

        // Assertion 2: replies with the correct channel count in the content
        const expectedContent = `**${categoryChannelMock}** has **${MOCK_CHANNEL_COUNT}** channel(s)!`;
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledWith({
            content: expectedContent,
            ephemeral: true
        });
    });

    test('should reply with an error message if the channel is not a valid category', async () => {
        // Setup: return an invalid channel mock that lacks the children property
        (mockInteraction.options.getChannel as jest.Mock).mockReturnValue(mockInvalidChannel);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: interaction.reply is called exactly once
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledTimes(1);

        // Assertion 2: replies with an error message (try/catch block triggered)
        const expectedContent = `That's not a valid channel category.`;
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledWith({
            content: expectedContent,
            ephemeral: true
        });
    });
});
