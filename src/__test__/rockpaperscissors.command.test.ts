import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  InteractionResponse,
  Message,
} from 'discord.js';
// Adjust this import path to match your project structure
import RockPaperScissorsCommand, {
  handleRpsOptionSelect,
} from '../commands/fun/rockpaperscissors';
import { SageInteractionType } from '@lib/types/InteractionType';
import { buildCustomId, getDataFromCustomId } from '@lib/utils/interactionUtils';
import { BOT, ROLES } from '@root/config'; // ROLES is now needed for the mock type
import { Command } from '@lib/types/Command';

// --- Mocks ---

// Mock discord.js
jest.mock('discord.js', () => {
  // Mock the builders to be classes with chainable methods
  const MockEmbedBuilder = jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  }));
  const MockButtonBuilder = jest.fn(() => ({
    setLabel: jest.fn().mockReturnThis(),
    setCustomId: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
  }));
  const MockActionRowBuilder = jest.fn(() => ({
    addComponents: jest.fn().mockReturnThis(),
  }));

  return {
    EmbedBuilder: MockEmbedBuilder,
    ButtonBuilder: MockButtonBuilder,
    ActionRowBuilder: MockActionRowBuilder,
    ButtonStyle: {
      Primary: 1,
    },
    // Export types for casting
    ChatInputCommandInteraction: jest.fn(),
    ButtonInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    Message: jest.fn(),
    // Mock the enum used in the Command base class
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
  // This is the fix: The base Command class needs ROLES.VERIFIED
  ROLES: {
    VERIFIED: 'mock-verified-role-id',
  },
}));

jest.mock('@lib/types/InteractionType', () => ({
  SageInteractionType: {
    RPS: 'MOCK_RPS_TYPE',
  },
}));

jest.mock('@lib/utils/interactionUtils', () => ({
  buildCustomId: jest.fn((data) => JSON.stringify(data)), // Simple stringify for mock
  getDataFromCustomId: jest.fn((id) => JSON.parse(id)), // Simple parse for mock
}));

// Use Jest's fake timers
jest.useFakeTimers();
// We only need to spy on clearInterval.
jest.spyOn(global, 'clearInterval');

// --- Typed Mocks ---

// We can cast the imported mocks directly when we use them
const mockBuildCustomId = buildCustomId as jest.Mock;
const mockGetDataFromCustomId = getDataFromCustomId as jest.Mock;

const DECISION_TIMEOUT = 10; // From the file

