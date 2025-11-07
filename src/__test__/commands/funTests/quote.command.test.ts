/**
 * QuoteCommand fetches inspirational quotes from ZenQuotes. These tests document
 * how we mock axios, assert on embed construction, and surface failures.
 */
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionResponse,
} from 'discord.js';
// Adjust this import path to match your project structure
import QuoteCommand from '../../../commands/fun/quote';
import axios from 'axios';

// --- Mocks ---
// Centralized so the tests can focus on behavior instead of setup noise.

// Mock axios so we can control success/error responses from the API.
jest.mock('axios');

// Mock discord.js embed builder to track chained calls.
jest.mock('discord.js', () => {
  // Mock the builders to be classes with chainable methods
  const MockEmbedBuilder = jest.fn(() => ({
    setColor: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
  }));
  return {
    EmbedBuilder: MockEmbedBuilder,
    ChatInputCommandInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    // Mock the enum used in the Command base class
    ApplicationCommandPermissionType: {
      Role: 2,
    },
  };
});

// Mock local dependencies (for the base Command class)
jest.mock('@root/config', () => ({
  // The base Command class needs ROLES.VERIFIED
  ROLES: {
    VERIFIED: 'mock-verified-role-id',
  },
  // BOT isn't needed for this command's description
  BOT: {
    NAME: 'TestBot',
  },
}));

// --- Typed Mocks ---
// We cast the imported mocks so TypeScript understands them.
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Suite: QuoteCommand
 * Focus: verifying metadata, successful replies, and error propagation.
 */
describe('QuoteCommand', () => {
  let command: QuoteCommand;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockEmbed: any;

  /**
   * Each spec gets a fresh command, embed builder, and interaction mock. The
   * command holds no internal state but this keeps expectations isolated.
   */
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock builder instances
    mockEmbed = {
      setColor: jest.fn().mockReturnThis(),
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
    };
    (EmbedBuilder as unknown as jest.Mock).mockReturnValue(mockEmbed);

    // Create a base mock interaction
    mockInteraction = {
      user: { id: 'user123', username: 'TestUser' },
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    // Create a new command instance
    command = new QuoteCommand();
  });

  /**
   * Static metadata should stay informative, so we snapshot the description.
   */
  describe('Command Definition', () => {
    it('should have the correct description', () => {
      expect(command.description).toBe(
        'Get a quote from historical figures via ZenQuotes API at https://zenquotes.io/',
      );
    });
  });

  /**
   * The runtime suite focuses on API calls and Discord replies.
   */
  describe('run()', () => {
    /**
     * Happy path: axios resolves, we construct an embed, and reply once.
     */
    it('should fetch a quote and reply with an embed', async () => {
      // 1. Setup the mock API response
      const mockApiResponse = {
        data: [
          { a: 'Test Author', q: 'This is a test quote.' },
        ],
      };
      // We mock 'axios.get' since it's a named export method
      mockedAxios.get.mockResolvedValue(mockApiResponse);

      // 2. Run the command
      await command.run(mockInteraction);

      // 3. Check assertions
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://zenquotes.io/api/random',
      );

      expect(EmbedBuilder).toHaveBeenCalledTimes(1);
      expect(mockEmbed.setColor).toHaveBeenCalledWith('#3CD6A3');
      expect(mockEmbed.setTitle).toHaveBeenCalledWith('Test Author:');
      expect(mockEmbed.setDescription).toHaveBeenCalledWith(
        '"This is a test quote."',
      );

      expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
      expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [mockEmbed] });
    });

    /**
     * Failure path: axios rejects and the error propagates so upstream consumers
     * can decide how to handle the outage.
     */
    it('should throw an error if the API fails', async () => {
      // 1. Setup the mock API error
      const mockError = new Error('API is down');
      mockedAxios.get.mockRejectedValue(mockError);

      // 2. Run the command and expect it to throw
      // Your current code doesn't have a try/catch, so it will throw
      await expect(command.run(mockInteraction)).rejects.toThrow('API is down');

      // 3. Check that no reply was sent
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });
  });
});
