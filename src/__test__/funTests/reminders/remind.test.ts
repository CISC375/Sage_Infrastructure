import RemindCommand from "../../../commands/reminders/remind";
import parse from "parse-duration";
import { reminderTime } from "@root/src/lib/utils/generalUtils";
jest.mock("parse-duration");
jest.mock("@root/src/lib/utils/generalUtils");

describe("RemindCommand", () => {
	let cmd: RemindCommand, mockInt: any, coll: any;
	const mockParse = parse as jest.MockedFunction<typeof parse>;
	const mockTime = reminderTime as jest.MockedFunction<typeof reminderTime>;

	beforeEach(() => {
		cmd = new RemindCommand();
		coll = { insertOne: jest.fn() };
		mockInt = {
			options: { getString: jest.fn() },
			user: { id: "u1" },
			client: { mongo: { collection: () => coll } },
			reply: jest.fn(),
		};
	});

	it("creates a valid reminder", async () => {
		mockInt.options.getString
			.mockReturnValueOnce("Do thing")
			.mockReturnValueOnce("2h")
			.mockReturnValueOnce(null);
		mockParse.mockReturnValue(7200000);
		mockTime.mockReturnValue("10:00 PM");

		await cmd.run(mockInt);
		expect(coll.insertOne).toHaveBeenCalled();
		expect(mockInt.reply).toHaveBeenCalledWith(
			expect.objectContaining({ ephemeral: true })
		);
	});

	it("rejects invalid duration", async () => {
		mockInt.options.getString
			.mockReturnValueOnce("Bad")
			.mockReturnValueOnce("nonsense")
			.mockReturnValueOnce(null);
		mockParse.mockReturnValue(null);
		await cmd.run(mockInt);
		expect(coll.insertOne).not.toHaveBeenCalled();
		expect(mockInt.reply).toHaveBeenCalledWith(
			expect.objectContaining({ ephemeral: true })
		);
	});
});
