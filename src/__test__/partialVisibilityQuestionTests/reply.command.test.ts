// src/__test__/partial_visibility_question/reply.command.test.ts
// @ts-nocheck

import { jest } from "@jest/globals";

// IMPORTANT: path includes `commands/` and the folder has spaces
import ReplyCommand from "../../commands/partial visibility question/reply";

// ---- Mock discord.js primitives used by this command / base Command ----
jest.mock("discord.js", () => {
  const EmbedBuilder = jest.fn().mockImplementation(() => ({
    setAuthor: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
  }));

  // Minimal stubs that the code touches
  return {
    EmbedBuilder,
    TextChannel: jest.fn(),
    ChatInputCommandInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    ApplicationCommandPermissionType: { Role: 2 },
    ApplicationCommandType: { ChatInput: 1 },
    ApplicationCommandOptionType: { String: 3, Attachment: 11 },
  };
});

// ---- Mock general utils used by the command ----
jest.mock("@lib/utils/generalUtils", () => ({
  generateErrorEmbed: jest.fn((msg: string) => ({ content: msg, mocked: true })),
}));

// ---- Mock config used by the command & base Command ----
jest.mock("@root/config", () => ({
  BOT: { NAME: "TestBot" },
  MAINTAINERS: "@maintainers",
  DB: { USERS: "users", COURSES: "courses", PVQ: "pvq" },
  ROLES: { VERIFIED: "role-verified" },
}));

// ------- Little factory to build a mocked interaction -------
const makeInteraction = () => {
  const channel = {
    send: jest.fn().mockResolvedValue({ id: "msg-1" }),
  };

  const channelsFetch = jest.fn().mockResolvedValue(channel);

  const mongo = { collection: jest.fn() };

  const interaction: any = {
    user: { id: "U1", tag: "User#1234", avatarURL: jest.fn() },
    client: {
      user: { avatarURL: jest.fn().mockReturnValue("https://bot.avatar.url") },
      channels: { fetch: channelsFetch },
      mongo,
    },
    options: {
      getAttachment: jest.fn().mockReturnValue(null),
      getString: jest.fn(),
    },
    reply: jest.fn(),
  };

  return { interaction, mongo, channel, channelsFetch };
};

// ---------------- Tests ----------------
describe("ReplyCommand", () => {
  beforeEach(() => jest.clearAllMocks());

  it("replies with an error if question does not exist", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "pvq") return { findOne: jest.fn().mockResolvedValue(null) };
      return { findOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Q999") // questionid
      .mockReturnValueOnce("Test response");

    const cmd = new (ReplyCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("replies with an error if question is private (not anonymous)", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "pvq") {
        return {
          findOne: jest.fn().mockResolvedValue({
            questionId: "Q123",
            type: "private",
            owner: "U1",
            messageLink: "https://discord.com/channels/1/2/3",
          }),
        };
      }
      return { findOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Q123")
      .mockReturnValueOnce("Test response");

    const cmd = new (ReplyCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("replies with an error if user is not the question owner", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "pvq") {
        return {
          findOne: jest.fn().mockResolvedValue({
            questionId: "Q123",
            type: "anonymous",
            owner: "U2", // different owner
            messageLink: "https://discord.com/channels/1/2/3",
          }),
        };
      }
      return { findOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Q123")
      .mockReturnValueOnce("Test response");

    const cmd = new (ReplyCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("sends a reply without file attachment", async () => {
    const { interaction, mongo, channel } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "pvq") {
        return {
          findOne: jest.fn().mockResolvedValue({
            questionId: "Q123",
            type: "anonymous",
            owner: "U1",
            messageLink: "https://discord.com/channels/1/2/3",
          }),
        };
      }
      return { findOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Q123")
      .mockReturnValueOnce("Test response");
    interaction.options.getAttachment = jest.fn().mockReturnValue(null);

    const cmd = new (ReplyCommand as any)();
    await cmd.run(interaction);

    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      })
    );

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "I've forwarded your message along.",
      ephemeral: true,
    });
  });

  it("sends a reply with file attachment", async () => {
    const { interaction, mongo, channel } = makeInteraction();
    const mockFile = {
      url: "https://example.com/file.png",
      name: "file.png",
    };

    mongo.collection.mockImplementation((name: string) => {
      if (name === "pvq") {
        return {
          findOne: jest.fn().mockResolvedValue({
            questionId: "Q123",
            type: "anonymous",
            owner: "U1",
            messageLink: "https://discord.com/channels/1/2/3",
          }),
        };
      }
      return { findOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Q123")
      .mockReturnValueOnce("Test response");
    interaction.options.getAttachment = jest.fn().mockReturnValue(mockFile);

    const cmd = new (ReplyCommand as any)();
    await cmd.run(interaction);

    expect(channel.send).toHaveBeenCalledTimes(1);
    const callArgs = channel.send.mock.calls[0][0];
    expect(callArgs.embeds).toBeDefined();
    expect(callArgs.embeds[0].setImage).toHaveBeenCalledWith(mockFile.url);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "I've forwarded your message along.",
      ephemeral: true,
    });
  });

  it("correctly parses channel ID from message link", async () => {
    const { interaction, mongo, channelsFetch } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "pvq") {
        return {
          findOne: jest.fn().mockResolvedValue({
            questionId: "Q123",
            type: "anonymous",
            owner: "U1",
            messageLink: "https://discord.com/channels/1234567890/9876543210/1122334455",
          }),
        };
      }
      return { findOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Q123")
      .mockReturnValueOnce("Test response");

    const cmd = new (ReplyCommand as any)();
    await cmd.run(interaction);

    expect(channelsFetch).toHaveBeenCalledWith("9876543210");
  });
});