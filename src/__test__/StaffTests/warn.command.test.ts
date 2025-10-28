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

    // Should not reply or delete if it throws
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