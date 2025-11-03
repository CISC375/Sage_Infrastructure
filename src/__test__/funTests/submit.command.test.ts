// adjust the import path to the file that exports the command class
const ContestSubmitCommand = require("../../commands/fun/submit").default;
// We need to mock the config file
const { CHANNELS, ROLES } = require('@root/config'); // ROLES is imported here by the base class
const { EmbedBuilder } = require('discord.js');

// --- Mocks ---
// Mock the config to provide all required values
jest.mock('@root/config', () => ({
    CHANNELS: {
        FEEDBACK: 'mock-feedback-channel-id'
    },
    // FIX: You must also mock the ROLES object that the base Command class uses
    ROLES: {
        VERIFIED: 'mock-verified-role-id'
    }
}));
// --- End Mocks ---

describe("ContestSubmitCommand", () => {
    let cmd;
    let mockInteraction;
    let mockReply;
    let mockSend;
    let mockFetch;
    let mockGetAttachment;
    let mockGetString;

    beforeEach(() => {
        cmd = new ContestSubmitCommand(); // This line was failing

        // Mock the interaction.reply function
        mockReply = jest.fn().mockResolvedValue(true);
        // Mock the channel.send function
        mockSend = jest.fn().mockResolvedValue(true);
        // Mock the client.channels.fetch function
        // It needs to return an object with a 'send' method
        mockFetch = jest.fn().mockResolvedValue({ send: mockSend });
        
        mockGetAttachment = jest.fn();
        mockGetString = jest.fn();

        mockInteraction = {
            reply: mockReply,
            client: {
                channels: {
                    fetch: mockFetch
                }
            },
            options: {
                getAttachment: mockGetAttachment,
                getString: mockGetString
            },
            user: {
                tag: 'TestUser#0001',
                username: 'TestUser'
            }
        };

        // Clear all mock history
        jest.clearAllMocks();
    });

    describe("with description", () => {
        test("fetches channel, sends embed, and replies to user", async () => {
            const mockFile = { url: 'http://example.com/image.png' };
            const mockDesc = 'This is my submission.';
            mockGetAttachment.mockReturnValue(mockFile);
            mockGetString.mockReturnValue(mockDesc);

            // Run the command. This will return (Promise<void>) quickly.
            await cmd.run(mockInteraction);

            // CRITICAL: Wait for the promise queue to clear.
            // This allows the .then() block in the command to execute.
            await new Promise(process.nextTick);

            // 1. Check if channel was fetched
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(CHANNELS.FEEDBACK); // 'mock-feedback-channel-id'

            // 2. Check if embed was sent to the channel
            expect(mockSend).toHaveBeenCalledTimes(1);
            
            // 3. Check the embed content
            const callArg = mockSend.mock.calls[0][0];
            expect(Array.isArray(callArg.embeds)).toBe(true);
            expect(callArg.embeds[0]).toBeInstanceOf(EmbedBuilder);
            
            const embed = callArg.embeds[0].data;
            expect(embed.title).toBe('New contest submission from TestUser#0001');
            expect(embed.description).toBe(mockDesc);
            expect(embed.image.url).toBe(mockFile.url);
            expect(embed.fields[0].value).toBe(mockFile.url);
            expect(embed.color).toBe(3447003); // 'Blue'

            // 4. Check if the user was replied to
            expect(mockReply).toHaveBeenCalledTimes(1);
            expect(mockReply).toHaveBeenCalledWith({ content: 'Thanks for your submission, TestUser!' });
        });
    });

    describe("without description", () => {
        test("sends embed without description field", async () => {
            const mockFile = { url: 'http://example.com/image.png' };
            mockGetAttachment.mockReturnValue(mockFile);
            mockGetString.mockReturnValue(null); // No description provided

            await cmd.run(mockInteraction);
            await new Promise(process.nextTick); // Wait for .then()

            // Check that send was still called
            expect(mockSend).toHaveBeenCalledTimes(1);
            
            // Check the embed content
            const embed = mockSend.mock.calls[0][0].embeds[0].data;
            expect(embed.title).toBe('New contest submission from TestUser#0001');
            // Description field should be undefined
            expect(embed.description).toBeUndefined();
            expect(embed.image.url).toBe(mockFile.url);

            // Check that reply still happened
            expect(mockReply).toHaveBeenCalledTimes(1);
        });
    });

    test("propagates errors from interaction.client.channels.fetch", async () => {
        const err = new Error("Fetch failed");
        mockFetch.mockRejectedValue(err);

        // We need attachment mock to avoid error before the fetch
        mockGetAttachment.mockReturnValue({ url: 'http://example.com/image.png' });

        // The 'run' function will reject because it awaits the fetch
        await expect(cmd.run(mockInteraction)).rejects.toThrow("Fetch failed");
        
        // Neither send nor reply should have been called
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockReply).not.toHaveBeenCalled();
    });
});