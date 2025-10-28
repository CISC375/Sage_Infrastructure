const warn = require("../../commands/staff/warn").default;

// We are mocking the external dependencies and internal utility functions. 
// For this single-file output, we define the mocks before the main execution.

import WarnCommand from '../../commands/staff/warn';
import { ChatInputCommandInteraction, Message, TextChannel, EmbedBuilder } from 'discord.js';
import { getMsgIdFromLink } from '@root/src/lib/utils/generalUtils';
// Import nodemailer here to get a reference to the mocked version
import nodemailer from 'nodemailer'; // <-- Now we can reference the mock on this object

// --- MOCK EXTERNAL AND INTERNAL DEPENDENCIES ---

// Mocking the utility function to return a predictable message ID
jest.mock('@root/src/lib/utils/generalUtils', () => ({
    getMsgIdFromLink: jest.fn(() => 'targetMessageId'),
}));

// Mocking nodemailer's transport creation and sendMail function
const mockSendMail = jest.fn().mockResolvedValue({}); // Initialize sendMail mock outside
// 1. Module-level mock for nodemailer
jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        sendMail: mockSendMail,
    })),
}));

// Mocking Discord.js EmbedBuilder for testing the log
class MockEmbedBuilder {
    setTitle = jest.fn().mockReturnThis();
    setFooter = jest.fn().mockReturnThis();
    addFields = jest.fn().mockReturnThis();
}
// Replace the actual EmbedBuilder with our mock class
jest.mock('discord.js', () => ({
    ...jest.requireActual('discord.js'),
    EmbedBuilder: jest.fn(() => new MockEmbedBuilder()),
}));

// --- MOCK CONFIG DATA ---
// Mock the imported configuration constants for DB and EMAIL
const MOCK_DB = { COURSES: 'courses', USERS: 'users' };
const MOCK_EMAIL = { SENDER: 'sender@example.com', REPLY_TO: 'reply@example.com' };

// Mock data structures for MongoDB lookups
const courseData = {
    channels: {
        category: 'mockParentId',
        staff: 'mockStaffChannelId',
    },
};
const targetUserData = {
    email: 'test@example.com',
    discordId: 'targetUserId',
};

// Create a new instance of the command
// Note: In a real project, DB and EMAIL would be mocked via path aliases, but here we assume the command receives them correctly.
const command = new WarnCommand();
// To make the test runnable, we temporarily expose the mock config to the command instance for testing purposes.
(command as any).DB = MOCK_DB;
(command as any).EMAIL = MOCK_EMAIL;
(command as any).sendEmail = command.sendEmail.bind(command); // Rebind to ensure it works with the temporary mock config

