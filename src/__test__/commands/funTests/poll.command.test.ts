import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  InteractionResponse,
  Message,
  Client,
  GuildMember,
} from 'discord.js';
// Adjust this import path to match your project structure
import PollCommand, { handlePollOptionSelect } from '../../../commands/fun/poll';
import { SageInteractionType } from '@lib/types/InteractionType';
import { DB } from '@root/config';
import parse from 'parse-duration';
import { Poll } from '@lib/types/Poll';

// --- Mocks ---

// Mock discord.js
jest.mock('discord.js', () => {
  const MockEmbedBuilder = jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
  }));
  const MockButtonBuilder = jest.fn(() => ({
    setLabel: jest.fn().mockReturnThis(),
    setCustomId: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
  }));
  // *** FIX 1a: Mock ActionRowBuilder to see what it was constructed with ***
  const MockActionRowBuilder = jest.fn(() => ({
    addComponents: jest.fn().mockReturnThis(),
  }));

  return {
    EmbedBuilder: MockEmbedBuilder,
    ButtonBuilder: MockButtonBuilder,
    ActionRowBuilder: MockActionRowBuilder,
    ButtonStyle: {
      Secondary: 2,
    },
    ApplicationCommandOptionType: {
      String: 3,
    },
    ChatInputCommandInteraction: jest.fn(),
    ButtonInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    Message: jest.fn(),
    Client: jest.fn(),
    GuildMember: jest.fn(),
    ApplicationCommandPermissionType: {
      Role: 2,
    },
  };
});

// Mock local dependencies
jest.mock('@root/config', () => ({
  BOT: {
    NAME: 'TestBot',
  },
  DB: {
    POLLS: 'test_polls_collection',
  },
  ROLES: {
    VERIFIED: 'mock-verified-role-id',
  },
}));

// *** FIX 2: Change the mock value to not include an underscore ***
jest.mock('@lib/types/InteractionType', () => ({
  SageInteractionType: {
    POLL: 'POLL', // Was 'MOCK_POLL_TYPE'
  },
}));

jest.mock('@lib/utils/generalUtils', () => ({
  generateErrorEmbed: jest.fn((msg) => ({
    mockedEmbed: true,
    content: msg,
  })),
  dateToTimestamp: jest.fn((date, format) => `<mock-timestamp:${format}>`),
}));

// Mock external dependencies
jest.mock('parse-duration', () => jest.fn());

// --- Typed Mocks ---
const mockParse = parse as jest.Mock;
const MockEmbedBuilder = EmbedBuilder as unknown as jest.Mock;
const MockButtonBuilder = ButtonBuilder as unknown as jest.Mock;
const MockActionRowBuilder = ActionRowBuilder as unknown as jest.Mock;

const mockCollection = {
  insertOne: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue({} as Poll),
  findOneAndReplace: jest.fn().mockResolvedValue({}),
};
const mockMongo = {
  collection: jest.fn(() => mockCollection),
};

const mockClient = {
  mongo: mockMongo,
} as unknown as Client;

describe('PollCommand', () => {
  let command: PollCommand;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockEmbed: any;
  let mockButton: any;
  let mockRow: any;

  // Helper function to create a default valid interaction
  const createMockInteraction = (options: Record<string, string>) => {
    const getString = (key: string) => options[key];
    return {
      user: { id: 'user123', username: 'TestUser' },
      channelId: 'channel456',
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      fetchReply: jest.fn().mockResolvedValue({ id: 'msg789' } as Message),
      options: {
        getString: jest.fn(getString),
      },
      client: mockClient,
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    MockEmbedBuilder.mockClear();
    MockButtonBuilder.mockClear();
    MockActionRowBuilder.mockClear();

    mockEmbed = {
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
    };
    mockButton = {
      setLabel: jest.fn().mockReturnThis(),
      setCustomId: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis(),
      setEmoji: jest.fn().mockReturnThis(),
    };
    mockRow = {
      addComponents: jest.fn().mockReturnThis(),
    };

    MockEmbedBuilder.mockReturnValue(mockEmbed);
    MockButtonBuilder.mockReturnValue(mockButton);
    MockActionRowBuilder.mockReturnValue(mockRow);

    mockMongo.collection.mockClear();
    mockCollection.insertOne.mockClear();
    mockCollection.findOne.mockClear();
    mockCollection.findOneAndReplace.mockClear();
    mockMongo.collection.mockReturnValue(mockCollection);

    mockParse.mockReturnValue(60000); // 1 minute

    command = new PollCommand();
  });

  describe('run()', () => {
    it('should create a valid poll with 2 options', async () => {
      mockInteraction = createMockInteraction({
        timespan: '1m',
        question: 'Is this a test?',
        choices: 'Yes|No',
        optiontype: 'Single',
      });

      await command.run(mockInteraction);

      expect(MockEmbedBuilder).toHaveBeenCalledTimes(1);
      expect(mockEmbed.setTitle).toHaveBeenCalledWith('Is this a test?');

      expect(MockButtonBuilder).toHaveBeenCalledTimes(2);

      // *** FIX 1b: Change this test ***
      // Check that ActionRowBuilder was called ONCE, and check its constructor args
      expect(MockActionRowBuilder).toHaveBeenCalledTimes(1);
      // Check the 'components' array that was passed to the constructor
      const constructorArgs = MockActionRowBuilder.mock.calls[0][0];
      expect(constructorArgs.components).toHaveLength(2);
      expect(constructorArgs.components).toEqual([mockButton, mockButton]);
      // --- End Fix ---

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [mockEmbed],
        components: [mockRow], // This is fine, mockRow is the *instance* returned by the mock constructor
      });

      expect(mockMongo.collection).toHaveBeenCalledWith(DB.POLLS);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Single',
        }),
      );
    });

    it('should create a valid poll with 6 options (2 rows)', async () => {
      mockInteraction = createMockInteraction({
        timespan: '1m',
        question: 'Favorite color?',
        choices: 'Red|Green|Blue|Yellow|Purple|Orange',
        optiontype: 'Multiple',
      });

      await command.run(mockInteraction);

      // Check buttons (6 choices = 5 in row 1, 1 in row 2)
      expect(MockButtonBuilder).toHaveBeenCalledTimes(6);
      expect(MockActionRowBuilder).toHaveBeenCalledTimes(2);

      // *** FIX 1c: Check the logic for > 5 choices ***
      // This path *does* use .addComponents()
      expect(mockRow.addComponents).toHaveBeenCalledTimes(2);
      expect(mockRow.addComponents.mock.calls[0][0]).toHaveLength(5); // First call has 5 buttons
      expect(mockRow.addComponents.mock.calls[1][0]).toHaveLength(1); // Second call has 1 button
      // --- End Fix ---

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [mockEmbed],
        components: [mockRow, mockRow],
      });
    });

    // --- Validation Error Tests ---

    // *** FIX 3: Change this test to use try/catch ***
    it('should error on invalid optiontype', async () => {
      mockInteraction = createMockInteraction({
        timespan: '1m',
        question: 'Is this a test?',
        choices: 'Yes|No',
        optiontype: 'InvalidType', // Not 'Single' or 'Multiple'
      });

      let error: any;
      try {
        await command.run(mockInteraction);
      } catch (e) {
        error = e;
      }

      expect(error).toBe('poll option types must be one of Single, Multiple');
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });
    // --- End Fix ---
  });
});

