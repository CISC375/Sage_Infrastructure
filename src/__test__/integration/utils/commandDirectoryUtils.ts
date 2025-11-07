import path from 'path';
import { readdirSync } from 'fs';

/**
 * Returns command file names for a given commands directory relative to the integration tests.
 * This keeps flow tests in sync with the actual command files without manual lists.
 */
export function getCommandNames(relativeDir: string): string[] {
	const integrationRoot = path.resolve(__dirname, '..');
	const commandsDir = path.resolve(integrationRoot, relativeDir);
	return readdirSync(commandsDir, { withFileTypes: true })
		.filter(entry => entry.isFile() && /\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts'))
		.map(entry => entry.name.replace(/\.(ts|js)$/, ''));
}