describe('RockPaperScissors', () => {
  let command: RockPaperScissorsCommand;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockEmbed: any;
  let mockButton: any;
  let mockRow: any;

  // --- CHANGE 1: Add this variable ---
  let originalSetInterval: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock builder instances
    mockEmbed = {
      setTitle: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
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

    // This is the correct way to tell the mock constructor
    // (which is the imported EmbedBuilder) to return our instance
    (EmbedBuilder as unknown as jest.Mock).mockReturnValue(mockEmbed);
    (ButtonBuilder as unknown as jest.Mock).mockReturnValue(mockButton);
    (ActionRowBuilder as unknown as jest.Mock).mockReturnValue(mockRow);

    // --- CHANGE 2: Replace the "THIS IS THE FIX" block ---
    
    // 1. Save the original fake timer function
    originalSetInterval = global.setInterval;

    // 2. Save a reference to it for our implementation
    const fakeTimerImpl = global.setInterval;

    const mockTimer = {
      [Symbol.toPrimitive]: () => '12345'
    };
    
    // 3. Overwrite global.setInterval with a new mock
    global.setInterval = jest.fn((callback: (...args: any[]) => void, ms: number, ...args: any[]) => {
        // 4. Call the *saved* fake timer implementation to queue the timer
        fakeTimerImpl(callback, ms, ...args);
        // 5. Return our custom object
        return mockTimer as any;
    }) as any;
    // --- END FIX ---

    // Create a new command instance
    command = new RockPaperScissorsCommand();

    // Create a base mock interaction
    mockInteraction = {
      user: { id: 'user123', username: 'TestUser' },
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      editReply: jest.fn().mockResolvedValue({} as Message),
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;
  });

  // --- CHANGE 3: Add this entire afterEach block ---
  afterEach(() => {
    // Restore the original setInterval to prevent test leakage
    global.setInterval = originalSetInterval;
  });

  describe('Command Definition', () => {
    it('should have the correct description', () => {
      expect(command.description).toBe(
        `The ultimate battle of human vs program. Can you best ${BOT.NAME} in a round of rock paper scissors?`,
      );
    });
  });

  describe('run()', () => {
    it('should reply with an embed and three buttons', async () => {
      await command.run(mockInteraction);

      // Check embed creation
      expect(EmbedBuilder).toHaveBeenCalledTimes(1); // 'new EmbedBuilder()' was called
      expect(mockEmbed.setTitle).toHaveBeenCalledWith(
        'Make your choice, TestUser...',
      );
      expect(mockEmbed.setColor).toHaveBeenCalledWith('Red');
      expect(mockEmbed.setFooter).toHaveBeenCalledWith({
        text: `You have ${DECISION_TIMEOUT} seconds to make up your mind.`,
      });

      // Check button creation
      expect(ButtonBuilder).toHaveBeenCalledTimes(3); // 'new ButtonBuilder()'
      expect(mockRow.addComponents).toHaveBeenCalledWith([
        mockButton,
        mockButton,
        mockButton,
      ]);

      // Check custom ID generation
      expect(mockBuildCustomId).toHaveBeenCalledWith({
        type: SageInteractionType.RPS,
        commandOwner: 'user123',
        additionalData: ['rock', '12345'], // Now correctly gets '12345' from the mockTimer
      });
      expect(mockBuildCustomId).toHaveBeenCalledWith({
        type: SageInteractionType.RPS,
        commandOwner: 'user123',
        additionalData: ['paper', '12345'],
      });
      expect(mockBuildCustomId).toHaveBeenCalledWith({
        type: SageInteractionType.RPS,
        commandOwner: 'user123',
        additionalData: ['scissors', '12345'],
      });

      // Check interaction reply
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [mockEmbed],
        components: [mockRow],
      });
    });

    it('should set a timeout', async () => {
      await command.run(mockInteraction);
      expect(global.setInterval).toHaveBeenCalledTimes(1); // Check our new mock
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function), // The timeoutMessage function
        DECISION_TIMEOUT * 1000,
        mockInteraction,
      );
    });
  });

  describe('timeoutMessage()', () => {
    it('should edit the reply to show a timeout message', () => {
      command.timeoutMessage(mockInteraction);

      // Check embed creation
      expect(EmbedBuilder).toHaveBeenCalledTimes(1);
      expect(mockEmbed.setTitle).toHaveBeenCalledWith(
        `TestUser couldn't make up their mind! Command timed out.`,
      );
      expect(mockEmbed.setColor).toHaveBeenCalledWith('Red');

      // Check interaction edit
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        components: [],
        embeds: [mockEmbed],
      });
    });
  });

  describe('Timeout Flow', () => {
    it('should call timeoutMessage after the timeout duration', async () => {
      await command.run(mockInteraction);

      // Ensure editReply has not been called yet
      expect(mockInteraction.editReply).not.toHaveBeenCalled();

      // Fast-forward timers
      jest.advanceTimersByTime(DECISION_TIMEOUT * 1000);

      // Now check if the timeout logic (which calls editReply) has run
      expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);
      expect(mockEmbed.setTitle).toHaveBeenCalledWith(
        `TestUser couldn't make up their mind! Command timed out.`,
      );
    });
  });
});

