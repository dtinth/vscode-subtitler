# subtitler

An extension to help me create subtitle files in VS Code.

- Use its own plain text file format, which then can be converted into SRT files.
- Supports loading and playing a Vorbis audio track to help with synchronization.

## Setup

- Open this Git repository, run `yarn` to install the dependencies, then press Cmd+Shift+B to run the build task, and press F5 to launch VS Code with the extension enabled.

- In the workspace’s `.vscode/settings.json` file, add a ruler to the editor to prevent subtitle from being too long.

  ```json
  {
    "editor.rulers": [42]
  }
  ```
