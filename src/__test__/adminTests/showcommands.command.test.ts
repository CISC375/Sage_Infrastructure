import ShowCommandsCommand from '../../commands/admin/showcommands';
import { ChatInputCommandInteraction, codeBlock } from 'discord.js';

jest.mock('@lib/permissions', () => ({ BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }] }));

describe('Admin ShowCommands Command', () => {
  let command: ShowCommandsCommand;
  let interaction: ChatInputCommandInteraction;
  const mockReply = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    command = new (ShowCommandsCommand as any)();
    mockReply.mockClear();

    const commandsMap = new Map<string, any>([
      ['alpha', { name: 'alpha', enabled: true }],
      ['beta', { name: 'beta', enabled: false }],
      ['gamma', { name: 'gamma', enabled: true }],
    ]);

    interaction = {
      client: { commands: commandsMap } as any,
      reply: mockReply as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('replies with a diff-styled list of enabled/disabled commands', async () => {
    await command.run(interaction);

    const expected = '+ Enabled\n- Disabled\n\n+ alpha\n- beta\n+ gamma';
    expect(mockReply).toHaveBeenCalledWith(codeBlock('diff', expected));
  });
});
