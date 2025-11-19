/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the command class to be tested
import SudoreplyCommand from '../../../commands/staff/sudoreply';

// --- Mock Dependencies ---

// Mock config and permissions
jest.mock('@root/config', () => ({
  BOT: { NAME: 'TestBot' },
  DB: { PVQ: 'pvqCollectionName', COURSES: 'coursesCollectionName' },
  MAINTAINERS: '@maintainers',
}));

jest.mock('@lib/permissions', () => ({
  STAFF_PERMS: { id: 'staff_perm_id', type: 1, permission: true },
  ADMIN_PERMS: { id: 'admin_perm_id', type: 1, permission: true },
}));

// Mock the base Command class
jest.mock('@lib/types/Command', () => ({
  Command: class Command {
    description = '';
    extendedHelp = '';
    runInDM = false;
    options = [];
    permissions = [];
  },
}));

// Mock discord.js library
const { ChannelType, ApplicationCommandOptionType } = jest.requireActual('discord.js');

// We'll create mock functions for EmbedBuilder methods
const mockEmbedSetDescription = jest.fn().mockReturnThis();
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetFooter = jest.fn().mockReturnThis();
const mockEmbedSetAuthor = jest.fn().mockReturnThis();

jest.mock('discord.js', () => {
  const actualDiscord = jest.requireActual('discord.js');
  return {
    ...actualDiscord,
    EmbedBuilder: jest.fn(() => ({
      setDescription: mockEmbedSetDescription,
      setTitle: mockEmbedSetTitle,
      setFooter: mockEmbedSetFooter,
      setAuthor: mockEmbedSetAuthor,
    })),
    // Export constants needed by the command file
    ChannelType: actualDiscord.ChannelType,
    ApplicationCommandOptionType: actualDiscord.ApplicationCommandOptionType,
  };
});

// --- Test Suite ---

