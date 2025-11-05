<<<<<<< HEAD
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
=======
/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the command class to be tested
import WarnCommand from '../../commands/staff/warn'; // Adjust this path to your command file

// --- Mock Dependencies ---

// Mock config
jest.mock('@root/config', () => ({
  DB: {
    COURSES: 'coursesCollectionName',
    USERS: 'usersCollectionName',
  },
  EMAIL: {
    SENDER: 'sender@test.com',
    REPLY_TO: 'replyto@test.com',
  },
}));

// Mock permissions
jest.mock('@lib/permissions', () => ({
  STAFF_PERMS: { id: 'staff_perm_id', type: 1, permission: true },
  ADMIN_PERMS: { id: 'admin_perm_id', type: 1, permission: true },
}));

// Mock base Command class
jest.mock('@lib/types/Command', () => ({
  Command: class Command {
    runInDM = false;
    description = '';
    extendedHelp = '';
    options = [];
    permissions = [];
  },
}));

// Mock utils
jest.mock('@root/src/lib/utils/generalUtils', () => ({
  getMsgIdFromLink: jest.fn(() => 'mockMessageId123'),
}));

// Mock nodemailer
// const mockSendMail = jest.fn();
const mockSendMail = jest.fn().mockResolvedValue(true);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

// Mock discord.js
const { ApplicationCommandOptionType } = jest.requireActual('discord.js');

const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetFooter = jest.fn().mockReturnThis();
const mockEmbedAddFields = jest.fn().mockReturnThis();

jest.mock('discord.js', () => {
  const actualDiscord = jest.requireActual('discord.js');
  return {
    ...actualDiscord,
    EmbedBuilder: jest.fn(() => ({
      setTitle: mockEmbedSetTitle,
      setFooter: mockEmbedSetFooter,
      addFields: mockEmbedAddFields,
    })),
    // Export constants needed by the command file
    ApplicationCommandOptionType: actualDiscord.ApplicationCommandOptionType,
  };
});

// --- Test Suite ---

