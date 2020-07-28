import * as https from 'https';

import { ConfigurationTarget, ExtensionContext, commands, workspace, WorkspaceConfiguration } from 'vscode';

interface Gist {
	id: string;
	files: Record<string, GistFile>;
	history: GistHistory[];
}

interface GistFile {
	filename: string;
	content: string;
}

interface GistHistory {
	version: string;
}

const gistId = 'eafc6c48f8de6a6f4703ad4f4697cb53';

const appliedVersionKey = 'persona.appliedVersion';

export function activate(context: ExtensionContext) {

	console.log('Congratulations, your extension "Persona" is now active!');

	context.subscriptions.push(
		commands.registerCommand('persona.applySettings', async () => {
			const config = workspace.getConfiguration();
			const previousVersion = config.get<string>(appliedVersionKey);
			
			const { settings, version } = await getGistSettings(gistId);
			if (version === previousVersion) {
				console.log('Persona: Nothing to do.');
				return;
			}
			
			const previousSettings = previousVersion && (await getGistSettings(gistId, previousVersion)).settings || undefined;

			await mergeSettings(config, settings, previousSettings);
			await config.update(appliedVersionKey, version, ConfigurationTarget.Global);
		})
	);
}

async function getGistSettings(id: string, sha?: string) {
	const shaSegment = sha ? `/${sha}` : '';
	const buf = await httpsGet(`https://api.github.com/gists/${id}${shaSegment}`);
	const gist = JSON.parse(buf.toString()) as Gist;
	const settings = JSON.parse(gist.files['settings.json'].content);
	const version = gist.history[0].version;
	return { settings, version };
}

async function mergeSettings(config: WorkspaceConfiguration, settings: any = {}, previousSettings: any = {}) {
	for (const key in settings) {
		const currentValue = config.inspect(key)?.globalValue;
		const previousValue = previousSettings[key];
		if (currentValue === previousValue) {
			const value = settings[key];
			await config.update(key, value, ConfigurationTarget.Global);
		}
	}
}

async function httpsGet(url: string) {
	return new Promise<Buffer>((resolve, reject) => {
		https.get(url, {
			headers: {
				'User-Agent': 'vscode-persona/0.0.1'
			}
		}, res => {
			if (res.statusCode! < 200 || res.statusCode! > 299) {
				reject(new Error(`HTTPS GET failed: ${res.statusCode}, ${res.statusMessage}`));
			} else {
				const chunks: Buffer[] = [];
				res.on('data', chunk => {
					chunks.push(chunk);
				});
				res.on('end', () => {
					resolve(Buffer.concat(chunks));
				});
			}
		}).on('error', reject);
	});
}
