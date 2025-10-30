/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the command class to be tested
import CheckCommand from '../commands/check'; 

// --- Mock Dependencies ---

// Mock config
jest.mock('@root/config', () => ({
  DB: { USERS: 'usersCollection' },
  MAINTAINERS: '@maintainers',
}));

// Mock base Command class
jest.mock('@lib/types/Command', () => ({
  Command: class Command {
    description = '';
    options = [];
  },
}));

// Mock discord.js
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedSetThumbnail = jest.fn().mockReturnThis();
const mockEmbedAddFields = jest.fn().mockReturnThis();

jest.mock('discord.js', () => {
  const actualDiscord = jest.requireActual('discord.js');
  return {
    ...actualDiscord,
    EmbedBuilder: jest.fn(() => ({
      setTitle: mockEmbedSetTitle,
      setThumbnail: mockEmbedSetThumbnail,
      addFields: mockEmbedAddFields,
    })),
    // Export constants needed
    ApplicationCommandOptionType: actualDiscord.ApplicationCommandOptionType,
  };
});

// --- Test Suite ---

describe('Check Command', () => {
  let command: CheckCommand;
  let mockInteraction: any;
  let mockFindOne: jest.Mock;
  let mockCollection: jest.Mock;

  beforeEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();

    // Clear mock function calls
    mockEmbedSetTitle.mockClear();
    mockEmbedSetThumbnail.mockClear();
    mockEmbedAddFields.mockClear();
    (require('discord.js').EmbedBuilder as jest.Mock).mockClear();

    // --- Mock Mongo/Client ---
    mockFindOne = jest.fn();
    mockCollection = jest.fn(() => ({ findOne: mockFindOne }));

    // --- Mock Interaction ---
    mockInteraction = {
      user: {
        id: 'user123',
        username: 'TestUser',
        avatarURL: jest.fn(() => 'http://avatar.url'),
        client: { mongo: { collection: mockCollection } },
      },
      options: {
        getBoolean: jest.fn(),
      },
      reply: jest.fn().mockResolvedValue(true),
    };

    command = new CheckCommand();
  });

  // --- Test Cases for run() ---

  it('should reply with an error if user is not found', async () => {
    mockFindOne.mockResolvedValue(null); // User not found

    await command.run(mockInteraction);

    // 1. Check DB was queried
    expect(mockCollection).toHaveBeenCalledWith('usersCollection');
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'user123' });

    // 2. Check reply
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      "I couldn't find you in the database, if you think this is an error please contact @maintainers."
    );

    // 3. Check embed was not created
    expect(require('discord.js').EmbedBuilder).not.toHaveBeenCalled();
  });

  it('should reply with a public embed by default (hide=false)', async () => {
    const mockUser = {
      count: 5,
      level: 2,
      curExp: 10,  // Messages remaining
      levelExp: 50, // Total messages for next level
    };
    mockFindOne.mockResolvedValue(mockUser);
    mockInteraction.options.getBoolean.mockReturnValue(false); // 'hide' is false

    await command.run(mockInteraction);

    // 1. Check reply was public
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
      // ephemeral is NOT present
    });

    // 2. Check embed content
    expect(mockEmbedSetTitle).toHaveBeenCalledWith("TestUser's Progress");
    expect(mockEmbedSetThumbnail).toHaveBeenCalledWith('http://avatar.url');

    // 3. Check fields (plural 'messages')
    expect(mockEmbedAddFields).toHaveBeenCalledWith({
      name: 'Message Count',
      value: 'You have sent **5** messages this week in academic course channels.',
      inline: true,
    });
    expect(mockEmbedAddFields).toHaveBeenCalledWith({
      name: 'Level Progress',
      value: expect.stringContaining("You're **10** messages away from **Level 3**"),
      inline: false,
    });
    // (50-10) / 50 = 0.8. 18 * 0.8 = 14.4. 13 green + 1 check
	const expectedBar = '🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩✅⚫⚫⚫⚫ **80%**';
    expect(mockEmbedAddFields).toHaveBeenCalledWith({
      name: 'Level Progress',
      value: expect.stringContaining(expectedBar), 
      inline: false,
    });
  });

  it('should reply with a hidden embed if hide=true', async () => {
    const mockUser = { count: 5, level: 2, curExp: 10, levelExp: 50 };
    mockFindOne.mockResolvedValue(mockUser);
    mockInteraction.options.getBoolean.mockReturnValue(true); // 'hide' is TRUE

    await command.run(mockInteraction);

    // Check reply was ephemeral
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
      ephemeral: true,
    });
  });

  it('should use singular "message" for count=1 and curExp=1', async () => {
    const mockUser = {
      count: 1,
      level: 0,
      curExp: 1,   // 1 message remaining
      levelExp: 10,
    };
    mockFindOne.mockResolvedValue(mockUser);
    mockInteraction.options.getBoolean.mockReturnValue(false);

    await command.run(mockInteraction);

    // 1. Check singular 'message' for count
    expect(mockEmbedAddFields).toHaveBeenCalledWith({
      name: 'Message Count',
      value: 'You have sent **1** message this week in academic course channels.',
      inline: true,
    });

    // 2. Check singular 'message' for progress
    expect(mockEmbedAddFields).toHaveBeenCalledWith({
      name: 'Level Progress',
      value: expect.stringContaining("You're **1** message away from **Level 1**"),
      inline: false,
    });
  });

  // --- Test Cases for progressBar() ---

  describe('Progress Bar Function', () => {
    // progressBar(value: number, maxValue: number, size: number)
    // 'value' is the progress made (levelExp - curExp)
    
    it('should show 50% progress', () => {
      // 5 progress made, 10 max value, 10 size
      // 5/10 = 0.5. 10 * 0.5 = 5.
      // 4 green squares, 1 check, 5 empty
      const bar = command.progressBar(5, 10, 10);
      expect(bar).toBe('🟩🟩🟩🟩✅⚫⚫⚫⚫⚫ **50%**');
    });

    it('should show 0% progress (new level)', () => {
      // 0 progress made, 10 max value, 10 size
      // 0/10 = 0. 10 * 0 = 0.
      // 0 green squares, 1 check, 9 empty
      const bar = command.progressBar(0, 10, 10);
      expect(bar).toBe('✅⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫ **0%**');
    });

    it('should show 100% progress (level up)', () => {
      // 10 progress made, 10 max value, 10 size
      // 10/10 = 1. 10 * 1 = 10.
      // 9 green squares, 1 check, 0 empty
      const bar = command.progressBar(10, 10, 10);
      expect(bar).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩✅ **100%**');
    });

    it('should show 90% progress', () => {
      // 18 progress made, 20 max value, 20 size
      // 18/20 = 0.9. 20 * 0.9 = 18.
      // 17 green, 1 check, 2 empty
      const bar = command.progressBar(18, 20, 20);
      expect(bar).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩✅⚫⚫ **90%**');
    });
  });
});