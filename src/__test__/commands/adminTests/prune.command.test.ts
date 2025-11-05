import { ChatInputCommandInteraction } from 'discord.js';
import PruneCommand from '../../../commands/admin/prune';

// Mock required modules used by the command
jest.mock('@root/config', () => ({
  ROLES: { VERIFIED: 'verified_role_id' },
}));

jest.mock('@lib/permissions', () => ({
  BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }],
}));

describe('Admin Prune Command', () => {
  let command: PruneCommand;
  let interaction: ChatInputCommandInteraction;
  const mockReply = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    command = new (PruneCommand as any)();
    mockReply.mockClear();
    interaction = { reply: mockReply as any } as unknown as ChatInputCommandInteraction;
  });

  it('has runInDM set to false', () => {
    expect(command.runInDM).toBe(false);
  });

  it('replies with the placeholder message', async () => {
    await command.run(interaction);
    expect(mockReply).toHaveBeenCalledWith('To be implemented again soon...');
  });
});

