import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';

// Ensure local binaries (yt-dlp, ffmpeg) downloaded during Render build are in PATH
process.env.PATH = `${process.cwd()}:${process.env.PATH}`;

// Initialize cookie file if env var exists, otherwise check for local file
let COOKIE_FILE_PATH = path.join(os.tmpdir(), 'youtube_cookies.txt');
if (process.env.YOUTUBE_COOKIES) {
  try {
    fs.writeFileSync(COOKIE_FILE_PATH, process.env.YOUTUBE_COOKIES, 'utf8');
    console.log('YouTube cookies loaded from environment variable.');
  } catch (err) {
    console.error('Failed to write YouTube cookies file:', err);
  }
} else if (fs.existsSync(path.join(process.cwd(), 'cookies.txt'))) {
  COOKIE_FILE_PATH = path.join(process.cwd(), 'cookies.txt');
  console.log('YouTube cookies loaded from local cookies.txt file.');
} else {
  COOKIE_FILE_PATH = ''; // No cookies available
}

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

    const ytDlpArgs = [
      '-J',
      '--no-colors',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=ios,android,web',
      '--force-ipv4',
      '--geo-bypass',
      '--no-warnings'
    ];
    
    if (COOKIE_FILE_PATH && fs.existsSync(COOKIE_FILE_PATH)) {
      ytDlpArgs.push('--cookies', COOKIE_FILE_PATH);
    }
    
    ytDlpArgs.push(url);

    const ytDlp = spawn('yt-dlp', ytDlpArgs);

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

    ytDlp.on('close', async (code) => {
      if (hasResponded) return;
      hasResponded = true;
      if (code !== 0) {
        console.error('yt-dlp error:', stderr);
        
        const isKnownPlatform = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('instagram.com') || url.includes('tiktok.com') || url.includes('twitter.com') || url.includes('x.com');
        const isBotError = stderr.includes('Sign in to confirm') || stderr.includes('HTTP Error 403') || stderr.includes('bot') || stderr.includes('Login required') || stderr.toLowerCase().includes('redirecting to login') || stderr.includes('HTTP Error 401');

        if (isKnownPlatform || isBotError) {
          console.log('Extraction failed or bot detection triggered. Falling back to Cobalt API...');
          try {
            let title = "Media";
            let thumbnail = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80";
            
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
              try {
                const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
                const oembedData = await oembedRes.json();
                if (oembedData.title) title = oembedData.title;
                if (oembedData.thumbnail_url) thumbnail = oembedData.thumbnail_url;
              } catch (e) { /* ignore */ }
            } else if (url.includes('instagram.com')) {
              title = "Instagram Media";
              thumbnail = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80";
            } else if (url.includes('tiktok.com')) {
              title = "TikTok Video";
            } else if (url.includes('x.com') || url.includes('twitter.com')) {
              title = "X (Twitter) Video";
            }

            return res.json({
              title,
              thumbnail,
              duration: 0,
              formats: [
                {
                  format_id: "cobalt_video_max",
                  ext: "mp4",
                  resolution: "Best Quality (Auto)",
                  filesize: 0,
                  vcodec: "h264",
                  acodec: "aac",
                  video_only: false,
                  audio_only: false,
                  combined: true,
                  format_note: "Bypassed via external API",
                  fps: null
                },
                {
                  format_id: "cobalt_video_1080",
                  ext: "mp4",
                  resolution: "1080p",
                  filesize: 0,
                  vcodec: "h264",
                  acodec: "aac",
                  video_only: false,
                  audio_only: false,
                  combined: true,
                  format_note: "Bypassed via external API",
                  fps: null
                },
                {
                  format_id: "cobalt_video_720",
                  ext: "mp4",
                  resolution: "720p",
                  filesize: 0,
                  vcodec: "h264",
                  acodec: "aac",
                  video_only: false,
                  audio_only: false,
                  combined: true,
                  format_note: "Bypassed via external API",
                  fps: null
                },
                {
                  format_id: "cobalt_video_480",
                  ext: "mp4",
                  resolution: "480p",
                  filesize: 0,
                  vcodec: "h264",
                  acodec: "aac",
                  video_only: false,
                  audio_only: false,
                  combined: true,
                  format_note: "Bypassed via external API",
                  fps: null
                },
                {
                  format_id: "cobalt_video_360",
                  ext: "mp4",
                  resolution: "360p",
                  filesize: 0,
                  vcodec: "h264",
                  acodec: "aac",
                  video_only: false,
                  audio_only: false,
                  combined: true,
                  format_note: "Bypassed via external API",
                  fps: null
                },
                {
                  format_id: "cobalt_audio",
                  ext: "mp3",
                  resolution: "Audio Only",
                  filesize: 0,
                  vcodec: "none",
                  acodec: "mp3",
                  video_only: false,
                  audio_only: true,
                  combined: false,
                  format_note: "Bypassed via external API",
                  fps: null
                }
              ]
            });
          } catch (e) {
            return res.status(400).json({ error: 'Extraction failed, and fallback API failed.' });
          }
        }

        let errorMessage = 'Failed to extract media info. Ensure the URL is valid and supported.';
        if (stderr.includes('Unsupported URL')) {
          errorMessage = 'The provided URL is not supported by the extractor.';
        } else if (stderr.includes('Video unavailable')) {
          errorMessage = 'The video is unavailable, private, or deleted.';
        } else if (stderr.includes('Private video')) {
          errorMessage = 'This video is private and requires authentication.';
        }
        
        return res.status(400).json({ error: errorMessage, details: stderr.substring(0, 200) });
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

    // Handle Cobalt API Fallback Downloads
    if (format_id.startsWith('cobalt_')) {
      res.json({ downloadId });
      
      const isAudio = format_id === 'cobalt_audio';
      const ext = isAudio ? 'mp3' : 'mp4';
      const filename = `${downloadId}.${ext}`;
      const outputTemplate = path.join(downloadsDir, filename);
      
      let vQuality = "max";
      if (format_id.startsWith('cobalt_video_')) {
        vQuality = format_id.replace('cobalt_video_', '');
      }

      activeDownloads.set(downloadId, { progress: 10, status: 'Bypassing Bot Detection...' });

      try {
        const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            url: url,
            isAudioOnly: isAudio,
            vQuality: vQuality
          })
        });

        if (!cobaltRes.ok) {
          let errorText = `Bypass API failed with status ${cobaltRes.status}`;
          try {
            const errorData = await cobaltRes.json();
            if (errorData.text) errorText = errorData.text;
          } catch (e) { /* ignore */ }
          throw new Error(errorText);
        }
        
        const cobaltData = await cobaltRes.json();
        if (cobaltData.status === 'error') throw new Error(cobaltData.text || 'Unknown bypass error');
        
        let downloadUrl = cobaltData.url;
        if (cobaltData.status === 'picker' && cobaltData.picker && cobaltData.picker.length > 0) {
          downloadUrl = cobaltData.picker[0].url;
        }

        if (!downloadUrl) throw new Error('No download URL returned from bypass server');
        
        activeDownloads.set(downloadId, { progress: 30, status: 'Downloading from Bypass Server...' });

        const fileRes = await fetch(downloadUrl);
        if (!fileRes.ok) throw new Error('Failed to fetch media from bypass server');
        
        const totalSize = parseInt(fileRes.headers.get('content-length') || '0', 10);
        let downloadedSize = 0;
        
        const dest = fs.createWriteStream(outputTemplate);
        
        if (fileRes.body) {
          // @ts-ignore
          const reader = fileRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            downloadedSize += value.length;
            if (totalSize > 0) {
              const percent = 30 + ((downloadedSize / totalSize) * 69);
              activeDownloads.set(downloadId, { progress: percent, status: 'Downloading' });
            }
            dest.write(value);
          }
          dest.end();
          
          activeDownloads.set(downloadId, { 
            progress: 100, 
            status: 'Completed', 
            filename: filename 
          });
        } else {
          throw new Error('No response body from bypass server');
        }
      } catch (err: any) {
        console.error('Cobalt fallback error:', err);
        activeDownloads.set(downloadId, { progress: 0, status: 'Error', error: err.message || 'Bypass server failed to process this video.' });
      }
      return;
    }

    // Start normal yt-dlp download process in background
    const outputTemplate = path.join(downloadsDir, `${downloadId}_%(ext)s`);
    
    let formatArg = format_id;
    if (needs_merge) {
      formatArg = `${format_id}+bestaudio/best`;
    }

    const ytDlpArgs = [
      '-f', formatArg,
      '-o', outputTemplate,
      '--newline',
      '--no-colors',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=ios,android,web',
      '--force-ipv4',
      '--geo-bypass'
    ];

    if (COOKIE_FILE_PATH && fs.existsSync(COOKIE_FILE_PATH)) {
      ytDlpArgs.push('--cookies', COOKIE_FILE_PATH);
    }

    ytDlpArgs.push(url);

    const ytDlp = spawn('yt-dlp', ytDlpArgs);

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
