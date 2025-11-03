import SetAssignCommand from '../../commands/admin/setassign';
import { ChatInputCommandInteraction } from 'discord.js';

jest.mock('@root/config', () => ({ DB: { ASSIGNABLE: 'assignable' }, ROLES: { VERIFIED: 'verified_role_id' } }));
jest.mock('@lib/permissions', () => ({ ADMIN_PERMS: { id: 'admin_role_id', permission: true, type: 1 } }));
jest.mock('@root/src/lib/utils/generalUtils', () => ({ updateDropdowns: jest.fn() }));

describe('Admin SetAssign Command', () => {
  let command: SetAssignCommand;
  let interaction: ChatInputCommandInteraction;

  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockGetRole = jest.fn();
  const mockRolesFetch = jest.fn();

  // Mongo mocks
  const mockCountDocuments = jest.fn();
  const mockFindOneAndDelete = jest.fn();
  const mockInsertOne = jest.fn();
  const mockCollection = jest.fn(() => ({
    countDocuments: mockCountDocuments,
    findOneAndDelete: mockFindOneAndDelete,
    insertOne: mockInsertOne,
  }));

  beforeEach(() => {
    command = new (SetAssignCommand as any)();

    mockReply.mockClear();
    mockEditReply.mockClear();
    mockGetRole.mockClear();
    mockRolesFetch.mockClear();
    mockCountDocuments.mockClear();
    mockFindOneAndDelete.mockClear();
    mockInsertOne.mockClear();
    mockCollection.mockClear();

    interaction = {
      options: { getRole: mockGetRole } as any,
      guild: { roles: { fetch: mockRolesFetch } } as any,
      client: { mongo: { collection: mockCollection } } as any,
      reply: mockReply as any,
      editReply: mockEditReply as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('adds a role when not already assignable', async () => {
    // Input role from options
    const apiRole = { id: 'role-1' };
    mockGetRole.mockReturnValue(apiRole);

    // Fetched role object with name for messages
    mockRolesFetch.mockResolvedValue({ id: 'role-1', name: 'Cool Role' });

    // Not present in DB
    mockCountDocuments.mockResolvedValue(0);

    await command.run(interaction);

    expect(mockReply).toHaveBeenCalledWith('Adding role...');
    expect(mockInsertOne).toHaveBeenCalledWith({ id: 'role-1' });
    expect(mockEditReply).toHaveBeenCalledWith('The role `Cool Role` has been added.');
  });

  it('removes a role when already assignable', async () => {
    const apiRole = { id: 'role-2' };
    mockGetRole.mockReturnValue(apiRole);
    mockRolesFetch.mockResolvedValue({ id: 'role-2', name: 'Old Role' });

    mockCountDocuments.mockResolvedValue(1);

    await command.run(interaction);

    expect(mockReply).toHaveBeenCalledWith('Removing role...');
    expect(mockFindOneAndDelete).toHaveBeenCalledWith({ id: 'role-2' });
    expect(mockEditReply).toHaveBeenCalledWith('The role `Old Role` has been removed.');
  });
});
