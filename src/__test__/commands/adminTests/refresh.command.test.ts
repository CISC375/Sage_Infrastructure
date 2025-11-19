import { ChatInputCommandInteraction } from 'discord.js';
import RefreshCommand from '../../../commands/admin/refresh';

// Mocks for modules used by the command
jest.mock('@root/config', () => ({
  BOT: { NAME: 'TestBot' },
  ROLES: { VERIFIED: 'verified_role_id' },
}));

jest.mock('@root/src/lib/permissions', () => ({
  BOTMASTER_PERMS: [],
}));

import { readdirRecursive } from '@root/src/lib/utils/generalUtils';
jest.mock('@root/src/lib/utils/generalUtils', () => ({
  readdirRecursive: jest.fn(),
}));

describe('Admin Refresh Command', () => {
  let command: RefreshCommand;
  let interaction: ChatInputCommandInteraction;

  const mockDeferReply = jest.fn().mockResolvedValue(undefined);
  const mockFollowUp = jest.fn().mockResolvedValue(undefined);
  const mockChannelSend = jest.fn().mockResolvedValue({});
  const mockGuildCommandsSet = jest.fn().mockResolvedValue(undefined);
  const mockSetActivity = jest.fn();
  const mockClientDestroy = jest.fn();

  beforeEach(() => {
    command = new (RefreshCommand as any)();

    mockDeferReply.mockClear();
    mockFollowUp.mockClear();
    mockChannelSend.mockClear();
    mockGuildCommandsSet.mockClear();
    mockSetActivity.mockClear();
    mockClientDestroy.mockClear();

    (readdirRecursive as jest.Mock).mockReset();

    interaction = {
      deferReply: mockDeferReply as any,
      followUp: mockFollowUp as any,
      channel: { send: mockChannelSend } as any,
      guild: { commands: { set: mockGuildCommandsSet } } as any,
      client: { user: { setActivity: mockSetActivity }, destroy: mockClientDestroy } as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('refreshes with no discovered commands and triggers restart flow', async () => {
    (readdirRecursive as jest.Mock).mockReturnValue([]);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    await command.run(interaction);

    expect(mockDeferReply).toHaveBeenCalled();

    // Sent clearing and setting messages
    expect(mockChannelSend).toHaveBeenNthCalledWith(1, "Clearing TestBot's commands...");
    expect(mockGuildCommandsSet).toHaveBeenNthCalledWith(1, []);
    expect(mockChannelSend).toHaveBeenNthCalledWith(2, "Setting TestBot's commands...");
    expect(mockGuildCommandsSet).toHaveBeenNthCalledWith(2, []);

    // Follow up and set activity
    expect(mockFollowUp).toHaveBeenCalledWith("Successfully refreshed TestBot's commands. Restarting...");
    expect(mockSetActivity).toHaveBeenCalledWith('Restarting...', expect.any(Object));

    // Restart message triggers destroy + exit
    expect(mockChannelSend).toHaveBeenNthCalledWith(3, 'Restarting TestBot');
    expect(mockClientDestroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
