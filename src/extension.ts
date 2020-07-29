/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';

import { ConfigurationTarget, ExtensionContext, commands, workspace, WorkspaceConfiguration, window, env, Uri } from 'vscode';

interface Gist {
	id: string;
	html_url: string;
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

export async function activate(context: ExtensionContext) {
	await applyCurrentSettings();

	context.subscriptions.push(
		commands.registerCommand('persona.removeSettings', removeSettings),
	);
}

async function applyCurrentSettings() {
	const { settings, version } = await getGistSettings(gistId);
	await applySettings(settings, version);
}

async function removeSettings() {
	const config = workspace.getConfiguration();
	const previousVersion = config.get<string>(appliedVersionKey);
	if (!previousVersion) {
		const message = 'There is no applied version in the settings and without that the settings to remove cannot be determined. You might have already removed them.';
		await window.showInformationMessage(message, { modal: true });
		return;
	}

	const removeSettings = 'Remove Settings';
	const showAppliedSettings = 'Show Applied Settings';
	const message = 'If one of your personal settings happends to be equal to the currently applied setting, that setting will be removed too.';
	const result = await window.showWarningMessage(message, { modal: true }, removeSettings, showAppliedSettings);
	if (result === removeSettings) {
		await applySettings({}, undefined);
		const message = 'Done. You might want to uninstall the Persona extension to avoid having the settings reapplied when VS Code starts.';
		await window.showInformationMessage(message, { modal: true });
	} else if (result === showAppliedSettings) {
		const gist = await getGistSettings(previousVersion);
		await env.openExternal(Uri.parse(gist.html_url));
	}
}

async function applySettings(settings: any, version: string | undefined) {
	const config = workspace.getConfiguration();
	const previousVersion = config.get<string>(appliedVersionKey);
	
	if (version === previousVersion) {
		console.log('Persona: Nothing to do.');
		return;
	}
	
	const previousSettings = previousVersion && (await getGistSettings(previousVersion)).settings || undefined;

	await mergeSettings(config, settings, previousSettings);
	await config.update(appliedVersionKey, version, ConfigurationTarget.Global);
}

async function getGistSettings(idOrVersion: string) {
	const buf = await httpsGet(`https://api.github.com/gists/${idOrVersion}`);
	const gist = JSON.parse(buf.toString()) as Gist;
	const settings = JSON.parse(gist.files['settings.json'].content);
	const version = `${gist.id}/${gist.history[0].version}`;
	const { html_url } = gist;
	return { settings, version, html_url };
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
	for (const key in previousSettings) {
		if (!(key in settings)) {
			const currentValue = config.inspect(key)?.globalValue;
			const previousValue = previousSettings[key];
			if (currentValue === previousValue) {
				await config.update(key, undefined, ConfigurationTarget.Global);
			}
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
