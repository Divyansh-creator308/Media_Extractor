import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';

// Ensure local binaries (yt-dlp, ffmpeg) downloaded during Render build are in PATH
process.env.PATH = `${process.cwd()}:${process.env.PATH}`;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const downloadsDir = path.resolve(process.cwd(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Serve downloaded files
app.use('/downloads', express.static(downloadsDir));

const urlSchema = z.object({
  url: z.string().url(),
});

// Store active downloads for progress tracking
const activeDownloads = new Map<string, { progress: number; status: string; error?: string; filename?: string }>();

app.post('/api/info', async (req, res) => {
  try {
    const { url } = urlSchema.parse(req.body);

    const ytDlp = spawn('yt-dlp', [
      '-J',
      '--no-colors',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=android,web',
      '--geo-bypass',
      '--no-warnings',
      url
    ]);

    let hasResponded = false;

    ytDlp.on('error', (err: any) => {
      if (hasResponded) return;
      hasResponded = true;
      if (err.code === 'ENOENT') {
        return res.status(500).json({ error: 'yt-dlp is not installed on the server.' });
      }
      return res.status(500).json({ error: 'Failed to execute yt-dlp.' });
    });

    let stdout = '';
    let stderr = '';

    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (hasResponded) return;
      hasResponded = true;
      if (code !== 0) {
        console.error('yt-dlp error:', stderr);
        
        let errorMessage = 'Failed to extract media info. Ensure the URL is valid and supported.';
        if (stderr.includes('Sign in to confirm') || stderr.includes('HTTP Error 403') || stderr.includes('bot')) {
          errorMessage = 'The media provider blocked the request (IP ban/Bot detection). Try a different platform.';
        } else if (stderr.includes('Unsupported URL')) {
          errorMessage = 'The provided URL is not supported by the extractor.';
        } else if (stderr.includes('Video unavailable')) {
          errorMessage = 'The video is unavailable, private, or deleted.';
        }
        
        return res.status(400).json({ error: errorMessage });
      }

      try {
        let jsonStr = stdout;
        // Robust JSON extraction to ignore yt-dlp warnings/logs printed to stdout
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
        }
        
        const info = JSON.parse(jsonStr);
        const formats = info.formats || [];

        const structuredFormats = formats.map((f: any) => {
          const vcodec = f.vcodec !== 'none' ? f.vcodec : 'none';
          const acodec = f.acodec !== 'none' ? f.acodec : 'none';
          
          return {
            format_id: f.format_id,
            ext: f.ext,
            resolution: f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : 'audio only'),
            filesize: f.filesize || f.filesize_approx || 0,
            vcodec,
            acodec,
            video_only: vcodec !== 'none' && acodec === 'none',
            audio_only: vcodec === 'none' && acodec !== 'none',
            combined: vcodec !== 'none' && acodec !== 'none',
            format_note: f.format_note || '',
            fps: f.fps || null,
          };
        });

        res.json({
          title: info.title,
          thumbnail: info.thumbnail,
          duration: info.duration,
          formats: structuredFormats,
        });
      } catch (err) {
        console.error('JSON parse error:', err);
        res.status(500).json({ error: 'Failed to parse media info.' });
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid URL provided.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/download', async (req, res) => {
  try {
    const schema = z.object({
      url: z.string().url(),
      format_id: z.string(),
      needs_merge: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input.' });
    }
    const { url, format_id, needs_merge } = parsed.data;

    const downloadId = uuidv4();
    activeDownloads.set(downloadId, { progress: 0, status: 'Starting' });

    // Start download process in background
    const outputTemplate = path.join(downloadsDir, `${downloadId}_%(ext)s`);
    
    let formatArg = format_id;
    if (needs_merge) {
      formatArg = `${format_id}+bestaudio/best`;
    }

    const ytDlp = spawn('yt-dlp', [
      '-f', formatArg,
      '-o', outputTemplate,
      '--newline',
      '--no-colors',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=android,web',
      '--geo-bypass',
      url
    ]);

    ytDlp.on('error', (err: any) => {
      if (err.code === 'ENOENT') {
        activeDownloads.set(downloadId, { progress: 0, status: 'Error', error: 'yt-dlp is not installed on the server.' });
      } else {
        activeDownloads.set(downloadId, { progress: 0, status: 'Error', error: 'Failed to execute yt-dlp.' });
      }
    });

    ytDlp.stdout.on('data', (data) => {
      const output = data.toString();
      const progressMatch = output.match(/\[download\]\s+([\d.]+)%/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        activeDownloads.set(downloadId, { progress: percent, status: 'Downloading' });
      } else if (output.includes('[Merger]')) {
        activeDownloads.set(downloadId, { progress: 100, status: 'Merging' });
      }
    });

    ytDlp.stderr.on('data', (data) => {
      console.error(`yt-dlp stderr: ${data}`);
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        const files = fs.readdirSync(downloadsDir);
        const downloadedFile = files.find(f => f.startsWith(downloadId));
        
        if (downloadedFile) {
          activeDownloads.set(downloadId, { 
            progress: 100, 
            status: 'Completed', 
            filename: downloadedFile 
          });
        } else {
          activeDownloads.set(downloadId, { progress: 0, status: 'Error', error: 'File not found after download.' });
        }
      } else {
        activeDownloads.set(downloadId, { progress: 0, status: 'Error', error: 'Download failed.' });
      }
    });

    res.json({ downloadId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/progress/:downloadId', (req, res) => {
  const { downloadId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = () => {
    const data = activeDownloads.get(downloadId);
    if (data) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (data.status === 'Completed' || data.status === 'Error') {
        clearInterval(intervalId);
        res.end();
      }
    }
  };

  const intervalId = setInterval(sendProgress, 500);
  
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
