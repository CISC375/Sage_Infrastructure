// src/__test__/partial_visibility_question/private.command.test.ts
// @ts-nocheck

import { jest } from "@jest/globals";

// IMPORTANT: path includes `commands/` and the folder has spaces
import PrivateCommand from "../../../commands/partial visibility question/private";

// ---- Mock discord.js primitives used by this command / base Command ----
jest.mock("discord.js", () => {
  const EmbedBuilder = jest.fn().mockImplementation(() => ({
    setAuthor: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  }));

  // Minimal stubs that the code touches
  return {
    EmbedBuilder,
    TextChannel: jest.fn(),
    ChatInputCommandInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    ChannelType: { GuildText: 0, PrivateThread: 12 },
    ApplicationCommandPermissionType: { Role: 2 },
    ApplicationCommandType: { ChatInput: 1 },
    ApplicationCommandOptionType: { String: 3, Attachment: 11 },
  };
});

// ---- Mock general utils used by the command ----
jest.mock("@lib/utils/generalUtils", () => ({
  generateErrorEmbed: jest.fn((msg: string) => ({ content: msg, mocked: true })),
  generateQuestionId: jest.fn(async () => "Q123"),
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
  const privThread = {
    id: "thread-1",
    guild: {
      id: "guild-1",
      members: {
        fetch: jest.fn().mockResolvedValue(undefined),
        cache: {
          filter: jest.fn().mockReturnValue([
            {
              id: "staff-1",
              roles: { cache: { has: jest.fn().mockReturnValue(true) } },
            },
            {
              id: "staff-2",
              roles: { cache: { has: jest.fn().mockReturnValue(true) } },
            },
          ]),
        },
      },
    },
    members: {
      add: jest.fn().mockResolvedValue(undefined),
    },
    send: jest.fn().mockResolvedValue({
      id: "msg-1",
      guild: { id: "guild-1" },
      channel: { id: "thread-1" },
    }),
  };

  const courseGeneral = {
    id: "chan-general",
    type: 0, // GuildText
    threads: {
      create: jest.fn().mockResolvedValue(privThread),
    },
  };

  const privateChannel = {
    send: jest.fn().mockResolvedValue({ ok: true }),
  };

  const channelsFetch = jest
    .fn()
    .mockResolvedValueOnce(courseGeneral as any)
    .mockResolvedValueOnce(privateChannel as any);

  const mongo = { collection: jest.fn() };

  const interaction: any = {
    user: { id: "U1", tag: "User#1234", username: "TestUser", avatarURL: jest.fn().mockReturnValue("https://avatar.url") },
    client: {
      user: { avatarURL: jest.fn().mockReturnValue("https://bot.avatar.url") },
      channels: { fetch: channelsFetch },
      mongo,
    },
    options: {
      getAttachment: jest.fn().mockReturnValue(null),
      getString: jest.fn(), // we override per test
    },
    reply: jest.fn(),
  };

  return { interaction, mongo, courseGeneral, privateChannel, privThread };
};

// ---------------- Tests ----------------
describe("PrivateCommand", () => {
  beforeEach(() => jest.clearAllMocks());

  it("replies with an error if the user is not in the DB", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue(null) };
      if (name === "courses") return { find: () => ({ toArray: jest.fn().mockResolvedValue([]) }) };
      return { insertOne: jest.fn() };
    });

    const cmd = new (PrivateCommand as any)();
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

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce(null) // question
      .mockReturnValueOnce(undefined); // course

    const cmd = new (PrivateCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("replies with an error if user is enrolled in multiple courses and no course is specified", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375", "CISC401"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([
              { name: "CISC375", channels: {} },
              { name: "CISC401", channels: {} },
            ]),
          }),
        };
      }
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Test question")
      .mockReturnValueOnce(null); // no course specified

    const cmd = new (PrivateCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("replies with an error if specified course does not exist", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375", "CISC401"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([
              { name: "CISC375", channels: {} },
              { name: "CISC401", channels: {} },
            ]),
          }),
        };
      }
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Test question")
      .mockReturnValueOnce("CISC999"); // non-existent course

    const cmd = new (PrivateCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("replies with an error if user is not enrolled in the specified course", async () => {
    const { interaction, mongo } = makeInteraction();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375", "CISC401"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([
              { name: "CISC375", channels: {} },
              { name: "CISC401", channels: {} },
              { name: "CISC999", channels: {} },
            ]),
          }),
        };
      }
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Test question")
      .mockReturnValueOnce("CISC999"); // not enrolled in this course

    const cmd = new (PrivateCommand as any)();
    await cmd.run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), ephemeral: true })
    );
  });

  it("creates a thread, sends messages, and inserts a PVQ record when single enrolled course", async () => {
    const { interaction, mongo, courseGeneral, privateChannel, privThread } = makeInteraction();
    const insertOne = jest.fn();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([
              {
                name: "CISC375",
                channels: { general: "chan-general", private: "chan-private" },
                roles: { staff: "role-staff" },
              },
            ]),
          }),
        };
      }
      if (name === "pvq") return { insertOne };
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Test question")
      .mockReturnValueOnce(null); // auto-detect course

    const cmd = new (PrivateCommand as any)();
    await cmd.run(interaction);

    expect(courseGeneral.threads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining("TestUser"),
        autoArchiveDuration: 4320,
        type: 12, // PrivateThread
      })
    );

    expect(privThread.members.add).toHaveBeenCalledWith(interaction.user.id);
    expect(privateChannel.send).toHaveBeenCalledTimes(1);
    expect(privThread.send).toHaveBeenCalledTimes(1);

    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: interaction.user.id,
        type: "private",
        questionId: "Q123",
        messageLink: expect.any(String),
      })
    );

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Your question has been sent to the staff"),
        ephemeral: true,
      })
    );
  });

  it("creates a thread with specified course when user is enrolled in multiple courses", async () => {
    const { interaction, mongo, courseGeneral, privateChannel, privThread } = makeInteraction();
    const insertOne = jest.fn();

    mongo.collection.mockImplementation((name: string) => {
      if (name === "users") return { findOne: jest.fn().mockResolvedValue({ courses: ["CISC375", "CISC401"] }) };
      if (name === "courses") {
        return {
          find: () => ({
            toArray: jest.fn().mockResolvedValue([
              {
                name: "CISC375",
                channels: { general: "chan-general", private: "chan-private" },
                roles: { staff: "role-staff" },
              },
              {
                name: "CISC401",
                channels: { general: "chan-general-2", private: "chan-private-2" },
                roles: { staff: "role-staff" },
              },
            ]),
          }),
        };
      }
      if (name === "pvq") return { insertOne };
      return { insertOne: jest.fn() };
    });

    interaction.options.getString = jest.fn()
      .mockReturnValueOnce("Test question")
      .mockReturnValueOnce("CISC375"); // specify course

    const cmd = new (PrivateCommand as any)();
    await cmd.run(interaction);

    expect(courseGeneral.threads.create).toHaveBeenCalled();
    expect(insertOne).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Your question has been sent to the staff"),
        ephemeral: true,
      })
    );
  });
});