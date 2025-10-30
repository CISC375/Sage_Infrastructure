import StatusCommand from '../../commands/admin/status';
import { ChatInputCommandInteraction } from 'discord.js';

jest.mock('@root/config', () => ({ BOT: { NAME: 'TestBot' }, ROLES: { VERIFIED: 'verified_role_id' } }));
jest.mock('@lib/permissions', () => ({ BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }] }));

describe('Admin Status Command', () => {
  let command: StatusCommand;
  let interaction: ChatInputCommandInteraction;

  const mockGetString = jest.fn();
  const mockSetStatus = jest.fn().mockResolvedValue(undefined);
  const mockReply = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    command = new (StatusCommand as any)();

    mockGetString.mockClear();
    mockSetStatus.mockClear();
    mockReply.mockClear();

    interaction = {
      options: { getString: mockGetString } as any,
      client: { user: { setStatus: mockSetStatus } } as any,
      reply: mockReply as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it("sets the bot's status and replies", async () => {
    mockGetString.mockReturnValue('idle');

    await command.run(interaction);

    expect(mockSetStatus).toHaveBeenCalledWith('idle');
    expect(mockReply).toHaveBeenCalledWith("Set TestBot's status to idle");
  });
});
