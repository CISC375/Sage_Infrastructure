import TagQuestionCommand from "../../commands/question tagging/tagquestion";
import { generateErrorEmbed } from "../../../src/lib/utils/generalUtils";

// Mock the generateErrorEmbed since it creates Discord embeds
jest.mock("../../../src/lib/utils/generalUtils", () => ({
  generateErrorEmbed: jest.fn((msg: string) => ({ description: msg })),
}));

// Create a fake interaction object
function makeMockInteraction(overrides: Partial<any> = {}) {
  return {
    channel: overrides.channel || {},
    client: {
      mongo: {
        collection: jest.fn().mockReturnThis(),
        findOne: jest.fn(),
        insertOne: jest.fn(),
      },
      guilds: {
        cache: new Map([
          [
            "123",
            {
              channels: {
                cache: new Map([
                  [
                    "456",
                    {
                      messages: {
                        fetch: jest.fn().mockResolvedValue({
                          embeds: [], // ✅ added to prevent crash
                          cleanContent: "Example question content",
                        }),
                      },
                    },
                  ],
                ]),
              },
            },
          ],
        ]),
      },
    },
    options: {
      getString: jest.fn((key: string) => overrides[key]),
    },
    reply: jest.fn(),
    user: { id: "123" },
    ...overrides,
  };
}

describe("TagQuestionCommand", () => {
  test("fails if not in a text channel", async () => {
    const cmd = new TagQuestionCommand();
    const interaction = makeMockInteraction({
      channel: {}, // no parentId = not a text channel
    });

    await cmd.run(interaction as any);
    expect(interaction.reply).toHaveBeenCalled();
    expect(generateErrorEmbed).toHaveBeenCalledWith(
      "This command is only available in text channels."
    );
  });

  test("fails if course or assignment not found", async () => {
    const cmd = new TagQuestionCommand();
    const interaction = makeMockInteraction({
      channel: { parentId: "abc" },
      assignmentid: "A1",
      message: "https://discord.com/channels/123/456/789",
    });

    // Simulate Mongo returning a course with no matching assignment
    interaction.client.mongo.findOne.mockResolvedValueOnce({
      name: "CSC101",
      assignments: [],
    });

    await cmd.run(interaction as any);

    expect(interaction.reply).toHaveBeenCalled();
    const replyArg = interaction.reply.mock.calls[0][0];
    const content =
      replyArg?.description || replyArg?.content || JSON.stringify(replyArg);
    expect(content.toLowerCase()).toMatch(/assignment|course|could not find/i);
  });

  test("succeeds when valid data is provided", async () => {
    const cmd = new TagQuestionCommand();

    const interaction = makeMockInteraction({
      channel: { parentId: "abc" },
      assignmentid: "A1",
      message: "https://discord.com/channels/123/456/789",
    });

    // Mock DB responses: valid course + assignment exists
    interaction.client.mongo.findOne
      .mockResolvedValueOnce({
        courseId: "abc",
        name: "CSC101",
        assignments: ["A1"],
      }) // course found
      .mockResolvedValueOnce(null); // message not yet tagged

    interaction.client.mongo.insertOne.mockResolvedValueOnce({
      acknowledged: true,
    });

    await cmd.run(interaction as any);

    expect(interaction.reply).toHaveBeenCalled();
    const msg = interaction.reply.mock.calls[0][0];
    const content = msg?.description || msg?.content || JSON.stringify(msg);
    expect(content.toLowerCase()).toMatch(/added|success|database/i);
  });
});