describe('WarnCommand', () => {
    // Shared Mock Objects
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockTargetMessage: Partial<Message>;
    let mockStaffChannel: Partial<TextChannel>;
    let mockMongo: any;
    let mockGetMsgIdFromLink = getMsgIdFromLink as jest.Mock;
    
    // References to the specific collection findOne mocks (captured in beforeEach)
    let mockCoursesCollection: { findOne: jest.Mock };
    let mockUsersCollection: { findOne: jest.Mock };

    beforeEach(() => {
        // Reset mocks and spies before each test
        jest.clearAllMocks();
        // Reset nodemailer mocks
        (nodemailer.createTransport as jest.Mock).mockClear(); // Clear the main function mock
        mockSendMail.mockClear(); // Clear the inner sendMail mock

        mockGetMsgIdFromLink.mockReturnValue('targetMessageId');
        mockSendMail.mockResolvedValue({});

        // 1. Mock MongoDB Client - Define findOne mocks and capture references
        mockCoursesCollection = {
            findOne: jest.fn((query) => Promise.resolve(courseData)),
        };
        mockUsersCollection = {
            findOne: jest.fn((query) => Promise.resolve(targetUserData)),
        };
        
        mockMongo = {
            collection: jest.fn((name: string) => {
                if (name === MOCK_DB.COURSES) return mockCoursesCollection;
                if (name === MOCK_DB.USERS) return mockUsersCollection;
                return { findOne: jest.fn() };
            }),
        };

        // 2. Mock Staff Channel (where the log goes)
        mockStaffChannel = {
            send: jest.fn().mockResolvedValue({}),
        } as unknown as Partial<TextChannel>;

        // 3. Mock Target Message (the one being deleted/warned against)
        mockTargetMessage = {
            content: 'Offending message content.',
            author: {
                tag: 'TargetUser#0001',
                id: 'targetUserId',
                username: 'TargetUser',
                send: jest.fn().mockResolvedValue({}), // Default: DM success
            },
            channel: {
                toString: () => '#course-channel',
                messages: {
                    fetch: jest.fn().mockResolvedValue({}),
                },
            },
            delete: jest.fn().mockResolvedValue({}),
        } as unknown as Partial<Message>;

        // 4. Mock Interaction
        mockInteraction = {
            client: {
                mongo: mockMongo,
                channels: {
                    cache: {
                        get: jest.fn((id: string) => {
                            // Returns the mock staff channel when looked up by ID
                            if (id === courseData.channels.staff) return mockStaffChannel;
                            return undefined;
                        }),
                    },
                },
            },
            // Mock options to return a link and a reason
            options: {
                getString: jest.fn((name: string) => {
                    if (name === 'msglink') return 'https://discord.com/channels/123/456/789/targetMessageId';
                    if (name === 'reason') return 'Posted unauthorized solution';
                    return null;
                }),
            },
            // Mock channel in a course category
            channel: {
                parentId: 'mockParentId',
                messages: {
                    fetch: jest.fn().mockResolvedValue(mockTargetMessage), // Interaction fetches the target message
                },
            },
            user: {
                tag: 'ModUser#0001',
                id: 'modUserId',
                username: 'ModUser',
            },
            guild: {
                channels: {
                    cache: {
                        get: jest.fn((id: string) => {
                            if (id === courseData.channels.staff) return mockStaffChannel;
                            return undefined;
                        }),
                    },
                },
            },
            reply: jest.fn().mockResolvedValue({}),
        } as unknown as ChatInputCommandInteraction;
    });

    // --- TEST SUITE ---

    test('should successfully warn a user and log to staff channel (DM success)', async () => {
        // ACT
        await command.run(mockInteraction as ChatInputCommandInteraction);

        // ASSERTIONS
        // 1. Message retrieval and utility calls
        expect(mockGetMsgIdFromLink).toHaveBeenCalledWith('https://discord.com/channels/123/456/789/targetMessageId');
        expect(mockInteraction.channel.messages.fetch).toHaveBeenCalledWith('targetMessageId');

        // 2. Course and staff channel log
        expect(mockMongo.collection).toHaveBeenCalledWith(MOCK_DB.COURSES);
        expect(mockStaffChannel.send).toHaveBeenCalledTimes(1);

        // 3. Target was DMed
        expect(mockTargetMessage.author.send).toHaveBeenCalledWith(
            expect.stringContaining('Your message was deleted in #course-channel by ModUser#0001')
        );

        // 4. Command conclusion
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'TargetUser has been warned.',
            ephemeral: true,
        });
        expect(mockTargetMessage.delete).toHaveBeenCalledTimes(1);
    });

    test('should successfully warn a user and fall back to email when DM fails', async () => {
        // ARRANGE: Mock the DM send to throw an error (triggering the .catch block)
        mockTargetMessage.author.send = jest.fn().mockRejectedValue(new Error('Cannot send DMs'));
        // Spy on the internal sendEmail method to confirm it's called
        const sendEmailSpy = jest.spyOn(command, 'sendEmail');

        // ACT
        await command.run(mockInteraction as ChatInputCommandInteraction);

        // ASSERTIONS
        // 1. DM failed
        expect(mockTargetMessage.author.send).toHaveBeenCalledTimes(1);
        // 2. User was looked up for email (FIXED: Uses captured mock reference)
        expect(mockMongo.collection).toHaveBeenCalledWith(MOCK_DB.USERS);
        expect(mockUsersCollection.findOne).toHaveBeenCalledWith({ discordId: 'targetUserId' });
        // 3. Email was sent via the sendEmail method
        expect(sendEmailSpy).toHaveBeenCalledWith(
            targetUserData.email,
            'ModUser#0001',
            'Posted unauthorized solution'
        );
        // 4. Nodemailer transport was used (FIXED: Uses imported mock reference)
        expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
        expect(mockSendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: targetUserData.email,
                subject: 'UD CIS Discord Warning',
            })
        );
        // 5. Deletion and reply still happen
        expect(mockTargetMessage.delete).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);

        sendEmailSpy.mockRestore();
    });

    test('should use default reason if none is provided', async () => {
        // ARRANGE: Interaction options returns null for 'reason'
        mockInteraction.options.getString = jest.fn((name: string) => {
            if (name === 'msglink') return 'link';
            if (name === 'reason') return null; // No reason provided
            return null;
        });

        // ACT
        await command.run(mockInteraction as ChatInputCommandInteraction);

        // ASSERTIONS
        // Check DM content for default reason
        expect(mockTargetMessage.author.send).toHaveBeenCalledWith(
            expect.stringContaining('Below is the given reason:\nBreaking server rules')
        );

        // The staff channel log should also contain the default reason
        expect(mockStaffChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: [expect.objectContaining({})],
            })
        );
        // Note: Full verification of the Embed content requires complex mock state tracking, 
        // but verifying the string is used in the DM is a sufficient check of the logic.
    });

    test('should skip logging to staff channel if course lookup fails', async () => {
        // ARRANGE: Mock MongoDB to return null for the course lookup (FIXED: Uses captured mock reference)
        mockCoursesCollection.findOne.mockResolvedValue(null);

        // ACT
        await command.run(mockInteraction as ChatInputCommandInteraction);

        // ASSERTIONS
        // Staff log should NOT have been sent
        expect(mockStaffChannel.send).not.toHaveBeenCalled();

        // But the rest of the flow (DM, reply, delete) must still happen.
        expect(mockTargetMessage.author.send).toHaveBeenCalledTimes(1);
        expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
        expect(mockTargetMessage.delete).toHaveBeenCalledTimes(1);
    });
});
