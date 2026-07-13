import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ApiConfig from './ApiConfig.jsx';
import MemoryPalace from './MemoryPalace.jsx';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

// ===== 小工具 =====
function getReplyPreview(msg) {
  if (!msg) return '';
  if (msg.voice) return '[语音]';
  if (msg.images && msg.images.length > 0) return '[图片]';
  if (msg.content && msg.content.includes('[贴纸]')) return '[贴纸]';
  return msg.content?.slice(0, 60) || '';
}

function renderStickerContent(content) {
  if (!content) return null;
  if (!content.includes('[贴纸]')) return content;
  const parts = [];
  const regex = /\[贴纸\](.*?)\[\/贴纸\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<img key={`s${match.index}`} src={match[1]} alt="贴纸" className="inline-sticker" />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={`t${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }
  return parts;
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

  // 生成气泡（只生成一次）
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
      {/* 水面光线 */}
      <div className="splash-rays" />

      {/* 可爱的鲸鱼（居中，轻轻浮动） */}
      <div className="splash-whale-wrap" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -45%) scale(0.85)' }}>
        <svg className="splash-whale-svg" viewBox="0 0 220 180">
          <defs>
            <linearGradient id="whaleSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7EC8D3" />
              <stop offset="100%" stopColor="#58A8B8" />
            </linearGradient>
            <linearGradient id="whaleBelly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EAF7FA" />
              <stop offset="100%" stopColor="#C8ECF2" />
            </linearGradient>
            <filter id="whaleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 喷水 */}
          <g className="whale-spray">
            <circle cx="110" cy="22" r="3.5" fill="#EAF7FA" opacity="0.7" />
            <circle cx="102" cy="14" r="2.5" fill="#C8ECF2" opacity="0.55" />
            <circle cx="118" cy="16" r="2.2" fill="#EAF7FA" opacity="0.45" />
            <circle cx="96" cy="6" r="1.6" fill="#C8ECF2" opacity="0.35" />
            <circle cx="124" cy="8" r="1.4" fill="#EAF7FA" opacity="0.3" />
          </g>

          {/* 尾鳍 */}
          <path className="whale-tail" d="M 32 88 C 18 76, 8 64, 4 58 C 16 70, 26 80, 36 86 C 28 92, 18 102, 8 112 C 18 104, 28 96, 40 92 Z" fill="#58A8B8" />

          {/* 身体 */}
          <path className="whale-body" d="M 48 90 C 48 52, 85 38, 125 42 C 158 46, 180 68, 178 96 C 176 126, 148 144, 110 144 C 72 144, 48 124, 48 90 Z" fill="url(#whaleSkin)" filter="url(#whaleGlow)" />

          {/* 肚皮 */}
          <path d="M 62 98 C 78 130, 142 130, 164 98 C 158 122, 130 134, 110 134 C 86 134, 66 120, 62 98 Z" fill="url(#whaleBelly)" opacity="0.95" />

          {/* 肚皮纹理线 */}
          <path d="M 72 108 Q 110 120, 152 106" stroke="#9BD3DD" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
          <path d="M 80 118 Q 110 128, 144 116" stroke="#9BD3DD" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d="M 92 126 Q 110 132, 134 124" stroke="#9BD3DD" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />

          {/* 胸鳍 */}
          <path d="M 95 120 C 88 136, 78 142, 72 138 C 82 132, 90 124, 100 118 Z" fill="#4A98A8" opacity="0.55" />

          {/* 眼睛 */}
          <circle cx="146" cy="74" r="4.5" fill="#2A4A54" />
          <circle cx="147.5" cy="72.8" r="1.6" fill="white" />

          {/* 微笑 */}
          <path d="M 150 86 Q 156 90, 150 94" stroke="#2A4A54" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* 腮红 */}
          <ellipse cx="138" cy="88" rx="5" ry="3" fill="#FFB7B2" opacity="0.35" />
        </svg>
      </div>

      {/* 上升的气泡 */}
      <div className="splash-bubbles">
        {bubbles.map(b => (
          <div
            key={b.id}
            className="splash-bubble"
            style={{
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`
            }}
          />
        ))}
      </div>

      {/* 底部水面 */}
      <div className="splash-water-surface" />

      {/* 鱼说 品牌字 */}
      <div className="splash-bottom">
        <h1
          className="splash-brand"
          style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(24px)' }}
        >
          鱼说
        </h1>
        <div className="splash-ripple" />
        <p className="splash-tagline" style={{ opacity: phase >= 1 ? 1 : 0 }}>
          在深海里，听见你的声音
        </p>
      </div>
    </div>
  );
}

