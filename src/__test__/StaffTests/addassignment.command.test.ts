const addassignment = require("../../commands/staff/addassignment").default;

describe("addassignment command", () => {
	let cmd;

	beforeEach(async () => {
		cmd = new addassignment();
	});

	describe("when adding assignments to a course", () => {
		test("correctly adds new assignments and identifies pre-existing ones", async () => {
			const mockUpdateOne = jest.fn().mockResolvedValue({});
			const mockFindOne = jest.fn().mockResolvedValue({
				name: "CS101",
				assignments: ["Assignment 1", "Assignment 2"]
			});
			const mockReplyResult = { mocked: true };
			const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
			const newAssignmentsInput = "Assignment 2 | Assignment 3 | Assignment 4";
			const interaction = {
				reply: mockReply,
				options: {
					getString: jest.fn().mockImplementation((name) => {
							if (name === "course") return "CS101";
							if (name === "newassignments") return newAssignmentsInput;
						}),
				},
				client: {
					mongo: {
						collection: jest.fn().mockImplementation((colName) => {
							if (colName === "courses") {
								return {
									findOne: mockFindOne,
									updateOne: mockUpdateOne
								};
							}
						})
					}
				}
			};
		});

		test("propagates errors from interaction.reply", async () => {
			const err = new Error("reply failed");
			const mockReply = jest.fn().mockRejectedValue(err);
			const interaction = {
				reply: mockReply,
				options: {
					getString: jest.fn().mockReturnValue("CS101 | Assignment 1"),
				},
				client: {
					mongo: {
						collection: jest.fn().mockReturnValue({
							findOne: jest.fn().mockResolvedValue({ name: "CS101", assignments: [] }),
							updateOne: jest.fn().mockResolvedValue({}),
						})
					}
				}
			};
			await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
			expect(mockReply).toHaveBeenCalledTimes(1);
		});
	});
});