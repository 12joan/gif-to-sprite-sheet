#!/usr/bin/env node
const gifFrames = require('gif-frames');
const baseGetPixels = require('get-pixels')
const sharp = require('sharp');

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const buffer = [];
    stream.on('data', (chunk) => buffer.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(buffer)));
    stream.on('error', (error) => reject(error));
  });
}

function getPixels(...args) {
  return new Promise((resolve, reject) => {
    baseGetPixels(...args, (error, pixels) => {
      if (error) {
        reject(error);
      } else {
        resolve(pixels);
      }
    });
  });
}

function scan(pixels, direction, predicate) {
  const [width, height] = pixels.shape;
  let vertical, scanStart, scanEnd, scanIncrement, crossEnd;

  switch (direction) {
    case 'right':
      vertical = false;
      scanStart = 0;
      scanEnd = width;
      scanIncrement = 1;
      crossEnd = height;
      break;

    case 'left':
      vertical = false;
      scanStart = width;
      scanEnd = 0;
      scanIncrement = -1;
      crossEnd = height;
      break;

    case 'up':
      vertical = true;
      scanStart = height;
      scanEnd = 0;
      scanIncrement = -1;
      crossEnd = width;
      break;

    case 'down':
      vertical = true;
      scanStart = 0;
      scanEnd = height;
      scanIncrement = 1;
      crossEnd = width;
      break;

    default:
      throw new Error(`Invalid direction ${direction}`);
  }

  for (let s = scanStart; s !== scanEnd; s += scanIncrement) {
    for (let c = 0; c !== crossEnd; c++) {
      const [x, y] = vertical ? [c, s] : [s, c];
      if (predicate(x, y)) return s;
    }
  }

  return null;
}

(async () => {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath) {
    throw new Error('Missing input path');
  }

  if (!outputPath) {
    throw new Error('Missing output path');
  }

  const frames = await gifFrames({
    url: inputPath,
    frames: 'all',
    outputType: 'png',
  });

  const frameImages = await Promise.all(
    frames.map((frame) => streamToBuffer(frame.getImage()))
  );

  const startXs = [];
  const startYs = [];
  const endXs = [];
  const endYs = [];

  await Promise.all(frameImages.map(async (frameImage) => {
    const firstFramePixels = await getPixels(frameImage, 'image/png');

    function isOpaque(x, y) {
      return firstFramePixels.get(x, y, 3) > 0;
    }

    startXs.push(scan(firstFramePixels, 'right', isOpaque));
    startYs.push(scan(firstFramePixels, 'down', isOpaque));
    endXs.push(scan(firstFramePixels, 'left', isOpaque));
    endYs.push(scan(firstFramePixels, 'up', isOpaque));
  }));

  const startX = Math.min(...startXs);
  const startY = Math.min(...startYs);
  const endX = Math.min(...endXs);
  const endY = Math.min(...endYs);

  const frameWidth = endX - startX;
  const frameHeight = endY - startY;

  console.log(`frame width: ${frameWidth}px`);

  const croppedFrames = await Promise.all(frameImages.map(
    (frameImage) => sharp(frameImage)
      .extract({
        left: startX,
        top: startY,
        width: frameWidth,
        height: frameHeight,
      })
      .toBuffer()
  ));

  await sharp({
    create: {
      width: frameWidth * frameImages.length,
      height: frameHeight,
      channels: 4,
      background: 'transparent',
    },
  })
    .composite(croppedFrames.map((frame, i) => ({
      input: frame,
      top: 0,
      left: frameWidth * i,
    })))
    .toFile(outputPath);
})();
