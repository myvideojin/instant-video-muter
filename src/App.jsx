import React, { useState, useRef, useEffect } from 'react';
import ToolFAQ from './components/ToolFAQ';

import BrandedNav from './components/BrandedNav';
import BrandedFooter from './components/BrandedFooter';
import { 
  Upload, Play, Pause, Volume2, VolumeX,
  Settings, Video, FileText, FileVideo,
  SkipBack, SkipForward, Repeat, Loader2, CheckCircle2, AlertCircle, AlertTriangle
} from 'lucide-react';
import { useToolUsage } from './hooks/useToolUsage';

export default function VideoMuter() {
  const { checkUsage, incrementUsage } = useToolUsage();

  const faqs = [
    {
      "question": "How fast is the Video Muter?",
      "answer": "Instantaneous! Because we don't re-encode the video (we simply strip the audio track from the file container), muting happens almost instantly regardless of video length."
    },
    {
      "question": "Does muting reduce the video quality?",
      "answer": "Absolutely not. The original video stream is copied identically, so there is zero loss in visual quality or framerate."
    },
    {
      "question": "Are my files uploaded to a server?",
      "answer": "No, all processing happens locally on your device. Your videos never leave your browser, ensuring complete privacy."
    },
    {
      "question": "Is there a file size limit?",
      "answer": "Because the process runs locally in your browser, we recommend keeping videos under 2GB for optimal performance."
    },
    {
      "question": "Is the Video Muter free?",
      "answer": "Yes! You can mute your videos for free without any watermarks or hidden fees."
    }
  ];

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  
  // Video state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(true);

  // Muter state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Booting Engine...');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState("");

  const ffmpegRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const loadStarted = useRef(false);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    const loadFFmpeg = async () => {
      try {
        setLoadingMsg("Fetching Engine...");
        const { createFFmpeg } = window.FFmpeg;
        const ffmpeg = createFFmpeg({
           log: true,
           corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        ffmpegRef.current = ffmpeg;
        await ffmpeg.load();
        setIsReady(true);
        setLoadingMsg('Engine Loaded');
        setError(null);
      } catch (err) {
        console.error("FFmpeg load error:", err);
        setError("Error: " + (err.message || "Failed to initialize WebAssembly."));
        setLoadingMsg("Failed to Load");
      }
    };
    
    setTimeout(() => {
        if (window.FFmpeg) {
            loadFFmpeg();
        } else {
            setError("Global FFmpeg library failed to inject.");
        }
    }, 500);
  }, []);

  // Handle file upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
      setError(null);
    } else {
        setError('Please upload a valid video file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
      const url = URL.createObjectURL(droppedFile);
      setVideoUrl(url);
      setError(null);
    } else {
        setError('Please upload a valid video file.');
    }
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleScrub = (e) => {
    if (videoRef.current) {
      const scrubTime = (e.target.value / 100) * videoRef.current.duration;
      videoRef.current.currentTime = scrubTime;
      setProgress(e.target.value);
    }
  };

  const stepFrame = (forward) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime += forward ? 0.033 : -0.033;
    }
  };

  const handleProcess = async () => {
    if (!checkUsage()) {
      setError("Daily limit reached. Free users can process tools 3 times a day. Please upgrade for unlimited access.");
      return;
    }
    incrementUsage();

    if (!file || !isReady) return;

    if (file.size > 2000 * 1024 * 1024) {
      setError("File is too large for client-side processing. Please use a file under 2GB.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setResultVideoUrl(null);
    setProcessProgress(0);
    setDownloadFileName(file.name.split('.')[0]);

    try {
      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = window.FFmpeg;
      
      setLoadingMsg('Uploading to virtual filesystem...');
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));

      setLoadingMsg('Stripping audio track...');
      
      let interval = setInterval(() => {
         setProcessProgress(p => (p < 90 ? p + 15 : p));
      }, 100);
      
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-c', 'copy',
        '-an',
        'output.mp4'
      );

      clearInterval(interval);
      setProcessProgress(100);
      setLoadingMsg("Finalizing...");

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const localVideoUrl = window.URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
      
      setResultVideoUrl(localVideoUrl);
      
      const sizeMB = (data.buffer.byteLength / (1024 * 1024)).toFixed(2);
      
      setResult({ message: `Success! Video is now completely silent (${sizeMB}MB)` });

      ffmpeg.FS('unlink', 'input.mp4');
      ffmpeg.FS('unlink', 'output.mp4');

    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while muting the video.');
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12">
      
      <script type="application/ld+json">
        {JSON.stringify({'@context': 'https://schema.org', '@graph': [{'@type': 'SoftwareApplication', 'name': 'Videojin Video Muter', 'applicationCategory': 'MultimediaApplication', 'operatingSystem': 'All', 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}}, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': 'How fast is the Video Muter?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'Instantaneous! Because we don\'t re-encode the video (we simply strip the audio track from the file container), muting happens almost instantly regardless of video length.'}}, {'@type': 'Question', 'name': 'Does muting reduce the video quality?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'Absolutely not. The original video stream is copied identically, so there is zero loss in visual quality or framerate.'}}, {'@type': 'Question', 'name': 'Are my files uploaded to a server?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'No, all processing happens locally on your device. Your videos never leave your browser, ensuring complete privacy.'}}]}, {'@type': 'HowTo', 'name': 'How to Mute Videos using AI', 'step': [{'@type': 'HowToStep', 'name': 'Upload Video', 'text': 'Upload the video file you want to mute.'}, {'@type': 'HowToStep', 'name': 'Review Settings', 'text': 'Check the preview to ensure it is the right file.'}, {'@type': 'HowToStep', 'name': 'Mute Video', 'text': 'Click Mute Video and we will instantly strip the audio track losslessly.'}, {'@type': 'HowToStep', 'name': 'Download', 'text': 'Download your silenced video instantly.'}]}]})}
      </script>
      <BrandedNav />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
              <VolumeX className="text-slate-400" /> Video Muter
            </h1>
            <p className="text-gray-400 font-medium">Instantly strip sound from any video losslessly.</p>
          </div>
          {videoUrl && !isProcessing && (
            <button 
              onClick={() => { setFile(null); setVideoUrl(null); setResult(null); setError(null); }}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full font-bold text-sm transition-colors border border-white/10"
            >
              Upload New Video
            </button>
          )}
        </div>

        {!videoUrl ? (
          <div 
            className="w-full max-w-3xl mx-auto h-[60vh] border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center hover:bg-white/5 hover:border-slate-500/50 transition-all cursor-pointer group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              id="video-input" 
              accept="video/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <label htmlFor="video-input" className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
              <div className="w-20 h-20 bg-slate-500/10 text-slate-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">Select a Video</h2>
              <p className="text-gray-400 max-w-sm">Drag and drop your .mp4 or .mov file here to remove audio.</p>
              <div className="mt-8 px-4 py-2 bg-white/5 rounded-full text-xs font-bold text-gray-500 uppercase tracking-widest">
                Local Processing • Zero Uploads
              </div>
            </label>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Preview Area */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full bg-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden shrink-0 aspect-video flex items-center justify-center">
                {resultVideoUrl ? (
                  <video 
                    src={resultVideoUrl}
                    className="w-full h-full object-contain bg-zinc-900"
                    controls
                    playsInline
                  />
                ) : (
                  <video 
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain bg-zinc-900"
                    onTimeUpdate={handleTimeUpdate}
                    loop={isLooping}
                    muted={isMuted}
                    playsInline
                  />
                )}
              </div>

              {/* Transport Controls */}
              {!resultVideoUrl && (
                <div className="w-full mt-6 bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => stepFrame(false)} className="p-2 text-gray-400 hover:text-white"><SkipBack size={20} /></button>
                    <button onClick={togglePlay} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button onClick={() => stepFrame(true)} className="p-2 text-gray-400 hover:text-white"><SkipForward size={20} /></button>
                  </div>
                  
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress}
                    onChange={handleScrub}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-slate-500"
                  />
                  
                  <div className="flex justify-between mt-4">
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-lg ${isMuted ? 'text-red-400 bg-red-400/10' : 'text-gray-400 hover:text-white'}`}>
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button onClick={() => setIsLooping(!isLooping)} className={`p-2 rounded-lg ${isLooping ? 'text-slate-400 bg-slate-400/10' : 'text-gray-400 hover:text-white'}`}>
                      <Repeat size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Settings */}
            <div className="w-full lg:w-[350px] space-y-6">
              
              <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                 <div className="text-slate-200 text-xs">
                   <span className="font-bold text-slate-400">Notice:</span> 
                   Muting is instantaneous because we copy the video stream directly without re-encoding.
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-300 mb-4">{result.message}</p>
                  <div className="flex flex-col gap-3">
                    {resultVideoUrl && (
                      <a 
                        href={resultVideoUrl} 
                        download={`muted_${downloadFileName}.mp4`}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all text-sm"
                      >
                        <Video size={16} />
                        Download Muted Video
                      </a>
                    )}
                  </div>
                </div>
              )}

              {!result && (
                <button 
                  onClick={handleProcess}
                  disabled={isProcessing || !isReady}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all flex flex-col items-center justify-center gap-2 transform relative overflow-hidden ${
                    isProcessing || !isReady
                      ? 'bg-white/10 text-white/50 cursor-not-allowed'
                      : 'bg-slate-600 hover:bg-slate-500 text-white shadow-slate-600/20 hover:-translate-y-1'
                  }`}
                >
                  {isProcessing && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    ></div>
                  )}
                  
                  <div className="relative flex items-center gap-2">
                    {(isProcessing || !isReady) ? <Loader2 size={18} className="animate-spin" /> : <VolumeX size={18} />}
                    {isProcessing || !isReady ? loadingMsg : 'Mute Video'}
                  </div>
                </button>
              )}

            </div>
          </div>
        )}
      </div>

      {/* SEO Sections */}
      <div className="mt-24 space-y-24 max-w-4xl mx-auto px-4">
        {/* How It Works */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">How to Mute Videos Instantly</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-500/20">1</div>
              <h3 className="text-xl font-bold mb-3 text-slate-400 mt-2">Upload Video</h3>
              <p className="text-gray-400">Upload the video file you want to remove sound from directly in your browser.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-500/20">2</div>
              <h3 className="text-xl font-bold mb-3 text-slate-400 mt-2">Review</h3>
              <p className="text-gray-400">Ensure the correct video is loaded using the built-in previewer.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-500/20">3</div>
              <h3 className="text-xl font-bold mb-3 text-slate-400 mt-2">Mute</h3>
              <p className="text-gray-400">Click Mute Video to instantly strip the audio track losslessly.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-500/20">4</div>
              <h3 className="text-xl font-bold mb-3 text-slate-400 mt-2">Download</h3>
              <p className="text-gray-400">Download your completely silenced video instantly without waiting.</p>
            </div>
          </div>
        </section>

        {/* Feature Breakdown */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Why Use Our Video Muter?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Instant Processing</h3>
              <p className="text-gray-400">Instead of re-encoding your video, we quickly drop the audio track, making it finish almost instantly.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Lossless Quality</h3>
              <p className="text-gray-400">The video stream is completely untouched. You get exactly the same picture quality, just without the sound.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">100% Local Privacy</h3>
              <p className="text-gray-400">Everything happens in your browser. Your video files are never uploaded to our servers, preserving absolute privacy.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Completely Free</h3>
              <p className="text-gray-400">Remove audio from videos quickly without any watermarks, subscriptions, or paywalls.</p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Built for Content Creators & Professionals</h2>
          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Meme Creators</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Strip background audio from stock footage or clips to prepare them for new voiceovers and background music.</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Privacy Focus</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Remove sensitive conversations or background noises before sharing family videos or work recordings online.</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Social Media Posters</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Ensure auto-playing videos on websites and feeds are completely silent by default by removing the track entirely.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ToolFAQ faqs={faqs} />
      <BrandedFooter />
    </div>
  );
}
