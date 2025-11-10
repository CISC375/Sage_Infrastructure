import { ChatInputCommandInteraction, CategoryChannel } from 'discord.js';
import RemoveCourseCommand from '../../../commands/admin/removecourse';

// Mock config and permissions
jest.mock('@root/config', () => ({
  CHANNELS: { ARCHIVE: 'archive-category-id' },
  DB: { USERS: 'users', COURSES: 'courses' },
  SEMESTER_ID: 'F25',
  ROLES: { VERIFIED: 'verified_role_id' },
}));

jest.mock('@lib/permissions', () => ({
  ADMIN_PERMS: { id: 'admin_role_id', permission: true, type: 1 },
}));

// Mock util to avoid accidental real calls
jest.mock('@root/src/lib/utils/generalUtils', () => ({
  updateDropdowns: jest.fn(),
}));

describe('Admin RemoveCourse Command', () => {
  let command: RemoveCourseCommand;
  let interaction: ChatInputCommandInteraction;

  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockFetchReply = jest.fn();
  const mockCreateCollector = jest.fn();
  const mockCountDocuments = jest.fn();

  beforeEach(() => {
    command = new (RemoveCourseCommand as any)();

    mockReply.mockClear();
    mockEditReply.mockClear();
    mockFetchReply.mockClear();
    mockCreateCollector.mockClear();
    mockCountDocuments.mockClear();

    // Collector mock that immediately triggers 'end' to clear the interval
    const collector = {
      on: function (event: string, handler: Function) {
        if (event === 'end') {
          // Pass a discord.js-like Collection stub with .filter returning size 0
          const collectedStub = { filter: () => ({ size: 0 }) } as any;
          setTimeout(() => handler(collectedStub), 0);
        }
        return this;
      },
    } as any;

    mockCreateCollector.mockReturnValue(collector);

    interaction = {
      options: { getChannel: jest.fn() } as any,
      reply: mockReply as any,
      editReply: mockEditReply as any,
      fetchReply: mockFetchReply as any,
      channel: { createMessageComponentCollector: mockCreateCollector } as any,
      client: {
        mongo: {
          collection: jest.fn(() => ({
            countDocuments: mockCountDocuments,
          })),
        },
      } as any,
      user: { tag: 'Tester#0001', id: 'user-id-1' } as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('replies with an error when provided course is invalid', async () => {
    // Return an object that lacks children to trigger the catch without null access
    (interaction.options.getChannel as jest.Mock).mockReturnValue({} as any);

    await command.run(interaction);

    expect(mockReply).toHaveBeenCalledWith('You have to tag a valid course category.');
  });

  it('sends confirmation message with counts when given a valid course', async () => {
    // Mock a CategoryChannel-like object
    const course = {
      id: 'course-cat-id',
      name: 'CISC 108',
      children: { cache: { size: 5 /* channel count */ } },
    } as unknown as CategoryChannel;

    (interaction.options.getChannel as jest.Mock).mockReturnValue(course);
    mockCountDocuments.mockResolvedValue(3); // user count

    // fetchReply must resolve to an object with id used by collector filter
    mockFetchReply.mockResolvedValue({ id: 'reply-id-1' });

    await command.run(interaction);

    // It should send the confirmation with base text and a components row
    expect(mockReply).toHaveBeenCalledTimes(1);
    const replyArg = mockReply.mock.calls[0][0];

    expect(replyArg.content).toContain('Are you sure you want to delete');
    expect(replyArg.content).toContain('archive 5 channels');
    expect(replyArg.content).toContain('unenroll 3 users');
    expect(replyArg.content).toContain("Press 'yes' in the next 30 seconds to confirm.");
    expect(Array.isArray(replyArg.components)).toBe(true);
    expect(replyArg.components.length).toBe(1);
  });
});
