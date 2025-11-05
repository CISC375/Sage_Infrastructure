import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  InteractionResponse,
  Message,
} from 'discord.js';
// Adjust this import path to match your project structure
import XkcdCommand from '../../../commands/fun/xkcd';
import fetch from 'node-fetch';

// --- Type for Mock Data ---
interface XkcdComic {
  alt: string;
  day: string;
  img: string;
  link: string;
  month: string;
  news: string;
  num: number;
  safe_title: string;
  title: string;
  transcript: string;
  year: string;
}

// --- Mocks ---
jest.mock('discord.js', () => {
  const MockEmbedBuilder = jest.fn(() => ({
    setColor: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
  }));
  const MockButtonBuilder = jest.fn(() => ({
    setLabel: jest.fn().mockReturnThis(),
    setCustomId: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
  }));
  const MockActionRowBuilder = jest.fn(() => ({
    addComponents: jest.fn().mockReturnThis(),
  }));
  return {
    EmbedBuilder: MockEmbedBuilder,
    ButtonBuilder: MockButtonBuilder,
    ActionRowBuilder: MockActionRowBuilder,
    ButtonStyle: { Secondary: 2 },
    ApplicationCommandOptionType: { String: 3 },
    ChatInputCommandInteraction: jest.fn(),
    ButtonInteraction: jest.fn(),
    InteractionResponse: jest.fn(),
    Message: jest.fn(),
    TextChannel: jest.fn(),
    MessageComponentCollector: jest.fn(),
    ApplicationCommandPermissionType: { Role: 2 },
  };
});

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

jest.mock('moment', () => () => ({
  format: jest.fn(() => '2025 TestDate 1st'),
}));

jest.mock('@root/config', () => ({
  ROLES: { VERIFIED: 'mock-verified-role-id' },
  BOT: { NAME: 'TestBot' },
}));

jest.mock('@lib/utils/generalUtils', () => ({
  generateErrorEmbed: jest.fn((msg) => ({
    mockedEmbed: true,
    content: msg,
  })),
}));

// --- Typed Mocks ---
const mockedFetch = fetch as unknown as jest.Mock;
const MockEmbedBuilder = EmbedBuilder as unknown as jest.Mock;
const MockButtonBuilder = ButtonBuilder as unknown as jest.Mock;
const MockActionRowBuilder = ActionRowBuilder as unknown as jest.Mock;

// --- Mock Data ---
const latestComic: XkcdComic = {
  num: 2000,
  safe_title: 'Latest Comic',
  alt: 'Latest alt text',
  img: 'http://example.com/latest.png',
  year: '2025',
  month: '1',
  day: '1',
  transcript: '',
  link: '',
  news: '',
  title: '',
};

const randomComic: XkcdComic = {
  num: 122, // <-- Changed to 122 to match the math
  safe_title: 'Random Comic',
  alt: 'Random alt text',
  img: 'http://example.com/random.png',
  year: '2010',
  month: '2',
  day: '2',
  transcript: '',
  link: '',
  news: '',
  title: '',
};

const firstComic: XkcdComic = {
  num: 1,
  safe_title: 'First Comic',
  alt: 'First alt text',
  img: 'http://example.com/first.png',
  year: '2006',
  month: '3',
  day: '3',
  transcript: '',
  link: '',
  news: '',
  title: '',
};