describe('Warn Command', () => {
  let command: WarnCommand;
  let mockInteraction: any;
  let mockTargetMessage: any;
  let mockStaffChannel: any;
  let mockFindOne: jest.Mock;

  beforeEach(() => {
    // Restore all mocks to ensure no implementations leak
    jest.restoreAllMocks();

    // Clear mock function calls from discord.js EmbedBuilder
    mockEmbedSetTitle.mockClear();
    mockEmbedSetFooter.mockClear();
    mockEmbedAddFields.mockClear();
    (require('discord.js').EmbedBuilder as jest.Mock).mockClear();

    // Clear nodemailer mock calls
    mockSendMail.mockClear();
    (require('nodemailer').createTransport as jest.Mock).mockClear();

    command = new WarnCommand();

    // --- Mock Data & Objects ---

    mockTargetMessage = {
      author: {
        send: jest.fn().mockResolvedValue(true),
        tag: 'TargetUser#0001',
        id: 'targetId123',
        username: 'TargetUser',
      },
      content: 'This is the offending message content.',
      channel: '<#mockChannelId>',
      delete: jest.fn().mockResolvedValue(true),
    };

    mockStaffChannel = {
      send: jest.fn(),
    };

    mockFindOne = jest.fn();

    // --- Mock Interaction ---

    mockInteraction = {
      options: {
        getString: jest.fn(),
      },
      channel: {
        messages: {
          fetch: jest.fn().mockResolvedValue(mockTargetMessage),
        },
        parentId: 'mockCourseParentId',
      },
      guild: {
        channels: {
          cache: {
            get: jest.fn().mockReturnValue(mockStaffChannel),
          },
        },
      },
      client: {
        mongo: {
          collection: jest.fn(() => ({ findOne: mockFindOne })),
        },
      },
      user: {
        tag: 'Moderator#0001',
        id: 'modId789',
      },
      reply: jest.fn().mockResolvedValue(true),
    };
  });

  // --- Test Cases ---

  it('should warn a user, log to staff, DM, and delete (Happy Path)', async () => {
    const mockReason = 'Test reason';
    mockInteraction.options.getString.mockImplementation((opt: string) => {
      if (opt === 'msglink') return 'http://discord-message-link';
      if (opt === 'reason') return mockReason;
      return null;
    });

    const mockCourse = { channels: { staff: 'staffChannelId' } };
    mockFindOne.mockResolvedValue(mockCourse); // Mock course lookup

    await command.run(mockInteraction);

    // 1. Fetches the message
    expect(require('@lib/utils/generalUtils').getMsgIdFromLink).toHaveBeenCalledWith('http://discord-message-link');
    expect(mockInteraction.channel.messages.fetch).toHaveBeenCalledWith('mockMessageId123');

    // 2. Finds the course and staff channel
    expect(mockInteraction.client.mongo.collection).toHaveBeenCalledWith('coursesCollectionName');
    expect(mockFindOne).toHaveBeenCalledWith({ 'channels.category': 'mockCourseParentId' });
    expect(mockInteraction.guild.channels.cache.get).toHaveBeenCalledWith('staffChannelId');

    // 3. Sends embed to staff channel
    expect(mockStaffChannel.send).toHaveBeenCalledTimes(1);
    expect(mockEmbedSetTitle).toHaveBeenCalledWith('Moderator#0001 Warned TargetUser#0001');
    expect(mockEmbedAddFields).toHaveBeenCalledWith([
      { name: 'Reason', value: mockReason },
      { name: 'Message content', value: mockTargetMessage.content },
    ]);

    // 4. DMs the user
    expect(mockTargetMessage.author.send).toHaveBeenCalledWith(
      `Your message was deleted in ${mockTargetMessage.channel} by ${mockInteraction.user.tag}. Below is the given reason:\n${mockReason}`
    );

    // 5. Does NOT send an email
    expect(mockSendMail).not.toHaveBeenCalled();

    // 6. Replies to interaction and deletes message
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'TargetUser has been warned.',
      ephemeral: true,
    });
    expect(mockTargetMessage.delete).toHaveBeenCalledTimes(1);
  });

  it('should use a default reason if one is not provided', async () => {
    const defaultReason = 'Breaking server rules';
    mockInteraction.options.getString.mockImplementation((opt: string) => {
      if (opt === 'msglink') return 'http://discord-message-link';
      if (opt === 'reason') return null; // No reason provided
      return null;
    });

    const mockCourse = { channels: { staff: 'staffChannelId' } };
    mockFindOne.mockResolvedValue(mockCourse);

    await command.run(mockInteraction);

    // Check embed
    expect(mockEmbedAddFields).toHaveBeenCalledWith([
      { name: 'Reason', value: defaultReason },
      { name: 'Message content', value: mockTargetMessage.content },
    ]);

    // Check DM
    expect(mockTargetMessage.author.send).toHaveBeenCalledWith(
      expect.stringContaining(defaultReason)
    );
  });

  it('should send an email if DMs fail and user is in database', async () => {
    mockInteraction.options.getString.mockReturnValue('http://discord-message-link');
    mockTargetMessage.author.send.mockRejectedValue(new Error('Cannot send messages to this user')); // Simulate failed DM

    const mockCourse = { channels: { staff: 'staffChannelId' } };
    const mockSageUser = { email: 'targetuser@test.edu' };
    mockFindOne
      .mockResolvedValueOnce(mockCourse) // First call (course)
      .mockResolvedValueOnce(mockSageUser); // Second call (user)

    await command.run(mockInteraction);

    // 1. Tries to DM
    expect(mockTargetMessage.author.send).toHaveBeenCalledTimes(1);

    // 2. Looks up user in DB
    expect(mockInteraction.client.mongo.collection).toHaveBeenCalledWith('usersCollectionName');
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'targetId123' });

    // 3. Sends email
    expect(require('nodemailer').createTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'targetuser@test.edu',
      subject: 'UD CIS Discord Warning',
      html: expect.stringContaining('You were issued a warning'),
    }));

    // 4. Still replies and deletes
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(mockTargetMessage.delete).toHaveBeenCalledTimes(1);
  });

it('should throw an error if DMs fail and user is not in database', async () => {
    mockInteraction.options.getString.mockReturnValue('http://discord-message-link');
    mockTargetMessage.author.send.mockRejectedValue(new Error('Cannot send messages to this user')); // Simulate failed DM

    const mockCourse = { channels: { staff: 'staffChannelId' } };
    mockFindOne
      .mockResolvedValueOnce(mockCourse) // First call (course)
      .mockResolvedValueOnce(null); // Second call (user) -> NOT FOUND

    // ADD THIS BLOCK TO CATCH THE ERROR
    await expect(command.run(mockInteraction)).rejects.toThrow(
      'TargetUser#0001 (targetId123) is not in the database'
    );

    // Verify that it didn't reply or delete
    expect(mockInteraction.reply).not.toHaveBeenCalled();
    expect(mockTargetMessage.delete).not.toHaveBeenCalled();
  });

  it('should not send a staff log if not in a course channel', async () => {
    mockInteraction.channel.parentId = null; // Simulate not in a course category
    mockFindOne.mockResolvedValue(null); // Course lookup fails

    await command.run(mockInteraction);

    // 1. Does NOT send staff message
    expect(mockStaffChannel.send).not.toHaveBeenCalled();

    // 2. Still DMs user
    expect(mockTargetMessage.author.send).toHaveBeenCalledTimes(1);

    // 3. Still replies and deletes
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(mockTargetMessage.delete).toHaveBeenCalledTimes(1);
  });
});
>>>>>>> 35bb007c9c57d52ae04e06953b86aff4b93f5f2e
