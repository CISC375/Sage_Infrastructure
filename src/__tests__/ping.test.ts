// 👇 Mock before anything else that depends on it
jest.mock('@root/config', () => ({
	ROLES: {
	  ADMIN: '123456789', // or whatever mock values make sense
	}
  }));
  
  jest.mock('pretty-ms', () => (ms: number) => `${ms}ms`);
  
  import PingCommand from '../../src/commands/info/ping';
  import { ChatInputCommandInteraction, Client } from 'discord.js';
  
  describe('PingCommand', () => {
	let interaction: jest.Mocked<ChatInputCommandInteraction>;
	let command: PingCommand;
  
	beforeEach(() => {
	  const mockClient = {
		ws: { ping: 123 },
	  } as unknown as Client;
  
	  interaction = {
		reply: jest.fn().mockResolvedValue(undefined),
		editReply: jest.fn().mockResolvedValue(undefined),
		createdTimestamp: Date.now() - 42, // simulate 42ms round trip
		client: mockClient,
	  } as unknown as jest.Mocked<ChatInputCommandInteraction>;
  
	  command = new PingCommand();
	});
  
	it('replies with "Ping?" and edits reply with round trip time and ping', async () => {
	  await command.run(interaction);
  
	  expect(interaction.reply).toHaveBeenCalledWith('Ping?');
  
	  const expectedEdit = `Pong! Round trip took 42ms, REST ping 123ms.`;
	  expect(interaction.editReply).toHaveBeenCalledWith(
		expect.stringMatching(/Pong! Round trip took \d+ms, REST ping 123ms\./)
	  );
	});
  });
  