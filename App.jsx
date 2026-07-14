import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import './App.css';
import ApiConfig from './ApiConfig.jsx';
import MemoryPalace from './MemoryPalace.jsx';
import ReadTogether from './ReadTogether.jsx';
import MusicPlayer from './MusicPlayer.jsx';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

// 本地聊天记录缓存（防止刷新 / 重进网址后丢失记录）
const SESSION_KEY = 'fishtalk_current_session';
const MSG_CACHE_PREFIX = 'fishtalk_msgs_';

function genId() {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ===== 小工具 =====
function getReplyPreview(msg) {
  if (!msg) return '';
  if (msg.voice) return '[语音]';
  if (msg.images && msg.images.length > 0) return '[图片]';
  if (msg.content && msg.content.includes('[贴纸]')) return '[贴纸]';
  return msg.content?.slice(0, 60) || '';
}

// ===== Markdown 渲染组件（支持代码高亮 + 一键复制）=====
function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  const handleCopy = async () => {
    const code = codeRef.current?.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e2) {}
      document.body.removeChild(ta);
    }
  };

  const lang = className?.replace('language-', '') || '';

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang">{lang || 'code'}</span>
        <button className={`code-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <pre><code ref={codeRef} className={className}>{children}</code></pre>
    </div>
  );
}

function MarkdownContent({ content }) {
  // 处理贴纸标记：把 [贴纸]url[/贴纸] 替换成 markdown 图片语法
  const processed = useMemo(() => {
    if (!content) return '';
    return content.replace(/\[贴纸\](.*?)\[\/贴纸\]/g, (match, url) => `![贴纸](${url})`);
  }, [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ node, inline, className, children, ...props }) {
          if (inline) {
            return <code className="inline-code" {...props}>{children}</code>;
          }
          return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
        },
        pre({ children }) {
          // CodeBlock already wraps in <pre>, so just pass through
          return <>{children}</>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
        img({ src, alt }) {
          return <img src={src} alt={alt || ''} className="md-img" />;
        },
        table({ children }) {
          return <div className="md-table-wrap"><table>{children}</table></div>;
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

// ===== API 配置 =====
function getApiProviders() {
  try {
    const saved = localStorage.getItem('apiProviders');
    if (!saved) return { providers: [], activeId: null };
    return JSON.parse(saved);
  } catch { return { providers: [], activeId: null }; }
}

function getActiveModel() {
  const { providers, activeId } = getApiProviders();
  const active = providers.find(p => p.id === activeId);
  if (active && active.models && active.models.length > 0) {
    return { name: active.models[0], baseUrl: active.baseUrl, apiKey: active.apiKey, providerName: active.name, allModels: active.models };
  }
  return null;
}

// ===== 开屏动画 =====
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  const bubbles = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 3 + Math.random() * 12,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 5
    }))
  )[0];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 3200);
    const t3 = setTimeout(() => onDone(), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div className={`splash ${phase >= 2 ? 'fade-out' : ''}`}>
      <div className="splash-rays" />
      <div className="splash-whale-wrap" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -45%) scale(0.85)' }}>
        <div className="splash-whale">🐋</div>
        <div className="splash-whale-spray">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div className="splash-bubbles">
        {bubbles.map(b => (
          <div key={b.id} className="splash-bubble" style={{ left: `${b.left}%`, width: `${b.size}px`, height: `${b.size}px`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }} />
        ))}
      </div>
      <div className="splash-water-surface" />
      <div className="splash-bottom">
        <h1 className="splash-brand" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(24px)' }}>鱼说</h1>
        <p className="splash-welcome" style={{ opacity: phase >= 1 ? 1 : 0 }}>在深海里，听见你的声音</p>
        <div className="splash-ripple" />
      </div>
    </div>
  );
}

// ===== 桌宠组件 =====
function DesktopPet() {
  const [pos, setPos] = useState({ x: 50, y: 80 });
  const [dir, setDir] = useState(1);
  const [petImage, setPetImage] = useState(() => localStorage.getItem('petImage') || '');
  const [petSize, setPetSize] = useState(() => parseInt(localStorage.getItem('petSize') || '40'));
  const [showSettings, setShowSettings] = useState(false);
  const [imgInput, setImgInput] = useState(petImage);
  const [sizeInput, setSizeInput] = useState(petSize);
  const petRef = useRef(null);
  const petFileRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let raf;
    let t = 0;
    const animate = () => {
      t += 0.02;
      if (!dragging.current) {
        setPos(p => ({ x: Math.max(10, Math.min(window.innerWidth - petSize - 10, p.x + dir * 0.3)), y: p.y + Math.sin(t) * 0.5 }));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [dir, petSize]);

  useEffect(() => {
    try { localStorage.setItem('petImage', petImage); localStorage.setItem('petSize', String(petSize)); } catch (e) {}
  }, [petImage, petSize]);

  const startInteract = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    startPos.current = { x: touch.clientX, y: touch.clientY };
    dragging.current = true;
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    longPressTimer.current = setTimeout(() => { dragging.current = false; setShowSettings(true); setImgInput(petImage); setSizeInput(petSize); }, 600);
  };
  const onMove = (e) => {
    if (longPressTimer.current) {
      const touch = e.touches ? e.touches[0] : e;
      const dx = Math.abs(touch.clientX - startPos.current.x);
      const dy = Math.abs(touch.clientY - startPos.current.y);
      if (dx > 8 || dy > 8) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
    if (!dragging.current) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    setPos({ x: touch.clientX - offset.current.x, y: touch.clientY - offset.current.y });
  };
  const endInteract = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } dragging.current = false; };

  const savePetSettings = () => {
    try { localStorage.setItem('petImage', imgInput); localStorage.setItem('petSize', String(sizeInput)); } catch (err) { alert('保存失败：图片可能太大'); }
    setPetImage(imgInput); setPetSize(sizeInput); setShowSettings(false);
  };
  const resetPet = () => { setImgInput(''); setSizeInput(40); };

  const onPetFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('图片不能超过3MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 200;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          setImgInput(canvas.toDataURL('image/jpeg', 0.85));
        } catch (err) { setImgInput(reader.result); }
      };
      img.onerror = () => setImgInput(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div ref={petRef} className="desktop-pet" style={{ left: pos.x, top: pos.y, width: petSize, height: petSize, transform: dir < 0 ? 'scaleX(-1)' : '' }}
        onMouseDown={startInteract} onMouseMove={onMove} onMouseUp={endInteract} onMouseLeave={endInteract}
        onTouchStart={startInteract} onTouchMove={onMove} onTouchEnd={endInteract}
        onContextMenu={(e) => { e.preventDefault(); setShowSettings(true); setImgInput(petImage); setSizeInput(petSize); }}>
        {petImage ? <img src={petImage} alt="桌宠" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} /> : <span style={{ fontSize: petSize, lineHeight: 1 }}>🐠</span>}
      </div>
      {showSettings && (
        <div className="pet-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="pet-settings" onClick={e => e.stopPropagation()}>
            <h3>桌宠设置</h3>
            <div className="pet-preview">{imgInput ? <img src={imgInput} alt="预览" style={{ width: sizeInput, height: sizeInput, objectFit: 'contain' }} /> : <span style={{ fontSize: sizeInput }}>🐠</span>}</div>
            <div className="pet-setting-field"><label>图片URL</label><input type="text" value={imgInput} onChange={e => setImgInput(e.target.value)} placeholder="粘贴图片URL或上传文件" /></div>
            <div className="pet-setting-field"><label>上传图片</label><input ref={petFileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/*" style={{ display: 'none' }} onChange={onPetFileChange} /><button className="pet-file-btn" onClick={() => petFileRef.current?.click()}>📷 从相册选择</button></div>
            <div className="pet-setting-field"><label>大小: {sizeInput}px</label><input type="range" min="20" max="100" value={sizeInput} onChange={e => setSizeInput(parseInt(e.target.value))} /></div>
            <div className="pet-settings-actions"><button className="btn-cancel" onClick={resetPet}>重置</button><button className="btn-save" onClick={savePetSettings}>保存</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== 长按上下文菜单 =====
function ContextMenu({ x, y, msg, isUser, onQuote, onCopy, onEdit, onDelete, onRecall, onMultiSelect, onRegenerate, canRegenerate, onClose }) {
  const menuRef = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let adjX = x, adjY = y;
      if (x + rect.width > window.innerWidth - 10) adjX = window.innerWidth - rect.width - 10;
      if (y + rect.height > window.innerHeight - 10) adjY = y - rect.height;
      setAdjustedPos({ x: Math.max(10, adjX), y: Math.max(10, adjY) });
    }
  }, [x, y]);

  const items = [
    { label: '复制', onClick: () => { onCopy(msg); onClose(); } },
    { label: '引用', onClick: () => { onQuote(msg); onClose(); } },
    { label: '多选', onClick: () => { onMultiSelect(msg); onClose(); } },
    { label: '编辑', onClick: () => { onEdit(msg); onClose(); } },
    { label: '撤回', onClick: () => { onRecall(msg); onClose(); } },
  ];
  if (canRegenerate) items.unshift({ label: '重新生成', accent: true, onClick: () => { onRegenerate(msg); onClose(); } });
  items.push({ label: '删除', danger: true, onClick: () => { onDelete(msg); onClose(); } });

  return (
    <div className="context-menu-overlay" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <div ref={menuRef} className="context-menu" style={{ left: adjustedPos.x, top: adjustedPos.y }} onClick={e => e.stopPropagation()}>
        {items.map((item, i) => (<button key={i} className={item.danger ? 'ctx-item danger' : item.accent ? 'ctx-item accent' : 'ctx-item'} onClick={item.onClick}>{item.label}</button>))}
      </div>
    </div>
  );
}

// ===== 语音消息组件 =====
function VoiceMessage({ voice, isUser, isPlaying, onPlay }) {
  const [showText, setShowText] = useState(false);
  const duration = voice.duration || 3;
  const width = Math.min(220, 80 + duration * 7);
  const hasAudio = !!voice.audio;
  return (
    <div className={`voice-wrap ${isUser ? 'user' : 'ai'}`}>
      <div className={`voice-bubble ${isUser ? 'user' : 'ai'} ${isPlaying ? 'playing' : ''}`} style={{ width }} onClick={() => { if (hasAudio) onPlay(); setShowText(s => !s); }}>
        <span className="voice-icon">
          {isPlaying ? (<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>) : (<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" /></svg>)}
        </span>
        <div className="voice-bars">{[0, 1, 2, 3, 4].map(i => (<span key={i} className="voice-bar" style={{ animationDelay: `${i * 0.1}s` }} />))}</div>
        <span className="voice-duration">{duration}''</span>
      </div>
      {showText && voice.text && (<div className={`voice-transcript ${isUser ? 'user' : 'ai'}`} onClick={() => setShowText(false)}>{voice.text}</div>)}
    </div>
  );
}

// ===== 迷你音乐播放条（AI 放歌 / 后台播放时显示在输入框上方）=====
function FloatingMusicPlayer({ song, onToggle, onSeek, onClose, onOpen }) {
  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const lyricLines = (song.lyric || '').split('\n').filter(l => l.trim()).map(line => {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const time = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + parseInt(match[3], 10) / 1000;
      return { time, text: match[4].trim() };
    }
    return { time: 0, text: line.trim() };
  });
  let currentLyric = '';
  if (lyricLines.length > 0) {
    currentLyric = lyricLines[0].text;
    for (const l of lyricLines) { if (l.time <= (song.currentTime || 0)) currentLyric = l.text; else break; }
  }

  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ right: 16, bottom: 96 });
  const dragState = useRef(null);
  const movedRef = useRef(false);

  const onDragStart = (e) => {
    const p = e.touches ? e.touches[0] : e;
    movedRef.current = false;
    dragState.current = { x: p.clientX, y: p.clientY, r: pos.right, b: pos.bottom };
    const move = (ev) => {
      const q = ev.touches ? ev.touches[0] : ev;
      const dx = q.clientX - dragState.current.x;
      const dy = q.clientY - dragState.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
      const vw = window.innerWidth, vh = window.innerHeight;
      const newRight = Math.min(Math.max(8, dragState.current.r - dx), vw - 56);
      const newBottom = Math.min(Math.max(8, dragState.current.b - dy), vh - 56);
      setPos({ right: newRight, bottom: newBottom });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  const ballClick = () => { if (!movedRef.current) setCollapsed(false); };

  if (collapsed) {
    return (
      <div className="music-ball" style={{ right: pos.right, bottom: pos.bottom }}
           onMouseDown={onDragStart} onTouchStart={onDragStart} onClick={ballClick} title="点击展开">
        <div className="music-ball-cover" style={song.cover ? { backgroundImage: `url(${song.cover})` } : {}}>
          {!song.cover && (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="#fff" stroke="none" />
            </svg>
          )}
          {song.isPlaying && <div className="mini-cover-spinning" />}
        </div>
        {song.isPlaying && (
          <div className="music-ball-eq"><span></span><span></span><span></span></div>
        )}
      </div>
    );
  }

  return (
    <div className="mini-music" style={{ right: pos.right, bottom: pos.bottom }}>
      <div className="mini-music-cover" style={song.cover ? { backgroundImage: `url(${song.cover})` } : {}}
           onMouseDown={onDragStart} onTouchStart={onDragStart} title="拖动我">
        {!song.cover && (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--theme-accent, #5ba3c4)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill="var(--theme-accent, #5ba3c4)" stroke="none" />
          </svg>
        )}
        {song.isPlaying && <div className="mini-cover-spinning" />}
      </div>
      <div className="mini-music-info">
        <div className="mini-music-name">{song.name}</div>
        <div className="mini-music-artist">{song.artist}{currentLyric ? ' · ' + currentLyric : ''}</div>
        <div className="mini-music-progress" onClick={(e) => { e.stopPropagation(); onSeek(e); }}>
          <div className="mini-music-fill" style={{ width: `${song.progress || 0}%` }} />
        </div>
      </div>
      <button className="mini-music-min" onClick={() => setCollapsed(true)} aria-label="缩小" title="缩小">—</button>
      <button className="mini-music-play" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="播放/暂停">
        {song.isPlaying ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" /></svg>
        )}
      </button>
      {onOpen && (
        <button className="mini-music-expand" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label="打开播放器" title="打开完整播放器">⤢</button>
      )}
      <button className="mini-music-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="关闭">×</button>
      <span className="mini-music-time">{formatTime(song.currentTime || 0)} / {formatTime(song.duration || 0)}</span>
    </div>
  );
}

// ===== 消息气泡组件 =====
function MessageBubble({ msg, index, profile, onQuote, onCopy, onEdit, onDelete, onRecall, playingVoiceId, onPlayVoice, editingId, setEditingId, editContent, setEditContent, saveEdit, isQuoted, onRead, userRead, read, isLastAI, multiSelectMode, isSelected, onToggleSelect }) {
  const longPressTimer = useRef(null);
  const touchStart = useRef(null);
  const bubbleRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const isUser = msg.role === 'user';

  useEffect(() => {
    if (msg.role !== 'assistant' || !onRead) return;
    if (read) return;
    const el = bubbleRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) { onRead(msg.id); obs.disconnect(); } }); }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [msg.id, msg.role, read, onRead]);

  const handleTouchStart = (e) => {
    if (multiSelectMode) return;
    touchStart.current = e.touches[0].clientX;
    longPressTimer.current = setTimeout(() => { const touch = e.touches[0]; window.__showContextMenu && window.__showContextMenu(touch.clientX, touch.clientY, msg, index); }, 500);
  };
  const handleTouchMove = (e) => {
    if (multiSelectMode) return;
    if (touchStart.current !== null) {
      const delta = e.touches[0].clientX - touchStart.current;
      if (Math.abs(delta) > 10 && longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (delta > 0 && delta < 80 && !longPressTimer.current) setSwipeX(delta);
    }
  };
  const handleTouchEnd = () => {
    if (multiSelectMode) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current); if (swipeX > 40) onQuote(msg); setSwipeX(0); touchStart.current = null;
  };
  const handleContextMenu = (e) => {
    if (multiSelectMode) return;
    e.preventDefault(); window.__showContextMenu && window.__showContextMenu(e.clientX, e.clientY, msg, index);
  };
  const handleClick = () => {
    if (multiSelectMode) { onToggleSelect(msg.id); }
  };
  const handleDoubleClick = () => { if (isUser) { setEditingId(msg.id); setEditContent(msg.content); } };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isVoicePlaying = playingVoiceId === msg.id;

  return (
    <div ref={bubbleRef} className={`message ${msg.role} ${multiSelectMode ? 'multi-select' : ''} ${isSelected ? 'selected' : ''}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick} onClick={handleClick} style={{ transform: swipeX > 0 ? `translateX(${swipeX}px)` : '' }}>
      {multiSelectMode && (
        <div className={`msg-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
        </div>
      )}
      <div className="message-inner">
        {(msg.reply_content || msg.reply_preview) && (
          <div className="reply-indicator-bubble">
            <span className="reply-role">{msg.reply_role === 'user' || (msg.reply_preview && msg.reply_preview.startsWith('我:')) ? '我' : (profile?.aiName || '裴拟')}</span>
            <span className="reply-text">{msg.reply_content || msg.reply_preview}</span>
          </div>
        )}
        {editingId === msg.id ? (
          <div className="edit-mode">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus />
            <div className="edit-actions"><button onClick={() => saveEdit(msg.id)}>保存</button><button onClick={() => setEditingId(null)}>取消</button></div>
          </div>
        ) : (
          <>
            {msg.images && msg.images.length > 0 && (
              <div className="msg-images">{msg.images.map((img, i) => (<img key={i} src={img} alt="图片" onClick={() => window.open(img, '_blank')} />))}</div>
            )}
            {msg.voice ? (
              <VoiceMessage voice={msg.voice} isUser={isUser} isPlaying={isVoicePlaying} onPlay={() => onPlayVoice(msg)} />
            ) : msg.content ? (
              <div className="bubble markdown-body"><MarkdownContent content={msg.content} /></div>
            ) : null}
          </>
        )}
        <div className="msg-meta">
          {msg.role === 'user' && (userRead ? <span className="read-status read">已读</span> : <span className="read-status delivered">已送达</span>)}
          {msg.role === 'assistant' && !read && <span className="read-status unread">未读</span>}
          {!isQuoted && (<span className="msg-time">{formatTime(msg.created_at)}{msg.edited && ' (已编辑)'}</span>)}
        </div>
      </div>
    </div>
  );
}

// ===== 主应用 =====
function App() {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splashed'));
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [model, setModel] = useState(localStorage.getItem('selectedModel') || 'claude');
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showMemoryPalace, setShowMemoryPalace] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showReadTogether, setShowReadTogether] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [musicInfo, setMusicInfo] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'ocean');
  const [isListening, setIsListening] = useState(false);
  const [typingStatus, setTypingStatus] = useState(''); // 打字状态提示文案
  const [pendingCount, setPendingCount] = useState(0); // 未回复的用户消息数
  const [multiSelectMode, setMultiSelectMode] = useState(false); // 多选模式
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set()); // 选中的消息ID
  const [searchSettings, setSearchSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('searchSettings') || '{"enabled":true,"city":""}'); } catch { return { enabled: true, city: '' }; }
  });

  const [readSet, setReadSet] = useState(() => {
    const sid = localStorage.getItem(SESSION_KEY);
    try { return new Set(JSON.parse(localStorage.getItem('fishtalk_read_' + sid) || '[]')); } catch { return new Set(); }
  });
  const [stickers, setStickers] = useState(() => { try { return JSON.parse(localStorage.getItem('stickers') || '[]'); } catch { return []; } });
  const [stickerInput, setStickerInput] = useState('');
  const [profile, setProfile] = useState({ userBio: '', aiBio: '', userName: '我', aiName: '裴拟' });
  const [settings, setSettings] = useState({
    system_prompt: '', temperature: 0.7,
    compress_threshold: 4000, compress_keep_rounds: 15, max_reply_tokens: 1024,
    auto_summarize: true, delete_after_summarize: false
  });
  const [ttsConfig, setTtsConfig] = useState(() => { try { return JSON.parse(localStorage.getItem('ttsConfig') || '{}'); } catch { return {}; } });
  const [petSettings, setPetSettings] = useState({ image: localStorage.getItem('petImage') || '', size: parseInt(localStorage.getItem('petSize') || '40') });

  // ===== 音乐播放（App 统一管理的播放器，AI 也能触发放歌）=====
  const musicAudioRef = useRef(null);
  const [nowPlaying, setNowPlaying] = useState(null); // {id,name,artist,cover,url,lyric,isPlaying,progress,currentTime,duration}

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const typingBufferRef = useRef(''); // 打字效果缓冲区（完整文本）
  const typingTimerRef = useRef(null); // 打字效果定时器

  // 主题切换
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { if (messagesAreaRef.current) { messagesAreaRef.current.scrollTo({ top: messagesAreaRef.current.scrollHeight, behavior: 'smooth' }); } }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, streamingText, scrollToBottom]);

  useEffect(() => {
    if (showSplash) { sessionStorage.setItem('splashed', '1'); const timer = setTimeout(() => setShowSplash(false), 4400); return () => clearTimeout(timer); }
  }, [showSplash]);

  useEffect(() => {
    fetchSessions(); fetchSettings(); fetchProfile();
    const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    setVH(); window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;
    const cached = localStorage.getItem(MSG_CACHE_PREFIX + currentSessionId);
    if (cached) { try { setMessages(JSON.parse(cached)); return; } catch (e) {} }
    fetchMessages(currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    if (!currentSessionId) return;
    try { setReadSet(new Set(JSON.parse(localStorage.getItem('fishtalk_read_' + currentSessionId) || '[]'))); } catch { setReadSet(new Set()); }
  }, [currentSessionId]);

  useEffect(() => { if (currentSessionId) localStorage.setItem('fishtalk_read_' + currentSessionId, JSON.stringify([...readSet])); }, [readSet, currentSessionId]);
  useEffect(() => { if (currentSessionId) localStorage.setItem(SESSION_KEY, currentSessionId); }, [currentSessionId]);
  useEffect(() => { if (currentSessionId && messages.length) { try { localStorage.setItem(MSG_CACHE_PREFIX + currentSessionId, JSON.stringify(messages)); } catch (e) {} } }, [messages, currentSessionId]);
  useEffect(() => { localStorage.setItem('selectedModel', model); }, [model]);
  useEffect(() => { localStorage.setItem('stickers', JSON.stringify(stickers)); }, [stickers]);
  useEffect(() => { localStorage.setItem('ttsConfig', JSON.stringify(ttsConfig)); }, [ttsConfig]);
  useEffect(() => { localStorage.setItem('searchSettings', JSON.stringify(searchSettings)); }, [searchSettings]);
  useEffect(() => { if (showSettings) { setPetSettings({ image: localStorage.getItem('petImage') || '', size: parseInt(localStorage.getItem('petSize') || '40') }); } }, [showSettings]);
  useEffect(() => { window.__showContextMenu = (x, y, msg, index) => { setContextMenu({ x, y, msg, index }); }; return () => { delete window.__showContextMenu; }; }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      const data = await res.json();
      if (data.sessions) { setSessions(data.sessions); const hasCurrent = currentSessionId && data.sessions.some(s => s.id === currentSessionId); if (!hasCurrent && data.sessions.length > 0) setCurrentSessionId(data.sessions[0].id); }
    } catch (err) { console.error('加载会话失败:', err); }
  };
  const fetchMessages = async (sessionId) => {
    try { const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`); const data = await res.json(); if (data.messages) setMessages(data.messages); } catch (err) { console.error('加载消息失败:', err); }
  };
  const fetchSettings = async () => {
    try { const res = await fetch(`${API_URL}/settings`); const data = await res.json(); if (data.settings) setSettings(data.settings); } catch (err) { console.error('加载设置失败:', err); }
  };
  const fetchProfile = async () => {
    try { const res = await fetch(`${API_URL}/profile`); const data = await res.json(); if (data.data) setProfile(data.data); } catch (err) { console.error('加载简介失败:', err); }
  };

  const createSession = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '新对话' }) });
      const data = await res.json();
      if (data.session) { localStorage.removeItem(MSG_CACHE_PREFIX + data.session.id); setSessions(prev => [data.session, ...prev]); setCurrentSessionId(data.session.id); setMessages([]); setShowSidebar(false); }
    } catch (err) { console.error('创建会话失败:', err); }
  };
  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除这个对话吗？')) return;
    try {
      await fetch(`${API_URL}/sessions/${id}`, { method: 'DELETE' });
      localStorage.removeItem(MSG_CACHE_PREFIX + id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) { const next = sessions.find(s => s.id !== id); setCurrentSessionId(next?.id || null); setMessages([]); }
    } catch (err) { console.error('删除会话失败:', err); }
  };
  const renameSession = async (id, e) => {
    e.stopPropagation();
    const newName = prompt('输入新名称:');
    if (!newName) return;
    try { await fetch(`${API_URL}/sessions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) }); setSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s)); } catch (err) { console.error('重命名失败:', err); }
  };

  const saveSettings = async () => {
    try { await fetch(`${API_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); localStorage.setItem('petImage', petSettings.image); localStorage.setItem('petSize', String(petSettings.size)); setShowSettings(false); } catch (err) { console.error('保存设置失败:', err); }
  };
  const saveProfile = async () => {
    try { await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }); setShowProfile(false); } catch (err) { console.error('保存简介失败:', err); }
  };

  // ===== 构建聊天请求体 =====
  const buildChatBody = (sentInput, sentImages, sentFiles, sessionId, isRegenerate = false) => {
    const activeApi = getActiveModel();
    const chatBody = { message: sentInput, session_id: sessionId, model };
    if (sentImages && sentImages.length > 0) chatBody.images = sentImages;
    if (sentFiles && sentFiles.length > 0) {
      chatBody.file_content = sentFiles.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n');
      chatBody.file_name = sentFiles.map(f => f.name).join(', ');
    }
    if (activeApi) { chatBody.api_url = activeApi.baseUrl; chatBody.api_key = activeApi.apiKey; chatBody.api_model = activeApi.name; }
    // 温度参数从 localStorage 读取（由 API 配置面板设置）
    const savedTemp = parseFloat(localStorage.getItem('apiTemperature'));
    if (!isNaN(savedTemp)) chatBody.temperature = savedTemp;
    // AI 参数从 localStorage 读取（由 API 配置面板设置）
    const aiParams = JSON.parse(localStorage.getItem('aiParams') || '{}');
    if (aiParams.max_context_rounds) chatBody.max_context_rounds = aiParams.max_context_rounds;
    if (aiParams.auto_summarize_after) chatBody.auto_summarize_after = aiParams.auto_summarize_after;
    if (aiParams.compress_keep_rounds) chatBody.compress_keep_rounds = aiParams.compress_keep_rounds;
    if (aiParams.max_reply_tokens) chatBody.max_reply_tokens = aiParams.max_reply_tokens;
    // 搜索设置
    chatBody.search_enabled = searchSettings.enabled;
    if (searchSettings.city) chatBody.search_city = searchSettings.city;
    // 音乐信息
    if (musicInfo) chatBody.music_info = musicInfo;
    if (ttsConfig.apiKey) {
      chatBody.tts_config = { apiKey: ttsConfig.apiKey, voiceId: ttsConfig.customVoiceId || ttsConfig.voiceId || 'male-qn-qingse', customVoiceId: ttsConfig.customVoiceId || '', groupId: ttsConfig.groupId || '', speed: ttsConfig.speed || 1.0, model: ttsConfig.model || 'speech-02-hd' };
    }
    return chatBody;
  };

  // ===== 打字效果（逐字显示）=====
  const startTypingEffect = (fullText) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    typingBufferRef.current = fullText;
    let displayLen = 0;
    const totalLen = fullText.length;
    // 每帧显示的字符数（根据总长度动态调整速度）
    const charsPerTick = Math.max(1, Math.ceil(totalLen / 200));
    typingTimerRef.current = setInterval(() => {
      displayLen = Math.min(displayLen + charsPerTick, totalLen);
      setStreamingText(fullText.slice(0, displayLen));
      if (displayLen >= totalLen) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }, 20);
  };

  const stopTypingEffect = () => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    // 立即显示全部文本
    if (typingBufferRef.current) {
      setStreamingText(typingBufferRef.current);
    }
  };

  // ===== 发送消息（有内容=保存不回复，空内容=触发AI回复）=====
  const sendMessage = async () => {
    // 空输入 + 有待回复消息 → 触发AI
    if (!input.trim() && pendingImages.length === 0 && pendingFiles.length === 0) {
      if (loading) return;
      if (pendingCount > 0) {
        triggerAIResponse();
      }
      return;
    }
    if (loading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const res = await fetch(`${API_URL}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.slice(0, 20) || '新对话' }) });
        const data = await res.json();
        if (data.session) { setSessions(prev => [data.session, ...prev]); sessionId = data.session.id; setCurrentSessionId(sessionId); }
      } catch (err) { console.error('创建会话失败:', err); return; }
    }

    const userMsg = {
      id: genId(), role: 'user', content: input,
      images: pendingImages.length > 0 ? pendingImages : undefined,
      file_names: pendingFiles.length > 0 ? pendingFiles.map(f => f.name) : undefined,
      created_at: new Date().toISOString(), reply_to: replyTo?.id || null,
      reply_preview: replyTo ? `${replyTo.role === 'user' ? '我' : (profile.aiName || '裴拟')}: ${getReplyPreview(replyTo)}` : null
    };
    setMessages(prev => [...prev, userMsg]);
    const sentInput = input;
    const sentImages = [...pendingImages];
    const sentFiles = [...pendingFiles];
    setInput(''); setPendingImages([]); setPendingFiles([]);
    setReplyTo(null); setShowToolbar(false);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.blur(); }

    // 只保存消息，不触发AI
    try {
      const chatBody = buildChatBody(sentInput, sentImages, sentFiles, sessionId);
      delete chatBody.tts_config;
      await fetch(`${API_URL}/messages/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody)
      });
      setPendingCount(c => c + 1);
    } catch (err) { console.error('保存消息失败:', err); }
  };

  // ===== 触发AI回复（空输入点发送时触发）=====
  const triggerAIResponse = async () => {
    if (loading || !currentSessionId) return;
    setLoading(true); setStreamingText(''); setTypingStatus('正在留下足迹……');
    const activeApi = getActiveModel();
    const chatBody = { session_id: currentSessionId, model };
    if (activeApi) { chatBody.api_url = activeApi.baseUrl; chatBody.api_key = activeApi.apiKey; chatBody.api_model = activeApi.name; }
    const savedTemp = parseFloat(localStorage.getItem('apiTemperature'));
    if (!isNaN(savedTemp)) chatBody.temperature = savedTemp;
    // AI 参数
    const aiParams = JSON.parse(localStorage.getItem('aiParams') || '{}');
    if (aiParams.max_context_rounds) chatBody.max_context_rounds = aiParams.max_context_rounds;
    if (aiParams.auto_summarize_after) chatBody.auto_summarize_after = aiParams.auto_summarize_after;
    if (aiParams.compress_keep_rounds) chatBody.compress_keep_rounds = aiParams.compress_keep_rounds;
    if (aiParams.max_reply_tokens) chatBody.max_reply_tokens = aiParams.max_reply_tokens;
    // 搜索设置
    chatBody.search_enabled = searchSettings.enabled;
    if (searchSettings.city) chatBody.search_city = searchSettings.city;
    // 音乐信息
    if (musicInfo) chatBody.music_info = musicInfo;
    if (ttsConfig.apiKey) {
      chatBody.tts_config = { apiKey: ttsConfig.apiKey, voiceId: ttsConfig.customVoiceId || ttsConfig.voiceId || 'male-qn-qingse', customVoiceId: ttsConfig.customVoiceId || '', groupId: ttsConfig.groupId || '', speed: ttsConfig.speed || 1.0, model: ttsConfig.model || 'speech-02-hd' };
    }

    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch(`${API_URL}/chat/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody), signal: abortControllerRef.current.signal
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let usage = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'searching') { setTypingStatus('正在搜索中……'); }
            else if (data.type === 'delta') { fullText += data.content; setTypingStatus(''); startTypingEffect(fullText); }
            else if (data.type === 'done') { usage = data.usage; }
            else if (data.type === 'error') { fullText = '抱歉，出了点问题: ' + (data.error || '未知错误'); setStreamingText(fullText); }
          } catch (e) {}
        }
      }
      stopTypingEffect();
      setStreamingText('');
      setTypingStatus('');
      // 提取 AI 给出的 [music]放歌标记（不显示给用户），其余文本正常展示
      const MUSIC_RE = /\[music\]([\s\S]*?)\[\/music\]/g;
      const musicKeywords = [];
      const cleanText = fullText.replace(MUSIC_RE, (m, kw) => { const t = (kw || '').trim(); if (t) musicKeywords.push(t); return ''; });
      if (cleanText.trim()) {
        const parts = cleanText.trim().split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 300));
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: parts[i], created_at: new Date().toISOString(), usage: i === parts.length - 1 ? usage : null }]);
        }
      }
      // 让 AI 主动为用户放歌
      musicKeywords.forEach(kw => playMusicByKeyword(kw));
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请稍后再试', created_at: new Date().toISOString() }]);
      }
    }
    setTypingStatus('');
    setPendingCount(0);
    setLoading(false);
    abortControllerRef.current = null;
  };

  // ===== 停止生成 =====
  const stopGeneration = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); }
  };

  // ===== 重新生成 =====
  const regenerateResponse = async () => {
    if (loading || !currentSessionId) return;
    setLoading(true); setStreamingText(''); setTypingStatus('正在留下足迹……');
    const chatBody = buildChatBody(null, null, null, currentSessionId, true);
    // AI 参数
    const aiParams = JSON.parse(localStorage.getItem('aiParams') || '{}');
    if (aiParams.max_context_rounds) chatBody.max_context_rounds = aiParams.max_context_rounds;
    if (aiParams.auto_summarize_after) chatBody.auto_summarize_after = aiParams.auto_summarize_after;
    if (aiParams.compress_keep_rounds) chatBody.compress_keep_rounds = aiParams.compress_keep_rounds;
    if (aiParams.max_reply_tokens) chatBody.max_reply_tokens = aiParams.max_reply_tokens;
    // 搜索设置
    chatBody.search_enabled = searchSettings.enabled;
    if (searchSettings.city) chatBody.search_city = searchSettings.city;
    // 删除前端最后一条 AI 消息
    setMessages(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].role === 'assistant') { arr.splice(i, 1); break; } }
      return arr;
    });

    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch(`${API_URL}/chat/regenerate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody), signal: abortControllerRef.current.signal
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let usage = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'searching') { setTypingStatus('正在搜索中……'); }
            else if (data.type === 'delta') { fullText += data.content; setTypingStatus(''); startTypingEffect(fullText); }
            else if (data.type === 'done') { usage = data.usage; }
            else if (data.type === 'error') { fullText = '抱歉，出了点问题: ' + (data.error || '未知错误'); setStreamingText(fullText); }
          } catch (e) {}
        }
      }
      stopTypingEffect();
      setStreamingText('');
      setTypingStatus('');
      // 提取 AI 给出的 [music]放歌标记（不显示给用户），其余文本正常展示
      const MUSIC_RE = /\[music\]([\s\S]*?)\[\/music\]/g;
      const musicKeywords = [];
      const cleanText = fullText.replace(MUSIC_RE, (m, kw) => { const t = (kw || '').trim(); if (t) musicKeywords.push(t); return ''; });
      if (cleanText.trim()) {
        const parts = cleanText.trim().split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 300));
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: parts[i], created_at: new Date().toISOString(), usage: i === parts.length - 1 ? usage : null }]);
        }
      }
      // 让 AI 主动为用户放歌
      musicKeywords.forEach(kw => playMusicByKeyword(kw));
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请稍后再试', created_at: new Date().toISOString() }]);
      }
    }
    setTypingStatus('');
    setLoading(false);
    abortControllerRef.current = null;
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; }
  };

  const onScroll = () => { if (messagesAreaRef.current) { const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current; setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200); } };
  const onQuote = (msg) => { setReplyTo(msg); if (textareaRef.current) textareaRef.current.focus(); };
  const onCopy = (msg) => { navigator.clipboard.writeText(msg.content || ''); };
  const onRead = useCallback((id) => { setReadSet(prev => { if (prev.has(id)) return prev; const n = new Set(prev); n.add(id); return n; }); }, []);
  const onEdit = (msg) => { setEditingId(msg.id); setEditContent(msg.content); };
  const onDelete = async (msg) => { if (!confirm('确定删除这条消息吗？')) return; try { await fetch(`${API_URL}/messages/${msg.id}`, { method: 'DELETE' }); setMessages(prev => prev.filter(m => m.id !== msg.id)); } catch (err) { console.error('删除失败:', err); } };
  const saveEdit = async (msgId) => { try { await fetch(`${API_URL}/messages/${msgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editContent }) }); setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, edited: true } : m)); setEditingId(null); } catch (err) { console.error('编辑失败:', err); } };
  const onRecall = async (msg) => { if (!confirm('撤回这条消息？')) return; try { await fetch(`${API_URL}/messages/${msg.id}`, { method: 'DELETE' }); setMessages(prev => prev.map(m => m.id === msg.id ? { id: m.id, role: 'system', recall: true, recallText: m.role === 'user' ? '你撤回了一条消息' : (profile.aiName || '裴拟') + ' 撤回了一条消息' } : m)); } catch (err) { console.error('撤回失败:', err); } };

  // ===== 多选操作 =====
  const toggleMsgSelection = (msgId) => {
    setSelectedMsgIds(prev => {
      const n = new Set(prev);
      if (n.has(msgId)) n.delete(msgId); else n.add(msgId);
      return n;
    });
  };
  const exitMultiSelect = () => { setMultiSelectMode(false); setSelectedMsgIds(new Set()); };
  const deleteSelectedMessages = async () => {
    if (selectedMsgIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedMsgIds.size} 条消息吗？`)) return;
    for (const id of selectedMsgIds) {
      try { await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE' }); } catch (err) { console.error('删除失败:', err); }
    }
    setMessages(prev => prev.filter(m => !selectedMsgIds.has(m.id)));
    exitMultiSelect();
  };
  const forwardSelectedMessages = () => {
    if (selectedMsgIds.size === 0) return;
    const selectedMsgs = messages.filter(m => selectedMsgIds.has(m.id));
    const text = selectedMsgs.map(m => `[${m.role === 'user' ? (profile.userName || '我') : (profile.aiName || '裴拟')}]\n${m.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      alert(`已复制 ${selectedMsgIds.size} 条消息到剪贴板，可粘贴到其他地方`);
      exitMultiSelect();
    }).catch(() => { alert('复制失败'); });
  };

  // ===== 图片选择 =====
  const onImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} 超过5MB，已跳过`); continue; }
      const reader = new FileReader();
      reader.onload = () => { setPendingImages(prev => [...prev, reader.result]); };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };
  const removePendingImage = (idx) => { setPendingImages(prev => prev.filter((_, i) => i !== idx)); };

  // ===== 文件选择（文本类文件）=====
  const onFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) { alert(`${file.name} 超过2MB，已跳过`); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        setPendingFiles(prev => [...prev, { name: file.name, content: reader.result, size: file.size }]);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };
  const removePendingFile = (idx) => { setPendingFiles(prev => prev.filter((_, i) => i !== idx)); };

  // ===== 语音播放 =====
  const playVoice = (msg) => {
    if (!msg.voice || !msg.voice.audio) return;
    if (playingVoiceId === msg.id && audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlayingVoiceId(null); return; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const byteChars = atob(msg.voice.audio);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingVoiceId(msg.id);
      audio.play();
      audio.onended = () => { audioRef.current = null; URL.revokeObjectURL(url); setPlayingVoiceId(null); };
      audio.onerror = () => { audioRef.current = null; URL.revokeObjectURL(url); setPlayingVoiceId(null); };
    } catch (err) { console.error('播放失败:', err); }
  };

  // ===== 语音输入（Web Speech API）=====
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('你的浏览器不支持语音输入，请使用 Chrome 或 Edge'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) {
        setInput(prev => prev + finalText);
        const ta = textareaRef.current;
        if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; }
      }
    };
    recognition.onerror = (event) => { console.error('语音识别错误:', event.error); setIsListening(false); };
    recognition.onend = () => { setIsListening(false); };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  // ===== 音乐播放（统一 Audio 元素，AI 也能搜索并播放）=====
  const ensureAudio = () => {
    if (!musicAudioRef.current) {
      const a = new Audio();
      a.addEventListener('timeupdate', () => {
        if (!a.duration) return;
        setNowPlaying(prev => prev ? { ...prev, currentTime: a.currentTime, duration: a.duration, progress: (a.currentTime / a.duration) * 100 } : prev);
      });
      a.addEventListener('ended', () => {
        setNowPlaying(prev => prev ? { ...prev, isPlaying: false, progress: 100, currentTime: a.duration || 0 } : prev);
      });
      a.addEventListener('error', () => {
        setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev);
      });
      musicAudioRef.current = a;
    }
    return musicAudioRef.current;
  };

  // 播放某首歌（先取详情/歌词/URL 再播放），并通知 AI 当前播放
  const playSong = async (song) => {
    if (!song || !song.id) return;
    const audio = ensureAudio();
    try { audio.pause(); } catch (e) {}
    setNowPlaying({
      id: song.id, name: song.name, artist: song.artist, album: song.album || '',
      cover: '', lyric: '', url: '', isPlaying: false, progress: 0, currentTime: 0,
      duration: song.duration ? Math.round(song.duration / 1000) : 0
    });
    try {
      const detailResp = await fetch(`${API_URL}/music/detail/${song.id}`);
      const detailData = await detailResp.json();
      if (detailData.success) {
        setNowPlaying(prev => prev ? { ...prev, cover: detailData.data.cover || '', duration: Math.round((detailData.data.duration || 0) / 1000) } : prev);
      }
      const lyricResp = await fetch(`${API_URL}/music/lyric/${song.id}`);
      const lyricData = await lyricResp.json();
      if (lyricData.success && lyricData.lyric) {
        setNowPlaying(prev => prev ? { ...prev, lyric: lyricData.lyric } : prev);
      }
      const urlResp = await fetch(`${API_URL}/music/url/${song.id}`);
      const urlData = await urlResp.json();
      if (urlData.success && urlData.url) {
        audio.src = urlData.url;
        audio.play().then(() => {
          setNowPlaying(prev => prev ? { ...prev, isPlaying: true, url: urlData.url } : prev);
        }).catch(() => {
          setNowPlaying(prev => prev ? { ...prev, isPlaying: false, url: urlData.url } : prev);
        });
      } else {
        setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev);
      }
    } catch (err) {
      console.error('播放失败:', err);
      setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev);
    }
    // 通知 AI 当前播放的歌曲
    setMusicInfo({ name: song.name, artist: song.artist, duration: song.duration ? Math.round(song.duration / 1000) + '秒' : null });
  };

  // AI（或用户）按关键词搜歌并播放（智能匹配：按歌名/歌手片段打分取最佳）
  const playMusicByKeyword = async (keyword) => {
    if (!keyword || !keyword.trim()) return;
    const segs = keyword.split(/[\s\-—,，·|/]+/).map(s => s.trim()).filter(Boolean);
    const candidates = [];
    const seen = new Set();
    const doSearch = async (kw) => {
      try {
        const resp = await fetch(`${API_URL}/music/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw })
        });
        const data = await resp.json();
        if (data.success && data.songs) {
          for (const s of data.songs.slice(0, 10)) {
            const hay = ((s.name || '') + ' ' + (s.artist || '')).toLowerCase();
            let score = 0;
            for (const seg of segs) { if (seg && hay.includes(seg.toLowerCase())) score++; }
            if (seen.has(s.id)) {
              const ex = candidates.find(c => c.song.id === s.id);
              if (ex && score > ex.score) ex.score = score;
            } else { seen.add(s.id); candidates.push({ song: s, score }); }
          }
        }
      } catch (e) { /* ignore */ }
    };
    await doSearch(keyword.trim());
    if (candidates.length === 0) {
      for (const seg of segs) await doSearch(seg);
    }
    if (candidates.length === 0) return;
    candidates.sort((a, b) => b.score - a.score);
    await playSong(candidates[0].song);
  };

  const togglePlayMusic = () => {
    const audio = musicAudioRef.current;
    if (!audio || !nowPlaying) return;
    if (nowPlaying.isPlaying) { audio.pause(); setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev); }
    else {
      audio.play().then(() => setNowPlaying(prev => prev ? { ...prev, isPlaying: true } : prev)).catch(() => {});
    }
  };

  const seekMusic = (e) => {
    const audio = musicAudioRef.current;
    if (!audio || !nowPlaying || !nowPlaying.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * nowPlaying.duration;
    setNowPlaying(prev => prev ? { ...prev, progress: pct * 100, currentTime: audio.currentTime } : prev);
  };

  const closeMusic = () => {
    const audio = musicAudioRef.current;
    if (audio) { try { audio.pause(); } catch (e) {} }
    setNowPlaying(null);
    setMusicInfo(null);
  };

  // ===== 表情包 =====
  const addStickers = () => { const urls = stickerInput.split('\n').map(s => s.trim()).filter(Boolean); if (urls.length === 0) return; setStickers(prev => [...prev, ...urls.map(url => ({ id: Date.now() + Math.random(), url }))]); setStickerInput(''); };
  const removeSticker = (id) => setStickers(prev => prev.filter(s => s.id !== id));
  const insertSticker = (url) => { setInput(prev => prev + ` [贴纸]${url}[/贴纸] `); setShowStickerPicker(false); };

  // ===== Markdown 导出 =====
  const exportMarkdown = async () => {
    if (!currentSessionId) { alert('请先选择一个会话'); return; }
    try {
      const res = await fetch(`${API_URL}/export/chat/${currentSessionId}/markdown`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sessionName = sessions.find(s => s.id === currentSessionId)?.name || 'export';
      a.download = `${sessionName}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('导出失败: ' + err.message); }
  };

  const activeApi = getActiveModel();
  const availableModels = activeApi?.allModels || ['claude', 'deepseek'];

  const miniMaxVoices = [
    { id: 'male-qn-qingse', name: '青涩青年男声' }, { id: 'male-qn-jingying', name: '精英青年男声' },
    { id: 'male-qn-badao', name: '霸道青年男声' }, { id: 'male-qn-daxuesheng', name: '大学生男声' },
    { id: 'female-shaonv', name: '少女女声' }, { id: 'female-yujie', name: '御姐女声' },
    { id: 'female-chengshu', name: '成熟女声' }, { id: 'female-tianmei', name: '甜美女声' },
  ];

  const quotedIds = useMemo(() => { const s = new Set(); messages.forEach(m => { if (m.reply_to) s.add(m.reply_to); }); return s; }, [messages]);

  // 过滤搜索的会话
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    const q = sessionSearch.toLowerCase();
    return sessions.filter(s => (s.name || '').toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  // 找到最后一条 AI 消息的 index
  const lastAIMsgIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'assistant') return i; }
    return -1;
  }, [messages]);

  if (showSplash) { return <SplashScreen onDone={() => setShowSplash(false)} />; }

  return (
    <div className="app">
      <DesktopPet />

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} msg={contextMenu.msg} isUser={contextMenu.msg.role === 'user'}
          onQuote={onQuote} onCopy={onCopy} onEdit={onEdit} onDelete={onDelete} onRecall={onRecall}
          onMultiSelect={(msg) => { setMultiSelectMode(true); setSelectedMsgIds(new Set([msg.id])); }}
          canRegenerate={contextMenu.msg.role === 'assistant' && contextMenu.index === lastAIMsgIdx}
          onRegenerate={() => { setContextMenu(null); regenerateResponse(); }}
          onClose={() => setContextMenu(null)} />
      )}

      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      {/* 侧边栏 */}
      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🐚 对话列表</h2>
          <button className="new-chat-btn" onClick={createSession}>+ 新对话</button>
        </div>
        {/* 会话搜索 */}
        <div className="session-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="搜索对话..." value={sessionSearch} onChange={(e) => setSessionSearch(e.target.value)} />
        </div>
        <div className="session-list">
          {filteredSessions.map(session => (
            <div key={session.id} className={`session-item ${session.id === currentSessionId ? 'active' : ''}`} onClick={() => { setCurrentSessionId(session.id); setShowSidebar(false); }}>
              <span className="session-name" onDoubleClick={(e) => renameSession(session.id, e)}>🫧 {session.name || '未命名对话'}</span>
              <button className="delete-btn" onClick={(e) => deleteSession(session.id, e)}>×</button>
            </div>
          ))}
          {filteredSessions.length === 0 && sessions.length > 0 && (
            <p style={{ padding: '20px', color: 'var(--ocean-accent)', fontSize: '13px', textAlign: 'center' }}>没有找到匹配的对话</p>
          )}
          {sessions.length === 0 && (
            <p style={{ padding: '20px', color: 'var(--ocean-accent)', fontSize: '13px', textAlign: 'center' }}>海洋馆里还没有故事，点击"+ 新对话"开始吧 🌊</p>
          )}
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={() => setShowProfile(true)}>🐬 简介</button>
          <button className="sidebar-btn" onClick={() => setShowApiConfig(true)}>🔌 API配置</button>
          <button className="sidebar-btn" onClick={() => setShowMemoryPalace(true)}>🪸 记忆宫殿</button>
          <button className="sidebar-btn" onClick={exportMarkdown}>📝 导出Markdown</button>
          {/* 主题切换 - 四色系 */}
          <div className="theme-picker">
            <span className="theme-picker-label">主题</span>
            <div className="theme-dots">
              <button className={`theme-dot ocean ${theme === 'ocean' ? 'active' : ''}`} onClick={() => setTheme('ocean')} title="海洋蓝" />
              <button className={`theme-dot orange ${theme === 'orange' ? 'active' : ''}`} onClick={() => setTheme('orange')} title="浅橙色" />
              <button className={`theme-dot gray ${theme === 'gray' ? 'active' : ''}`} onClick={() => setTheme('gray')} title="浅灰色" />
              <button className={`theme-dot purple ${theme === 'purple' ? 'active' : ''}`} onClick={() => setTheme('purple')} title="浅紫色" />
            </div>
          </div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="main-area">
        <header className="chat-header">
          <div className="chat-header-left">
            <button className="menu-btn" onClick={() => setShowSidebar(true)}>☰</button>
            <h1>裴拟的海洋馆 🐟</h1>
          </div>
          <div className="chat-header-right">
            <select className="model-select" value={model} onChange={(e) => setModel(e.target.value)}>
              {availableModels.map(m => (<option key={m} value={m}>{m.length > 20 ? m.slice(0, 20) + '…' : m}</option>))}
            </select>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
          </div>
        </header>

        {/* 消息区 */}
        <div className="messages-area" ref={messagesAreaRef} onScroll={onScroll}>
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <div className="welcome-icon">🌊</div>
              <h2>欢迎来到海洋馆🐋</h2>
              <p>在这片属于我们的海域，留下你的故事吧</p>
              <div className="welcome-decoration">🐠 🐙 🦈 🐚 🪸</div>
              {activeApi && <p className="welcome-model">当前模型: {activeApi.name}</p>}
            </div>
          )}
          {messages.map((msg, index) => msg.recall ? (
            <div key={msg.id || index} className="recall-note">{msg.recallText}</div>
          ) : (
            <MessageBubble key={msg.id || index} msg={msg} index={index} profile={profile}
              onQuote={onQuote} onCopy={onCopy} onEdit={onEdit} onDelete={onDelete} onRecall={onRecall}
              playingVoiceId={playingVoiceId} onPlayVoice={playVoice}
              editingId={editingId} setEditingId={setEditingId} editContent={editContent} setEditContent={setEditContent} saveEdit={saveEdit}
              isQuoted={quotedIds.has(msg.id)} onRead={onRead}
              userRead={msg.role === 'user' && messages.slice(index + 1).some(m => m.role === 'assistant')}
              read={msg.role === 'assistant' ? readSet.has(msg.id) : true}
              isLastAI={index === lastAIMsgIdx}
              multiSelectMode={multiSelectMode}
              isSelected={selectedMsgIds.has(msg.id)}
              onToggleSelect={toggleMsgSelection}
            />
          ))}
          {/* 流式输出区域 */}
          {loading && streamingText ? (
            <div className="message assistant">
              <div className="message-inner">
                <div className="bubble markdown-body"><MarkdownContent content={streamingText} /></div>
                <div className="msg-meta">
                  <span className="streaming-indicator">
                    <span className="streaming-dot"></span>
                    <span className="streaming-dot"></span>
                    <span className="streaming-dot"></span>
                  </span>
                </div>
              </div>
            </div>
          ) : loading && typingStatus ? (
            <div className="message assistant">
              <div className="message-inner">
                <div className="bubble typing-status-bubble">
                  <span className="typing-status-text">{typingStatus}</span>
                </div>
              </div>
            </div>
          ) : loading && (
            <div className="message assistant">
              <div className="message-inner">
                <div className="bubble"><div className="typing-indicator"><span></span><span></span><span></span></div></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 回到底部按钮 */}
        {showScrollBtn && (
          <button className="scroll-bottom-btn" onClick={scrollToBottom} aria-label="回到底部">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 10 12 16 18 10" /></svg>
          </button>
        )}

        {/* 表情包选择器 */}
        {showStickerPicker && (
          <div className="sticker-picker">
            <div className="sticker-picker-header"><span>表情包</span><button onClick={() => setShowStickerPicker(false)}>×</button></div>
            <div className="sticker-list">
              {stickers.length === 0 ? (<p className="sticker-empty">还没有表情包，在下方添加 URL</p>) : (
                stickers.map(s => (<div key={s.id} className="sticker-item"><img src={s.url} alt="sticker" onClick={() => insertSticker(s.url)} /><button onClick={() => removeSticker(s.id)}>×</button></div>))
              )}
            </div>
            <div className="sticker-add"><textarea placeholder="粘贴表情包 URL（每行一个）" value={stickerInput} onChange={(e) => setStickerInput(e.target.value)} rows={2} /><button onClick={addStickers}>添加</button></div>
          </div>
        )}

        {/* 工具栏面板 */}
        {showToolbar && (
          <div className="toolbar-panel">
            <div className="toolbar-item" onClick={() => fileInputRef.current?.click()}>
              <div className="toolbar-item-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--theme-accent, #e89a5a)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="var(--theme-accent, #e89a5a)" stroke="none" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <span className="toolbar-item-label">相册</span>
            </div>
            <div className="toolbar-item" onClick={() => docFileInputRef.current?.click()}>
              <div className="toolbar-item-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--theme-accent, #e89a5a)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="15" y2="17" />
                </svg>
              </div>
              <span className="toolbar-item-label">文件</span>
            </div>
            <div className="toolbar-item" onClick={() => { setShowReadTogether(true); setShowToolbar(false); }}>
              <div className="toolbar-item-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--theme-accent, #e89a5a)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <span className="toolbar-item-label">一起读</span>
            </div>
            <div className="toolbar-item" onClick={() => { setShowMusicPlayer(true); setShowToolbar(false); }}>
              <div className="toolbar-item-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--theme-accent, #e89a5a)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <span className="toolbar-item-label">音乐</span>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/*" multiple style={{ display: 'none' }} onChange={onImageSelect} />
        <input ref={docFileInputRef} type="file" accept=".txt,.md,.json,.csv,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.log,.sql,.java,.c,.cpp,.go,.rs,.rb,.php,.sh,.bat,.ini,.conf" multiple style={{ display: 'none' }} onChange={onFileSelect} />

        {/* 一起读面板 */}
        {showReadTogether && currentSessionId && (
          <ReadTogether sessionId={currentSessionId} onClose={() => setShowReadTogether(false)} />
        )}

        {/* 音乐播放器面板 */}
        {showMusicPlayer && (
          <MusicPlayer
            onClose={() => setShowMusicPlayer(false)}
            nowPlaying={nowPlaying}
            playSong={playSong}
            togglePlay={togglePlayMusic}
            seek={seekMusic}
          />
        )}

        {/* 待发送图片预览 */}
        {pendingImages.length > 0 && (
          <div className="pending-images">
            {pendingImages.map((img, i) => (<div key={i} className="pending-image-item"><img src={img} alt="待发送" /><button onClick={() => removePendingImage(i)}>×</button></div>))}
          </div>
        )}
        {/* 待发送文件预览 */}
        {pendingFiles.length > 0 && (
          <div className="pending-files">
            {pendingFiles.map((f, i) => (
              <div key={i} className="pending-file-item">
                <svg className="file-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="file-name">{f.name}</span>
                <span className="file-size">{(f.size / 1024).toFixed(1)}KB</span>
                <button onClick={() => removePendingFile(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* 引用消息预览 */}
        {replyTo && (
          <div className="reply-bar">
            <div className="reply-bar-content">
              <span className="reply-bar-name">{replyTo.role === 'user' ? '我' : (profile.aiName || '裴拟')}</span>
              <span className="reply-bar-text">: {getReplyPreview(replyTo)}</span>
            </div>
            <button className="reply-bar-close" onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}

        {/* 多选操作栏 */}
        {multiSelectMode && (
          <div className="multi-select-bar">
            <button className="ms-btn ms-cancel" onClick={exitMultiSelect}>取消({selectedMsgIds.size})</button>
            <div className="ms-actions">
              <button className="ms-btn ms-forward" onClick={forwardSelectedMessages} disabled={selectedMsgIds.size === 0}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" /></svg>
                转发
              </button>
              <button className="ms-btn ms-delete" onClick={deleteSelectedMessages} disabled={selectedMsgIds.size === 0}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                删除
              </button>
            </div>
          </div>
        )}

        {/* 输入区 */}
        <div className="input-area">
          <div className="input-wrapper">
            <button className="plus-btn" onClick={() => { setShowToolbar(!showToolbar); setShowStickerPicker(false); }}>+</button>
            <button className="sticker-btn" onClick={() => { setShowStickerPicker(!showStickerPicker); setShowToolbar(false); }} aria-label="表情包">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M8 14.5c1.5 1.8 4.5 1.8 6 0" /><circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <div className="input-box">
              <textarea ref={textareaRef} className="chat-input" value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="在这片海域留下你的声音…" rows={1} />
              {/* 语音输入按钮：放在输入框内右侧，像微信 */}
              <button className={`voice-input-btn inside ${isListening ? 'listening' : ''}`} onClick={toggleVoiceInput} aria-label="语音输入" title={isListening ? '正在录音，点击停止' : '语音输入'}>
                {isListening ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
            </div>
            {/* 发送/停止按钮 */}
            {loading ? (
              <button className="send-btn stop-btn" onClick={stopGeneration} title="停止生成">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button className={`send-btn ${pendingCount > 0 && !input.trim() ? 'pending-trigger' : ''}`} onClick={sendMessage} disabled={!input.trim() && pendingImages.length === 0 && pendingFiles.length === 0 && pendingCount === 0}>
                {pendingCount > 0 && !input.trim() ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                ) : '🐋'}
              </button>
            )}
          </div>
          {/* AI 思考时，小水泡从底部栏底下往上冒 */}
          {loading && (
            <div className="input-bubbles">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
          )}
        </div>
        {/* 音乐悬浮球（可拖动 / 可缩小）*/}
        {nowPlaying && (
          <FloatingMusicPlayer
            song={nowPlaying}
            onToggle={togglePlayMusic}
            onSeek={seekMusic}
            onClose={closeMusic}
            onOpen={() => setShowMusicPlayer(true)}
          />
        )}
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙ 设置</h2>
              <button className="modal-close-x" onClick={() => setShowSettings(false)} aria-label="关闭">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>
            <div className="settings-section">
              <h3 className="settings-section-title">联网搜索</h3>
              <label className="modal-check"><input type="checkbox" checked={searchSettings.enabled} onChange={(e) => setSearchSettings({ ...searchSettings, enabled: e.target.checked })} />启用联网搜索（天气、新闻等实际问题）</label>
              <div className="modal-field"><label>默认城市（用于天气查询定位）</label><input type="text" value={searchSettings.city || ''} onChange={(e) => setSearchSettings({ ...searchSettings, city: e.target.value })} placeholder="如：北京" /></div>
            </div>
            <div className="settings-section">
              <h3 className="settings-section-title">桌宠设置</h3>
              <div className="modal-field"><label>桌宠图片URL（留空用默认🐠）</label><input type="text" value={petSettings.image} onChange={(e) => setPetSettings({ ...petSettings, image: e.target.value })} placeholder="粘贴图片URL" /></div>
              <div className="modal-field"><label>桌宠大小: {petSettings.size}px</label><input type="range" min="20" max="100" value={petSettings.size} onChange={(e) => setPetSettings({ ...petSettings, size: parseInt(e.target.value) })} /></div>
            </div>
            <div className="settings-section">
              <h3 className="settings-section-title">语音设置 (MiniMax TTS)</h3>
              <div className="modal-field"><label>MiniMax API Key</label><input type="password" value={ttsConfig.apiKey || ''} onChange={(e) => setTtsConfig({ ...ttsConfig, apiKey: e.target.value })} placeholder="在 minimax.io 注册获取" /></div>
              <div className="modal-field"><label>音色预设</label><select value={ttsConfig.voiceId || 'male-qn-qingse'} onChange={(e) => setTtsConfig({ ...ttsConfig, voiceId: e.target.value })}>{miniMaxVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              <div className="modal-field"><label>自定义 Voice ID（优先于预设）</label><input type="text" value={ttsConfig.customVoiceId || ''} onChange={(e) => setTtsConfig({ ...ttsConfig, customVoiceId: e.target.value })} placeholder="填写后优先使用此 voice_id" /></div>
              <div className="modal-field"><label>Group ID（部分 MiniMax 账号需要）</label><input type="text" value={ttsConfig.groupId || ''} onChange={(e) => setTtsConfig({ ...ttsConfig, groupId: e.target.value })} placeholder="如需要 group_id 请填写" /></div>
              <div className="modal-field"><label>语速: {ttsConfig.speed || 1.0}</label><input type="range" min="0.5" max="2" step="0.1" value={ttsConfig.speed || 1.0} onChange={(e) => setTtsConfig({ ...ttsConfig, speed: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowSettings(false)}>取消</button><button className="btn-save" onClick={saveSettings}>保存</button></div>
          </div>
        </div>
      )}

      {/* 简介弹窗 */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>👤 简介</h2>
            <div className="modal-field"><label>你的名字</label><input value={profile.userName || ''} onChange={(e) => setProfile({ ...profile, userName: e.target.value })} /></div>
            <div className="modal-field"><label>你的简介</label><textarea value={profile.userBio || ''} onChange={(e) => setProfile({ ...profile, userBio: e.target.value })} placeholder="介绍一下你自己..." /></div>
            <div className="modal-field"><label>AI 的名字</label><input value={profile.aiName || ''} onChange={(e) => setProfile({ ...profile, aiName: e.target.value })} /></div>
            <div className="modal-field"><label>AI 的简介</label><textarea value={profile.aiBio || ''} onChange={(e) => setProfile({ ...profile, aiBio: e.target.value })} placeholder="描述你心目中 AI 的样子..." /></div>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowProfile(false)}>取消</button><button className="btn-save" onClick={saveProfile}>保存</button></div>
          </div>
        </div>
      )}

      {showApiConfig && <ApiConfig onClose={() => { setShowApiConfig(false); }} onConfigChange={() => {}} />}
      {showMemoryPalace && <MemoryPalace onClose={() => setShowMemoryPalace(false)} currentSessionId={currentSessionId} />}
    </div>
  );
}

export default App;
