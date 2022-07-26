import * as vscode from 'vscode'
import * as fs from 'fs'
import { setTime } from './utils'

export function activate(context: vscode.ExtensionContext) {
  const provider = new SubtitlerViewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SubtitlerViewProvider.viewType,
      provider,
    ),
  )
  context.subscriptions.push(
    vscode.commands.registerCommand('subtitler.insertTime', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        return
      }
      provider.insertTime()
    }),
  )
}

class SubtitlerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'subtitler.view'

  private _view?: vscode.WebviewView

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'timeInsert': {
          const editor = vscode.window.activeTextEditor
          if (editor) {
            setTime(editor, '@' + data.time)
          }
          break
        }
      }
    })
  }

  insertTime() {
    if (this._view) {
      this._view.webview.postMessage({ type: 'triggerTimeInsert' })
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return fs.readFileSync(__dirname + '/../media/index.html', 'utf8')
  }
}
