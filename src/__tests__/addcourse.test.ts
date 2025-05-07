import CreateCourseCommand from '../../src/commands/admin/addcourse';
import { ChatInputCommandInteraction, Guild, Role, TextChannel, Client } from 'discord.js';
import { DB } from '../../config';

jest.mock('@root/config', () => ({
  DB: { COURSES: 'courses' },
  GUILDS: { MAIN: 'main-guild-id' },
  ROLES: { ADMIN: 'admin-role-id', MUTED: 'muted-role-id' }
}));

jest.mock('@lib/utils/generalUtils', () => ({
  updateDropdowns: jest.fn()
}));

describe('Create Course Command Test', () => {
  let command: CreateCourseCommand;
  let interaction: jest.Mocked<ChatInputCommandInteraction>;
  let interaction2: jest.Mocked<ChatInputCommandInteraction>;
  let mockGuild: jest.Mocked<Guild>;
  let mockMongo: any;

  beforeEach(() => {
    mockMongo = {
      collection: jest.fn().mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(0),
        insertOne: jest.fn().mockResolvedValue(undefined)
      })
    };

    mockGuild = {
      roles: {
        create: jest.fn().mockResolvedValue({ id: 'role-id' } as Role)
      },
      channels: {
        create: jest.fn().mockImplementation(({ name }) =>
          Promise.resolve({ id: `${name}-id` } as TextChannel)
        )
      }
    } as any;

    interaction = {
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      options: { getString: jest.fn().mockReturnValue('108') } as any,
      client: { mongo: mockMongo } as any,
      user: { username: 'testuser', id: '12345' },
      guild: mockGuild
    } as any;

	interaction2 = {
		reply: jest.fn().mockResolvedValue(undefined),
		editReply: jest.fn().mockResolvedValue(undefined),
		options: { getString: jest.fn().mockReturnValue('361') } as any,
		client: { mongo: mockMongo } as any,
		user: { username: 'testuser', id: '12346' },
		guild: mockGuild
	  } as any;
  
    command = new CreateCourseCommand();
  });

  test('Creates a new 108 course properly', async () => {
    await command.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('working'));
    expect(mockGuild.roles.create).toHaveBeenCalledTimes(2);
    expect(mockGuild.channels.create).toHaveBeenCalled();
    expect(mockMongo.collection).toHaveBeenCalledWith('courses');
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Successfully added course'));
  });


  test('Creates a new 361 course properly', async () => {
    await command.run(interaction2);

    expect(interaction2.reply).toHaveBeenCalledWith(expect.stringContaining('working'));
    expect(mockGuild.roles.create).toHaveBeenCalledTimes(2);
    expect(mockGuild.channels.create).toHaveBeenCalled();
    expect(mockMongo.collection).toHaveBeenCalledWith('courses');
    expect(interaction2.editReply).toHaveBeenCalledWith(expect.stringContaining('Successfully added course'));
  });

});
