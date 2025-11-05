# Task 2.3.1 – Discord Command Flow Test Cases

## Slash Dispatch

- Simulate a slash interaction where `command.permissions` includes the member’s role to ensure `runCommand` invokes the command’s `run` method once and does not send a failure reply (src/pieces/commandManager.ts:258).
- Simulate an unauthorized member (no matching role or user permission) and confirm one of the failure strings is sent while `command.run` is never invoked (src/pieces/commandManager.ts:268-288).
- Force a command with `runInGuild = false` in a guild text channel to verify the “DM-only” guard returns the ephemeral warning (src/pieces/commandManager.ts:261-265).

## Poll Flow

- Execute the `/poll` command with valid options to validate it replies with an embed and buttons, and inserts a poll document into Mongo (src/commands/fun/poll.ts:56-144).
- Provide duplicate options or an invalid timespan to ensure `generateErrorEmbed` paths return ephemeral errors without touching Mongo (src/commands/fun/poll.ts:60-85).
- Trigger a poll button interaction for a new voter and verify `handlePollOptionSelect` updates the message, persists the `tally, and sends the “vote recorded” response (src/commands/fun/poll.ts:152-213).
- Re-click the same option (covering both `Single` and `Multiple` types) to assert the removal logic runs and the “vote removed” path is used exactly once (src/commands/fun/poll.ts:165-211).

## Rock Paper Scissors

- Run the `/rockpaperscissors` command and check the reply contains three buttons whose custom IDs encode owner and timer data; confirm the timeout callback clears components when triggered (src/commands/fun/rockpaperscissors.ts:14-74).
- Process a button press from a different user to confirm the ephemeral “You cannot respond” guard triggers and no message edit occurs (src/commands/fun/rockpaperscissors.ts:87-97).
- Process an authorized press and assert the timer clear, message edit, and `deferUpdate` happen while the embed text reflects the computed winner (src/commands/fun/rockpaperscissors.ts:99-124).

## Modal & Button Workflows

- Invoke `/announce` and assert the modal passed to `showModal` pre-populates channel and file fields from the command options (src/commands/admin/announce.ts:25-64).
- Feed the resulting modal submission into `handleModalBuilder` and verify the target channel’s `send` receives the composed payload with optional file handling (src/pieces/commandManager.ts:106-120).
- Click the `verify` button to confirm `handleButton` builds the expected modal with length restrictions (src/pieces/commandManager.ts:151-172).
- Submit the verification modal with a valid hash and ensure `verify` updates Mongo, grants roles, and replies with the enrollment message; also cover the invalid hash branch that DMs the user (src/pieces/commandManager.ts:132-146, src/pieces/verification.ts:5-20).

## Role Select Flow

- Mimic a dropdown submission adding new course roles to assert member role mutations, Mongo updates for `SageUser.courses`, and the summarized reply content (src/pieces/commandManager.ts:54-99).
- Mimic removing roles (both course and non-course) to verify the unenroll path removes student roles and updates Mongo accordingly (src/pieces/commandManager.ts:63-79).

## Interaction Routing

- Call `interactionHandler.register`, emit a `ButtonInteraction` with `customId` prefix `P`, and ensure it delegates to `handlePollOptionSelect`; repeat with prefix `RPS` to cover `handleRpsOptionSelect` (src/pieces/interactionHandler.ts:6-24).
