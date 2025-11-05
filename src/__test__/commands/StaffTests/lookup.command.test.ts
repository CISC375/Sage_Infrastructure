const lookup = require("../../../commands/staff/lookup").default;

describe("lookup Command", () => {
	let cmd;

	beforeEach(() => {
		cmd = new lookup();
	});

	describe("With verified user", () => {
		test("calls reply with correct embed and user allows shared data", async () => {
			const mockReplyResult = { mocked: true };
			const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
			const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "VerifiedUser", avatarURL: () => "http://avatar.url/image.png"});

			const interaction = {
				reply: mockReply,
				options: { getUser: mockGetUser },
				client: {mongo: {
					collection: jest.fn().mockReturnValue({
						findOne: jest.fn().mockResolvedValueOnce({
								discordId: "1234567890", tag: "VerifiedUser", pii: true, count: 42, email: "vUser@udel.edu"
						}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
					},)
				}},
				guild: {
					members: {
						fetch: jest.fn().mockResolvedValueOnce({
							id: "1234567890", displayName: "VerifiedUser"
						})
					}
				},
				// Sender info
				user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" }
			};
			const result = await cmd.run(interaction);

			// reply was called once
			expect(mockReply).toHaveBeenCalledTimes(1);
			// reply called with proper argument shape
			const callArg = mockReply.mock.calls[0][0];
			//expect(callArg.content).toBe(undefined); //test line
			expect(Array.isArray(callArg.embeds)).toBe(true);
			expect(callArg.embeds).toHaveLength(1);
			// Check embed content
			const embed = callArg.embeds[0].data;
			expect(embed.title).toBe("Looking Up:	VerifiedUser");
			expect(embed.color).toBe(5763719); // Green
			expect(embed.thumbnail.url).toBe("http://avatar.url/image.png");
			expect(embed.footer.text).toBe("Member ID: 1234567890");
			expect(embed.fields).toEqual([
				{ name: 'Display Name', value: `<@1234567890>`, inline: true },
				{ name: 'Username', value: `VerifiedUser`, inline: false },
				{ name: 'UD Email:', value: 'vUser@udel.edu', inline: false },
				{ name: 'Message count: ', value: `This week: 42`, inline: false },
			]);
			// run should resolve to whatever reply resolves to
			expect(result).toBe(mockReplyResult);
		});

		test("user disallows shared data", async () => {
			const mockReplyResult = { mocked: true };
			const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
			const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "VerifiedUser", avatarURL: () => "http://avatar.url/image.png" });
			const interaction = {
				reply: mockReply,
				options: { getUser: mockGetUser },
				client: {mongo: {
					collection: jest.fn().mockReturnValue({
						findOne: jest.fn().mockResolvedValueOnce({
								discordId: "1234567890", tag: "VerifiedUser", pii: false, count: 42, email: "vUser@udel.edu"
						}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
					},)
				}},
				guild: {
					members: {
						fetch: jest.fn().mockResolvedValueOnce({
							id: "1234567890", displayName: "VerifiedUser"
						})
					}
				},
				// Sender info
				user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" }
			};
			const result = await cmd.run(interaction);
			// reply was called once
			expect(mockReply).toHaveBeenCalledTimes(1);
			// reply called with proper argument shape
			const callArg = mockReply.mock.calls[0][0];
			expect(callArg.content).toBe("\`VerifiedUser\` has not opted to have their information shared over Discord.\nInstead, an email has been sent to you containing the requested data.");
			// run should resolve to whatever reply resolves to
			expect(result).toBe(mockReplyResult);
		});
	});

	test("With unverified user, calls reply with correct content", async () => {
		const mockReplyResult = { mocked: true };
		const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
		const mockGetUser = jest.fn().mockReturnValue({ id: "0987654321", tag: "UnverifiedUser", avatarURL: () => "http://avatar.url/image.png" });
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({discordId: "5987654322", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
				},)
			}},
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({
						id: "0985555321", displayName: "UnverifiedUser"
					})
				}
			},
			// Sender info
			user: { id: "5987654322", tag: "SenderUser", email: "sender@udel.edu" }
		};
		const result = await cmd.run(interaction);
		// reply was called once
		expect(mockReply).toHaveBeenCalledTimes(1);
		// reply called with proper argument shape
		const callArg = mockReply.mock.calls[0][0];
		expect(callArg.content).toBe("User UnverifiedUser has not verified.");
		// run should resolve to whatever reply resolves to
		expect(result).toBe(mockReplyResult);
	});

	test("propagates errors from interaction.reply", async () => {
		const err = new Error("reply failed");
		const mockReply = jest.fn().mockRejectedValue(err);
		const mockGetUser = jest.fn().mockReturnValue({ id: "1234567890", tag: "ErrorUser", avatarURL: () => "http://avatar.url/image.png" });
		const interaction = {
			reply: mockReply,
			options: { getUser: mockGetUser },
			client: {mongo: {
				collection: jest.fn().mockReturnValue({
					findOne: jest.fn().mockResolvedValueOnce({
							discordId: "1234567890", tag: "ErrorUser", pii: true, count: 22, email: "eUser@udel.edu"
					}).mockResolvedValueOnce({discordId: "0987654321", tag: "SenderUser", pii: true, count: 21, email: "sender@udel.edu"})
				},)
			}},
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValueOnce({
						id: "1234567890", displayName: "ErrorUser" 
					})
				}
			},
			// Sender info
			user: { id: "0987654321", tag: "SenderUser", email: "sender@udel.edu" }
		};
		await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
		expect(mockReply).toHaveBeenCalledTimes(1);
	});
});