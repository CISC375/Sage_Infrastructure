import {
  ChatInputCommandInteraction,
  InteractionResponse,
  EmbedBuilder, // Import EmbedBuilder if generateErrorEmbed returns one
  ApplicationCommandOptionType, // Needed for base Command mock
  ThreadChannel, // Import ThreadChannel type for mocking
} from 'discord.js';
// Adjust import path as necessary
import ArchiveCommand from '../../commands/partial visibility question/archive';
import { generateErrorEmbed } from '@lib/utils/generalUtils';
import { ROLES, BOT } from '@root/config'; // For base Command mock

// --- Mocks ---

jest.mock('discord.js', () => {
  // Mock EmbedBuilder for generateErrorEmbed
  const MockEmbedBuilder = jest.fn(() => ({
    // Add any methods generateErrorEmbed might use
  }));
  return {
    EmbedBuilder: MockEmbedBuilder,
    ChatInputCommandInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    ThreadChannel: jest.fn(), // Mock the class
    // Mock enums needed by base Command
    ApplicationCommandPermissionType: { Role: 2 },
    ApplicationCommandOptionType: { String: 3 }, // Assuming default if no options
  };
});

// Mock generateErrorEmbed
jest.mock('@lib/utils/generalUtils', () => ({
  generateErrorEmbed: jest.fn((msg) => ({
    // Simulate the structure returned by generateErrorEmbed
    mockedEmbed: true,
    content: msg,
  })),
}));

// Mock config for base Command
jest.mock('@root/config', () => ({
  ROLES: { VERIFIED: 'mock-verified-role-id' },
  BOT: { NAME: 'TestBot' },
}));

// --- Typed Mocks ---
const mockedGenerateErrorEmbed = generateErrorEmbed as jest.Mock;

// =============================
// == ArchiveCommand Tests
// =============================
describe('ArchiveCommand', () => {
  let command: ArchiveCommand;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockThreadChannel: jest.Mocked<ThreadChannel>;

  beforeEach(() => {
    jest.clearAllMocks();

    command = new ArchiveCommand();

    // Mock the thread channel methods
    mockThreadChannel = {
      isThread: jest.fn(() => true), // Default to being a thread
      setArchived: jest.fn().mockResolvedValue(undefined), // Mock setArchived
    } as unknown as jest.Mocked<ThreadChannel>;

    // Mock interaction
    mockInteraction = {
      user: { id: 'user123', username: 'TestUser' },
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      editReply: jest.fn().mockResolvedValue({} as InteractionResponse),
      channel: mockThreadChannel, // Use the mocked channel
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;
  });

  describe('run()', () => {
    it('should archive the thread if run in a thread channel', async () => {
      // 1. Arrange (already set up in beforeEach)

      // 2. Act
      await command.run(mockInteraction);

      // 3. Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith('Archiving thread...');
      expect(mockThreadChannel.setArchived).toHaveBeenCalledTimes(1);
      expect(mockThreadChannel.setArchived).toHaveBeenCalledWith(
        true,
        'TestUser archived the question.',
      );
      expect(mockInteraction.editReply).toHaveBeenCalledWith('Thread archived.');
      expect(mockedGenerateErrorEmbed).not.toHaveBeenCalled();
    });

    it('should reply with an error if not run in a thread channel', async () => {
      // 1. Arrange - Override the channel mock
      (mockInteraction.channel.isThread as unknown as jest.Mock).mockReturnValue(false);
      const mockErrorEmbed = { content: 'Must be in a thread' };
      mockedGenerateErrorEmbed.mockReturnValue(mockErrorEmbed);

      // 2. Act
      await command.run(mockInteraction);

      // 3. Assert
      expect(mockedGenerateErrorEmbed).toHaveBeenCalledWith(
        'You must run this command in a private question thread.',
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [mockErrorEmbed],
        ephemeral: true,
      });
      // Ensure archiving logic was NOT called
      expect(mockThreadChannel.setArchived).not.toHaveBeenCalled();
      expect(mockInteraction.editReply).not.toHaveBeenCalled();
    });

    it('should handle errors during setArchived', async () => {
      // 1. Arrange - Make setArchived throw an error
      const archiveError = new Error('Discord API error');
      (mockThreadChannel.setArchived as jest.Mock).mockRejectedValue(
        archiveError,
      );

      // 2. Act & Assert - Expect the error to propagate
      await expect(command.run(mockInteraction)).rejects.toThrow(
        'Discord API error',
      );

      // Check initial reply happened, but editReply did not
      expect(mockInteraction.reply).toHaveBeenCalledWith('Archiving thread...');
      expect(mockThreadChannel.setArchived).toHaveBeenCalledTimes(1);
      expect(mockInteraction.editReply).not.toHaveBeenCalled();
    });
  });
});