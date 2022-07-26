import * as assert from 'assert'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode'
import { setTime } from '../../utils'
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.')

  test('setTime', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content:
        'line one\nline two\n\nline three\nline four\n\nline five\nline six',
      language: 'plaintext',
    })
    const editor = await vscode.window.showTextDocument(doc)
    editor.selection = new vscode.Selection(
      new vscode.Position(3, 0),
      new vscode.Position(3, 0),
    )
    await setTime(editor, '00:00.00')
    assert.equal(
      editor.document.getText(),
      'line one\nline two\n\n[00:00.00]\nline three\nline four\n\nline five\nline six',
    )
    await setTime(editor, '00:01.00')
    assert.equal(
      editor.document.getText(),
      'line one\nline two\n\n[00:00.00]\nline three\nline four\n\n[00:01.00]\nline five\nline six',
    )
    await setTime(editor, '00:02.00')
    assert.equal(
      editor.document.getText(),
      'line one\nline two\n\n[00:00.00]\nline three\nline four\n\n[00:02.00]\nline five\nline six',
    )
  })
})
