import { useState, useRef, useCallback } from 'react';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

export default function MusicPlayer({ onClose, nowPlaying, playSong, togglePlay, seek }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState('search'); // 'search' | 'card'
  const [loadingSong, setLoadingSong] = useState(false);

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
        setView('search');
      } else {
        alert(data.error || '搜索失败');
      }
    } catch (err) {
      alert('搜索失败: ' + err.message);
    }
    setSearching(false);
  };

  const onPick = async (song) => {
    setLoadingSong(true);
    setView('card');
    await playSong(song);
    setLoadingSong(false);
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // 解析歌词
  const lyricLines = useCallback(() => {
    if (!nowPlaying || !nowPlaying.lyric) return [];
    return nowPlaying.lyric.split('\n').filter(l => l.trim()).map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const time = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + parseInt(match[3], 10) / 1000;
        return { time, text: match[4].trim() };
      }
      return { time: 0, text: line.trim() };
    });
  }, [nowPlaying]);

  const getCurrentLyric = () => {
    const lines = lyricLines();
    if (lines.length === 0) return '';
    let current = lines[0];
    for (const line of lines) {
      if (line.time <= (nowPlaying.currentTime || 0)) current = line;
      else break;
    }
    return current.text;
  };

  return (
    <div className="music-player-panel">
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
      {view === 'search' && results.length > 0 && (
        <div className="mp-results">
          {results.map(song => (
            <div key={song.id} className="mp-result-item" onClick={() => onPick(song)}>
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
      {view === 'card' && nowPlaying && (
        <div className="mp-card">
          <div className="mp-card-cover">
            {nowPlaying.cover ? (
              <img src={nowPlaying.cover} alt="cover" />
            ) : (
              <div className="mp-cover-placeholder">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--theme-accent, #5ba3c4)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" fill="var(--theme-accent, #5ba3c4)" stroke="none" />
                </svg>
              </div>
            )}
            {nowPlaying.isPlaying && <div className="mp-cover-spinning" />}
          </div>
          <div className="mp-card-info">
            <span className="mp-card-name">{nowPlaying.name}</span>
            <span className="mp-card-artist">{nowPlaying.artist}</span>
          </div>

          {nowPlaying.lyric && (
            <div className="mp-lyric">
              <p className="mp-current-lyric">{getCurrentLyric()}</p>
            </div>
          )}

          <div className="mp-progress" onClick={seek}>
            <div className="mp-progress-fill" style={{ width: `${nowPlaying.progress || 0}%` }} />
          </div>
          <div className="mp-time">
            <span>{formatTime(nowPlaying.currentTime || 0)}</span>
            <span>{formatTime(nowPlaying.duration || 0)}</span>
          </div>

          <div className="mp-controls">
            <button className="mp-play-btn" onClick={togglePlay} disabled={loadingSong}>
              {loadingSong ? (
                <span className="mp-loading">...</span>
              ) : nowPlaying.isPlaying ? (
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

          <button className="mp-back-btn" onClick={() => setView('search')}>
            返回搜索
          </button>
        </div>
      )}

      {/* 空状态 */}
      {view === 'search' && results.length === 0 && !searching && (
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
