/**
 * LatexCommand tests exercise the full rendering pipeline: interaction deferral,
 * third-party HTTP calls, canvas manipulation, and final Discord replies. The
 * suite intentionally mocks each dependency so future maintainers understand
 * exactly which side effects the command performs and how failures should
 * surface to users.
 */
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  InteractionResponse,
  Message,
} from 'discord.js';
// Adjust this import path to match your project structure
import LatexCommand from '../../../commands/fun/latex';
import fetch from 'node-fetch';
import { createCanvas, loadImage } from 'canvas';
import { generateErrorEmbed } from '@lib/utils/generalUtils';

/**
 * The command orchestrates several heavy dependencies. Centralizing the mocks
 * here keeps the actual test cases focused on intent rather than setup noise.
 */
// --- Mocks ---

// Mock node-fetch so we can deterministically drive primary/backup API flows.
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

// Mock canvas so the tests remain fast and do not require the native bindings.
jest.mock('canvas', () => {
  // We need to mock all the canvas functions
  const mockCanvasData = {
    data: [255, 255, 255, 255], // A single white pixel
  };
  const mockContext = {
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    fillStyle: '',
    fillRect: jest.fn(),
    drawImage: jest.fn(),
    getImageData: jest.fn(() => mockCanvasData),
    putImageData: jest.fn(),
  };
  const mockCanvas = {
    getContext: jest.fn(() => mockContext),
    toBuffer: jest.fn(() => Buffer.from('mock-image-buffer')),
  };
  return {
    createCanvas: jest.fn(() => mockCanvas),
    loadImage: jest.fn(() =>
      Promise.resolve({
        width: 100,
        height: 50,
      }),
    ),
  };
});

// Mock discord.js builders to avoid pulling in the full library during tests.
jest.mock('discord.js', () => {
  const MockEmbedBuilder = jest.fn(() => ({
    setImage: jest.fn().mockReturnThis(),
  }));
  const MockAttachmentBuilder = jest.fn();
  return {
    EmbedBuilder: MockEmbedBuilder,
    AttachmentBuilder: MockAttachmentBuilder,
    ChatInputCommandInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    Message: jest.fn(),
    ApplicationCommandOptionType: {
      String: 3,
    },
    ApplicationCommandPermissionType: {
      Role: 2,
    },
  };
});

// Mock local dependencies to pin the bot name/roles and error embed helper.
jest.mock('@root/config', () => ({
  ROLES: {
    VERIFIED: 'mock-verified-role-id',
  },
  BOT: {
    NAME: 'TestBot',
  },
}));

jest.mock('@lib/utils/generalUtils', () => ({
  generateErrorEmbed: jest.fn((msg) => ({
    mockedEmbed: true,
    content: msg,
  })),
}));

// --- Typed Mocks ---
// Casting to jest.Mock gives us typed helpers (.mockResolvedValue, etc.).
const mockedFetch = fetch as unknown as jest.Mock;
const mockedGenerateErrorEmbed = generateErrorEmbed as jest.Mock;
const MockEmbedBuilder = EmbedBuilder as unknown as jest.Mock;
const MockAttachmentBuilder = AttachmentBuilder as unknown as jest.Mock;
const mockedCreateCanvas = createCanvas as jest.Mock;
const mockedLoadImage = loadImage as jest.Mock;

/**
 * Each spec focuses on a single branch of the rendering flow so future readers
 * can immediately see which dependencies are involved and why the command makes
 * multiple network calls.
 */
