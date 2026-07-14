import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

export default function MusicPlayer({ onClose, onSongChange }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyric, setLyric] = useState('');
  const [cover, setCover] = useState('');
  const [loadingSong, setLoadingSong] = useState(false);
  const audioRef = useRef(null);

  const search = async () => {
    if (!keyword.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(`${API_URL}/music/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() })
      });
      const data = await resp.json();
      if (data.success) {
        setResults(data.songs || []);
      } else {
        alert(data.error || '搜索失败');
      }
    } catch (err) {
      alert('搜索失败: ' + err.message);
    }
    setSearching(false);
  };

  const playSong = async (song) => {
    setLoadingSong(true);
    setCurrentSong(song);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setLyric('');
    setCover('');

    try {
      // 获取歌曲详情（封面）
      const detailResp = await fetch(`${API_URL}/music/detail/${song.id}`);
      const detailData = await detailResp.json();
      if (detailData.success) {
        setCover(detailData.data.cover);
        setCurrentSong(prev => ({ ...prev, ...detailData.data }));
      }

      // 获取歌词
      const lyricResp = await fetch(`${API_URL}/music/lyric/${song.id}`);
      const lyricData = await lyricResp.json();
      if (lyricData.success && lyricData.lyric) {
        setLyric(lyricData.lyric);
      }

      // 获取播放URL
      const urlResp = await fetch(`${API_URL}/music/url/${song.id}`);
      const urlData = await urlResp.json();
      if (urlData.success && urlData.url) {
        if (audioRef.current) {
          audioRef.current.src = urlData.url;
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(err => {
            console.error('播放失败:', err);
            alert('该歌曲可能需要VIP，无法播放');
          });
        }
      }
      // 通知AI当前播放的歌曲
      if (onSongChange) {
        onSongChange({
          name: song.name,
          artist: song.artist,
          duration: song.duration ? Math.round(song.duration / 1000) + '秒' : null
        });
      }
    } catch (err) {
      alert('加载失败: ' + err.message);
    }
    setLoadingSong(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const ct = audioRef.current.currentTime;
    const d = audioRef.current.duration;
    setCurrentTime(ct);
    if (d > 0) setProgress((ct / d) * 100);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration || 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * 100);
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // 解析歌词
  const lyricLines = useCallback(() => {
    if (!lyric) return [];
    return lyric.split('\n').filter(l => l.trim()).map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 1000;
        return { time, text: match[4].trim() };
      }
      return { time: 0, text: line.trim() };
    });
  }, [lyric]);

  const getCurrentLyric = () => {
    const lines = lyricLines();
    if (lines.length === 0) return '';
    let current = lines[0];
    for (const line of lines) {
      if (line.time <= currentTime) current = line;
      else break;
    }
    return current.text;
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="music-player-panel">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <div className="mp-header">
        <span>音乐</span>
        <button onClick={onClose}>x</button>
      </div>

      <div className="mp-search-bar">
        <input
          type="text"
          placeholder="搜索歌曲或歌手..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search(); }}
        />
        <button onClick={search} disabled={searching}>
          {searching ? '...' : '搜索'}
        </button>
      </div>

      {/* 搜索结果列表 */}
      {results.length > 0 && !currentSong && (
        <div className="mp-results">
          {results.map(song => (
            <div key={song.id} className="mp-result-item" onClick={() => playSong(song)}>
              <div className="mp-result-info">
                <span className="mp-result-name">{song.name}</span>
                <span className="mp-result-artist">{song.artist}</span>
              </div>
              <span className="mp-result-duration">{formatTime(song.duration / 1000)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 播放器卡片 */}
      {currentSong && (
        <div className="mp-card">
          <div className="mp-card-cover">
            {cover ? (
              <img src={cover} alt="cover" />
            ) : (
              <div className="mp-cover-placeholder">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--theme-accent, #5ba3c4)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" fill="var(--theme-accent, #5ba3c4)" stroke="none" />
                </svg>
              </div>
            )}
            {isPlaying && <div className="mp-cover-spinning" />}
          </div>
          <div className="mp-card-info">
            <span className="mp-card-name">{currentSong.name}</span>
            <span className="mp-card-artist">{currentSong.artist}</span>
          </div>

          {/* 歌词 */}
          {lyric && (
            <div className="mp-lyric">
              <p className="mp-current-lyric">{getCurrentLyric()}</p>
            </div>
          )}

          {/* 进度条 */}
          <div className="mp-progress" onClick={seek}>
            <div className="mp-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="mp-time">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* 播放控制 */}
          <div className="mp-controls">
            <button className="mp-play-btn" onClick={togglePlay} disabled={loadingSong}>
              {loadingSong ? (
                <span className="mp-loading">...</span>
              ) : isPlaying ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" />
                </svg>
              )}
            </button>
          </div>

          {/* 返回搜索 */}
          <button className="mp-back-btn" onClick={() => { setCurrentSong(null); setIsPlaying(false); if (audioRef.current) audioRef.current.pause(); }}>
            返回搜索
          </button>
        </div>
      )}

      {/* 空状态 */}
      {results.length === 0 && !currentSong && !searching && (
        <div className="mp-empty">
          <div className="mp-empty-icon">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--theme-accent, #5ba3c4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <p>搜索歌曲，和AI一起听</p>
        </div>
      )}
    </div>
  );
}
