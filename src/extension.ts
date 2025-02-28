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
                        responseText += part.message.content
                        panel.webview.postMessage({ command: 'chatResponse', text: responseText });
                    }
                } catch (err) {
                    panel.webview.postMessage({ command: 'chatResponse', text: `Error: ${String(err)}` }); 
                }
            }
            else if (message.type === 'pull') {
                const modelName = message.model;
                console.log('pulling model:', modelName);
				let loadingResponse = '';
                try {
                    const pullResponse = await ollama.pull({
                        model: modelName,
                        stream: true
                    });

                    for await (const part of pullResponse) {
                        const progress = (part.completed / part.total) * 100;
						part.status == 'success' ? loadingResponse = `Model ${modelName} pulled successfully` : loadingResponse = `Loading model ${modelName}...\n`;
						panel.webview.postMessage({ command: 'progressResponse', text: loadingResponse });
                        panel.webview.postMessage({ command: 'updateProgress', progress });
                        console.log('pull response:', part);
                    }
                    panel.webview.postMessage({ command: 'prorgressResponse', text: `Model ${modelName} pulled successfully` });
                
					// update the available models list
					let availableModels = await getAvailableModelsHelper();
					panel.webview.postMessage({ command: 'updateModels', models: availableModels });
				} catch (err) {
                    panel.webview.postMessage({ command: 'chatResponse', text: `Error: ${String(err)}` });
                }
            }
        });
    });

    context.subscriptions.push(startDisposable);
}

function getWebviewContent(models: string[]): string {
    let modelOptions = models.map(model => `<option value="${model}">${model}</option>`).join('\n');
    return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: sans-serif; margin: 1rem; }
                #prompt { width: 100%; box-sizing: border-box; }
                #response { border: 1px solid green; margin-top: 1rem; padding: 0.5rem; }
				#progressResponse { border: 1px solid green; padding: 0.5rem; }
                #models > * { margin-right: 0.5rem; }
                .input { field-sizing: content; }
                #progressBarContainer { display: none; margin: 1rem; }
                #progressBar { width: 100%; height: 20px; background-color: #f3f3f3; border: 1px solid #ccc; }
                #progressBarFill { height: 100%; width: 0; background-color: #4caf50; }
            </style>
        </head>
        <body>
            <h2>Ogre Copilot Extension</h2>
            <p>Least helpful copilot ever</p>
            <div id="models" style="display: flex; flex-direction: row;">
                <select id="availableModels">
                    ${modelOptions}
                </select><br />
                <input id="modelInput" type="text" placeholder="Type the name of a model to pull, list at ollama.com/search"><br />
                <button id="pullBtn">Pull Model</button><br />
				<div id="progressResponse"> </div>
            </div>
            <div id="progressBarContainer">
                <div id="progressBar">
                    <div id="progressBarFill"></div>
                </div>
            </div>
            <textarea id="prompt" placeholder="Ask a question ooga booga"></textarea><br />
            <button id="askBtn">Ask</button>
            <div id="response"> </div>
            <script>
                // set the size of the model input to the length of the placeholder
                document.getElementById('modelInput').setAttribute('size', document.getElementById('modelInput').getAttribute('placeholder').length);

                const vscode = acquireVsCodeApi();

                // get the prompt from the textbox and send it to the extension
                document.getElementById('askBtn').addEventListener('click', () => {
                    const text = document.getElementById('prompt').value;
                    const model = document.getElementById('availableModels').value;
                    vscode.postMessage({ type: 'chat', text, model });
                    console.log('sent message:', text);
                });

                // get the desired model from the textbox and send it to the extension
                document.getElementById('pullBtn').addEventListener('click', () => {
                    const model = document.getElementById('modelInput').value;
                    vscode.postMessage({ type: 'pull', model });
                    console.log('sent message:', model);
                    document.getElementById('progressBarContainer').style.display = 'block';
                });

                // stream the response to the textbox
                window.addEventListener('message', event => {
                    const { command, text, progress, models } = event.data;
                    if (command === 'chatResponse') {
                        document.getElementById('response').innerText = text;
                    } else if (command === 'updateProgress') {
                        document.getElementById('progressBarFill').style.width = progress + '%';
                        if (progress === 100) {
                            document.getElementById('progressBarContainer').style.display = 'none';
                        }
                    } else if (command === 'progressResponse') {
						document.getElementById('progressResponse').innerText = text;
					} else if (command === 'updateModels') {
						const availableModels = document.getElementById('availableModels');
						availableModels.innerHTML = models.map(model => '<option value="' + model + '">' + model + '</option>').join('\\n');
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
