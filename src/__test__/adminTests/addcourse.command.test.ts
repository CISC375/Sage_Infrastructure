import {
    ChatInputCommandInteraction,
    TextChannel,
    CategoryChannel,
    Role,
    ChannelType
} from 'discord.js';
import AddCourseCommand from '../../commands/admin/addcourse'; // Command import path
import { updateDropdowns } from '@lib/utils/generalUtils'; // Target for mocking

// ------------------------------------------------------------------
// Mock Setup
// ------------------------------------------------------------------

// (1) Mock external utility function
jest.mock('@lib/utils/generalUtils', () => ({
    updateDropdowns: jest.fn().mockResolvedValue(undefined),
}));
// Give the mocked function a typed reference
const mockedUpdateDropdowns = updateDropdowns as jest.Mock;

// (2) Assumes jest.setup.ts already mocks @root/config (DB, ROLES, GUILDS)

// (3) discord.js mock functions
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockEditReply = jest.fn().mockResolvedValue(undefined);
const mockGetString = jest.fn();
const mockRoleCreate = jest.fn();
const mockChannelCreate = jest.fn();

// (4) Database (mongo) mock functions
const mockCountDocuments = jest.fn();
const mockInsertOne = jest.fn();

// Recreate client.mongo.collection('...').countDocuments(...)
const mockMongoCollection = jest.fn(() => ({
    countDocuments: mockCountDocuments,
    insertOne: mockInsertOne,
}));

// ------------------------------------------------------------------
// Start Testing
// ------------------------------------------------------------------

describe('AddCourse Command', () => {
    let command: AddCourseCommand;
    let mockInteraction: ChatInputCommandInteraction;

    // Reset mocks before each test and rebuild a mock Interaction object
    beforeEach(() => {
        command = new AddCourseCommand();

        // Reset mocks
        mockReply.mockReset();
        mockEditReply.mockReset();
        mockGetString.mockReset();
        mockRoleCreate.mockReset();
        mockChannelCreate.mockReset();
        mockCountDocuments.mockReset();
        mockInsertOne.mockReset();
        mockedUpdateDropdowns.mockReset();

        // Mock ChatInputCommandInteraction
        mockInteraction = {
            reply: mockReply,
            editReply: mockEditReply,
            options: {
                getString: mockGetString,
            },
            guild: {
                roles: {
                    create: mockRoleCreate,
                },
                channels: {
                    create: mockChannelCreate,
                },
            },
            client: {
                mongo: {
                    collection: mockMongoCollection,
                },
            },
            user: {
                username: 'TestUser',
                id: 'user-123',
            },
            // Other Interaction properties omitted via type assertion
        } as unknown as ChatInputCommandInteraction;
    });

    // ------------------------------------------------------------------
    // Success Cases
    // ------------------------------------------------------------------

    describe('Success Path', () => {
        it('should create a new course with all channels and roles', async () => {
            const courseName = '101';

            // --- Arrange ---
            // Set user input
            mockGetString.mockReturnValue(courseName);

            // 1. DB check (course does not exist)
            mockCountDocuments.mockResolvedValue(0);

            // 2. Create roles (Staff, Student)
            mockRoleCreate
                .mockResolvedValueOnce({ id: 'staff-role-id', name: `${courseName} Staff` } as Role)
                .mockResolvedValueOnce({ id: 'student-role-id', name: `CISC ${courseName}` } as Role);

            // 3. Create channels (Category, General, HW, Lab, Proj, Staff, Private)
            mockChannelCreate
                // Category
                .mockResolvedValueOnce({ id: 'category-id', type: ChannelType.GuildCategory } as CategoryChannel)
                // General
                .mockResolvedValueOnce({ id: 'general-id', type: ChannelType.GuildText } as TextChannel)
                // Homework
                .mockResolvedValueOnce({ id: 'hw-id', type: ChannelType.GuildText } as TextChannel)
                // Labs
                .mockResolvedValueOnce({ id: 'labs-id', type: ChannelType.GuildText } as TextChannel)
                // Projects
                .mockResolvedValueOnce({ id: 'projects-id', type: ChannelType.GuildText } as TextChannel)
                // Staff
                .mockResolvedValueOnce({ id: 'staff-id', type: ChannelType.GuildText } as TextChannel)
                // Private Qs
                .mockResolvedValueOnce({ id: 'private-id', type: ChannelType.GuildText } as TextChannel);
            
            // 4. Insert into DB
            mockInsertOne.mockResolvedValue({ acknowledged: true });

            // 5. Update dropdowns
            mockedUpdateDropdowns.mockResolvedValue(undefined);


            // --- Act ---
            await command.run(mockInteraction);


            // --- Assert ---
            // Initial reply
            expect(mockReply).toHaveBeenCalledWith('<a:loading:755121200929439745> working...');

            // DB check
            expect(mockMongoCollection).toHaveBeenCalledWith('courses'); // DB.COURSES
            expect(mockCountDocuments).toHaveBeenCalledWith({ name: courseName });

            // Role creation
            expect(mockRoleCreate).toHaveBeenCalledTimes(2);
            expect(mockRoleCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '101 Staff' }));
            expect(mockRoleCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'CISC 101' }));

            // Channel creation (1 category + 4 text + 2 staff = 7)
            expect(mockChannelCreate).toHaveBeenCalledTimes(7);
            expect(mockChannelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'CISC 101', type: ChannelType.GuildCategory }));
            expect(mockChannelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '101_general' }));
            expect(mockChannelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '101_staff' }));

            // DB insert
            expect(mockInsertOne).toHaveBeenCalledTimes(1);
            expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({
                name: courseName,
                channels: expect.objectContaining({
                    category: 'category-id',
                    general: 'general-id',
                    staff: 'staff-id',
                    private: 'private-id'
                }),
                roles: expect.objectContaining({
                    staff: 'staff-role-id',
                    student: 'student-role-id'
                })
            }));

            // Update dropdowns
            expect(mockedUpdateDropdowns).toHaveBeenCalledWith(mockInteraction);

            // Final reply
            expect(mockEditReply).toHaveBeenLastCalledWith(`Successfully added course with ID ${courseName}`);
        });
    });

    // ------------------------------------------------------------------
    // Error Cases
    // ------------------------------------------------------------------

    describe('Failure Path', () => {
        it('should reply with an error if the course already exists', async () => {
            const courseName = '102';

            // --- Arrange ---
            mockGetString.mockReturnValue(courseName);

            // 1. DB check (course exists)
            mockCountDocuments.mockResolvedValue(1);

            
            // --- Act ---
            await command.run(mockInteraction);

            
            // --- Assert ---
            // Initial reply
            expect(mockReply).toHaveBeenCalledWith('<a:loading:755121200929439745> working...');
            
            // DB check
            expect(mockCountDocuments).toHaveBeenCalledWith({ name: courseName });

            // Reply after early return
            expect(mockEditReply).toHaveBeenCalledWith({
                content: `${courseName} has already been registered as a course.`,
            });
            // Ensure the following actions were NOT executed
            expect(mockRoleCreate).not.toHaveBeenCalled();
            expect(mockChannelCreate).not.toHaveBeenCalled();
            expect(mockInsertOne).not.toHaveBeenCalled();
            expect(mockedUpdateDropdowns).not.toHaveBeenCalled();
        });
    });
});
