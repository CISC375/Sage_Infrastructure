// jest.setup.ts

// 全テストの実行前にグローバルモックを設定
jest.mock('@root/config', () => ({
    // addbutton や activity などで使われる
    BOT: { NAME: 'TestBot' },
    BOTMASTER_PERMS: [], 

    // addcourse で使われる
    DB: {
        COURSES: 'courses' // 実際のコレクション名（文字列）をダミーとして設定
    },
    
    // addcourse で使われる
    GUILDS: {
        MAIN: 'dummy-guild-id' // ダミーのID
    },

    // 複数のコマンドで使われる
    ROLES: {
        STAFF: 'dummy-staff-role-id',
        ADMIN: 'dummy-admin-role-id',
        MUTED: 'dummy-muted-role-id'
    }
}));
