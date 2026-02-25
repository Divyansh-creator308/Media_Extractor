#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing Node dependencies..."
npm install

echo "Building frontend..."
npm run build

echo "Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o yt-dlp
chmod a+rx yt-dlp

echo "Downloading FFmpeg..."
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz
tar -xf ffmpeg.tar.xz
mv ffmpeg-*-static/ffmpeg .
mv ffmpeg-*-static/ffprobe .
chmod a+rx ffmpeg ffprobe
rm -rf ffmpeg.tar.xz ffmpeg-*-static

echo "Build complete! yt-dlp and ffmpeg are ready."