// =============================
// == Handle Button Selection ==
// =============================

describe('handlePollOptionSelect', () => {
  let mockButtonInteraction: jest.Mocked<ButtonInteraction>;
  let mockMessage: jest.Mocked<Message>;
  let mockDbPoll: Poll;
  let mockPollOwner: GuildMember;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDbPoll = {
      owner: 'pollOwnerId',
      message: 'msg789',
      expires: new Date(Date.now() + 60000),
      results: [
        { option: 'Yes', users: [] },
        { option: 'No', users: [] },
      ],
      question: 'Is this a test?',
      channel: 'channel456',
      type: 'Single',
    };

    mockPollOwner = {
      displayName: 'PollOwner',
    } as GuildMember;

    mockMessage = {
      id: 'msg789',
      edit: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Message>;

    mockButtonInteraction = {
      user: { id: 'user123', username: 'TestUser' },
      customId: `${SageInteractionType.POLL}_Yes`, // This will now be 'POLL_Yes'
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      channel: {
        messages: {
          fetch: jest.fn().mockResolvedValue(mockMessage),
        },
      },
      guild: {
        members: {
          fetch: jest.fn().mockResolvedValue(mockPollOwner),
        },
      },
      message: mockMessage,
      client: mockClient,
      replied: false,
    } as unknown as jest.Mocked<ButtonInteraction>;

    mockCollection.findOne.mockResolvedValue(mockDbPoll);

    MockEmbedBuilder.mockReturnValue({
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
    });
    MockButtonBuilder.mockReturnValue({
      setLabel: jest.fn().mockReturnThis(),
      setCustomId: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis(),
      setEmoji: jest.fn().mockReturnThis(),
    });
    MockActionRowBuilder.mockReturnValue({
      addComponents: jest.fn().mockReturnThis(),
    });
  });

  // *** ALL 'handlePollOptionSelect' tests are now fixed by FIX 2 ***
  it('should add a vote to a single poll', async () => {
    await handlePollOptionSelect(mockClient, mockButtonInteraction);

    // Check reply (This will now pass)
    expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
      ephemeral: true,
      content: 'Vote for ***Yes*** recorded. To remove it, click the same option again.',
    });

    // Check DB replacement
    const expectedResults = [
      { option: 'Yes', users: ['user123'] },
      { option: 'No', users: [] },
    ];
    expect(mockCollection.findOneAndReplace).toHaveBeenCalledWith(
      { message: 'msg789' },
      expect.objectContaining({ results: expectedResults }),
    );

    // Check message edit
    expect(mockMessage.edit).toHaveBeenCalled();
  });

  it('should remove a vote if clicked again (single poll)', async () => {
    // User 'user123' has already voted 'Yes'
    mockDbPoll.results[0].users = ['user123'];
    mockCollection.findOne.mockResolvedValue(mockDbPoll);

    // Set 'replied' to true *after* the first reply
    mockButtonInteraction.reply.mockImplementation(() => {
      (mockButtonInteraction as any).replied = true;
      return Promise.resolve({} as InteractionResponse);
    });

    await handlePollOptionSelect(mockClient, mockButtonInteraction);

    // Check reply (This will now pass)
    expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
      ephemeral: true,
      content: 'Vote for Yes removed.',
    });

    // Check DB replacement
    const expectedResults = [
      { option: 'Yes', users: [] },
      { option: 'No', users: [] },
    ];
    expect(mockCollection.findOneAndReplace).toHaveBeenCalledWith(
      { message: 'msg789' },
      expect.objectContaining({ results: expectedResults }),
    );
  });
});