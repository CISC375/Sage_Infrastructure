const mute = require("../../commands/staff/mute").default;
<<<<<<< HEAD
import { MAINTAINERS, ROLES } from '@root/config';
=======
>>>>>>> 35bb007c9c57d52ae04e06953b86aff4b93f5f2e

describe("mute command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new mute();
	});

	describe("muting or unmuting a member", () => {
		test("successfully mutes a member", async () => {
			const mockReplyResult = { mocked: true };
			const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
			const mockGetUser = jest.fn().mockReturnValue('user');
			const interaction = {
				reply: mockReply,
				options: { getUser: mockGetUser },
				guild: {
					members: {
						fetch: jest.fn().mockResolvedValueOnce({id: "1234567890", displayName: "MutedUser", roles: {cache: { has: jest.fn().mockReturnValue(false)}, add: jest.fn().mockReturnValue(true), remove: jest.fn().mockReturnValue(true)}, user: {username:"MutedUser"}, send: jest.fn().mockResolvedValue(true) })
					}
				},
				user: { id: "0987654321", tag: "SenderUser"}
			};
			const result = await cmd.run(interaction);
			// reply was called once
			expect(mockReply).toHaveBeenCalledTimes(1);
			const callArg = mockReply.mock.calls[0][0];
			expect(callArg.content).toMatch("MutedUser has been muted.");
		});

		test("successfully unmutes a member", async () => {
			const mockReplyResult = { mocked: true };
			const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
			const mockGetUser = jest.fn().mockReturnValue('user');
			const interaction = {
				reply: mockReply,
				options: { getUser: mockGetUser },
				guild: {
					members: {
						fetch: jest.fn().mockResolvedValueOnce({id: "1234567890", displayName: "unmutedUser", roles: {cache: { has: jest.fn().mockReturnValue(true)}, add: jest.fn().mockReturnValue(true), remove: jest.fn().mockReturnValue(true) }, user: {username:"unmutedUser"}, send: jest.fn().mockResolvedValue(true)})
					}
				},
				user: { id: "0987654321", tag: "SenderUser"}
			};
			const result = await cmd.run(interaction);
			// reply was called once
			expect(mockReply).toHaveBeenCalledTimes(1);
			const callArg = mockReply.mock.calls[0][0];
			expect(callArg.content).toMatch(`unmutedUser has been un-muted.`);
		});
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("Test error");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetUser = jest.fn().mockReturnValue('user');
		const interaction = {
			reply: mockReply,
<<<<<<< HEAD
			options: { getUser: mockGetUser },
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({id: "1234567890", displayName: "MutedUser", roles: {cache: { has: jest.fn().mockReturnValue(false)}, add: jest.fn().mockReturnValue(true), remove: jest.fn().mockReturnValue(true)}, user: {username:"unmutedUser"}, send: jest.fn().mockResolvedValue(true) })
				}
			},
			user: { id: "0987654321", tag: "SenderUser"}
=======
			options: { 
				getUser: mockGetUser 
			},
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce(
						{
							id: "1234567890", 
							displayName: "MutedUser", 
							roles: {
								cache: {
									 has: jest.fn().mockReturnValue(false) 
								},
								add: jest.fn().mockReturnValue(true), 
								remove: jest.fn().mockReturnValue(true)
							}, 
							user: {
								username:"unmutedUser"
							},
							send: jest.fn().mockResolvedValue(true) 
						}
					)
				}
			},
			user: { 
				id: "0987654321", 
				tag: "SenderUser"
			}
>>>>>>> 35bb007c9c57d52ae04e06953b86aff4b93f5f2e
		};
		await expect(cmd.run(interaction)).rejects.toThrow("Test error");
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
	});

});