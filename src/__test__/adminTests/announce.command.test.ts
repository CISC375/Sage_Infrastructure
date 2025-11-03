import { ChatInputCommandInteraction, TextChannel, Attachment, ModalBuilder } from 'discord.js';
import AnnounceCommand from '../../commands/admin/announce';
import { Command } from '@lib/types/Command';

// --- MOCK SETUP ---

// Mock the configuration for the announcements channel ID
jest.mock('@root/config', () => ({
    CHANNELS: {
        ANNOUNCEMENTS: '1000' // Mock ID for the default channel
    },
}));

const MOCK_ANNOUNCEMENTS_CHANNEL_ID = '1000';
const MOCK_SPECIFIED_CHANNEL_ID = '9876543210';
const MOCK_ATTACHMENT_URL = 'https://sagediscord.com/test-file.png';

// src/__test__/commands/admin/announce.test.ts:9-18
jest.mock('@root/config', () => ({
    CHANNELS: {
        ANNOUNCEMENTS: '1000' // Mock ID for the default channel
    },
    // FIX: Added ROLES mock to prevent TypeError: Cannot read properties of undefined (reading 'STAFF')
    ROLES: {
        STAFF: '2000',
        BOT_MASTER: '3000',
    }
}));

// Type helper for mock objects
const mockChannel = (id: string): TextChannel => ({ id, name: `channel-${id}` } as unknown as TextChannel);
const mockAttachment = (url: string): Attachment => ({ url, name: 'file.png' } as unknown as Attachment);

let mockInteraction: ChatInputCommandInteraction;
let command: Command;

beforeEach(() => {
    // Initialize a new mock interaction object before each test
    mockInteraction = {
        options: {
            getChannel: jest.fn(),
            getAttachment: jest.fn(),
        },
        guild: {
            channels: {
                cache: {
                    get: jest.fn(),
                },
            },
        },
        showModal: jest.fn(),
    } as unknown as ChatInputCommandInteraction; // Cast to bypass full Discord.js implementation

    // Instantiate the command
    command = new AnnounceCommand();
});

// --- TESTS ---

describe('Announce Command', () => {

    test('should show modal with user-specified channel and file URL', async () => {
        // Setup Mocks for user-specified inputs
        const userChannel = mockChannel(MOCK_SPECIFIED_CHANNEL_ID);
        const userFile = mockAttachment(MOCK_ATTACHMENT_URL);

        // Interaction returns specified channel and file
        (mockInteraction.options.getChannel as jest.Mock).mockReturnValue(userChannel);
        (mockInteraction.options.getAttachment as jest.Mock).mockReturnValue(userFile);
        // Guild cache returns default channel (though the option will override it)
        (mockInteraction.guild.channels.cache.get as jest.Mock).mockReturnValue(mockChannel(MOCK_ANNOUNCEMENTS_CHANNEL_ID));

        // Execute the command
        await command.run(mockInteraction);

        // 1. Assert showModal was called once
        expect(mockInteraction.showModal as jest.Mock).toHaveBeenCalledTimes(1);

        // 2. Extract the ModalBuilder object passed to showModal
        const modal = (mockInteraction.showModal as jest.Mock).mock.calls[0][0] as ModalBuilder;
        const modalJson = (modal as any).toJSON();

        // 3. Assert Modal metadata
        expect(modalJson.custom_id).toBe('announce');
        expect(modalJson.title).toBe('Announce');

        // 4. Assert Component values (components[row_index].components[component_index])
        const components = modalJson.components;

        // Channel ID component check (Row 2, Component 1)
        const channelComponent = components[1].components[0];
        expect(channelComponent.custom_id).toBe('channel');
        // Crucial Check: Should use the user-specified channel ID
        expect(channelComponent.value).toBe(MOCK_SPECIFIED_CHANNEL_ID); 

        // File URL component check (Row 3, Component 1)
        const fileComponent = components[2].components[0];
        expect(fileComponent.custom_id).toBe('file');
        // Crucial Check: Should use the user-specified file URL
        expect(fileComponent.value).toBe(MOCK_ATTACHMENT_URL); 
    });

    test('should show modal with default announcements channel and empty file URL', async () => {
        // Setup Mocks for default behavior
        const defaultChannel = mockChannel(MOCK_ANNOUNCEMENTS_CHANNEL_ID);

        // Interaction returns no channel or file
        (mockInteraction.options.getChannel as jest.Mock).mockReturnValue(null);
        (mockInteraction.options.getAttachment as jest.Mock).mockReturnValue(null);
        // Guild cache returns the default channel ID defined in the mock config
        (mockInteraction.guild.channels.cache.get as jest.Mock).mockReturnValue(defaultChannel);

        // Execute the command
        await command.run(mockInteraction);

        // 1. Assert showModal was called once
        expect(mockInteraction.showModal as jest.Mock).toHaveBeenCalledTimes(1);

        // 2. Extract the ModalBuilder object passed to showModal
        const modal = (mockInteraction.showModal as jest.Mock).mock.calls[0][0] as ModalBuilder;
        const components = (modal as any).toJSON().components;

        // Channel ID component check (Row 2, Component 1)
        const channelComponent = components[1].components[0];
        expect(channelComponent.custom_id).toBe('channel');
        // Crucial Check: Should use the default announcements channel ID
        expect(channelComponent.value).toBe(MOCK_ANNOUNCEMENTS_CHANNEL_ID); 

        // File URL component check (Row 3, Component 1)
        const fileComponent = components[2].components[0];
        expect(fileComponent.custom_id).toBe('file');
        // Crucial Check: Should be an empty string since no file was attached
        expect(fileComponent.value).toBe(''); 
    });
});
