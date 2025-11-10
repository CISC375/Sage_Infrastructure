import RestartCommand from '../../../commands/admin/restart';
import { ActivityType, ChatInputCommandInteraction } from 'discord.js';

jest.mock('@root/config', () => ({ BOT: { NAME: 'TestBot' }, ROLES: { VERIFIED: 'verified_role_id' } }));
jest.mock('@lib/permissions', () => ({ BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }] }));

describe('Admin Restart Command', () => {
  let command: RestartCommand;
  let interaction: ChatInputCommandInteraction;

  const mockSetActivity = jest.fn();
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockDestroy = jest.fn();

  beforeEach(() => {
    command = new (RestartCommand as any)();

    mockSetActivity.mockClear();
    mockReply.mockClear();
    mockDestroy.mockClear();

    interaction = {
      client: { user: { setActivity: mockSetActivity }, destroy: mockDestroy } as any,
      reply: mockReply as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('sets activity, replies, destroys client, and exits process', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    await command.run(interaction);

    // Allow promise microtasks to flush so the .then callback executes
    await Promise.resolve();

    expect(mockSetActivity).toHaveBeenCalledWith('Restarting...', { type: ActivityType.Playing });
    expect(mockReply).toHaveBeenCalledWith('Restarting TestBot');
    expect(mockDestroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
