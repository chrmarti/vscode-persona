import * as https from 'https';

import { ConfigurationTarget, ExtensionContext, commands, workspace, WorkspaceConfiguration } from 'vscode';

const gistId = 'eafc6c48f8de6a6f4703ad4f4697cb53';

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

export function activate(context: ExtensionContext) {

	console.log('Congratulations, your extension "Persona" is now active!');

	context.subscriptions.push(
		commands.registerCommand('persona.applySettings', async () => {

			const buf = await httpsGet(`https://api.github.com/gists/${gistId}`);
			const gist = JSON.parse(buf.toString()) as Gist;
			const settings = JSON.parse(gist.files['settings.json'].content);

			const config = workspace.getConfiguration();
			await mergeSettings(config, settings);
		})
	);
}

async function mergeSettings(config: WorkspaceConfiguration, settings: any) {
	for (const key in settings) {
		const theme = config.inspect(key);
		if (!theme?.globalValue) {
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
