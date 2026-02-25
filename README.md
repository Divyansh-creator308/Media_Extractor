# Media Extractor

A full-stack web application to extract media formats from supported URLs and allow users to download selected formats with real-time progress tracking.

## Prerequisites

This application requires `yt-dlp` and `ffmpeg` to be installed on your system.

### macOS

1. Install Homebrew (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Install `yt-dlp` and `ffmpeg`:
   ```bash
   brew install yt-dlp ffmpeg
   ```

### Windows

1. Install Scoop (if not already installed):
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```
2. Install `yt-dlp` and `ffmpeg`:
   ```powershell
   scoop install yt-dlp ffmpeg
   ```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `PORT`: The port on which the server will run (default: 3000).

## Public Deployment

To deploy publicly:
1. Ensure the host environment has `yt-dlp` and `ffmpeg` installed.
2. Build the frontend:
   ```bash
   npm run build
   ```
3. Start the production server:
   ```bash
   npm start
   ```
   *(Ensure `package.json` has a `"start": "node server.ts"` script configured for production if using a custom server).*
