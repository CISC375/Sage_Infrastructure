/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the command class to be tested
// Adjust this path to where your command is located
import TogglePiiCommand from '../../../commands/configuration/togglepii'; 
import { DatabaseError } from '@lib/types/errors'; // Import the actual error class

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
  },
}));

// --- Test Suite ---

describe('Toggle PII Command', () => {
  let command: TogglePiiCommand;
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

    command = new TogglePiiCommand();
  });

  // --- Test Cases ---

  it('should toggle pii from true to false', async () => {
    const mockUser = {
      discordId: 'user123',
      pii: true, // Start as TRUE
    };
    mockFindOne.mockResolvedValue(mockUser);

    await command.run(mockInteraction);

    // 1. Check that the user was found
    expect(mockCollection).toHaveBeenCalledWith('usersCollection');
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'user123' });

    // 2. Check that the DB was updated with FALSE
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { discordId: 'user123' },
      { $set: { pii: false } }
    );

    // 3. Check the reply content
    const replyContent = mockInteraction.reply.mock.calls[0][0].content;
    expect(replyContent).toContain('now UNABLE');
    expect(replyContent).toContain('It is still available to staff');
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: replyContent,
      ephemeral: true,
    });
  });

  it('should toggle pii from false to true', async () => {
    const mockUser = {
      discordId: 'user123',
      pii: false, // Start as FALSE
    };
    mockFindOne.mockResolvedValue(mockUser);

    await command.run(mockInteraction);

    // 1. Check that the DB was updated with TRUE
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { discordId: 'user123' },
      { $set: { pii: true } }
    );

    // 2. Check the reply content
    const replyContent = mockInteraction.reply.mock.calls[0][0].content;
    expect(replyContent).toContain('now ABLE');
    expect(replyContent).not.toContain('It is still available to staff');
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: replyContent,
      ephemeral: true,
    });
  });

  it('should throw a DatabaseError if user is not found', async () => {
    mockFindOne.mockResolvedValue(null); // User not found

    let caughtError: any;
    try {
      await command.run(mockInteraction);
    } catch (error) {
      caughtError = error;
    }

    // 1. Check that the correct error was thrown
    expect(caughtError).toBeInstanceOf(DatabaseError);
    expect(caughtError.message).toBe('Member TestUser (user123) not in database');

    // 2. Check that the user-facing reply was sent
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `Something went wrong when looking you up in our database. @maintainers have been notified.`,
      ephemeral: true,
    });

    // 3. Check that no update was attempted
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});