describe('handleRpsOptionSelect', () => {
  let mockButtonInteraction: jest.Mocked<ButtonInteraction>;
  let mockMessage: jest.Mocked<Message>;
  let mockEmbed: any;
  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbed = {
      setTitle: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
    };
    // Cast the imported mock directly
    (EmbedBuilder as unknown as jest.Mock).mockReturnValue(mockEmbed);

    // Mock for i.channel.messages.fetch(i.message.id)
    mockMessage = {
      edit: jest.fn().mockResolvedValue({} as Message),
    } as unknown as jest.Mocked<Message>;

    mockButtonInteraction = {
      user: { id: 'user123', username: 'TestUser' },
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      deferUpdate: jest.fn().mockResolvedValue({} as InteractionResponse),
      channel: {
        messages: {
          fetch: jest.fn().mockResolvedValue(mockMessage),
        },
      },
      message: { id: 'msg456' },
      customId: '', // Will be set in each test
    } as unknown as jest.Mocked<ButtonInteraction>;

    // Spy on Math.random to control bot's move
    mathRandomSpy = jest.spyOn(Math, 'random');
  });

  afterEach(() => {
    // Restore original Math.random
    mathRandomSpy.mockRestore();
  });

  it('should deny interaction if user is not the command owner', async () => {
    const customIdData = {
      type: SageInteractionType.RPS,
      commandOwner: 'otherUser999', // Different user
      additionalData: ['rock', '12345'],
    };
    mockButtonInteraction.customId = JSON.stringify(customIdData);
    mockGetDataFromCustomId.mockReturnValue(customIdData);

    await handleRpsOptionSelect(mockButtonInteraction);

    expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
      content: 'You cannot respond to a command you did not execute',
      ephemeral: true,
    });
    // Ensure no further action was taken
    expect(clearInterval).not.toHaveBeenCalled();
    expect(mockMessage.edit).not.toHaveBeenCalled();
    expect(mockButtonInteraction.deferUpdate).not.toHaveBeenCalled();
  });

  it('should handle a player win (rock vs scissors)', async () => {
    const customIdData = {
      type: SageInteractionType.RPS,
      commandOwner: 'user123',
      additionalData: ['rock', '12345'],
    };
    mockButtonInteraction.customId = JSON.stringify(customIdData);
    mockGetDataFromCustomId.mockReturnValue(customIdData);

    // Mock Math.random to make bot choose 'scissors' (index 2)
    // Math.floor(0.8 * 3) = 2
    mathRandomSpy.mockReturnValue(0.8);

    await handleRpsOptionSelect(mockButtonInteraction);

    // Check timer was cleared
    expect(clearInterval).toHaveBeenCalledWith(12345); // Note: parseInt('12345')

    // Check message was fetched and edited
    expect(mockButtonInteraction.channel.messages.fetch).toHaveBeenCalledWith(
      'msg456',
    );
    expect(mockMessage.edit).toHaveBeenCalledWith({
      components: [],
      embeds: [mockEmbed],
    });

    // Check win embed
    expect(mockEmbed.setTitle).toHaveBeenCalledWith(
      `TestUser threw rock and TestBot threw scissors. TestUser won - humanity triumphs!`,
    );
    expect(mockEmbed.setColor).toHaveBeenCalledWith('Green');

    // Check update was deferred
    expect(mockButtonInteraction.deferUpdate).toHaveBeenCalled();
  });

  it('should handle a bot win (paper vs scissors)', async () => {
    const customIdData = {
      type: SageInteractionType.RPS,
      commandOwner: 'user123',
      additionalData: ['paper', '12345'],
    };
    mockButtonInteraction.customId = JSON.stringify(customIdData);
    mockGetDataFromCustomId.mockReturnValue(customIdData);

    // Bot chooses 'scissors' (index 2)
    mathRandomSpy.mockReturnValue(0.8);

    await handleRpsOptionSelect(mockButtonInteraction);

    // Check lose embed
    expect(mockEmbed.setTitle).toHaveBeenCalledWith(
      `TestUser threw paper and TestBot threw scissors. TestBot won - the machine triumphs!`,
    );
    expect(mockEmbed.setColor).toHaveBeenCalledWith('Red');
  });

  it('should handle a draw (rock vs rock)', async () => {
    const customIdData = {
      type: SageInteractionType.RPS,
      commandOwner: 'user123',
      additionalData: ['rock', '12345'],
    };
    mockButtonInteraction.customId = JSON.stringify(customIdData);
    mockGetDataFromCustomId.mockReturnValue(customIdData);

    // Bot chooses 'rock' (index 0)
    // Math.floor(0.1 * 3) = 0
    mathRandomSpy.mockReturnValue(0.1);

    await handleRpsOptionSelect(mockButtonInteraction);

    // Check draw embed
    expect(mockEmbed.setTitle).toHaveBeenCalledWith(
      `Both TestUser and TestBot threw rock. It's a draw!`,
    );
    expect(mockEmbed.setColor).toHaveBeenCalledWith('Blue');
  });

  it('should handle player win (scissors vs paper)', async () => {
    const customIdData = {
      type: SageInteractionType.RPS,
      commandOwner: 'user123',
      additionalData: ['scissors', '12345'],
    };
    mockButtonInteraction.customId = JSON.stringify(customIdData);
    mockGetDataFromCustomId.mockReturnValue(customIdData);

    // Bot chooses 'paper' (index 1)
    // Math.floor(0.5 * 3) = 1
    mathRandomSpy.mockReturnValue(0.5);

    await handleRpsOptionSelect(mockButtonInteraction);

    // Check win embed
    expect(mockEmbed.setTitle).toHaveBeenCalledWith(
      `TestUser threw scissors and TestBot threw paper. TestUser won - humanity triumphs!`,
    );
    expect(mockEmbed.setColor).toHaveBeenCalledWith('Green');
  });
});