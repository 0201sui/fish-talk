import { useState, useRef, useCallback } from 'react';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

export default function MusicPlayer({ onClose, nowPlaying, playSong, togglePlay, seek, favorites = [], onToggleFavorite }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState(() => favorites.length > 0 ? 'favorites' : 'search'); // 'search' | 'card' | 'favorites'
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

      {/* 标签切换：搜索 / 收藏 */}
      <div className="mp-tabs">
        <button className={`mp-tab ${view === 'search' || view === 'card' ? 'active' : ''}`} onClick={() => setView('search')}>🎵 搜索</button>
        <button className={`mp-tab ${view === 'favorites' ? 'active' : ''}`} onClick={() => setView('favorites')}>
          ❤️ 我的收藏{favorites.length > 0 ? ` (${favorites.length})` : ''}
        </button>
      </div>

      {/* 搜索栏（仅搜索视图显示） */}
      {view === 'search' && (
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
      )}

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

      {/* 收藏列表 */}
      {view === 'favorites' && (
        <div className="mp-results">
          {favorites.length === 0 ? (
            <div className="mp-empty">
              <div className="mp-empty-icon">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--theme-accent, #5ba3c4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <p>还没有收藏的歌曲</p>
              <p style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>播放音乐时点击 ❤ 即可收藏</p>
            </div>
          ) : (
            favorites.map(song => (
              <div key={song.id} className={`mp-result-item ${nowPlaying && nowPlaying.id === song.id ? 'playing' : ''}`} onClick={() => { playSong({ id: song.id, name: song.name, artist: song.artist, cover: song.cover }); }}>
                <div className="mp-result-cover" style={song.cover ? { backgroundImage: `url(${song.cover})` } : {}}>
                  {!song.cover && <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--ocean-accent)" strokeWidth="1.5" style={{ margin: '8px' }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="var(--ocean-accent)" stroke="none" /></svg>}
                  {nowPlaying && nowPlaying.id === song.id && nowPlaying.isPlaying && <div className="mp-cover-spinning" />}
                </div>
                <div className="mp-result-info">
                  <span className="mp-result-name">{song.name}{nowPlaying && nowPlaying.id === song.id ? ' ♪' : ''}</span>
                  <span className="mp-result-artist">{song.artist}</span>
                </div>
                <button className="mp-result-del" onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(song); }} title="取消收藏" aria-label="取消收藏">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            ))
          )}
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
