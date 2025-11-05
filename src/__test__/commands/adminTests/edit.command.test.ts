// Jest tests for admin/edit command
import { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import EditCommand from '../../../commands/admin/edit';

jest.mock('@root/config', () => ({
  BOT: { NAME: 'TestBot' },
  ROLES: { VERIFIED: 'verified_role_id' },
}));

jest.mock('@lib/permissions', () => ({
  BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }],
}));

const mockGetString = jest.fn();
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockShowModal = jest.fn().mockResolvedValue(undefined);
const mockFetchChannel = jest.fn();
const mockFetchMessage = jest.fn();

const makeMessage = (editable: boolean, id = '112233', channelId = '67890') => ({
  editable,
  id,
  channelId,
});

const mockClient = { channels: { fetch: mockFetchChannel } };

describe('Admin Edit Command', () => {
  let command: any;
  let interaction: ChatInputCommandInteraction;

  beforeEach(() => {
    command = new (EditCommand as any)();

    mockGetString.mockClear();
    mockReply.mockClear();
    mockShowModal.mockClear();
    mockFetchChannel.mockClear();
    mockFetchMessage.mockClear();

    mockFetchChannel.mockImplementation(async () => ({
      messages: { fetch: mockFetchMessage },
    }) as unknown as TextChannel);

    interaction = {
      client: mockClient as any,
      options: { getString: mockGetString } as any,
      reply: mockReply as any,
      showModal: mockShowModal as any,
    } as unknown as ChatInputCommandInteraction;
  });

  it('opens a modal for a valid link', async () => {
    const link = 'https://discord.com/channels/12345/67890/112233';
    mockGetString.mockImplementation((name: string) => (name === 'msg_link' ? link : null));
    mockFetchMessage.mockResolvedValue(makeMessage(true));

    await command.run(interaction);

    expect(mockFetchChannel).toHaveBeenCalledWith('67890');
    expect(mockFetchMessage).toHaveBeenCalledWith('112233');
    expect(mockShowModal).toHaveBeenCalledTimes(1);
  });
});
