// jest.setup.ts

jest.mock('@root/config', () => ({
    BOT: { NAME: 'TestBot' },
    BOTMASTER_PERMS: [],

    DB: {
        COURSES: 'courses',
        POLLS: 'polls',
        USERS: 'users',
    },

    GUILDS: {
        MAIN: 'dummy-guild-id'
    },

    ROLES: {
        STAFF: 'dummy-staff-role-id',
        ADMIN: 'dummy-admin-role-id',
        MUTED: 'dummy-muted-role-id',
        VERIFIED: 'dummy-verified-role-id',
    },

    EMAIL: {
        SENDER: 'no-reply@example.com',
        REPLY_TO: 'support@example.com',
    },
}), { virtual: true });

jest.mock('parse-duration', () => ({
    __esModule: true,
    default: jest.fn((input: string) => {
        if (/^\d+\s*m(s|in)?$/i.test(input)) return 60_000;
        if (/^\d+\s*h$/i.test(input)) return 3_600_000;
        if (/^\d+\s*s(ec)?$/i.test(input)) return 1_000;
        return 1_000; 
    }),
}));
