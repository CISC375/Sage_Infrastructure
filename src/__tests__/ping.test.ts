// 👇 Mock before anything else that depends on it
jest.mock('@root/config', () => ({
	ROLES: {
	  ADMIN: '123456789', // or whatever mock values make sense
	}
  }));
  
  jest.mock('pretty-ms', () => (ms: number) => `${ms}ms`);
  
  import PingCommand from '../../src/commands/info/ping';
  import { ChatInputCommandInteraction, Client } from 'discord.js';
  
  describe('Ping Command Test', () => {
	let interaction: jest.Mocked<ChatInputCommandInteraction>;
	let interaction2: jest.Mocked<ChatInputCommandInteraction>;
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
  
	  interaction2 = {
		reply: jest.fn().mockResolvedValue(undefined),
		editReply: jest.fn().mockResolvedValue(undefined),
		createdTimestamp: Date.now() - 76, // simulate 76ms round trip
		client: mockClient,
	  } as unknown as jest.Mocked<ChatInputCommandInteraction>;

	  command = new PingCommand();
	});
  
	test('Replies with "Ping?" and edits reply with round trip time and ping', async () => {
	  await command.run(interaction);
  
	  expect(interaction.reply).toHaveBeenCalledWith('Ping?');
  
	  const expectedEdit = `Pong! Round trip took 42ms, REST ping 123ms.`;
	  expect(interaction.editReply).toHaveBeenCalledWith(
		expect.stringMatching(/Pong! Round trip took \d+ms, REST ping 123ms\./)
	  );
	});

	test('Second Ping test and replies with round trip time and ping', async () => {
		await command.run(interaction2);
	
		expect(interaction2.reply).toHaveBeenCalledWith('Ping?');
	
		const expectedEdit = `Pong! Round trip took 76ms, REST ping 123ms.`;
		expect(interaction2.editReply).toHaveBeenCalledWith(
		  expect.stringMatching(/Pong! Round trip took \d+ms, REST ping 123ms\./)
		);
	  });


  });
  