describe('Sudoreply Command', () => {
  let command: SudoreplyCommand;
  let mockInteraction: any;
  let mockFindOne: jest.Mock;
  let mockCollection: jest.Mock;
  let mockClient: any;
  let mockThread: any;
  let mockGeneralChannel: any;

  // Re-initialize mocks before each test
  beforeEach(() => {
    // Restore all mocks to ensure no implementations leak
    jest.restoreAllMocks();

    // Re-instantiate the command
    command = new SudoreplyCommand();

    // --- Mock Mongo/Client ---
    mockFindOne = jest.fn();
    mockCollection = jest.fn(() => ({ findOne: mockFindOne }));

    mockThread = {
      id: 'newThreadId_123',
      guild: { members: { fetch: jest.fn() } },
      members: { add: jest.fn() },
      send: jest.fn().mockResolvedValue(true),
    };

    mockGeneralChannel = {
      type: ChannelType.GuildText,
      threads: {
        create: jest.fn().mockResolvedValue(mockThread),
      },
    };

    mockClient = {
      mongo: { collection: mockCollection },
      // Set fetch as a blank mock; it will be implemented in each test
      channels: { fetch: jest.fn() },
    };

    // --- Mock Interaction ---
    mockInteraction = {
      options: {
        getString: jest.fn(),
      },
      reply: jest.fn().mockResolvedValue(true),
      client: mockClient,
      channel: {
        type: ChannelType.GuildText,
        parentId: 'courseCategoryId_ABC',
      },
      guild: {
        members: {
          fetch: jest.fn().mockResolvedValue({ user: { tag: 'Asker#0001' } }),
        },
      },
      user: {
        id: 'replierId_789',
        tag: 'Replier#0001',
        avatarURL: jest.fn(() => 'http://replier.avatar.url'),
      },
    };

    // --- Mock EmbedBuilder (clear calls) ---
    // These mocks are imported directly, so we need to clear them manually.
    mockEmbedSetDescription.mockClear();
    mockEmbedSetTitle.mockClear();
    mockEmbedSetFooter.mockClear();
    mockEmbedSetAuthor.mockClear();
    (require('discord.js').EmbedBuilder as jest.Mock).mockClear();
  });

  // --- Test Cases ---

  it('should reply with an error if question ID is not a number', async () => {
    mockInteraction.options.getString.mockImplementation((arg: string) => {
      if (arg === 'questionid') return 'not-a-number';
      return null;
    });

    await command.run(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `**not-a-number** is not a valid question ID`,
      ephemeral: true,
    });
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it('should reply with an error if question is not found', async () => {
    mockInteraction.options.getString.mockReturnValue('123');
    mockFindOne.mockResolvedValueOnce(null); // Simulate question not found

    await command.run(mockInteraction);

    expect(mockCollection).toHaveBeenCalledWith('pvqCollectionName');
    expect(mockFindOne).toHaveBeenCalledWith({ questionId: '123' });
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `I could not find a question with ID **123**.`,
      ephemeral: true,
    });
  });

  it('should reply with an error if run in a non-text channel', async () => {
    mockInteraction.options.getString.mockReturnValue('123');
    mockFindOne.mockResolvedValueOnce({ questionId: '123' }); // Mock found question
    mockInteraction.channel.type = ChannelType.GuildVoice; // Change channel type

    await command.run(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('You must use this command in a regular text channel'),
      ephemeral: true,
    });
  });

  it('should reply with deprecation message for private questions', async () => {
    const mockPrivateQuestion = {
      questionId: '456',
      owner: 'askerId',
      type: 'private',
      messageLink: 'https://discord.com/channels/guild/threadId_456/messageId',
    };
    const mockCourse = { channels: { category: 'courseCategoryId_ABC' } };

    mockInteraction.options.getString.mockReturnValue('456');
    mockFindOne.mockImplementation((query: any) => {
      if (query.questionId) return Promise.resolve(mockPrivateQuestion);
      if (query['channels.category']) return Promise.resolve(mockCourse);
      return Promise.resolve(null);
    });

    await command.run(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `\`/sudoreply\` has been depreciated for private questions. Please reply in thread <#threadId_456>.`,
      ephemeral: true,
    });
    expect(mockGeneralChannel.threads.create).not.toHaveBeenCalled();
  });

  it('should execute the happy path for a public question', async () => {
    const mockPublicQuestion = {
      questionId: '123',
      owner: 'askerId_ABC',
      type: 'public',
      messageLink: 'http://discord.question.link',
    };
    const mockCourse = {
      channels: {
        category: 'courseCategoryId_ABC',
        general: 'generalChannelId_XYZ',
      },
    };

    // Setup mocks for happy path
    mockInteraction.options.getString.mockImplementation((arg: string) => {
      if (arg === 'questionid') return '123';
      if (arg === 'response') return 'This is the test response.';
      return null;
    });

    mockFindOne.mockImplementation((query: any) => {
      if (query.questionId) return Promise.resolve(mockPublicQuestion);
      if (query['channels.category']) return Promise.resolve(mockCourse);
      return Promise.resolve(null);
    });

    // Provide the mock implementation for this specific test
    mockClient.channels.fetch.mockResolvedValue(mockGeneralChannel);

    // Run the command
    await command.run(mockInteraction);

    // 1. Check if course general channel was fetched
    expect(mockClient.channels.fetch).toHaveBeenCalledWith('generalChannelId_XYZ');

    // 2. Check if thread was created
    expect(mockGeneralChannel.threads.create).toHaveBeenCalledWith({
      name: `Replier#0001‘s anonymous question (123)'`,
      autoArchiveDuration: 4320,
      reason: `Replier#0001 asked an anonymous question`,
      type: `GUILD_PRIVATE_THREAD`,
    });

    // 3. Check if members were added to the thread
    expect(mockThread.members.add).toHaveBeenCalledWith('replierId_789'); // Replier
    expect(mockThread.members.add).toHaveBeenCalledWith('askerId_ABC'); // Asker

    // 4. Check interaction reply (pointing to thread)
    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)], // EmbedBuilder mock
    });
    expect(mockEmbedSetDescription).toHaveBeenCalledWith(
      `I've sent your response to this thread: <#newThreadId_123>\n\n Please have any further conversation there.`
    );

    // 5. Check messages sent to the new thread
    expect(mockThread.send).toHaveBeenCalledTimes(2);

    // 5a. First thread message (Question context)
    expect(mockEmbedSetDescription).toHaveBeenNthCalledWith(2, 'http://discord.question.link');
    expect(mockEmbedSetTitle).toHaveBeenNthCalledWith(1, `Asker#0001's Question`);
    expect(mockEmbedSetFooter).toHaveBeenNthCalledWith(1, {
      text: `When you're done with this question, you can send \`/archive\` to close it`,
    });
    expect(mockThread.send.mock.calls[0][0]).toEqual({ embeds: [expect.any(Object)] });

    // 5b. Second thread message (The response)
    expect(mockEmbedSetAuthor).toHaveBeenNthCalledWith(1, {
      name: `Replier#0001`,
      iconURL: 'http://replier.avatar.url',
    });
    expect(mockEmbedSetDescription).toHaveBeenNthCalledWith(3, 'This is the test response.');
    expect(mockEmbedSetFooter).toHaveBeenNthCalledWith(2, {
      text: `Please have any further conversation in this thread!`,
    });
    expect(mockThread.send.mock.calls[1][0]).toEqual({ embeds: [expect.any(Object)] });
  });

  it('should throw an error if general channel is not a text channel', async () => {
    const mockPublicQuestion = { questionId: '123', type: 'public', owner: 'askerId_XYZ' };
    const mockCourse = { channels: { general: 'generalChannelId_XYZ' } };

    mockInteraction.options.getString.mockReturnValue('123');
    mockFindOne.mockImplementation((query: any) => {
      if (query.questionId) return Promise.resolve(mockPublicQuestion);
      if (query['channels.category']) return Promise.resolve(mockCourse);
      return Promise.resolve(null);
    });

    // Provide the mock implementation for this specific test
    mockClient.channels.fetch.mockResolvedValue({ type: ChannelType.GuildVoice } as any);

    // Expect the command to throw an error
	await expect(command.run(mockInteraction)).rejects.toThrow(
		/Something went wrong creating/
	);
  });
});