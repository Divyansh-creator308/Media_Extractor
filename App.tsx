import React, { useState, useEffect } from 'react';
import { Download, Loader2, Video, Music, Film, CheckCircle, AlertCircle } from 'lucide-react';

interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number;
  vcodec: string;
  acodec: string;
  video_only: boolean;
  audio_only: boolean;
  combined: boolean;
  format_note: string;
  fps: number | null;
}

interface MediaInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: Format[];
}

interface ProgressData {
  progress: number;
  status: string;
  error?: string;
  filename?: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return 'Unknown size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setInfo(null);
    setDownloadId(null);
    setProgress(null);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze URL');
      }

      setInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format_id: string, needs_merge: boolean = false) => {
    try {
      setError('');
      setDownloadId(null);
      setProgress(null);

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format_id, needs_merge }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start download');
      }

      setDownloadId(data.downloadId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!downloadId) return;

    const eventSource = new EventSource(`/api/progress/${downloadId}`);

    eventSource.onmessage = (event) => {
      const data: ProgressData = JSON.parse(event.data);
      setProgress(data);

      if (data.status === 'Completed' || data.status === 'Error') {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setProgress(prev => prev ? { ...prev, status: 'Error', error: 'Lost connection to server' } : null);
    };

    return () => {
      eventSource.close();
    };
  }, [downloadId]);

  const renderFormatGroup = (title: string, icon: React.ReactNode, formats: Format[], showMergeOption: boolean = false) => {
    if (formats.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800">
          {icon}
          {title}
        </h3>
        <div className="grid gap-3">
          {formats.map((f) => (
            <div key={f.format_id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="flex flex-col">
                <span className="font-medium text-slate-900">
                  {f.resolution} {f.fps ? `@ ${f.fps}fps` : ''}
                </span>
                <span className="text-sm text-slate-500">
                  {f.ext.toUpperCase()} • {formatBytes(f.filesize)} • {f.format_note}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Video: {f.vcodec} | Audio: {f.acodec}
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleDownload(f.format_id)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download
                </button>
                {showMergeOption && (
                  <button
                    onClick={() => handleDownload(f.format_id, true)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    title="Merge with best audio"
                  >
                    <Film size={16} />
                    + Audio
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 flex flex-col">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Media Extractor</h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            Extract and download media from YouTube, Instagram, X, TikTok, and more.
          </p>
        </div>

        <form onSubmit={handleAnalyze} className="mb-6 relative">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste media URL here..."
              className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-lg"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-medium text-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Analyze'}
            </button>
          </div>
        </form>

        <div className="text-center mb-12">
          <span className="text-3xl opacity-70 text-slate-900" style={{ fontFamily: "'Updock', cursive", fontWeight: 400, fontStyle: 'normal' }}>
            Created in Divyanshverse
          </span>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p>{error}</p>
          </div>
        )}

        {progress && (
          <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {progress.status === 'Completed' ? (
                  <CheckCircle className="text-emerald-500" />
                ) : progress.status === 'Error' ? (
                  <AlertCircle className="text-red-500" />
                ) : (
                  <Loader2 className="animate-spin text-indigo-500" />
                )}
                {progress.status}
              </h3>
              {progress.status === 'Downloading' && (
                <span className="font-mono text-sm font-medium text-slate-600">
                  {progress.progress.toFixed(1)}%
                </span>
              )}
            </div>

            {progress.status === 'Downloading' && (
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            )}

            {progress.status === 'Error' && (
              <p className="text-red-600 text-sm mt-2">{progress.error}</p>
            )}

            {progress.status === 'Completed' && progress.filename && (
              <div className="mt-4 flex justify-center">
                <a
                  href={`/downloads/${progress.filename}`}
                  download
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Download size={20} />
                  Save File to Device
                </a>
              </div>
            )}
          </div>
        )}

        {info && !progress && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row gap-6 items-center sm:items-start shadow-sm">
              {info.thumbnail && (
                <img
                  src={info.thumbnail}
                  alt={info.title}
                  className="w-full sm:w-48 aspect-video object-cover rounded-xl bg-slate-100"
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">{info.title}</h2>
                <p className="text-slate-500">
                  Duration: {Math.floor(info.duration / 60)}:{String(info.duration % 60).padStart(2, '0')}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {renderFormatGroup(
                'Combined (Video + Audio)',
                <Film className="text-indigo-500" />,
                info.formats.filter(f => f.combined).sort((a, b) => b.filesize - a.filesize)
              )}
              
              {renderFormatGroup(
                'Video Only',
                <Video className="text-emerald-500" />,
                info.formats.filter(f => f.video_only).sort((a, b) => b.filesize - a.filesize),
                true // Show merge option
              )}
              
              {renderFormatGroup(
                'Audio Only',
                <Music className="text-amber-500" />,
                info.formats.filter(f => f.audio_only).sort((a, b) => b.filesize - a.filesize)
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
