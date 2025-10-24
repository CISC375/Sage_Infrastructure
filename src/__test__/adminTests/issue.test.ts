import { ChatInputCommandInteraction } from 'discord.js';
import IssueCommand from '../../commands/admin/issue';

// Mock config and permissions
jest.mock('@root/config', () => ({
  BOT: { NAME: 'TestBot' },
  GITHUB_PROJECT: 'test-repo',
  ROLES: { VERIFIED: 'verified_role_id' },
}));

jest.mock('@lib/permissions', () => ({
  ADMIN_PERMS: { id: 'admin_role_id', permission: true, type: 1 },
}));

describe('Admin Issue Command', () => {
  let command: IssueCommand;
  let interaction: ChatInputCommandInteraction;

  const mockCreate = jest.fn();
  const mockGetString = jest.fn();
  const mockReply = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    command = new (IssueCommand as any)();

    mockCreate.mockReset();
    mockGetString.mockReset();
    mockReply.mockReset();

    interaction = {
      options: { getString: mockGetString } as any,
      reply: mockReply as any,
      user: { username: 'Tester' } as any,
      client: { octokit: { issues: { create: mockCreate } } } as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('creates a GitHub issue successfully and replies with the URL', async () => {
    const title = 'Bug: something is wrong';
    const labelsStr = 'bug, urgent';

    mockGetString.mockImplementation((name: string) => {
      if (name === 'title') return title;
      if (name === 'labels') return labelsStr;
      if (name === 'body') return null; // omitted
      return null;
    });

    const issueUrl = 'https://github.com/ud-cis-discord/test-repo/issues/1';
    mockCreate.mockResolvedValue({ data: { html_url: issueUrl } });

    await command.run(interaction);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0];
    expect(arg).toMatchObject({ owner: 'ud-cis-discord', repo: 'test-repo', title, labels: ['bug', 'urgent'] });
    expect(typeof arg.body).toBe('string');
    expect(arg.body).toContain('Created by Tester via TestBot');

    expect(mockReply).toHaveBeenCalledWith(`I've created your issue at <${issueUrl}>`);
  });

  it('replies with error details then generic failure on GitHub error', async () => {
    mockGetString.mockImplementation((name: string) => {
      if (name === 'title') return 'Failing Issue';
      if (name === 'labels') return 'bug';
      if (name === 'body') return 'Description';
      return null;
    });

    const errorResponse: any = {
      status: 422,
      errors: [
        { code: 'invalid', field: 'title' },
        { code: 'missing', field: 'body' },
      ],
    };
    mockCreate.mockRejectedValue(errorResponse);

    await command.run(interaction);

    expect(mockReply).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ content: expect.stringContaining('Issue creation failed. (HTTP Error 422)'), ephemeral: true })
    );

    expect(mockReply).toHaveBeenNthCalledWith(2, 'Something went horribly wrong with issue creation! Blame Josh.');
  });
});
