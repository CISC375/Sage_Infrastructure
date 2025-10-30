import { ChatInputCommandInteraction, ButtonStyle, TextChannel, Message } from 'discord.js';
import ButtonCommand from '../../commands/admin/addbutton'; // あなたのプロジェクト構成に合わせてパスを調整してください
import * as mockConfig from '@root/config';

// ------------------------------------------------------------------
// Mock Setup
// ------------------------------------------------------------------

// Jest mock functions (spies)
const mockGetString = jest.fn();
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockEdit = jest.fn().mockResolvedValue(undefined); // mock for message.edit

// Mocks to control success/failure of message fetching
const mockFetchMessage = jest.fn();
const mockFetchChannel = jest.fn();

// Mock Message object mirroring discord.js structure
const mockMessage = (editable: boolean, content: string = 'Original message content') => ({
    editable: editable,
    content: content,
    edit: mockEdit,
    // Other properties unused by the command are omitted
} as unknown as Message);

// Mock interaction.client.channels.fetch and channel.messages.fetch
const mockClient = {
    channels: {
        fetch: mockFetchChannel,
    },
    // Other unnecessary client properties are omitted
};

// Mock BOT config
jest.mock('@root/config', () => ({
    BOT: { NAME: 'TestBot' },
    BOTMASTER_PERMS: [], // Permissions not exercised in these tests
	ROLES: {
        STAFF: 'dummy-staff-role-id' // Any ID is fine as long as tests run
        // Add other referenced roles here if needed
    }
})
);

// ------------------------------------------------------------------
// Start Testing
// ------------------------------------------------------------------

describe('Button Command', () => {
    let command: ButtonCommand;
    let mockInteraction: ChatInputCommandInteraction;

    // Run before each test
    beforeEach(() => {
        command = new ButtonCommand();

        // Reset mocks
        mockGetString.mockClear();
        mockReply.mockClear();
        mockEdit.mockClear();
        mockFetchMessage.mockClear();
        mockFetchChannel.mockClear();

        // Build a minimal ChatInputCommandInteraction mock
        mockInteraction = {
            client: mockClient,
            options: {
                getString: mockGetString,
            },
            reply: mockReply,
            // Unused properties are omitted via casting
        } as unknown as ChatInputCommandInteraction;

        // Default successful wiring: channel fetch returns an object with messages.fetch
        mockFetchChannel.mockImplementation((channelID: string) => {
            return Promise.resolve({
                messages: {
                    fetch: mockFetchMessage
                }
            } as unknown as TextChannel);
        });
    });

    // ------------------------------------------------------------------
    // Success Cases
    // ------------------------------------------------------------------

    it('should successfully edit a message with a Primary button', async () => {
        const msgLink = 'https://discord.com/channels/12345/67890/112233';
        const label = 'Click Me!';
        const customID = 'unique_id_1';
        const style = 'primary';
        
        // Mock user input
        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return label;
                if (name === 'custom_id') return customID;
                if (name === 'style') return style;
                return null;
            });

        // Return an editable message
        const messageToEdit = mockMessage(true);
        mockFetchMessage.mockResolvedValue(messageToEdit);

        await command.run(mockInteraction);

        // 1. Verify message was fetched using parsed IDs
        expect(mockClient.channels.fetch).toHaveBeenCalledWith('67890');
        expect(mockFetchMessage).toHaveBeenCalledWith('112233');

        // 2. Verify message.edit was called with expected content and components
        expect(mockEdit).toHaveBeenCalledTimes(1);
        const editCall = mockEdit.mock.calls[0][0];
        
        // Validate edited content
        expect(editCall.content).toBe(messageToEdit.content);
        expect(editCall.components).toHaveLength(1);

        // Validate button (contents of ActionRow)
        const componentData = editCall.components[0].toJSON().components[0];
        expect(componentData.label).toBe(label);
        expect(componentData.custom_id).toBe(customID);
        // Converted to PRIMARY and set on ButtonComponent
        expect(componentData.style).toBe(ButtonStyle.Primary); 

        // 3. Verify success reply
        expect(mockReply).toHaveBeenCalledWith({
            content: 'Your message has been given a button', 
            ephemeral: true 
        });
    });

    it('should handle "canary." in the message link correctly', async () => {
        const msgLink = 'https://canary.discord.com/channels/12345/67890/112233';
        const label = 'Test';
        const customID = 'test_id';
        const style = 'success';
        
        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return label;
                if (name === 'custom_id') return customID;
                if (name === 'style') return style;
                return null;
            });
        
        mockFetchMessage.mockResolvedValue(mockMessage(true)); // Editable

        await command.run(mockInteraction);

        // Verify canary removal and correct ID extraction
        expect(mockClient.channels.fetch).toHaveBeenCalledWith('67890');
        expect(mockFetchMessage).toHaveBeenCalledWith('112233');
        expect(mockEdit).toHaveBeenCalled();
    });

    // ------------------------------------------------------------------
    // Error Cases
    // ------------------------------------------------------------------

    it('should reply with an error if the message cannot be found', async () => {
        const msgLink = 'https://discord.com/channels/12345/67890/112233';

        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return 'l';
                if (name === 'custom_id') return 'c';
                if (name === 'style') return 'secondary';
                return null;
            });

        // Simulate fetch failure
        mockFetchMessage.mockRejectedValue(new Error('Discord API Error'));

        // Verify the command throws the specified error string
        await expect(command.run(mockInteraction)).rejects.toBe("I can't seem to find that message");

        // Ensure success reply was not sent
        expect(mockReply).not.toHaveBeenCalledWith({ content: 'Your message has been given a button', ephemeral: true });
        
        // Ensure message.edit was not called
        expect(mockEdit).not.toHaveBeenCalled();
    });

    it('should reply with an error if the message is not editable', async () => {
        const msgLink = 'https://discord.com/channels/12345/67890/112233';
        
        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return 'l';
                if (name === 'custom_id') return 'c';
                if (name === 'style') return 'danger';
                return null;
            });

        // Return a non-editable message
        mockFetchMessage.mockResolvedValue(mockMessage(false)); 

        await command.run(mockInteraction);

        // 1. Verify it replies with not-editable error
        expect(mockReply).toHaveBeenCalledWith({
            content: `It seems I can't edit that message. You'll need to tag a message that was sent by me, ${mockConfig.BOT.NAME}`,
            ephemeral: true
        });

        // 2. Ensure message.edit was not called (early return)
        expect(mockEdit).not.toHaveBeenCalled();
    });
});