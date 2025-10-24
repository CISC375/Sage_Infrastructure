import { ChatInputCommandInteraction, codeBlock } from 'discord.js';
import EnableCommand from '../../commands/admin/enable';
import { Command } from '@lib/types/Command';
import { SageData } from '@lib/types/SageData';

// Mock DB and Permissions for config dependencies
jest.mock('@root/config', () => ({
  DB: { CLIENT_DATA: 'clientData' },
  ROLES: { VERIFIED: 'verified_role_id' },
}));

jest.mock('@lib/permissions', () => ({
  BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }],
}));

// Mock getCommand from generalUtils
import { getCommand } from '@root/src/lib/utils/generalUtils';
jest.mock('@root/src/lib/utils/generalUtils');
const mockGetCommand = getCommand as jest.Mock;

// --- Constants & Helpers ---
const MOCK_CLIENT_USER_ID = '000000000000000001';
const MOCK_COMMAND_INPUT = 'testcmd';
const MOCK_COMMAND_NAME = 'testcmd';
const MOCK_ALREADY_ENABLED = 'alreadyon';

const mockDisabledCommand: any = { name: MOCK_COMMAND_NAME, enabled: false };
const mockEnabledCommand: any = { name: MOCK_ALREADY_ENABLED, enabled: true };

const mockInitialSettings: SageData & { _id: string } = {
  _id: MOCK_CLIENT_USER_ID,
  status: { type: 0, name: 'Testing Status' } as any,
  commandSettings: [
    { name: MOCK_COMMAND_NAME, enabled: false },
    { name: MOCK_ALREADY_ENABLED, enabled: true },
    { name: 'othercmd', enabled: true },
  ],
};

let mockInteraction: ChatInputCommandInteraction;
let command: Command;
let mockCommandsMap: Map<string, any>;
let mockFindOne: jest.Mock;
let mockUpdateOne: jest.Mock;

beforeEach(() => {
  mockGetCommand.mockClear();

  mockCommandsMap = new Map();
  mockCommandsMap.set(MOCK_COMMAND_NAME, { ...mockDisabledCommand });
  mockCommandsMap.set(MOCK_ALREADY_ENABLED, { ...mockEnabledCommand });
  mockCommandsMap.set('enable', { name: 'enable', enabled: true });
  mockCommandsMap.set('disable', { name: 'disable', enabled: true });

  mockFindOne = jest.fn().mockResolvedValue({ ...mockInitialSettings });
  mockUpdateOne = jest.fn().mockResolvedValue({});

  mockInteraction = {
    options: {
      getString: jest.fn().mockReturnValue(MOCK_COMMAND_INPUT),
    },
    reply: jest.fn(),
    client: {
      commands: mockCommandsMap,
      mongo: {
        collection: jest.fn(() => ({
          findOne: mockFindOne,
          updateOne: mockUpdateOne,
        })),
      },
      user: { id: MOCK_CLIENT_USER_ID },
    },
  } as unknown as ChatInputCommandInteraction;

  command = new (EnableCommand as any)();
});

// --- TESTS ---

describe('Enable Command', () => {
  test('enables a disabled command and updates DB', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue(MOCK_COMMAND_INPUT);
    mockGetCommand.mockReturnValue(mockDisabledCommand);

    await command.run(mockInteraction);

    // Command flipped to enabled in memory
    expect(mockDisabledCommand.enabled).toBe(true);
    expect(mockCommandsMap.get(MOCK_COMMAND_NAME).enabled).toBe(true);

    // DB updated correctly
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const expectedUpdatedSettings = [...mockInitialSettings.commandSettings];
    expectedUpdatedSettings[0] = { name: MOCK_COMMAND_NAME, enabled: true };
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: MOCK_CLIENT_USER_ID },
      { $set: { commandSettings: expectedUpdatedSettings } },
      { upsert: true }
    );

    // Success reply
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      codeBlock('diff', `+>>> ${MOCK_COMMAND_NAME} Enabled`)
    );
  });

  test('replies with an error if command is not found', async () => {
    const missingCmd = 'nonexistent';
    (mockInteraction.options.getString as jest.Mock).mockReturnValue(missingCmd);
    mockGetCommand.mockReturnValue(null);

    await command.run(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `I couldn't find a command called \`${missingCmd}\``,
      ephemeral: true,
    });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  test('replies with an error if command is already enabled', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue(MOCK_ALREADY_ENABLED);
    mockGetCommand.mockReturnValue(mockEnabledCommand);

    await command.run(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: `${MOCK_ALREADY_ENABLED} is already enabled.`,
      ephemeral: true,
    });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});
