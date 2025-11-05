// adjust the import path to the file that exports the command class
const CatFactCommand = require("../../../commands/fun/catfacts").default;
const axios = require("axios");

// Mock the axios module
jest.mock("axios");
const mockedAxios = axios;

describe("CatFactCommand", () => {
    let cmd;

    beforeEach(() => {
        cmd = new CatFactCommand();
        // Clear mocks before each test
        mockedAxios.get.mockClear();
    });

    test("calls interaction.reply with an embed containing a cat fact", async () => {
        const mockFact = "Cats have over 20 muscles that control their ears.";
        const mockApiResponse = {
            data: {
                fact: mockFact,
            },
        };
        // Mock the successful API response
        mockedAxios.get.mockResolvedValue(mockApiResponse);

        const mockReplyResult = { mocked: true };
        const mockReply = jest.fn().mockResolvedValue(mockReplyResult);
        const interaction = { reply: mockReply };

        const result = await cmd.run(interaction);

        // axios.get was called once with the correct URL
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedAxios.get).toHaveBeenCalledWith('https://catfact.ninja/fact');

        // interaction.reply was called once
        expect(mockReply).toHaveBeenCalledTimes(1);

        // reply called with proper argument shape
        const callArg = mockReply.mock.calls[0][0];
        expect(callArg).toBeDefined();
        expect(Array.isArray(callArg.embeds)).toBe(true);
        expect(callArg.embeds).toHaveLength(1);

        // Check embed content
        const embed = callArg.embeds[0].data;
        expect(embed).toBeDefined();
        expect(embed.title).toBe('A Cat Fact');
        
        // FIX: 'Blue' resolves to 3447003 (0x3498DB), not 255 (0x0000FF)
        expect(embed.color).toBe(3447003);
        
        expect(embed.footer.text).toBe(mockFact);

        // run should resolve to whatever reply resolves to
        expect(result).toBe(mockReplyResult);
    });

    test("propagates errors from interaction.reply", async () => {
        const mockFact = "A test fact.";
        const mockApiResponse = { data: { fact: mockFact } };
        // Mock a successful API call
        mockedAxios.get.mockResolvedValue(mockApiResponse);

        const err = new Error("reply failed");
        const mockReply = jest.fn().mockRejectedValue(err);
        const interaction = { reply: mockReply };

        await expect(cmd.run(interaction)).rejects.toThrow("reply failed");
        expect(mockReply).toHaveBeenCalledTimes(1);
    });

    test("propagates errors from axios.get", async () => {
        const err = new Error("API failed");
        // Mock a failed API call
        mockedAxios.get.mockRejectedValue(err);

        const mockReply = jest.fn();
        const interaction = { reply: mockReply };

        await expect(cmd.run(interaction)).rejects.toThrow("API failed");
        
        // Reply should not have been called if axios failed
        expect(mockReply).not.toHaveBeenCalled();
    });
});