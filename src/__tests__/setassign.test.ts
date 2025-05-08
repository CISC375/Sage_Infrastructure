import AssignableRoleCommand from '../../src/commands/admin/setassign';
import { ChatInputCommandInteraction, Role, Guild } from 'discord.js';
import { updateDropdowns } from '../../src/lib/utils/generalUtils';
import { DB, ROLES } from '../../config';

jest.mock('@root/config', () => ({
	DB: { ASSIGNABLE: 'assignable_roles' },
	ROLES: {
		STAFF: 'staff-role-id',
		ADMIN: 'admin-role-id', // if needed
		MUTED: 'muted-role-id' // if needed
	}
}));

jest.mock('@root/src/lib/utils/generalUtils', () => ({
	updateDropdowns: jest.fn()
}));

describe('Assignable Role Command', () => {
	let command: AssignableRoleCommand;
	let interaction: jest.Mocked<ChatInputCommandInteraction>;
	let mockGuild: jest.Mocked<Guild>;
	let mockMongo: any;
	let mockRole: Role;

	beforeEach(() => {
		mockRole = {
			id: 'role-id',
			name: 'Test Role',
			toString: () => `<@&role-id>`
		} as any;

		mockMongo = {
			collection: jest.fn().mockReturnValue({
				countDocuments: jest.fn(),
				insertOne: jest.fn(),
				findOneAndDelete: jest.fn()
			})
		};

		mockGuild = {
			roles: {
				fetch: jest.fn().mockResolvedValue(mockRole)
			}
		} as any;

		interaction = {
			reply: jest.fn().mockResolvedValue(undefined),
			editReply: jest.fn().mockResolvedValue(undefined),
			options: {
				getRole: jest.fn().mockReturnValue({ id: 'role-id' })
			} as any,
			client: {
				mongo: mockMongo
			} as any,
			guild: mockGuild
		} as any;

		command = new AssignableRoleCommand();
	});

	test('Adds a new assignable role', async () => {
		mockMongo.collection().countDocuments.mockResolvedValue(0);

		await command.run(interaction);

		expect(interaction.reply).toHaveBeenCalledWith('Adding role...');
		expect(mockMongo.collection().insertOne).toHaveBeenCalledWith({ id: 'role-id' });
		expect(updateDropdowns).toHaveBeenCalledWith(interaction);
		expect(interaction.editReply).toHaveBeenCalledWith('The role `Test Role` has been added.');
	});

	test('Removes an existing assignable role', async () => {
		mockMongo.collection().countDocuments.mockResolvedValue(1);

		await command.run(interaction);

		expect(interaction.reply).toHaveBeenCalledWith('Removing role...');
		expect(mockMongo.collection().findOneAndDelete).toHaveBeenCalledWith({ id: 'role-id' });
		expect(updateDropdowns).toHaveBeenCalledWith(interaction);
		expect(interaction.editReply).toHaveBeenCalledWith('The role `Test Role` has been removed.');
	});

	test('Throws if role not found in guild', async () => {
		mockGuild.roles.fetch = jest.fn().mockResolvedValue(null);

		await expect(command.run(interaction)).rejects.toThrow();
	});

	test('Throws if getRole returns null', async () => {
		interaction.options.getRole = jest.fn().mockReturnValue(null);

		await expect(command.run(interaction)).rejects.toThrow();
	});

	test('Throws if MongoDB fails during countDocuments', async () => {
		mockMongo.collection().countDocuments.mockRejectedValue(new Error('Database failure'));

		await expect(command.run(interaction)).rejects.toThrow('Database failure');
	});
});
