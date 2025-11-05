/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the command class to be tested
// Adjust this path to where your command is located
import ToggleLevelPingsCommand from '../../../commands/configuration/togglelevelpings'; 
import { DatabaseError } from '@lib/types/errors'; // Import the actual error class

// --- Mock Dependencies ---

// Mock config
jest.mock('@root/config', () => ({
  DB: { USERS: 'usersCollection' },
}));

// Mock base Command class
jest.mock('@lib/types/Command', () => ({
  Command: class Command {
    description = '';
  },
}));

// Mock errors
// This assumes your DatabaseError is exported from this path
jest.mock('@lib/types/errors', () => ({
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

// --- Test Suite ---

describe('Toggle Level Pings Command', () => {
  let command: ToggleLevelPingsCommand;
  let mockInteraction: any;
  let mockFindOne: jest.Mock;
  let mockUpdateOne: jest.Mock;
  let mockCollection: jest.Mock;

  beforeEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();

    // --- Mock Mongo/Client ---
    mockFindOne = jest.fn();
    mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    mockCollection = jest.fn(() => ({
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
    }));

    // --- Mock Interaction ---
    mockInteraction = {
      client: { mongo: { collection: mockCollection } },
      user: { id: 'user123', username: 'TestUser' },
      reply: jest.fn().mockResolvedValue(true),
    };

    command = new ToggleLevelPingsCommand();
  });

  // --- Test Cases ---

  it('should toggle levelPings from true to false', async () => {
    const mockUser = {
      discordId: 'user123',
      levelPings: true, // Start as TRUE
    };
    mockFindOne.mockResolvedValue(mockUser);

    await command.run(mockInteraction);

    // 1. Check that the user was found
    expect(mockCollection).toHaveBeenCalledWith('usersCollection');
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'user123' });

    // 2. Check that the DB was updated with FALSE
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { discordId: 'user123' },
      { $set: { levelPings: false } }
    );

    // 3. Check the reply content
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `You will no longer receive notifications from Sage on a level up.`,
      ephemeral: true,
    });
  });

  it('should toggle levelPings from false to true', async () => {
    const mockUser = {
      discordId: 'user123',
      levelPings: false, // Start as FALSE
    };
    mockFindOne.mockResolvedValue(mockUser);

    await command.run(mockInteraction);

    // 1. Check that the DB was updated with TRUE
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { discordId: 'user123' },
      { $set: { levelPings: true } }
    );

    // 2. Check the reply content
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `You will now receive notifications from Sage on a level up.`,
      ephemeral: true,
    });
  });

  it('should throw a DatabaseError if user is not found', async () => {
    mockFindOne.mockResolvedValue(null); // User not found

    // Check that the command throws the specific error
    await expect(command.run(mockInteraction)).rejects.toThrow(DatabaseError);
    await expect(command.run(mockInteraction)).rejects.toThrow(
      'Member TestUser (user123) not in database'
    );

    // 2. Check that no reply was sent
    expect(mockInteraction.reply).not.toHaveBeenCalled();

    // 3. Check that no update was attempted
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});