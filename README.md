# subtitler

An extension to help me create subtitle files in VS Code.

This extension is not an editor for common subtitle formats which supports many different features. Instead, it has its own opinionated format, which can then be converted into WebVTT files.

- Instead of each cue having a start time and end times, they only have start time and then replaced by another cue. To clear the subtitle, is to create a cue with blank text. This means we assume that cues do not overlap.

It provides a rudimentary Vorbis audio player to help with synchronization.

## Setup

- Open this Git repository, run `yarn` to install the dependencies, then press Cmd+Shift+B to run the build task, and press F5 to launch VS Code with the extension enabled.

- In the workspace’s `.vscode/settings.json` file, add a ruler to the editor to prevent subtitle from being too long.

  ```json
  {
    "editor.rulers": [42]
  }
  ```

- Assign keyboard shortcuts to the following commands:

  - subtitler: Insert current time
  - subtitler: Jump to current text
  - subtitler: Seek forward
  - subtitler: Seek backward
  - subtitler: Play/Pause

- Convert your video to an OGG audio file (extension is `.oga`) and load it up in the player.
