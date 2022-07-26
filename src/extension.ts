import * as vscode from 'vscode'
import * as fs from 'fs'
import { parseTime, setTime } from './utils'
import { SubtitlerCommand } from './types'

interface Resources {
  collection: vscode.DiagnosticCollection
  decorationType: vscode.TextEditorDecorationType
  activeDecorationType: vscode.TextEditorDecorationType
  setSegments: (segments: SubtitleSegment[], uri: vscode.Uri) => void
}

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
      provider.postMessage({ type: 'insertTime' })
    }),
    vscode.commands.registerCommand('subtitler.seekForward', async () => {
      provider.postMessage({ type: 'seek', delta: 2 })
    }),
    vscode.commands.registerCommand('subtitler.seekBackward', async () => {
      provider.postMessage({ type: 'seek', delta: -2 })
    }),
    vscode.commands.registerCommand('subtitler.jumpToText', async () => {
      provider.jumpToText()
    }),
    vscode.commands.registerCommand('subtitler.playPause', async () => {
      provider.postMessage({ type: 'playPause' })
    }),
    vscode.commands.registerCommand('subtitler.generateVtt', async () => {
      provider.generateVtt()
    }),
  )
  subscribeToDocumentChanges(context, {
    collection: vscode.languages.createDiagnosticCollection('subtitler'),
    decorationType: vscode.window.createTextEditorDecorationType({
      color: '#bbeeff',
    }),
    activeDecorationType: vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      fontWeight: 'bold',
      backgroundColor: '#8b868577',
    }),
    setSegments: (segments, uri) => {
      provider.publishSegments(segments, uri)
    },
  })
}

class SubtitlerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'subtitler.view'

  private _view?: vscode.WebviewView
  private _segments: SubtitleSegment[] | undefined
  private _uri: vscode.Uri | undefined
  private _registrationId = 0
  private _nextRegistrationId = 1

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
      console.log('received message', data.type)
      switch (data.type) {
        case 'setTimeInDocument': {
          const editor = vscode.window.activeTextEditor
          if (editor) {
            setTime(editor, '@' + data.time)
          }
          break
        }
        case 'setActiveSegmentIndex': {
          if (this._segments && this._registrationId === data.id) {
            this._segments[data.index].markAsActive()
          }
        }
      }
    })
  }

  postMessage(command: SubtitlerCommand) {
    if (this._view) {
      this._view.webview.postMessage(command)
    }
  }

  jumpToText() {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }
    const doc = editor.document
    let line = editor.selection.start.line
    for (let i = line; i >= 0; i--) {
      const time = parseTime(doc.lineAt(i).text)
      if (time) {
        this.postMessage({ type: 'jump', time: time.seconds })
        break
      }
    }
  }

  async generateVtt() {
    if (!this._segments || !this._uri) {
      return
    }
    const vttLines: string[] = ['WEBVTT', '']
    for (const segment of this._segments) {
      if (
        !segment.endTime ||
        !segment.lines.length ||
        segment.lines.join('').trim() === '-'
      ) {
        continue
      }
      const formatWebVttTime = (ts: number) => {
        // Format is HH:MM:SS,mmm
        const hours = Math.floor(ts / 3600)
        const minutes = Math.floor((ts % 3600) / 60)
        const seconds = Math.floor(ts % 60)
        const milliseconds = Math.floor((ts % 1) * 1000)
        return [
          hours.toString().padStart(2, '0'),
          ':',
          minutes.toString().padStart(2, '0'),
          ':',
          seconds.toString().padStart(2, '0'),
          '.',
          milliseconds.toString().padStart(3, '0'),
        ].join('')
      }
      const configuration = vscode.workspace.getConfiguration('subtitler')
      const offset = configuration.get<number>('offset', 0)
      const gap = configuration.get<number>('gap', 0)
      vttLines.push(
        [
          formatWebVttTime(segment.startTime - offset),
          formatWebVttTime(segment.endTime - offset - gap),
        ].join(' --> '),
      )
      for (const line of segment.lines) {
        vttLines.push(line.replace(/`([^`]+)`/g, (a, x) => `<i>${x}</i>`))
      }
      vttLines.push('')
    }
    const file = this._uri.with({
      path: this._uri.path.replace(/(?:\.txt)?$/, '.vtt'),
    })
    await vscode.workspace.fs.writeFile(file, Buffer.from(vttLines.join('\n')))
    await vscode.window.showTextDocument(file)
  }

  publishSegments(segments: SubtitleSegment[], uri: vscode.Uri) {
    this._segments = segments
    this._uri = uri
    this._registrationId = this._nextRegistrationId++
    this.postMessage({
      type: 'registerSegments',
      id: this._registrationId,
      times: segments.map((s) => s.startTime),
    })
    console.log('registered segments', this._registrationId, segments.length)
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return fs.readFileSync(__dirname + '/../media/index.html', 'utf8')
  }
}

type SubtitleSegment = {
  startLine: number
  endLine: number
  startTime: number
  endTime?: number
  characterCount: number
  lines: string[]
  ended: boolean
  flush: () => void
  markAsActive: () => void
}

export function refresh(
  editor: vscode.TextEditor,
  { collection, decorationType, activeDecorationType, setSegments }: Resources,
): void {
  const diagnostics: vscode.Diagnostic[] = []
  const decorations: vscode.DecorationOptions[] = []
  const doc = editor.document
  let current: SubtitleSegment | undefined
  const segments: SubtitleSegment[] = []

  for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
    const lineOfText = doc.lineAt(lineIndex)
    const ts = parseTime(lineOfText.text)
    if (ts) {
      if (current) {
        current.endTime = ts.seconds
        current.flush()
        current = undefined
      }
      const decoration: vscode.DecorationOptions = {
        range: lineOfText.range,
      }
      const segment: SubtitleSegment = {
        startTime: ts.seconds,
        startLine: lineIndex,
        endLine: lineIndex,
        characterCount: 0,
        lines: [],
        flush: () => {
          if (segment.endTime) {
            const time = segment.endTime - segment.startTime
            const cps = Math.floor(segment.characterCount / time)
            decoration.renderOptions = {
              after: {
                contentText: ` — ${cps} CPS`,
                color: '#8b8685',
              },
            }
            if (segment.endTime < segment.startTime) {
              diagnostics.push({
                severity: vscode.DiagnosticSeverity.Error,
                range: lineOfText.range,
                message: 'Timestamp is out-of-order',
              })
            }
            if (cps > 20) {
              diagnostics.push({
                severity: vscode.DiagnosticSeverity.Warning,
                range: lineOfText.range,
                message: 'Too many characters per second',
              })
            }
          }
        },
        markAsActive: () => {
          editor.setDecorations(activeDecorationType, [
            {
              range: lineOfText.range,
            },
          ])
        },
        ended: false,
      }
      current = segment
      decorations.push(decoration)
      segments.push(segment)
    } else if (current) {
      current.characterCount += lineOfText.text.replace(/\s/g, '').length
      if (lineOfText.text.trim() && !current.ended) {
        current.endLine = lineIndex
        current.lines.push(lineOfText.text)
      } else {
        current.ended = true
      }
    }
  }
  if (current) {
    current.flush()
    current = undefined
  }
  collection.set(doc.uri, diagnostics)
  editor.setDecorations(decorationType, decorations)
  setSegments(segments, doc.uri)
}

export function subscribeToDocumentChanges(
  context: vscode.ExtensionContext,
  resources: Resources,
): void {
  if (vscode.window.activeTextEditor) {
    refresh(vscode.window.activeTextEditor, resources)
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        refresh(editor, resources)
      }
    }),
  )
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (vscode.window.activeTextEditor) {
        refresh(vscode.window.activeTextEditor, resources)
      }
    }),
  )
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      resources.collection.delete(doc.uri),
    ),
  )
}
