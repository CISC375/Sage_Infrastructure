import { ChatInputCommandInteraction, codeBlock } from 'discord.js';
import DisableCommand from '../../../commands/admin/disable';
import { Command } from '@lib/types/Command';
import { SageData } from '@lib/types/SageData';

// --- FIX: Step 1 ---
// Import the actual function you intend to mock
import { getCommand } from '@root/src/lib/utils/generalUtils';

// --- MOCK SETUP: Dependencies ---

// 1. Mock DB and Permissions for config dependencies
jest.mock('@root/config', () => ({
    DB: { CLIENT_DATA: 'clientData' }, // MongoDB collection name
    ROLES: { VERIFIED: 'verified_role_id' }, // add minimal ROLES to satisfy base Command
}));
jest.mock('@lib/permissions', () => ({
    BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }],
}));

// --- FIX: Step 2 ---
// 2. Mock the *entire module*
// Jest will automatically find 'getCommand' and replace it with a jest.fn()
jest.mock('@root/src/lib/utils/generalUtils');

// --- FIX: Step 3 ---
// Create your variable and assign the *mocked* import to it.
// This gives you a typed reference to Jest's auto-mock.
const mockGetCommand = getCommand as jest.Mock;


// --- MOCK SETUP: Constants ---

const MOCK_CLIENT_USER_ID = '000000000000000001';
const MOCK_COMMAND_INPUT = 'testcmd';
const MOCK_COMMAND_NAME = 'testcmd';
const MOCK_DISABLED_COMMAND_NAME = 'alreadyoff';

// Dummmy command objects
const mockEnabledCommand: any = { name: MOCK_COMMAND_NAME, enabled: true };
const mockDisabledCommand: any = { name: MOCK_DISABLED_COMMAND_NAME, enabled: false };
const mockProtectedCommand: any = { name: 'enable', enabled: true };

// Dummy initial data from MongoDB
const mockInitialSettings: SageData & { _id: string } = {
    _id: MOCK_CLIENT_USER_ID,
    status: { type: 0, name: 'Testing Status' } as any, 
    commandSettings: [
        { name: MOCK_COMMAND_NAME, enabled: true },
        { name: MOCK_DISABLED_COMMAND_NAME, enabled: false },
        { name: 'othercmd', enabled: true },
    ]
};

let mockInteraction: ChatInputCommandInteraction;
let command: Command;
let mockCommandsMap: Map<string, any>;
let mockFindOne: jest.Mock;
let mockUpdateOne: jest.Mock;

beforeEach(() => {
    // Reset mock behavior before each test
    mockGetCommand.mockClear(); 

    // Initialize interaction object
    mockCommandsMap = new Map();
    mockCommandsMap.set(MOCK_COMMAND_NAME, { ...mockEnabledCommand });
    mockCommandsMap.set(MOCK_DISABLED_COMMAND_NAME, { ...mockDisabledCommand });
    mockCommandsMap.set('enable', { ...mockProtectedCommand });
    mockCommandsMap.set('disable', { name: 'disable', enabled: true });

    mockFindOne = jest.fn().mockResolvedValue({ ...mockInitialSettings });
    mockUpdateOne = jest.fn().mockResolvedValue({});

    mockInteraction = {
        options: {
            getString: jest.fn().mockReturnValue(MOCK_COMMAND_INPUT),
        },
        reply: jest.fn(),
        client: {
            // Mock the command map and MongoDB client
            commands: mockCommandsMap,
            mongo: {
                collection: jest.fn(() => ({
                    findOne: mockFindOne,
                    updateOne: mockUpdateOne,
                })),
            },
            user: { id: MOCK_CLIENT_USER_ID }
        }
    } as unknown as ChatInputCommandInteraction;

    // Initialize command instance
    command = new DisableCommand();
});

// --- TESTS ---

describe('Disable Command', () => {

    test('should successfully disable an enabled command and update DB', async () => {
        // Setup: return an enabled command
        (mockInteraction.options.getString as jest.Mock).mockReturnValue(MOCK_COMMAND_INPUT);
        mockGetCommand.mockReturnValue(mockEnabledCommand);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: Command's enabled property changed in memory
        expect(mockEnabledCommand.enabled).toBe(false);
        // Assertion 2: Command map was updated
        expect(mockCommandsMap.get(MOCK_COMMAND_NAME).enabled).toBe(false);

        // Assertion 3: MongoDB was updated
        expect(mockUpdateOne).toHaveBeenCalledTimes(1);

        // Assertion 4: DB update object verification
        const expectedUpdatedSettings = [...mockInitialSettings.commandSettings];
        expectedUpdatedSettings[0] = { name: MOCK_COMMAND_NAME, enabled: false }; // testcmd becomes false

        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: MOCK_CLIENT_USER_ID },
            { $set: { commandSettings: expectedUpdatedSettings } },
            { upsert: true }
        );

        // Assertion 5: Replied with success message
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            codeBlock('diff', `->>> ${MOCK_COMMAND_NAME} Disabled`)
        );
    });

    // --- Failure Paths (Early Returns) ---

    test('should reply with an error if command is not found', async () => {
        const missingCmd = 'nonexistent';
        // Setup: return a non-existent command name, getCommand returns null
        (mockInteraction.options.getString as jest.Mock).mockReturnValue(missingCmd);
        mockGetCommand.mockReturnValue(null);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: Replied with error message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: `I couldn't find a command called \`${missingCmd}\``,
            ephemeral: true
        });

        // Assertion 2: No DB operation was performed
        expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    test('should reply with an error if command is already disabled', async () => {
        // Setup: return an already disabled command
        (mockInteraction.options.getString as jest.Mock).mockReturnValue(MOCK_DISABLED_COMMAND_NAME);
        mockGetCommand.mockReturnValue(mockDisabledCommand);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: Replied with error message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: `${MOCK_DISABLED_COMMAND_NAME} is already disabled.`,
            ephemeral: true
        });

        // Assertion 2: No DB operation was performed
        expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    test('should reply with an error if trying to disable "enable" command', async () => {
        // Setup: return the protected command (enable)
        (mockInteraction.options.getString as jest.Mock).mockReturnValue('enable');
        mockGetCommand.mockReturnValue(mockProtectedCommand);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: Replied with protected error message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: "Sorry fam, you can't disable that one.",
            ephemeral: true
        });

        // Assertion 2: No DB operation was performed
        expect(mockUpdateOne).not.toHaveBeenCalled();
    });
});