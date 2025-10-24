import ResetLevelsCommand from '../../commands/admin/resetlevels';
import { ChatInputCommandInteraction } from 'discord.js';

// Mocks for config and permissions
jest.mock('@root/config', () => ({
  DB: { USERS: 'users' },
  FIRST_LEVEL: 100,
  LEVEL_TIER_ROLES: ['tier2', 'tier5', 'tier10', 'tier15', 'tier20'],
  ROLES: { VERIFIED: 'verified', LEVEL_ONE: 'lvl1' },
}));

jest.mock('@lib/permissions', () => ({
  BOTMASTER_PERMS: [{ id: 'botmaster_role_id', permission: true, type: 1 }],
}));

describe('Admin ResetLevels Command', () => {
  let command: ResetLevelsCommand;
  let interaction: ChatInputCommandInteraction;

  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockRolesFetch = jest.fn().mockResolvedValue(undefined);
  const mockMembersFetch = jest.fn().mockResolvedValue(undefined);
  const mockDbUpdateMany = jest.fn().mockResolvedValue(undefined);

  let members: any[];

  function makeMember({ isBot = false, hasVerified = true, roles = [] as string[] }) {
    const cache = new Map<string, any>();
    // Seed roles cache
    roles.forEach((r) => cache.set(r, { id: r, name: r }));
    if (hasVerified) cache.set('verified', { id: 'verified', name: 'Verified' });

    return {
      user: { bot: isBot },
      roles: {
        cache: {
          has: (id: string) => cache.has(id),
          forEach: (fn: (role: any) => void) => cache.forEach(fn),
        },
        add: jest.fn(),
        remove: jest.fn(),
      },
    } as any;
  }

  beforeEach(() => {
    command = new (ResetLevelsCommand as any)();

    mockReply.mockClear();
    mockEditReply.mockClear();
    mockRolesFetch.mockClear();
    mockMembersFetch.mockClear();
    mockDbUpdateMany.mockClear();

    members = [
      // A verified member with Level 5 role should lose it and get tier5 then lvl1
      makeMember({ roles: ['Level 5'] }),
      // A verified member with no level role should just get lvl1 added (if missing)
      makeMember({ roles: [] }),
      // A bot should be skipped
      makeMember({ isBot: true, roles: ['Level 10'] }),
      // An unverified human should be skipped
      makeMember({ hasVerified: false, roles: ['Level 2'] }),
    ];

    const rolesCacheFind = jest.fn((predicate: (role: any) => boolean) => {
      const lvl1 = { id: 'lvl1', name: 'Level 1' };
      return predicate(lvl1) ? lvl1 : undefined;
    });

    interaction = {
      reply: mockReply as any,
      editReply: mockEditReply as any,
      guild: {
        roles: { fetch: mockRolesFetch, cache: { find: rolesCacheFind } },
        members: {
          fetch: mockMembersFetch,
          cache: { forEach: (fn: (member: any) => void) => members.forEach(fn) },
        },
      },
      client: {
        mongo: { collection: jest.fn(() => ({ updateMany: mockDbUpdateMany })) },
      },
    } as unknown as ChatInputCommandInteraction;
  });

  it('resets levels for verified members, updates DB, and replies appropriately', async () => {
    await command.run(interaction);

    expect(mockReply).toHaveBeenCalledWith('loading... <a:loading:928003042954059888>');
    expect(mockRolesFetch).toHaveBeenCalled();
    expect(mockMembersFetch).toHaveBeenCalled();

    // Member 0: verified with Level 5 should have had a level role removed
    expect(members[0].roles.remove).toHaveBeenCalled();
    const removedIds = members[0].roles.remove.mock.calls.map((c: any[]) => String(c[0]));
    expect(removedIds.some((id: string) => id.startsWith('Level'))).toBe(true);

    // Member 0 should get tier5 added
    expect(members[0].roles.add).toHaveBeenCalledWith('tier5');

    // At least one verified member should have lvl1 added
    const anyAddedLvl1 = members.some((m: any) => m.roles.add.mock.calls.some(([id]: any[]) => id === 'lvl1'));
    expect(anyAddedLvl1).toBe(true);

    // DB update
    expect(mockDbUpdateMany).toHaveBeenCalledWith(
      { roles: { $all: ['verified'] } },
      { $set: { count: 0, levelExp: 100, level: 1, curExp: 100 } }
    );

    expect(mockEditReply).toHaveBeenCalledWith("I've reset all levels in the guild.");
  });
});