// ===== 桌宠组件（支持自定义图片+大小调节）=====
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
        setPos(p => ({
          x: Math.max(10, Math.min(window.innerWidth - petSize - 10, p.x + dir * 0.3)),
          y: p.y + Math.sin(t) * 0.5
        }));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [dir, petSize]);

  const startInteract = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    startPos.current = { x: touch.clientX, y: touch.clientY };
    dragging.current = true;
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    longPressTimer.current = setTimeout(() => {
      dragging.current = false;
      setShowSettings(true);
      setImgInput(petImage);
      setSizeInput(petSize);
    }, 600);
  };

  const onMove = (e) => {
    if (longPressTimer.current) {
      const touch = e.touches ? e.touches[0] : e;
      const dx = Math.abs(touch.clientX - startPos.current.x);
      const dy = Math.abs(touch.clientY - startPos.current.y);
      if (dx > 8 || dy > 8) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    if (!dragging.current) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    setPos({ x: touch.clientX - offset.current.x, y: touch.clientY - offset.current.y });
  };

  const endInteract = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    dragging.current = false;
  };

  const savePetSettings = () => {
    localStorage.setItem('petImage', imgInput);
    localStorage.setItem('petSize', String(sizeInput));
    setPetImage(imgInput);
    setPetSize(sizeInput);
    setShowSettings(false);
  };

  const resetPet = () => {
    setImgInput('');
    setSizeInput(40);
  };

  const onPetFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('图片不能超过3MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImgInput(reader.result); };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div
        ref={petRef}
        className="desktop-pet"
        style={{ left: pos.x, top: pos.y, width: petSize, height: petSize, transform: dir < 0 ? 'scaleX(-1)' : '' }}
        onMouseDown={startInteract}
        onMouseMove={onMove}
        onMouseUp={endInteract}
        onMouseLeave={endInteract}
        onTouchStart={startInteract}
        onTouchMove={onMove}
        onTouchEnd={endInteract}
        onContextMenu={(e) => { e.preventDefault(); setShowSettings(true); setImgInput(petImage); setSizeInput(petSize); }}
      >
        {petImage ? (
          <img src={petImage} alt="桌宠" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
        ) : (
          <span style={{ fontSize: petSize, lineHeight: 1 }}>🐠</span>
        )}
      </div>
      {showSettings && (
        <div className="pet-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="pet-settings" onClick={e => e.stopPropagation()}>
            <h3>桌宠设置</h3>
            <div className="pet-preview">
              {imgInput ? <img src={imgInput} alt="预览" style={{ width: sizeInput, height: sizeInput, objectFit: 'contain' }} /> : <span style={{ fontSize: sizeInput }}>🐠</span>}
            </div>
            <div className="pet-setting-field">
              <label>图片URL</label>
              <input type="text" value={imgInput} onChange={e => setImgInput(e.target.value)} placeholder="粘贴图片URL或上传文件" />
            </div>
            <div className="pet-setting-field">
              <label>上传图片</label>
              <input
                ref={petFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/*"
                style={{ display: 'none' }}
                onChange={onPetFileChange}
              />
              <button className="pet-file-btn" onClick={() => petFileRef.current?.click()}>
                📷 从相册选择
              </button>
            </div>
            <div className="pet-setting-field">
              <label>大小: {sizeInput}px</label>
              <input type="range" min="20" max="100" value={sizeInput} onChange={e => setSizeInput(parseInt(e.target.value))} />
            </div>
            <div className="pet-settings-actions">
              <button className="btn-cancel" onClick={resetPet}>重置</button>
              <button className="btn-save" onClick={savePetSettings}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== 长按上下文菜单（微信风格）=====
function ContextMenu({ x, y, msg, isUser, onQuote, onCopy, onEdit, onDelete, onClose }) {
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
  ];
  if (isUser) items.push({ label: '编辑', onClick: () => { onEdit(msg); onClose(); } });
  items.push({ label: '删除', danger: true, onClick: () => { onDelete(msg); onClose(); } });

  return (
    <div className="context-menu-overlay" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <div ref={menuRef} className="context-menu" style={{ left: adjustedPos.x, top: adjustedPos.y }} onClick={e => e.stopPropagation()}>
        {items.map((item, i) => (
          <button key={i} className={item.danger ? 'ctx-item danger' : 'ctx-item'} onClick={item.onClick}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== 语音消息组件（微信风格）=====
function VoiceMessage({ voice, isUser, isPlaying, onPlay }) {
  const duration = voice.duration || 3;
  const width = Math.min(200, 70 + duration * 8);
  return (
    <div
      className={`voice-bubble ${isUser ? 'user' : 'ai'} ${isPlaying ? 'playing' : ''}`}
      style={{ width }}
      onClick={onPlay}
    >
      <span className="voice-icon">{isPlaying ? '⏸' : '▶'}</span>
      <div className="voice-bars">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className="voice-bar" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      <span className="voice-duration">{duration}''</span>
    </div>
  );
}

// ===== 消息气泡组件 =====
function MessageBubble({ msg, index, onQuote, onCopy, onEdit, onDelete, playingVoiceId, onPlayVoice, editingId, setEditingId, editContent, setEditContent, saveEdit }) {
  const longPressTimer = useRef(null);
  const touchStart = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const isUser = msg.role === 'user';

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      // Trigger context menu via callback - we'll use a custom event
      const rect = e.currentTarget.getBoundingClientRect();
      window.__showContextMenu && window.__showContextMenu(x, y, msg);
    }, 500);
  };
  const handleTouchMove = (e) => {
    if (touchStart.current !== null) {
      const delta = e.touches[0].clientX - touchStart.current;
      if (Math.abs(delta) > 10 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (delta > 0 && delta < 80 && !longPressTimer.current) setSwipeX(delta);
    }
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (swipeX > 40) onQuote(msg);
    setSwipeX(0);
    touchStart.current = null;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    window.__showContextMenu && window.__showContextMenu(e.clientX, e.clientY, msg);
  };

  const handleDoubleClick = () => {
    if (isUser) {
      setEditingId(msg.id);
      setEditContent(msg.content);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (isToday) return time;
    return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
  };

  const isVoicePlaying = playingVoiceId === msg.id;

  return (
    <div
      className={`message ${msg.role}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      style={{ transform: swipeX > 0 ? `translateX(${swipeX}px)` : '' }}
    >
      <div className="message-inner">
        {msg.reply_to && (
          <div className="reply-indicator-bubble">
            <span className="reply-icon">↩</span>
            <span className="reply-text">{msg.reply_preview || '引用消息'}</span>
          </div>
        )}
        {editingId === msg.id ? (
          <div className="edit-mode">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus />
            <div className="edit-actions">
              <button onClick={() => saveEdit(msg.id)}>保存</button>
              <button onClick={() => setEditingId(null)}>取消</button>
            </div>
          </div>
        ) : (
          <>
            {msg.images && msg.images.length > 0 && (
              <div className="msg-images">
                {msg.images.map((img, i) => (
                  <img key={i} src={img} alt="图片" onClick={() => window.open(img, '_blank')} />
                ))}
              </div>
            )}
            {msg.voice ? (
              <VoiceMessage
                voice={msg.voice}
                isUser={isUser}
                isPlaying={isVoicePlaying}
                onPlay={() => onPlayVoice(msg)}
              />
            ) : msg.content ? (
              <div className="bubble">{renderStickerContent(msg.content)}</div>
            ) : null}
          </>
        )}
        <div className="msg-meta">
          <span className="msg-time">{formatTime(msg.created_at)}{msg.edited && ' (已编辑)'}</span>
        </div>
      </div>
    </div>
  );
}

// ===== 主应用 =====
function App() {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splashed'));
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(localStorage.getItem('selectedModel') || 'claude');
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showMemoryPalace, setShowMemoryPalace] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [stickers, setStickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stickers') || '[]'); } catch { return []; }
  });
  const [stickerInput, setStickerInput] = useState('');
  const [profile, setProfile] = useState({ userBio: '', aiBio: '', userName: '我', aiName: '裴拟' });
  const [settings, setSettings] = useState({
    system_prompt: '', temperature: 0.7, max_context_rounds: 20,
    compress_threshold: 4000, compress_keep_rounds: 6, max_reply_tokens: 1024,
    auto_summarize: true, auto_summarize_after: 10, delete_after_summarize: false
  });
  const [ttsConfig, setTtsConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ttsConfig') || '{}'); } catch { return {}; }
  });
  const [petSettings, setPetSettings] = useState({
    image: localStorage.getItem('petImage') || '',
    size: parseInt(localStorage.getItem('petSize') || '40')
  });

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesAreaRef.current) {
        messagesAreaRef.current.scrollTo({ top: messagesAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (showSplash) {
      sessionStorage.setItem('splashed', '1');
      const timer = setTimeout(() => setShowSplash(false), 4400);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  useEffect(() => {
    fetchSessions();
    fetchSettings();
    fetchProfile();
    const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    setVH();
    window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);

  useEffect(() => {
    if (currentSessionId) fetchMessages(currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    localStorage.setItem('selectedModel', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('stickers', JSON.stringify(stickers));
  }, [stickers]);

  useEffect(() => {
    localStorage.setItem('ttsConfig', JSON.stringify(ttsConfig));
  }, [ttsConfig]);

  // 全局长按菜单回调
  useEffect(() => {
    window.__showContextMenu = (x, y, msg) => {
      setContextMenu({ x, y, msg });
    };
    return () => { delete window.__showContextMenu; };
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        if (!currentSessionId && data.sessions.length > 0) setCurrentSessionId(data.sessions[0].id);
      }
    } catch (err) { console.error('加载会话失败:', err); }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (err) { console.error('加载消息失败:', err); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch (err) { console.error('加载设置失败:', err); }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile`);
      const data = await res.json();
      if (data.data) setProfile(data.data);
    } catch (err) { console.error('加载简介失败:', err); }
  };

  const createSession = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新对话' })
      });
      const data = await res.json();
      if (data.session) {
        setSessions(prev => [data.session, ...prev]);
        setCurrentSessionId(data.session.id);
        setMessages([]);
        setShowSidebar(false);
      }
    } catch (err) { console.error('创建会话失败:', err); }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除这个对话吗？')) return;
    try {
      await fetch(`${API_URL}/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
        const next = sessions.find(s => s.id !== id);
        setCurrentSessionId(next?.id || null);
        setMessages([]);
      }
    } catch (err) { console.error('删除会话失败:', err); }
  };

  const renameSession = async (id, e) => {
    e.stopPropagation();
    const newName = prompt('输入新名称:');
    if (!newName) return;
    try {
      await fetch(`${API_URL}/sessions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    } catch (err) { console.error('重命名失败:', err); }
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      localStorage.setItem('petImage', petSettings.image);
      localStorage.setItem('petSize', String(petSettings.size));
      setShowSettings(false);
    } catch (err) { console.error('保存设置失败:', err); }
  };

  const saveProfile = async () => {
    try {
      await fetch(`${API_URL}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      setShowProfile(false);
    } catch (err) { console.error('保存简介失败:', err); }
  };

  // ===== 发送消息（支持图片+分条回复）=====
  const sendMessage = async () => {
    if ((!input.trim() && pendingImages.length === 0) || loading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const res = await fetch(`${API_URL}/sessions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: input.slice(0, 20) || '新对话' })
        });
        const data = await res.json();
        if (data.session) {
          setSessions(prev => [data.session, ...prev]);
          sessionId = data.session.id;
          setCurrentSessionId(sessionId);
        }
      } catch (err) { console.error('创建会话失败:', err); return; }
    }

    const userMsg = {
      role: 'user', content: input,
      images: pendingImages.length > 0 ? pendingImages : undefined,
      created_at: new Date().toISOString(), reply_to: replyTo?.id || null,
      reply_preview: replyTo ? `${replyTo.role === 'user' ? '我' : (profile.aiName || '裴拟')}: ${getReplyPreview(replyTo)}` : null
    };
    setMessages(prev => [...prev, userMsg]);
    const sentInput = input;
    const sentImages = [...pendingImages];
    setInput('');
    setPendingImages([]);
    setLoading(true);
    setReplyTo(null);
    setShowToolbar(false);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.blur(); }

    const activeApi = getActiveModel();
    const chatBody = { message: sentInput, session_id: sessionId, model };
    if (sentImages.length > 0) chatBody.images = sentImages;
    if (activeApi) {
      chatBody.api_url = activeApi.baseUrl;
      chatBody.api_key = activeApi.apiKey;
      chatBody.api_model = activeApi.name;
    }
    if (ttsConfig.apiKey) {
      chatBody.tts_config = {
        apiKey: ttsConfig.apiKey,
        voiceId: ttsConfig.customVoiceId || ttsConfig.voiceId || 'male-qn-qingse',
        customVoiceId: ttsConfig.customVoiceId || '',
        groupId: ttsConfig.groupId || '',
        speed: ttsConfig.speed || 1.0,
        model: ttsConfig.model || 'speech-02-hd'
      };
    }

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody)
      });
      const data = await res.json();

      if (data.replies && data.replies.length > 0) {
        // 分条逐条添加
        for (let i = 0; i < data.replies.length; i++) {
          setLoading(true);
          if (i > 0) {
            await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
          }
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.replies[i].content,
            voice: data.replies[i].voice || null,
            created_at: data.replies[i].created_at
          }]);
          setLoading(false);
          if (i < data.replies.length - 1) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，出了点问题: ' + (data.error || '未知错误'),
          created_at: new Date().toISOString()
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: '网络错误，请稍后再试',
        created_at: new Date().toISOString()
      }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; }
  };

  const onScroll = () => {
    if (messagesAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
    }
  };

  const onQuote = (msg) => {
    setReplyTo(msg);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const onCopy = (msg) => {
    navigator.clipboard.writeText(msg.content || '');
  };

  const onEdit = (msg) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const onDelete = async (msg) => {
    if (!confirm('确定删除这条消息吗？')) return;
    try {
      await fetch(`${API_URL}/messages/${msg.id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    } catch (err) { console.error('删除失败:', err); }
  };

  const saveEdit = async (msgId) => {
    try {
      await fetch(`${API_URL}/messages/${msgId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, edited: true } : m));
      setEditingId(null);
    } catch (err) { console.error('编辑失败:', err); }
  };

  // ===== 图片选择 =====
  const onImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} 超过5MB，已跳过`); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImages(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removePendingImage = (idx) => {
    setPendingImages(prev => prev.filter((_, i) => i !== idx));
  };

  // ===== 语音消息播放（微信风格，点击播放/暂停）=====
  const playVoice = (msg) => {
    if (!msg.voice || !msg.voice.audio) return;
    // 正在播放这条 → 暂停
    if (playingVoiceId === msg.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingVoiceId(null);
      return;
    }
    // 停止之前的
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // 解码 base64 → 播放
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

  // ===== 表情包 =====
  const addStickers = () => {
    const urls = stickerInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setStickers(prev => [...prev, ...urls.map(url => ({ id: Date.now() + Math.random(), url }))]);
    setStickerInput('');
  };
  const removeSticker = (id) => setStickers(prev => prev.filter(s => s.id !== id));
  const insertSticker = (url) => {
    setInput(prev => prev + ` [贴纸]${url}[/贴纸] `);
    setShowStickerPicker(false);
  };

  const activeApi = getActiveModel();
  const availableModels = activeApi?.allModels || ['claude', 'deepseek'];

  const miniMaxVoices = [
    { id: 'male-qn-qingse', name: '青涩青年男声' },
    { id: 'male-qn-jingying', name: '精英青年男声' },
    { id: 'male-qn-badao', name: '霸道青年男声' },
    { id: 'male-qn-daxuesheng', name: '大学生男声' },
    { id: 'female-shaonv', name: '少女女声' },
    { id: 'female-yujie', name: '御姐女声' },
    { id: 'female-chengshu', name: '成熟女声' },
    { id: 'female-tianmei', name: '甜美女声' },
  ];

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <div className="app">
      <DesktopPet />

      {/* 上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} msg={contextMenu.msg}
          isUser={contextMenu.msg.role === 'user'}
          onQuote={onQuote} onCopy={onCopy} onEdit={onEdit} onDelete={onDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      {/* 侧边栏 */}
      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🐚 对话列表</h2>
          <button className="new-chat-btn" onClick={createSession}>+ 新对话</button>
        </div>
        <div className="session-list">
          {sessions.map(session => (
            <div key={session.id} className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => { setCurrentSessionId(session.id); setShowSidebar(false); fetchMessages(session.id); }}>
              <span className="session-name" onDoubleClick={(e) => renameSession(session.id, e)}>
                🫧 {session.name || '未命名对话'}
              </span>
              <button className="delete-btn" onClick={(e) => deleteSession(session.id, e)}>×</button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p style={{ padding: '20px', color: '#7ab0c4', fontSize: '13px', textAlign: 'center' }}>
              海洋馆里还没有故事，点击"+ 新对话"开始吧 🌊
            </p>
          )}
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={() => setShowProfile(true)}>👤 简介</button>
          <button className="sidebar-btn" onClick={() => setShowApiConfig(true)}>🔑 API配置</button>
          <button className="sidebar-btn" onClick={() => setShowMemoryPalace(true)}>🧠 记忆宫殿</button>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="main-area">
        <header className="chat-header">
          <div className="chat-header-left">
            <button className="menu-btn" onClick={() => setShowSidebar(true)}>☰</button>
            <h1>裴拟的海洋馆 🐠</h1>
          </div>
          <div className="chat-header-right">
            <select className="model-select" value={model} onChange={(e) => setModel(e.target.value)}>
              {availableModels.map(m => (
                <option key={m} value={m}>{m.length > 20 ? m.slice(0, 20) + '…' : m}</option>
              ))}
            </select>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
          </div>
        </header>

        {/* 消息区 */}
        <div className="messages-area" ref={messagesAreaRef} onScroll={onScroll}>
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <div className="welcome-icon">🌊</div>
              <h2>欢迎来到裴拟的海洋馆</h2>
              <p>在这片海域，裴拟陪你聊天、思考和生活</p>
              <div className="welcome-decoration">🐠 🐙 🦈 🐚 🪸</div>
              {activeApi && <p className="welcome-model">当前模型: {activeApi.name}</p>}
            </div>
          )}
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id || index}
              msg={msg} index={index}
              onQuote={onQuote} onCopy={onCopy} onEdit={onEdit} onDelete={onDelete}
              playingVoiceId={playingVoiceId}
              onPlayVoice={playVoice}
              editingId={editingId} setEditingId={setEditingId}
              editContent={editContent} setEditContent={setEditContent}
              saveEdit={saveEdit}
            />
          ))}
          {loading && (
            <div className="message assistant">
              <div className="message-inner">
                <div className="bubble">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 回到底部按钮 */}
        {showScrollBtn && (
          <button className="scroll-bottom-btn" onClick={scrollToBottom} aria-label="回到底部">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 10 12 16 18 10" />
            </svg>
          </button>
        )}

        {/* 表情包选择器 */}
        {showStickerPicker && (
          <div className="sticker-picker">
            <div className="sticker-picker-header">
              <span>表情包</span>
              <button onClick={() => setShowStickerPicker(false)}>×</button>
            </div>
            <div className="sticker-list">
              {stickers.length === 0 ? (
                <p className="sticker-empty">还没有表情包，在下方添加 URL</p>
              ) : (
                stickers.map(s => (
                  <div key={s.id} className="sticker-item">
                    <img src={s.url} alt="sticker" onClick={() => insertSticker(s.url)} />
                    <button onClick={() => removeSticker(s.id)}>×</button>
                  </div>
                ))
              )}
            </div>
            <div className="sticker-add">
              <textarea
                placeholder="粘贴表情包 URL（每行一个）"
                value={stickerInput}
                onChange={(e) => setStickerInput(e.target.value)}
                rows={2}
              />
              <button onClick={addStickers}>添加</button>
            </div>
          </div>
        )}

        {/* 工具栏面板（微信风格 +）*/}
        {showToolbar && (
          <div className="toolbar-panel">
            <div className="toolbar-item" onClick={() => fileInputRef.current?.click()}>
              <div className="toolbar-item-icon">📷</div>
              <span className="toolbar-item-label">相册</span>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/*" multiple style={{ display: 'none' }} onChange={onImageSelect} />

        {/* 待发送图片预览 */}
        {pendingImages.length > 0 && (
          <div className="pending-images">
            {pendingImages.map((img, i) => (
              <div key={i} className="pending-image-item">
                <img src={img} alt="待发送" />
                <button onClick={() => removePendingImage(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* 引用消息预览（微信风格，在输入框上方）*/}
        {replyTo && (
          <div className="reply-bar">
            <div className="reply-bar-content">
              <span className="reply-bar-name">{replyTo.role === 'user' ? '我' : (profile.aiName || '裴拟')}</span>
              <span className="reply-bar-text">: {getReplyPreview(replyTo)}</span>
            </div>
            <button className="reply-bar-close" onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}

        {/* 输入区 */}
        <div className="input-area">
          <div className="input-wrapper">
            <button className="sticker-btn" onClick={() => { setShowStickerPicker(!showStickerPicker); setShowToolbar(false); }} aria-label="表情包">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14.5c1.5 1.8 4.5 1.8 6 0" />
                <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="在这片海域留下你的声音..."
              rows={1}
            />
            <button className="plus-btn" onClick={() => { setShowToolbar(!showToolbar); setShowStickerPicker(false); }}>+</button>
            <button className="send-btn" onClick={sendMessage} disabled={loading || (!input.trim() && pendingImages.length === 0)}>
              🐋
            </button>
          </div>
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙ 设置</h2>

            <div className="settings-section">
              <h3 className="settings-section-title">AI 设置</h3>
              <div className="modal-field">
                <label>系统提示词</label>
                <textarea value={settings.system_prompt || ''} onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })} placeholder="定义 AI 的人格和行为方式..." />
              </div>
              <div className="modal-field">
                <label>温度 (0-1)</label>
                <input type="number" step="0.1" min="0" max="1" value={settings.temperature} onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })} />
              </div>
              <div className="modal-field">
                <label>上下文保留轮数</label>
                <input type="number" value={settings.max_context_rounds} onChange={(e) => setSettings({ ...settings, max_context_rounds: parseInt(e.target.value) })} />
              </div>
              <div className="modal-field">
                <label>自动总结消息条数 (0=关闭)</label>
                <input type="number" value={settings.auto_summarize_after} onChange={(e) => setSettings({ ...settings, auto_summarize_after: parseInt(e.target.value) })} />
              </div>
              <div className="modal-field">
                <label>总结后保留轮数</label>
                <input type="number" value={settings.compress_keep_rounds} onChange={(e) => setSettings({ ...settings, compress_keep_rounds: parseInt(e.target.value) })} />
              </div>
              <div className="modal-field">
                <label>最大回复 token 数</label>
                <input type="number" value={settings.max_reply_tokens} onChange={(e) => setSettings({ ...settings, max_reply_tokens: parseInt(e.target.value) })} />
              </div>
              <label className="modal-check">
                <input type="checkbox" checked={settings.delete_after_summarize || false} onChange={(e) => setSettings({ ...settings, delete_after_summarize: e.target.checked })} />
                总结后删除原始聊天记录
              </label>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">桌宠设置</h3>
              <div className="modal-field">
                <label>桌宠图片URL（留空用默认🐠）</label>
                <input type="text" value={petSettings.image} onChange={(e) => setPetSettings({ ...petSettings, image: e.target.value })} placeholder="粘贴图片URL" />
              </div>
              <div className="modal-field">
                <label>桌宠大小: {petSettings.size}px</label>
                <input type="range" min="20" max="100" value={petSettings.size} onChange={(e) => setPetSettings({ ...petSettings, size: parseInt(e.target.value) })} />
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">语音设置 (MiniMax TTS)</h3>
              <div className="modal-field">
                <label>MiniMax API Key</label>
                <input type="password" value={ttsConfig.apiKey || ''} onChange={(e) => setTtsConfig({ ...ttsConfig, apiKey: e.target.value })} placeholder="在 minimax.io 注册获取" />
              </div>
              <div className="modal-field">
                <label>音色预设</label>
                <select value={ttsConfig.voiceId || 'male-qn-qingse'} onChange={(e) => setTtsConfig({ ...ttsConfig, voiceId: e.target.value })}>
                  {miniMaxVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>自定义 Voice ID（优先于预设）</label>
                <input type="text" value={ttsConfig.customVoiceId || ''} onChange={(e) => setTtsConfig({ ...ttsConfig, customVoiceId: e.target.value })} placeholder="填写后优先使用此 voice_id" />
              </div>
              <div className="modal-field">
                <label>Group ID（部分 MiniMax 账号需要）</label>
                <input type="text" value={ttsConfig.groupId || ''} onChange={(e) => setTtsConfig({ ...ttsConfig, groupId: e.target.value })} placeholder="如需要 group_id 请填写" />
              </div>
              <div className="modal-field">
                <label>语速: {ttsConfig.speed || 1.0}</label>
                <input type="range" min="0.5" max="2" step="0.1" value={ttsConfig.speed || 1.0} onChange={(e) => setTtsConfig({ ...ttsConfig, speed: parseFloat(e.target.value) })} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>取消</button>
              <button className="btn-save" onClick={saveSettings}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 简介弹窗 */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>👤 简介</h2>
            <div className="modal-field">
              <label>你的名字</label>
              <input value={profile.userName || ''} onChange={(e) => setProfile({ ...profile, userName: e.target.value })} />
            </div>
            <div className="modal-field">
              <label>你的简介</label>
              <textarea value={profile.userBio || ''} onChange={(e) => setProfile({ ...profile, userBio: e.target.value })} placeholder="介绍一下你自己..." />
            </div>
            <div className="modal-field">
              <label>AI 的名字</label>
              <input value={profile.aiName || ''} onChange={(e) => setProfile({ ...profile, aiName: e.target.value })} />
            </div>
            <div className="modal-field">
              <label>AI 的简介</label>
              <textarea value={profile.aiBio || ''} onChange={(e) => setProfile({ ...profile, aiBio: e.target.value })} placeholder="描述你心目中 AI 的样子..." />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowProfile(false)}>取消</button>
              <button className="btn-save" onClick={saveProfile}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* API 配置弹窗 */}
      {showApiConfig && <ApiConfig onClose={() => { setShowApiConfig(false); }} onConfigChange={() => {}} />}

      {/* 记忆宫殿 */}
      {showMemoryPalace && <MemoryPalace onClose={() => setShowMemoryPalace(false)} currentSessionId={currentSessionId} />}
    </div>
  );
}

export default App;
