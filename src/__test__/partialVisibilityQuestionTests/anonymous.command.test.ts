// src/__test__/partial_visibility_question/anonymous.command.test.ts
// @ts-nocheck

import { jest } from "@jest/globals";

// IMPORTANT: path includes `commands/` and the folder has spaces
import AnonymousCommand from "../../commands/partial visibility question/anonymous";

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
    // If your base Command references these enums, you can expose them too:
    ApplicationCommandPermissionType: { Role: 2 },
    ApplicationCommandType: { ChatInput: 1 },
    ApplicationCommandOptionType: { String: 3, Attachment: 11 }, // <-- ADD THIS
  };
});

// ---- Mock general utils used by the command ----
jest.mock("@lib/utils/generalUtils", () => ({
  generateErrorEmbed: jest.fn((msg: string) => ({ content: msg, mocked: true })),
  generateQuestionId: jest.fn(async () => "Q123"),
}));

// ---- Mock config used by the command & base Command (THIS FIXES THE ERROR) ----
jest.mock("@root/config", () => ({
  BOT: { NAME: "TestBot" },
  MAINTAINERS: "@maintainers",
  DB: { USERS: "users", COURSES: "courses", PVQ: "pvq" },
  ROLES: { VERIFIED: "role-verified" }, // <-- needed by base Command constructor
}));

// ------- Little factory to build a mocked interaction -------
const makeInteraction = () => {
  const generalChannel = {
    send: jest.fn().mockResolvedValue({
      id: "msg-1",
      channel: { id: "chan-general" },
      guild: { id: "guild-1" },
    }),
  };

  const privateChannel = {
    send: jest.fn().mockResolvedValue({ ok: true }),
  };

  const channelsFetch = jest
    .fn()
    .mockResolvedValueOnce(generalChannel as any)
    .mockResolvedValueOnce(privateChannel as any);

  const mongo = { collection: jest.fn() };

  const interaction: any = {
    user: { id: "U1", tag: "User#1234", avatarURL: jest.fn() },
    client: {
      user: { avatarURL: jest.fn() },
      channels: { fetch: channelsFetch },
      mongo,
    },
    options: {
      getAttachment: jest.fn().mockReturnValue(null),
      getString: jest.fn(), // we override per test
    },
    reply: jest.fn(),
  };

  return { interaction, mongo, generalChannel, privateChannel };
};

// ---------------- Tests ----------------
describe("AnonymousCommand", () => {
  beforeEach(() => jest.clearAllMocks());

  it("replies with an error if the user is not in the DB", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue(null) };
      if (name === "courses") return { find: () => ({ toArray: jest.fn().mockResolvedValue([]) }) };
      return { insertOne: jest.fn() };
    });

    const cmd = new (AnonymousCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("replies with an error if no question text is provided", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([{ name: "CISC375", channels: {} }]),
          }),
        };
      }
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn().mockReturnValueOnce(null);

    const cmd = new (AnonymousCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("sends to both channels and inserts a PVQ record", async () => {
    const { interaction, mongo, generalChannel, privateChannel } = makeInteraction();
    const insertOne = jest.fn();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([
              { name: "CISC375", channels: { general: "chan-general", private: "chan-private" } },
            ]),
          }),
        };
      }
      if (name === "pvq") return { insertOne };
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn().mockReturnValue("Test question");

    const cmd = new (AnonymousCommand as any)();
    await cmd.run(interaction);

    expect(generalChannel.send).toHaveBeenCalledTimes(1);
    expect(privateChannel.send).toHaveBeenCalledTimes(1);

    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: interaction.user.id,
        type: "anonymous",
        questionId: "Q123",
        messageLink: expect.any(String),
      })
    );

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Your question has been sent"),
        ephemeral: true,
      })
    );
  });
});