describe('LatexCommand', () => {
  let command: LatexCommand;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockEmbed: any;
  let mockAttachment: any;

  /**
   * Resetting all mocks ensures no previous fetch/canvas configuration bleeds
   * into subsequent specs. We also create minimal stand-ins for interaction and
   * builder objects so the tests can assert on how they are used.
   */
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock builder instances
    mockEmbed = {
      setImage: jest.fn().mockReturnThis(),
    };
    mockAttachment = {
      name: 'tex.png',
    };
    MockEmbedBuilder.mockReturnValue(mockEmbed);
    MockAttachmentBuilder.mockReturnValue(mockAttachment);

    // Mock interaction
    mockInteraction = {
      deferReply: jest.fn().mockResolvedValue({} as InteractionResponse),
      followUp: jest.fn().mockResolvedValue({} as Message),
      editReply: jest.fn().mockResolvedValue({} as Message),
      options: {
        getString: jest.fn(() => 'E = mc^2'),
      },
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    command = new LatexCommand();
  });

  /**
   * Base case: the primary codecogs API succeeds. We expect deferReply to be
   * awaited, fetch called with the primary host, the SVG decoded via canvas, and
   * the resulting attachment sent back through editReply.
   */
  it('should render LaTeX using the primary API', async () => {
    // 1. Setup mocks for primary API success
    const mockBase64 = Buffer.from('fake-svg-data').toString('base64');
    const mockApiResponse = {
      latex: { base64: mockBase64 },
    };
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify(mockApiResponse), { status: 200 }),
    );

    // 2. Run the command
    await command.run(mockInteraction);

    // 3. Check assertions
    expect(mockInteraction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.stringContaining('latex.codecogs.com'),
      { method: 'Get' },
    );
    expect(mockedLoadImage).toHaveBeenCalledWith(
      Buffer.from(mockBase64, 'base64'),
    );
    expect(mockedCreateCanvas).toHaveBeenCalled();
    expect(MockAttachmentBuilder).toHaveBeenCalledWith(
      Buffer.from('mock-image-buffer'),
      { name: 'tex.png' },
    );
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [mockEmbed],
      files: [mockAttachment],
    });
    expect(mockEmbed.setImage).toHaveBeenCalledWith('attachment://tex.png');
  });

  /**
   * Resilience: when codecogs fails we fall back to Google Chart's PNG renderer.
   * The expectations verify that two fetch calls occur and that the PNG path is
   * followed.
   */
  it('should render LaTeX using the backup API if primary fails', async () => {
    // 1. Setup mocks for primary fail, backup success
    const mockBackupBuffer = Buffer.from('fake-png-data');
    mockedFetch.mockImplementation((url: string) => {
      if (url.includes('codecogs.com')) {
        // Primary API fails
        return Promise.resolve(new Response('Not Found', { status: 404 }));
      }
      if (url.includes('google.com')) {
        // Backup API succeeds
        return Promise.resolve({
          ok: true,
          buffer: () => Promise.resolve(mockBackupBuffer),
        } as any);
      }
      return Promise.reject(new Error('Unexpected fetch call'));
    });

    // 2. Run the command
    await command.run(mockInteraction);

    // 3. Check assertions
    expect(mockInteraction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2); // Called for both APIs
    expect(mockedLoadImage).toHaveBeenCalledWith(mockBackupBuffer, 'png');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [mockEmbed],
      files: [mockAttachment],
    });
  });

  /**
   * When both APIs fail we surface a friendly error embed rather than editing
   * the original reply. This captures the user-facing contract for outage cases.
   */
  it('should send an error if both APIs fail', async () => {
    // 1. Setup mocks for both APIs failing
    mockedFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

    // 2. Run the command
    await command.run(mockInteraction);

    // 3. Check assertions
    expect(mockInteraction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2); // Called for both
    expect(mockedGenerateErrorEmbed).toHaveBeenCalledWith(
      "Sorry, I couldn't render that LaTeX expression.",
    );
    expect(mockInteraction.followUp).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
    });
    expect(mockInteraction.editReply).not.toHaveBeenCalled();
  });

  /**
   * Canvas failures are rare but possible if native bindings break. The command
   * should respond the same way as API failures, so we simulate a thrown error
   * from createCanvas/getImageData and assert on the follow-up flow.
   */
  it('should send an error if canvas logic fails', async () => {
    // 1. Setup mocks for primary API success
    const mockBase64 = Buffer.from('fake-svg-data').toString('base64');
    const mockApiResponse = {
      latex: { base64: mockBase64 },
    };
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify(mockApiResponse), { status: 200 }),
    );

    // 2. Mock canvas to throw an error
    const canvasError = new Error('Canvas failed');
    (createCanvas as jest.Mock).mockImplementation(() => {
      const mockContext = {
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        fillStyle: '',
        fillRect: jest.fn(),
        drawImage: jest.fn(),
        // This is where we throw the error
        getImageData: jest.fn(() => {
          throw canvasError;
        }),
        putImageData: jest.fn(),
      };
      return {
        getContext: jest.fn(() => mockContext),
        toBuffer: jest.fn(),
      };
    });

    // 3. Run the command
    await command.run(mockInteraction);

    // 4. Check assertions
    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockInteraction.editReply).not.toHaveBeenCalled();
    expect(mockedGenerateErrorEmbed).toHaveBeenCalledWith(
      "Sorry, I couldn't render that LaTeX expression.",
    );
    expect(mockInteraction.followUp).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
    });
  });
});
