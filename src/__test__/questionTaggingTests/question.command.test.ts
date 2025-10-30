/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the command class to be tested
import FilterQuestionsCommand from '../../commands/question tagging/question'; // Adjust this path
// import { ApplicationCommandOptionType, ChannelType } from 'discord.js';

// --- Mock Dependencies ---

// Mock config
jest.mock('@root/config', () => ({
  BOT: { NAME: 'TestBot' },
  DB: {
    USERS: 'usersCollection',
    COURSES: 'coursesCollection',
    QTAGS: 'qtagsCollection',
  },
  MAINTAINERS: '@maintainers',
}));

// Mock utils
// const mockGenerateErrorEmbed = jest.fn((desc) => ({
//   description: desc,
//   color: 'Red',
// }));

// Mock base Command class
jest.mock('@lib/types/Command', () => ({
  Command: class Command {
    description = '';
    extendedHelp = '';
    options = [];
  },
}));

jest.mock('@root/src/lib/utils/generalUtils', () => ({
  generateErrorEmbed: jest.fn((desc) => ({
    description: desc,
    color: 'Red',
  })),
}));

// Mock discord.js
const mockEmbedSetTitle = jest.fn().mockReturnThis();
const mockEmbedAddFields = jest.fn().mockReturnThis();
const mockEmbedSetColor = jest.fn().mockReturnThis();

jest.mock('discord.js', () => {
  const actualDiscord = jest.requireActual('discord.js');
  return {
    ...actualDiscord,
    EmbedBuilder: jest.fn(() => ({
      setTitle: mockEmbedSetTitle,
      addFields: mockEmbedAddFields,
      setColor: mockEmbedSetColor,
    })),
    // Export constants needed
    ApplicationCommandOptionType: actualDiscord.ApplicationCommandOptionType,
  };
});

// --- Test Suite ---

