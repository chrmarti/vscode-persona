/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';

import { ConfigurationTarget, ExtensionContext, commands, workspace, WorkspaceConfiguration, window, env, Uri } from 'vscode';

interface Gist {
	url: string;
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
	url: string;
	version: string;
}

const applySettingsKey = 'persona.applySettings';
const appliedVersionKey = 'persona.appliedVersion';
const preserveSettingsKey = 'persona.preserveSettings';

export async function activate(context: ExtensionContext) {
	await applyCurrentSettings();

	context.subscriptions.push(
		commands.registerCommand('persona.removeSettings', removeSettings),
	);
}

async function applyCurrentSettings() {
	const config = workspace.getConfiguration();
	const currentVersion = config.inspect<string>(applySettingsKey)!;
	const { settings, version } = await getGistSettings(currentVersion.globalValue?.trim() || currentVersion.defaultValue!);
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

	await applySettings({}, undefined);
	const message = 'Done. You might want to uninstall the Persona extension to avoid having the settings reapplied when VS Code starts.';
	await window.showInformationMessage(message, { modal: true });
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

async function getGistSettings(url: string) {
	const buf = await httpsGet(url);
	const gist = JSON.parse(buf.toString()) as Gist;
	const settings = JSON.parse(gist.files['settings.json'].content);
	const version = gist.history[0].url;
	const { html_url } = gist;
	return { settings, version, html_url };
}

async function mergeSettings(config: WorkspaceConfiguration, newSettings: any = {}, previousSettings: any = {}) {
	const settings: any = { ...newSettings };
	for (const key in previousSettings) {
		if (!(key in newSettings)) {
			settings[key] = undefined;
		}
	}

	const preserveSettings = config.get<string[]>(preserveSettingsKey) || [];
	for (const key in settings) {
		const currentValue = config.inspect(key)?.globalValue;
		const previousValue = previousSettings[key];
		const newValue = settings[key];
		if (newValue !== previousValue) {
			const i = preserveSettings.indexOf(key);
			if (currentValue === previousValue && i === -1) {
				await config.update(key, newValue, ConfigurationTarget.Global);
			} else if (currentValue === newValue && i === -1) {
				preserveSettings.push(key);
			} else if (currentValue !== newValue && i !== -1) {
				preserveSettings.splice(i, 1);
			}
		}
	}
	await config.update(preserveSettingsKey, preserveSettings.length ? preserveSettings : undefined, ConfigurationTarget.Global);
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
