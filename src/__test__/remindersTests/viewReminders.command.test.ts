import ViewRemindersCommand from "../../commands/reminders/viewreminders";
import { reminderTime } from "@root/src/lib/utils/generalUtils";
jest.mock("@root/src/lib/utils/generalUtils");

describe("ViewRemindersCommand", () => {
	let cmd: ViewRemindersCommand, mockInt: any, coll: any;
	const mockTime = reminderTime as jest.MockedFunction<typeof reminderTime>;

	beforeEach(() => {
		cmd = new ViewRemindersCommand();
		coll = { find: jest.fn().mockReturnThis(), toArray: jest.fn() };
		mockInt = {
			user: { id: "u1" },
			client: { mongo: { collection: () => coll } },
			reply: jest.fn(),
		};
	});

	it("shows message when no reminders", async () => {
		coll.toArray.mockResolvedValue([]);
		await cmd.run(mockInt);
		expect(mockInt.reply).toHaveBeenCalledWith(
			expect.objectContaining({ ephemeral: true })
		);
	});

	it("displays reminders sorted by date", async () => {
		const rems = [
			{
				content: "Later",
				mode: "public",
				expires: new Date("2025-10-25"),
			},
			{
				content: "Soon",
				mode: "public",
				expires: new Date("2025-10-20"),
			},
		];
		mockTime.mockReturnValue("some time");
		coll.toArray.mockResolvedValue(rems);

		await cmd.run(mockInt);
		const reply = mockInt.reply.mock.calls[0][0];
		expect(reply.embeds[0].data.fields[0].name).toContain("Soon");
	});
});