describe('Filter Questions Command', () => {
  let command: FilterQuestionsCommand;
  let mockInteraction: any;
  let mockFindOne: jest.Mock;
  let mockFind: jest.Mock;
  let mockToArray: jest.Mock;
  let mockCollection: jest.Mock;

  // --- Mock Data ---
  const mockCourse108 = {
    name: 'CISC108',
    assignments: ['hw1', 'hw2', 'lab1'],
  };
  const mockCourse220 = {
    name: 'CISC220',
    assignments: ['p1', 'p2'],
  };
  const mockAllCourses = [mockCourse108, mockCourse220];

  const mockSingleCourseUser = {
    discordId: 'user123',
    courses: ['CISC108'],
  };
  const mockMultiCourseUser = {
    discordId: 'user456',
    courses: ['CISC108', 'CISC220'],
  };

  const mockQuestionTags = [
    {
      header: 'Question about hw1',
      link: 'http://discord.link/1',
      course: 'CISC108',
      assignment: 'hw1',
    },
    {
      header: 'Another question hw1',
      link: 'http://discord.link/2',
      course: 'CISC108',
      assignment: 'hw1',
    },
  ];

  // --- Setup ---

  beforeEach(() => {
    // Restore all mocks to ensure no implementations leak
    jest.restoreAllMocks();

    // Clear mock function calls
    mockEmbedSetTitle.mockClear();
    mockEmbedAddFields.mockClear();
    mockEmbedSetColor.mockClear();
    // --- THIS IS THE FIX ---
    (require('@root/src/lib/utils/generalUtils').generateErrorEmbed as jest.Mock).mockClear();
    (require('discord.js').EmbedBuilder as jest.Mock).mockClear();

    // --- Mock Mongo/Client ---
    mockFindOne = jest.fn();
    mockToArray = jest.fn();
    mockFind = jest.fn(() => ({ toArray: mockToArray }));
    mockCollection = jest.fn(() => ({
      findOne: mockFindOne,
      find: mockFind,
    }));

    // --- Mock Interaction ---
    mockInteraction = {
      options: {
        getString: jest.fn(),
      },
      client: {
        mongo: { collection: mockCollection },
      },
      user: {
        id: 'user123',
      },
      reply: jest.fn().mockResolvedValue(true),
    };

    command = new FilterQuestionsCommand();
  });

  // --- Test Cases ---

  it('should reply with an error if the user is not found', async () => {
    mockFindOne.mockResolvedValueOnce(null); // User not found

    await command.run(mockInteraction);

    expect(mockCollection).toHaveBeenCalledWith('usersCollection');
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'user123' });
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({ description: expect.stringContaining('Something went wrong') })],
      ephemeral: true,
    });
    // We now check the mock this way
    expect(require('@root/src/lib/utils/generalUtils').generateErrorEmbed).toHaveBeenCalledTimes(1);
  });

  it('should find questions for a single-course user (auto-detect course)', async () => {
    mockInteraction.options.getString.mockReturnValue('hw1'); // Only returns assignment
    mockFindOne.mockResolvedValueOnce(mockSingleCourseUser); // Find user
    mockToArray.mockResolvedValueOnce([mockCourse108]); // Find courses
    mockToArray.mockResolvedValueOnce(mockQuestionTags); // Find tags

    await command.run(mockInteraction);

    // 1. Fetched user
    expect(mockCollection).toHaveBeenCalledWith('usersCollection');
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'user123' });

    // 2. Fetched courses
    expect(mockCollection).toHaveBeenCalledWith('coursesCollection');
    expect(mockToArray).toHaveBeenCalledTimes(2); // Once for courses, once for tags

    // 3. Fetched tags with correct filter
    expect(mockCollection).toHaveBeenCalledWith('qtagsCollection');
    expect(mockFind).toHaveBeenCalledWith({
      course: 'CISC108',
      assignment: 'hw1',
    });

    // 4. Replied with correct embed
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
      ephemeral: true,
    });
    expect(mockEmbedSetTitle).toHaveBeenCalledWith('Questions for CISC108 hw1');
    expect(mockEmbedAddFields).toHaveBeenCalledWith([
      { name: 'Question about hw1', value: '[Click to view](http://discord.link/1)', inline: false },
      { name: 'Another question hw1', value: '[Click to view](http://discord.link/2)', inline: false },
    ]);
  });

  it('should find questions for a multi-course user who specifies a course', async () => {
    mockInteraction.user.id = 'user456';
    mockInteraction.options.getString.mockImplementation((opt: string) => {
      if (opt === 'assignment') return 'p1';
      if (opt === 'course') return 'CISC220';
      return null;
    });

    mockFindOne.mockResolvedValueOnce(mockMultiCourseUser);
    mockToArray.mockResolvedValueOnce(mockAllCourses);
    mockToArray.mockResolvedValueOnce([{ header: 'P1 Q', link: 'http://link' }]); // Find tags

    await command.run(mockInteraction);

    // 1. Fetched user
    expect(mockFindOne).toHaveBeenCalledWith({ discordId: 'user456' });

    // 2. Fetched tags with correct filter
    expect(mockFind).toHaveBeenCalledWith({
      course: 'CISC220',
      assignment: 'p1',
    });

    // 3. Replied with correct embed
    expect(mockEmbedSetTitle).toHaveBeenCalledWith('Questions for CISC220 p1');
    expect(mockEmbedAddFields).toHaveBeenCalledWith([
      { name: 'P1 Q', value: '[Click to view](http://link)', inline: false },
    ]);
  });

  it('should error for a multi-course user who does not specify a course', async () => {
    mockInteraction.user.id = 'user456';
    mockInteraction.options.getString.mockImplementation((opt: string) => {
      if (opt === 'assignment') return 'p1';
      if (opt === 'course') return null; // Course not specified
      return null;
    });

    mockFindOne.mockResolvedValueOnce(mockMultiCourseUser);
    mockToArray.mockResolvedValueOnce(mockAllCourses);

    await command.run(mockInteraction);

    const mockGenerateErrorEmbed = require('@root/src/lib/utils/generalUtils').generateErrorEmbed;
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
      ephemeral: true,
    });
    expect(mockGenerateErrorEmbed).toHaveBeenCalledWith(
      expect.stringContaining('I wasn\'t able to determine your course')
    );
    // Check that it lists the available courses
    expect(mockGenerateErrorEmbed).toHaveBeenCalledWith(
      expect.stringContaining('`CISC108`, `CISC220`')
    );
  });

  it('should error if the assignment is invalid for the course', async () => {
    mockInteraction.options.getString.mockReturnValue('invalid-assignment');
    mockFindOne.mockResolvedValueOnce(mockSingleCourseUser);
    mockToArray.mockResolvedValueOnce([mockCourse108]);

    await command.run(mockInteraction);

    const mockGenerateErrorEmbed = require('@root/src/lib/utils/generalUtils').generateErrorEmbed;
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
      ephemeral: true,
    });
    expect(mockGenerateErrorEmbed).toHaveBeenCalledWith(
      expect.stringContaining("I couldn't find an assignment called **invalid-assignment**")
    );
    // Check that it lists available assignments
    expect(mockGenerateErrorEmbed).toHaveBeenCalledWith(
      expect.stringContaining('`hw1`, `hw2`, `lab1`')
    );
  });

  it('should reply with a message if no questions are found', async () => {
    mockInteraction.options.getString.mockReturnValue('hw2'); // A valid assignment
    mockFindOne.mockResolvedValueOnce(mockSingleCourseUser);
    mockToArray.mockResolvedValueOnce([mockCourse108]);
    mockToArray.mockResolvedValueOnce([]); // No tags found

    await command.run(mockInteraction);

    expect(mockFind).toHaveBeenCalledWith({
      course: 'CISC108',
      assignment: 'hw2',
    });
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('There are no questions for CISC108, hw2'),
      ephemeral: true,
    });
    expect(mockEmbedSetTitle).not.toHaveBeenCalled();
  });

  it('should paginate embeds if more than 25 questions are found', async () => {
    // Create 30 mock tags
    const manyTags = Array.from({ length: 30 }, (_, i) => ({
      header: `Question ${i + 1}`,
      link: `http://link/${i + 1}`,
    }));

    mockInteraction.options.getString.mockReturnValue('hw1');
    mockFindOne.mockResolvedValueOnce(mockSingleCourseUser);
    mockToArray.mockResolvedValueOnce([mockCourse108]);
    mockToArray.mockResolvedValueOnce(manyTags); // 30 tags

    await command.run(mockInteraction);

    // 1. Check that reply was called with TWO embeds
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object), expect.any(Object)],
      ephemeral: true,
    });

    // 2. Check that EmbedBuilder was constructed twice
    expect(require('discord.js').EmbedBuilder).toHaveBeenCalledTimes(2);

    // 3. Check the first embed (title + 25 fields)
    expect(mockEmbedSetTitle).toHaveBeenCalledTimes(1);
    expect(mockEmbedAddFields.mock.calls[0][0].length).toBe(25); // First call to addFields
    expect(mockEmbedAddFields.mock.calls[0][0][0].name).toBe('Question 1'); // Check first field
    expect(mockEmbedAddFields.mock.calls[0][0][24].name).toBe('Question 25'); // Check 25th field

    // 4. Check the second embed (no title + 5 fields)
    expect(mockEmbedAddFields.mock.calls[1][0].length).toBe(5); // Second call to addFields
    expect(mockEmbedAddFields.mock.calls[1][0][0].name).toBe('Question 26'); // Check 26th field
    expect(mockEmbedAddFields.mock.calls[1][0][4].name).toBe('Question 30'); // Check 30th field
  });
});