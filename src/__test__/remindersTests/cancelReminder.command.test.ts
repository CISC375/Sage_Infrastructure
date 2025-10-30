import CancelReminderCommand from "../../commands/reminders/cancelreminder";
import { ChatInputCommandInteraction } from "discord.js";

describe("CancelReminderCommand", () => {
	let cmd: CancelReminderCommand, mockInt: any, coll: any;

	beforeEach(() => {
		cmd = new CancelReminderCommand();
		coll = {
			find: jest.fn().mockReturnThis(),
			toArray: jest.fn(),
			findOneAndDelete: jest.fn(),
		};
		mockInt = {
			options: { getInteger: jest.fn() },
			user: { id: "u1" },
			client: { mongo: { collection: () => coll } },
			reply: jest.fn(),
		} as unknown as ChatInputCommandInteraction;
	});

	it("cancels correct reminder and replies properly", async () => {
		const reminders = [
			{
				owner: "u1",
				content: "A",
				mode: "public",
				expires: new Date("2025-01-01"),
			},
			{
				owner: "u1",
				content: "B",
				mode: "private",
				expires: new Date("2025-01-02"),
			},
		];
		coll.toArray.mockResolvedValue(reminders);
		mockInt.options.getInteger.mockReturnValue(2);

		await cmd.run(mockInt);
		expect(coll.findOneAndDelete).toHaveBeenCalledWith(reminders[1]);
		expect(mockInt.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringMatching("B") })
		);
	});

	it("handles invalid number gracefully", async () => {
		coll.toArray.mockResolvedValue([]);
		mockInt.options.getInteger.mockReturnValue(99);
		await cmd.run(mockInt);
		expect(mockInt.reply).toHaveBeenCalledWith(
			expect.objectContaining({ ephemeral: true })
		);
	});
});