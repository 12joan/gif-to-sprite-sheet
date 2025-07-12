# GIF to Sprite Sheet

Converts an animated GIF to a PNG sprite sheet. The bounding box of each frame is computed, and each frame is cropped to the combined bounding box of all frames.

## Installation

```
git clone https://github.com/12joan/gif-to-sprite-sheet
cd gif-to-sprite-sheet
npm install
npm link # Adds `gif-to-sprite-sheet` to your PATH
```

## Usage

```
gif-to-sprite-sheet input.gif sheet.png
```
