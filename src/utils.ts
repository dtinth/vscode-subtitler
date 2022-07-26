import * as vscode from 'vscode'

export async function setTime(editor: vscode.TextEditor, time: string) {
  let line = editor.selection.start.line
  for (let i = line - 1; i >= 0; i--) {
    if (editor.document.lineAt(i).text.trim()) {
      line = i
    } else {
      break
    }
  }
  await editor.edit((edit) => {
    const lineObj = editor.document.lineAt(line)
    if (parseTime(lineObj.text)) {
      edit.replace(lineObj.range, `[${time}]`)
    } else {
      edit.replace(new vscode.Range(line, 0, line, 0), `[${time}]\n`)
    }
  })
  let found = false
  for (let i = line + 1; i < editor.document.lineCount; i++) {
    if (editor.document.lineAt(i).text.trim()) {
      if (found) {
        editor.selection = new vscode.Selection(
          new vscode.Position(i, 0),
          new vscode.Position(i, 0),
        )
        break
      }
    } else {
      found = true
    }
  }
}

export function parseTime(text: string) {
  const m = text.trim().match(/^\[@?([\d:.]+)\]$/)
  if (m) {
    return { seconds: +m[1] }
  } else {
    return null
  }
}