// --- Tests ---
describe('XkcdCommand', () => {
  let command: XkcdCommand;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockCollector: { on: jest.Mock; stop: jest.Mock };
  let collectorCallback: (i: ButtonInteraction) => Promise<void>;
  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    MockEmbedBuilder.mockImplementation(() => ({
      setColor: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      setImage: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
      setTitle: jest.fn().mockReturnThis(),
    }));
    MockButtonBuilder.mockImplementation(() => ({
      setLabel: jest.fn().mockReturnThis(),
      setCustomId: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis(),
      setEmoji: jest.fn().mockReturnThis(),
    }));
    MockActionRowBuilder.mockImplementation(() => ({
      addComponents: jest.fn().mockReturnThis(),
    }));

    collectorCallback = jest.fn();
    mockCollector = {
      on: jest.fn((event, callback) => {
        if (event === 'collect') {
          collectorCallback = callback;
        }
      }),
      stop: jest.fn(),
    };

    mockInteraction = {
      user: { id: 'user123' },
      options: { getString: jest.fn() },
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      editReply: jest.fn().mockResolvedValue({} as Message),
      fetchReply: jest.fn().mockResolvedValue({ id: 'msg789' } as Message),
      channel: {
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector as any),
      },
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    // --- THIS IS THE FIX ---
    mockedFetch.mockImplementation((url: string) => {
      if (url.includes('/1/info.0.json')) {
        return Promise.resolve(new Response(JSON.stringify(firstComic)));
      }
      // Check for 122 (the correct random number)
      if (url.includes('/122/info.0.json')) {
        return Promise.resolve(new Response(JSON.stringify(randomComic)));
      }
      if (url.includes('/123/info.0.json')) {
        // This is for the 'next' button test
        return Promise.resolve(
          new Response(JSON.stringify({ ...randomComic, num: 123, safe_title: 'Next Comic' })),
        );
      }
      // Fallback for 'latest'
      if (url.includes('xkcd.com/info.0.json')) {
        return Promise.resolve(new Response(JSON.stringify(latestComic)));
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });
    // --- END FIX ---

    // This mock value (0.06103) correctly produces 122
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.06103);

    command = new XkcdCommand();
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  const createButtonInteraction = (
    customId: string,
    userId: string = 'user123',
  ): jest.Mocked<ButtonInteraction> => {
    return {
      customId,
      user: { id: userId },
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      deferUpdate: jest.fn().mockResolvedValue({} as InteractionResponse),
    } as unknown as jest.Mocked<ButtonInteraction>;
  };

  describe('run()', () => {
    it("should fetch 'latest' comic", async () => {
      (mockInteraction.options.getString as jest.Mock).mockReturnValue('latest');
      await command.run(mockInteraction);
      expect(mockedFetch).toHaveBeenCalledWith('http://xkcd.com/info.0.json');
      expect(MockButtonBuilder).toHaveBeenCalledTimes(3); // 3 definitions
      const actionRowArgs = MockActionRowBuilder.mock.calls[0][0];
      expect(actionRowArgs.components).toHaveLength(2); // 2 used
    });

    it("should fetch a 'random' comic", async () => {
      (mockInteraction.options.getString as jest.Mock).mockReturnValue('random');
      
      // Our mock Math.random gives 0.06103 -> 122
      await command.run(mockInteraction);

      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(mockedFetch).toHaveBeenCalledWith('http://xkcd.com/info.0.json');
      // --- THIS IS THE FIX ---
      expect(mockedFetch).toHaveBeenCalledWith(
        'http://xkcd.com/122/info.0.json', // Expect 122
      );
      // --- END FIX ---
      expect(MockButtonBuilder).toHaveBeenCalledTimes(3);
      const actionRowArgs = MockActionRowBuilder.mock.calls[0][0];
      expect(actionRowArgs.components).toHaveLength(3);
    });

    it("should fetch comic '1' and show correct buttons", async () => {
      (mockInteraction.options.getString as jest.Mock).mockReturnValue('1');
      await command.run(mockInteraction);
      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(MockButtonBuilder).toHaveBeenCalledTimes(3); // 3 definitions
      const actionRowArgs = MockActionRowBuilder.mock.calls[0][0];
      expect(actionRowArgs.components).toHaveLength(2); // 2 used
    });
  });

  describe('Collector', () => {
    it('should respond to "next" button', async () => {
      // 1. Run the command with comic 122
      (mockInteraction.options.getString as jest.Mock).mockReturnValue('122');
      
      await command.run(mockInteraction); // Fetches latest, then 122

      // 2. Simulate the 'next' button click
      const buttonClick = createButtonInteraction('next');
      await collectorCallback(buttonClick);

      // 3. Check results
      expect(buttonClick.deferUpdate).toHaveBeenCalled();
      expect(mockedFetch).toHaveBeenCalledTimes(3); // latest, 122, 123
      expect(mockedFetch).toHaveBeenLastCalledWith(
        'http://xkcd.com/123/info.0.json',
      );
      expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);

      const newEmbed = MockEmbedBuilder.mock.results[MockEmbedBuilder.mock.results.length - 1].value;
      expect(newEmbed.setTitle).toHaveBeenCalledWith(
        expect.stringContaining('Next Comic'),
      );
    });

    it('should not respond to "previous" button on comic 1', async () => {
      (mockInteraction.options.getString as jest.Mock).mockReturnValue('1');
      await command.run(mockInteraction);
      
      const buttonClick = createButtonInteraction('previous');
      await collectorCallback(buttonClick);

      expect(buttonClick.deferUpdate).toHaveBeenCalled();
      expect(mockedFetch).toHaveBeenCalledTimes(2); // latest, 1 (no new fetch)
      
      // The code *does* call editReply, just with the same comic
      expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);
    });
  });
});