const whois = require("../../commands/staff/whois").default;

describe("whois command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new whois();
	});

	test("successfully replies with user info", async () => {
		const mockReplyResult = { mocked:true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockGetUser = jest.fn().mockReturnValue({ user: {id: "1234567890", username: "VerifiedUser"}});
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({ 
						member: {
							roles:{
								cache: {
									filter: jest.fn().mockReturnValue({sort: jest.fn(function() {return this}), values: [{name: "King", id: "4232", guild: {id: 4444}}, {name: "Member", id: "4511", guild: {id: 4444}}, {name: "Admin", id: "6789", guild: {id: 4444} }]}), 
									size: 5
								}
							},
							displayName: "VerifiedUser",
							id: "1234567890",
							joinedAt: new Date("2022-01-01T00:00:00Z"),
							user: {id: "1234567890", username: "VerifiedUser", createdAt: new Date("2021-01-01T00:00:00Z")}
						}
					})
				}
			}
		}
		const result = await cmd.run(interaction);
		expect(mockReply).toHaveBeenCalledTimes(1);
		
		const callArg = mockReply.mock.calls[0][0];
		expect(Array.isArray(callArg.embeds)).toBe(true);
		expect(callArg.embeds).toHaveLength(1);
		const embed = callArg.embeds[0];
		expect(embed.author.name).toBe("VerifiedUser");
		expect(embed.fields).toBe([
				{ name: 'Display Name', value: `VerifiedUser (<@1234567890>)`, inline: true },
				{ name: 'Account Created', value: "", inline: true },
				{ name: 'Joined Server', value: "", inline: true },
				{ name: 'Roles', value: "", inline: true }
			]);
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetUser = jest.fn().mockReturnValue("user");
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({ 
						user: {id: "1234567890", username: "VerifiedUser", createdAt: new Date("2021-01-01T00:00:00Z")}
					}),
					member: {
						roles:{
							cache: {
								get: jest.fn().mockReturnValue({name: "Member"})
							}
						},
						displayName: "VerifiedUser",
						id: "1234567890",
						joinedAt: new Date("2022-01-01T00:00:00Z"),
						cache: { size: 5, filter: jest.fn().mockReturnValue({ size: 4 })}
					}
				}
			}
		}
		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
	});

});