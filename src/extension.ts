import * as vscode from 'vscode';
import ollama from 'ollama';

export function activate(context: vscode.ExtensionContext) {

    console.log('ogre copilot activated');

    const startDisposable = vscode.commands.registerCommand('ogre-copilot.start', async () => {
        const panel = vscode.window.createWebviewPanel(
            'ogreCopilot',
            'Ogre Copilot',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const availableModels = await getAvailableModelsHelper();

        panel.webview.html = getWebviewContent(availableModels); 

        panel.webview.onDidReceiveMessage(async (message: any) => {
            console.log('received message:', message);
            if (message.type === 'chat') {
                const userPrompt = message.text;
                const selectedModel = message.model;
                let responseText = '';

                try {
                    const streamResponse = await ollama.chat({ 
                        model: selectedModel,
                        messages: [{ role: 'user', content: userPrompt }],
                        stream: true 
                    });

                    for await (const part of streamResponse) {
                        responseText += part.message.content;
                        panel.webview.postMessage({ command: 'chatResponse', text: responseText });
                    }
                } catch (err) {
                    console.error('Error during chat:', err);
                    panel.webview.postMessage({ command: 'chatResponse', text: `Error: ${String(err)}` }); 
                }
            }
        });
    });

    context.subscriptions.push(startDisposable);
}

function getWebviewContent(models: string[]): string {
    const modelOptions = models.map(model => `<option value="${model}">${model}</option>`).join('\n');
    return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: sans-serif; margin: 1rem; }
                #prompt { width: 100%; box-sizing: border-box; }
                #response { border: 1px solid green; margin-top: 1rem; padding: 0.5rem; }
            </style>
        </head>
        <body>
            <h2>Ogre Copilot Extension</h2>
            <p>Least helpful copilot ever</p>
            <select id="model">
                ${modelOptions}
            </select><br />
            <textarea id="prompt" placeholder="Ask a question ooga booga"></textarea><br />
            <button id="askBtn">Ask</button>
            <div id="response"> </div>
            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('askBtn').addEventListener('click', () => {
                    const text = document.getElementById('prompt').value;
                    const model = document.getElementById('model').value;
                    vscode.postMessage({ type: 'chat', text, model });
                    console.log('sent message:', text, model);
                });

                window.addEventListener('message', event => {
                    const { command, text } = event.data;
                    if (command === 'chatResponse') {
                        document.getElementById('response').innerText = text;
                    }
                    console.log('received message:', event.data);
                });
            </script>
        </body>
        </html>
    `;
}

async function getAvailableModelsHelper(): Promise<string[]> {
    let availableModels: string[] = [];
    try {
        const response = await ollama.list();
        availableModels = response.models.map((model: any) => model.name);
    } catch (err) {
        console.error('Error fetching models:', err);
    }
    return availableModels;
}

// This method is called when your extension is deactivated
export function deactivate() {}
