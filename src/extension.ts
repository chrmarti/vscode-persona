import { ConfigurationTarget, ExtensionContext, commands, workspace } from 'vscode';

export function activate(context: ExtensionContext) {

	console.log('Congratulations, your extension "Persona" is now active!');

	let disposable = commands.registerCommand('persona.applySettings', async () => {
		const config = workspace.getConfiguration();
		const theme = config.inspect('workbench.colorTheme');
		if (!theme?.globalValue) {
			await config.update('workbench.colorTheme', 'Default Light+', ConfigurationTarget.Global);
		}
	});

	context.subscriptions.push(disposable);
}
