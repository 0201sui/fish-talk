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

// 音乐直连 API：飞飞点歌台（HTTPS，支持搜索/点歌/歌词/直链）
const MUSIC_API = 'https://ffapi.cn/int/v1/dg_netease';
// 旧 GD Studio 已无法搜索（返回 []），仅保留作为历史兼容
const GD_MUSIC_API = 'https://music-api.gdstudio.xyz/api.php';

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

// ===== 桌宠组件（受控：图片/大小由 App 统一管理，支持图片库与 AI 切换）=====
function DesktopPet({ image, size, shape, onImageChange, onSizeChange, onShapeChange }) {
  const [pos, setPos] = useState({ x: 50, y: 80 });
  const [dir, setDir] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [imgInput, setImgInput] = useState(image || '');
  const [sizeInput, setSizeInput] = useState(size || 40);
  const [cutoutLoading, setCutoutLoading] = useState(false);
  const petRef = useRef(null);
  const petFileRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => { setImgInput(image || ''); }, [image]);
  useEffect(() => { setSizeInput(size || 40); }, [size]);

  useEffect(() => {
    let raf;
    let t = 0;
    const animate = () => {
      t += 0.02;
      if (!dragging.current) {
        setPos(p => ({ x: Math.max(10, Math.min(window.innerWidth - size - 10, p.x + dir * 0.3)), y: p.y + Math.sin(t) * 0.5 }));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [dir, size]);

  const startInteract = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    startPos.current = { x: touch.clientX, y: touch.clientY };
    dragging.current = true;
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    longPressTimer.current = setTimeout(() => { dragging.current = false; setShowSettings(true); setImgInput(image || ''); setSizeInput(size || 40); }, 600);
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
    onImageChange(imgInput);
    onSizeChange(sizeInput);
    setShowSettings(false);
  };
  const resetPet = () => { setImgInput(''); setSizeInput(40); };

  const cutoutPet = async () => {
    if (!imgInput || cutoutLoading) return;
    setCutoutLoading(true);
    try {
      let cleaned = await removeBackgroundDataUrl(imgInput);
      if (cleaned) {
        cleaned = await cleanupPetImage(cleaned);
      } else {
        // 若 AI 抠图失败，尝试用简单颜色边框裁剪兜底
        cleaned = await cleanupPetImage(imgInput);
      }
      setImgInput(cleaned || imgInput);
    } catch (e) {
      console.warn('去背景失败:', e);
    } finally {
      setCutoutLoading(false);
    }
  };

  const onPetFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('图片不能超过5MB'); return; }
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
      <div ref={petRef} className={`desktop-pet ${shape === 'none' ? 'borderless' : ''}`} style={{ left: pos.x, top: pos.y, width: size, height: size, transform: dir < 0 ? 'scaleX(-1)' : '' }}
        onMouseDown={startInteract} onMouseMove={onMove} onMouseUp={endInteract} onMouseLeave={endInteract}
        onTouchStart={startInteract} onTouchMove={onMove} onTouchEnd={endInteract}
        onContextMenu={(e) => { e.preventDefault(); setShowSettings(true); setImgInput(image || ''); setSizeInput(size || 40); }}>
        {image ? <img src={image} alt="桌宠" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? '22%' : '0' }} draggable={false} /> : <span style={{ fontSize: size, lineHeight: 1 }}>🐠</span>}
      </div>
      {showSettings && (
        <div className="pet-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="pet-settings" onClick={e => e.stopPropagation()}>
            <h3>桌宠设置</h3>
            <div className="pet-preview">{imgInput ? <img src={imgInput} alt="预览" style={{ width: sizeInput, height: sizeInput, objectFit: 'contain', borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? '22%' : '0' }} /> : <span style={{ fontSize: sizeInput }}>🐠</span>}</div>
            <div className="pet-setting-field"><label>图片URL</label><input type="text" value={imgInput} onChange={e => setImgInput(e.target.value)} placeholder="粘贴图片URL或上传文件" /></div>
            <div className="pet-setting-field"><label>上传图片</label><input ref={petFileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/*" style={{ display: 'none' }} onChange={onPetFileChange} /><button className="pet-file-btn" onClick={() => petFileRef.current?.click()}>📷 从相册选择</button></div>
            <div className="pet-setting-field"><label>大小: {sizeInput}px</label><input type="range" min="20" max="100" value={sizeInput} onChange={e => setSizeInput(parseInt(e.target.value))} /></div>
            <div className="pet-setting-field"><label>形状</label>
              <div className="pet-shape-row">
                {[['none', '无边框'], ['square', '方型'], ['rounded', '圆角'], ['circle', '圆形']].map(([k, label]) => (
                  <button key={k} className={`pet-shape-btn ${shape === k ? 'active' : ''}`} onClick={() => { if (onShapeChange) onShapeChange(k); if (k === 'none' && imgInput && !cutoutLoading) cutoutPet(); }}>{label}</button>
                ))}
              </div>
            </div>
            {imgInput && (
              <div className="pet-setting-field">
                <label>背景</label>
                <button className="pet-cutout-btn" onClick={cutoutPet} disabled={cutoutLoading}>
                  {cutoutLoading ? '⏳ 正在去背景…' : '✂️ 去除背景'}
                </button>
                <p className="pet-cutout-hint">如果图片有黑边/白边，点这里一键抠掉</p>
              </div>
            )}
            <div className="pet-settings-actions"><button className="btn-cancel" onClick={resetPet}>重置</button><button className="btn-save" onClick={savePetSettings}>保存</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== 表情包格子（支持点击插入 / 批量选择 / 长按改含义）=====
function StickerTile({ sticker, batchMode, selected, onInsert, onDelete, onToggleSelect, onEdit }) {
  const timer = useRef(null);
  const start = useRef({ x: 0, y: 0 });
  const startPress = (e) => {
    const t = e.touches ? e.touches[0] : e;
    start.current = { x: t.clientX, y: t.clientY };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; onEdit(sticker); }, 550);
  };
  const movePress = (e) => {
    const t = e.touches ? e.touches[0] : e;
    if (Math.abs(t.clientX - start.current.x) > 8 || Math.abs(t.clientY - start.current.y) > 8) { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }
  };
  const endPress = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return (
    <div className={`sticker-item ${selected ? 'selected' : ''}`}
      onMouseDown={startPress} onMouseMove={movePress} onMouseUp={endPress} onMouseLeave={endPress}
      onTouchStart={startPress} onTouchMove={movePress} onTouchEnd={endPress}
      onContextMenu={(e) => { e.preventDefault(); onEdit(sticker); }}
      onClick={() => { if (batchMode) onToggleSelect(sticker.id); else onInsert(sticker.url); }}>
      <img src={sticker.url} alt={sticker.meaning || 'sticker'} />
      {batchMode && <span className="sticker-check">{selected ? '✓' : ''}</span>}
      {!batchMode && <button className="sticker-del" onClick={(e) => { e.stopPropagation(); onDelete(sticker.id); }}>×</button>}
    </div>
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

// ===== 桌宠智能抠图（客户端，@imgly/background-removal，动态加载，失败回退原图）=====
const removeBackgroundDataUrl = async (src) => {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await removeBackground(src, { output: { format: 'image/png' } });
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('桌宠抠图失败，使用原图：', e);
    return null;
  }
};

// 清理桌宠图片：①裁剪透明边缘（去掉抠图残留的虚边/光晕）②若整体不透明（抠图失败或带实色边框），
// 向内收缩去掉四边统一的颜色边框，确保桌宠干净、无边框。
const cleanupPetImage = (dataUrl) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const { width: w, height: h } = c;
      const px = (x, y) => { const i = (y * w + x) * 4; return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]]; };
      const isTransparent = (x, y) => px(x, y)[3] < 16;
      const near = (x, y, base) => { const p = px(x, y); const dr = p[0] - base[0], dg = p[1] - base[1], db = p[2] - base[2]; return dr * dr + dg * dg + db * db < 900; };
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!isTransparent(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
      if (maxX < 0) return resolve(dataUrl);
      // 整体不透明 → 可能是带实色边框的原图，尝试去掉四边统一颜色
      if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) {
        const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => px(x, y).slice(0, 3).join(','));
        const cnt = {}; corners.forEach(k => cnt[k] = (cnt[k] || 0) + 1);
        const baseKey = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        const base = baseKey.split(',').map(Number);
        let l = 0, r = w - 1, t = 0, b = h - 1;
        while (l < r && near(l, t, base) && near(l, b, base)) l++;
        while (r > l && near(r, t, base) && near(r, b, base)) r--;
        while (t < b && near(l, t, base) && near(r, t, base)) t++;
        while (b > t && near(l, b, base) && near(r, b, base)) b--;
        if (r - l < w - 8 && b - t < h - 8) { minX = l; maxX = r; minY = t; maxY = b; }
      }
      const pad = 2;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      const out = document.createElement('canvas');
      out.width = maxX - minX + 1; out.height = maxY - minY + 1;
      out.getContext('2d').drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
      resolve(out.toDataURL('image/png'));
    } catch (e) { resolve(dataUrl); }
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

// ===== 迷你音乐播放条（AI 放歌 / 后台播放时显示在输入框上方）=====
function FloatingMusicPlayer({ song, onToggle, onSeek, onClose, onOpen, onPrev, onNext, repeatMode, onCycleRepeat, isFav, onToggleFav, onToggleLyrics, lyricsOn }) {
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

  const [mode, setMode] = useState('ball'); // 'ball' | 'bar'
  const [desktopLyric, setDesktopLyric] = useState(false); // 桌面歌词浮窗
  const [pos, setPos] = useState({ right: 16, bottom: 96 });
  const [lyricPos, setLyricPos] = useState({ left: '50%', top: 80 });
  const dragState = useRef(null);
  const movedRef = useRef(false);
  const clickTimer = useRef(null);

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

  // 悬浮球：单击展开播放条，双击开关桌面歌词浮窗
  const handleBallClick = () => {
    if (movedRef.current) return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setDesktopLyric(prev => !prev);
    } else {
      clickTimer.current = setTimeout(() => { clickTimer.current = null; setMode('bar'); }, 250);
    }
  };

  if (mode === 'ball') {
    return (
      <>
      <div className="music-ball" style={{ right: pos.right, bottom: pos.bottom }}
           onMouseDown={onDragStart} onTouchStart={onDragStart} onClick={handleBallClick} title="单击展开 · 双击开关桌面歌词">
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
      {desktopLyric && currentLyric && (
        <div className="desktop-lyric" style={{ left: lyricPos.left, top: lyricPos.top }}
             onMouseDown={(e) => {
               const p = e.touches ? e.touches[0] : e;
               const sX = p.clientX, sY = p.clientY;
               const startL = typeof lyricPos.left === 'number' ? lyricPos.left : window.innerWidth / 2;
               const startT = typeof lyricPos.top === 'number' ? lyricPos.top : 80;
               const move = (ev) => {
                 const q = ev.touches ? ev.touches[0] : ev;
                 setLyricPos({ left: Math.max(20, Math.min(window.innerWidth - 100, startL + q.clientX - sX)), top: Math.max(20, Math.min(window.innerHeight - 60, startT + q.clientY - sY)) });
               };
               const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
               window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
             }}
             onClick={() => setDesktopLyric(false)} title="双击球开关 · 点击关闭">
          <span className="desktop-lyric-text" key={currentLyric}>{currentLyric}</span>
        </div>
      )}
      </>
    );
  }

  return (
    <>
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
      <button className="mini-music-min" onClick={() => setMode('ball')} aria-label="缩小" title="缩小">—</button>
      <button className={`mini-music-fav ${isFav ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(); }} aria-label="收藏" title={isFav ? '取消收藏' : '收藏'}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      {onToggleLyrics && (
        <button className={`mini-music-lyric ${lyricsOn ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleLyrics(); }} aria-label="歌词" title={lyricsOn ? '关闭歌词' : '显示歌词'}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <button className="mini-music-prev" onClick={(e) => { e.stopPropagation(); onPrev && onPrev(); }} aria-label="上一首" title="上一首">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z" /></svg>
      </button>
      <button className="mini-music-play" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="播放/暂停">
        {song.isPlaying ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" /></svg>
        )}
      </button>
      <button className="mini-music-next" onClick={(e) => { e.stopPropagation(); onNext && onNext(); }} aria-label="下一首" title="下一首">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
      </button>
      <button className={`mini-music-loop ${repeatMode === 'one' ? 'one' : repeatMode === 'all' ? 'all' : ''}`} onClick={(e) => { e.stopPropagation(); onCycleRepeat && onCycleRepeat(); }} aria-label="循环模式" title={repeatMode === 'one' ? '单曲循环' : repeatMode === 'all' ? '列表循环' : '不循环'}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        {repeatMode === 'one' && <span className="loop-one-badge">1</span>}
      </button>
      {onOpen && (
        <button className="mini-music-expand" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label="打开播放器" title="打开完整播放器">⤢</button>
      )}
      <button className="mini-music-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="关闭">×</button>
    </div>
    {desktopLyric && currentLyric && (
      <div className="desktop-lyric" style={{ left: lyricPos.left, top: lyricPos.top }}
           onMouseDown={(e) => {
             const p = e.touches ? e.touches[0] : e;
             const sX = p.clientX, sY = p.clientY;
             const startL = typeof lyricPos.left === 'number' ? lyricPos.left : window.innerWidth / 2;
             const startT = typeof lyricPos.top === 'number' ? lyricPos.top : 80;
             const move = (ev) => {
               const q = ev.touches ? ev.touches[0] : ev;
               setLyricPos({ left: Math.max(20, Math.min(window.innerWidth - 100, startL + q.clientX - sX)), top: Math.max(20, Math.min(window.innerHeight - 60, startT + q.clientY - sY)) });
             };
             const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
             window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
           }}
           onClick={() => setDesktopLyric(false)} title="双击球开关 · 点击关闭">
        <span className="desktop-lyric-text" key={currentLyric}>{currentLyric}</span>
      </div>
    )}
    </>
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
            <span className="reply-role">{msg.reply_role === 'user' || (msg.reply_preview && msg.reply_preview.startsWith('我:')) ? '我' : (profile?.aiName || 'ClaudeAI')}</span>
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
  // 环境音效
  const [ambientOn, setAmbientOn] = useState(() => localStorage.getItem('ambientOn') === 'true');
  const [ambientVol, setAmbientVol] = useState(() => parseFloat(localStorage.getItem('ambientVol') || '0.3'));
  const [ambientType, setAmbientType] = useState(() => localStorage.getItem('ambientType') || '海浪');
  const ambientAudioRef = useRef(null);
  // 天气联动背景
  const [weatherBg, setWeatherBg] = useState('default'); // sunny / cloudy / rainy / snow / night / default

  const [readSet, setReadSet] = useState(() => {
    const sid = localStorage.getItem(SESSION_KEY);
    try { return new Set(JSON.parse(localStorage.getItem('fishtalk_read_' + sid) || '[]')); } catch { return new Set(); }
  });
  const [stickers, setStickers] = useState(() => { try { return JSON.parse(localStorage.getItem('stickers') || '[]'); } catch { return []; } });
  const [stickerInput, setStickerInput] = useState('');
  const [stickerCategory, setStickerCategory] = useState('全部');
  const [stickerInputCategory, setStickerInputCategory] = useState('默认');
  const [stickerBatchMode, setStickerBatchMode] = useState(false);
  const [stickerSelected, setStickerSelected] = useState(() => new Set());
  const [stickerEdit, setStickerEdit] = useState(null); // { id, meaning }
  const [profile, setProfile] = useState({ userBio: '', aiBio: '', userName: '我', aiName: 'ClaudeAI', nickname: '' });
  const [settings, setSettings] = useState({
    system_prompt: '', temperature: 0.7,
    compress_threshold: 4000, compress_keep_rounds: 15, max_reply_tokens: 4096,
    auto_summarize: true, delete_after_summarize: false
  });
  const [ttsConfig, setTtsConfig] = useState(() => { try { return JSON.parse(localStorage.getItem('ttsConfig') || '{}'); } catch { return {}; } });
  const [petSettings, setPetSettings] = useState({ image: localStorage.getItem('petImage') || '', size: parseInt(localStorage.getItem('petSize') || '40') });
  // 桌宠显示形状：square=方型无边框 / rounded=圆角 / circle=圆形（统一无边框）
  const [petShape, setPetShape] = useState(() => localStorage.getItem('petShape') || 'none');
  const [petImages, setPetImages] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('petImages') || '[]'); return Array.isArray(s) ? s : []; } catch { return []; }
  }); // 桌宠图片库（localStorage + 后端双持久化，刷新不丢；并随聊天请求发给 AI）
  const petLibFileRef = useRef(null); // 设置页图片库上传
  const [petCutoutLoading, setPetCutoutLoading] = useState(false); // 桌宠抠图中
  const petImagesRef = useRef(petImages);
  useEffect(() => { petImagesRef.current = petImages; }, [petImages]);

  // ===== 音乐播放（App 统一管理的播放器，AI 也能触发放歌）=====
  const musicAudioRef = useRef(null);
  const [nowPlaying, setNowPlaying] = useState(null); // {id,name,artist,cover,url,lyric,isPlaying,progress,currentTime,duration}
  const [playlist, setPlaylist] = useState([]); // 当前播放队列（歌曲列表）
  const [playlistIndex, setPlaylistIndex] = useState(-1);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  const repeatModeRef = useRef('off');
  const playlistRef = useRef([]);
  const playlistIndexRef = useRef(-1);
  // 歌词窄条
  const [showLyricBar, setShowLyricBar] = useState(true);
  // 音乐收藏夹
  const [musicFavorites, setMusicFavorites] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('musicFavorites') || '[]'); return Array.isArray(s) ? s : []; } catch { return []; }
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(() => localStorage.getItem('toolboxOpen') !== 'false');
  useEffect(() => { localStorage.setItem('toolboxOpen', String(toolboxOpen)); }, [toolboxOpen]);
  const musicFavoritesRef = useRef(musicFavorites);
  useEffect(() => { musicFavoritesRef.current = musicFavorites; try { localStorage.setItem('musicFavorites', JSON.stringify(musicFavorites)); } catch (e) {} }, [musicFavorites]);

  // 收藏/取消收藏
  const toggleFavorite = (song) => {
    if (!song || !song.id) return;
    const exists = musicFavoritesRef.current.find(f => f.id === song.id);
    if (exists) {
      setMusicFavorites(prev => prev.filter(f => f.id !== song.id));
    } else {
      setMusicFavorites(prev => [{ id: song.id, name: song.name || '', artist: song.artist || '', cover: song.cover || '' }, ...prev]);
    }
  };
  const isFavorited = (song) => song && musicFavorites.some(f => f.id === song.id);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const pendingScrollToBottomRef = useRef(false); // 发送消息后强制滚到底部（即使键盘还开着）
  const textareaRef = useRef(null);
  const inputRef = useRef(''); // 镜像最新输入，供 AI 的 type/send 指令读取
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

  // 环境音效：用 Web Audio API 合成多种自然音效（无需外部音频文件）
  // 支持海浪、雨声、水泡、鲸鸣、海鸥 五种音效
  useEffect(() => {
    if (!ambientOn) {
      if (ambientAudioRef.current) {
        try { ambientAudioRef.current.stop(); } catch (e) {}
        ambientAudioRef.current = null;
      }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const nodes = [];
      let stopped = false;

      // 创建噪声 buffer 的通用函数
      const makeNoiseBuffer = (type) => {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        if (type === 'brown') {
          let lastOut = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
          }
        } else {
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
        }
        return buffer;
      };

      const gain = ctx.createGain();
      gain.gain.value = ambientVol;
      gain.connect(ctx.destination);

      if (ambientType === '海浪') {
        // 海浪：棕色噪声 + 低通滤波 + LFO 调制音量模拟涨落
        const noise = ctx.createBufferSource();
        noise.buffer = makeNoiseBuffer('brown');
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.12;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = ambientVol * 0.5;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        noise.connect(filter);
        filter.connect(gain);
        noise.start();
        lfo.start();
        nodes.push(noise, lfo);
      } else if (ambientType === '雨声') {
        // 雨声：白噪声 + 带通滤波 + 高频细节
        const noise = ctx.createBufferSource();
        noise.buffer = makeNoiseBuffer('white');
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 0.5;
        const highFilter = ctx.createBiquadFilter();
        highFilter.type = 'highpass';
        highFilter.frequency.value = 800;
        noise.connect(filter);
        filter.connect(highFilter);
        highFilter.connect(gain);
        // 轻微的音量波动模拟雨势变化
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.3;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = ambientVol * 0.15;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        noise.start();
        lfo.start();
        nodes.push(noise, lfo);
      } else if (ambientType === '水泡') {
        // 水泡：随机正弦波泡泡声
        const bubbleInterval = setInterval(() => {
          if (stopped) return;
          const osc = ctx.createOscillator();
          const bubbleGain = ctx.createGain();
          const freq = 200 + Math.random() * 600;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.08);
          bubbleGain.gain.setValueAtTime(0, ctx.currentTime);
          bubbleGain.gain.linearRampToValueAtTime(ambientVol * 0.6, ctx.currentTime + 0.01);
          bubbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.connect(bubbleGain);
          bubbleGain.connect(gain);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        }, 200 + Math.random() * 400);
        nodes.push({ stop: () => clearInterval(bubbleInterval) });
      } else if (ambientType === '鲸鸣') {
        // 鲸鸣：低频正弦波 + 慢速频率调制 + 颤音
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 80;
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 120;
        // 慢速频率调制模拟鲸鸣的起伏
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.15;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 40;
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);
        // 颤音
        const vibrato = ctx.createOscillator();
        vibrato.frequency.value = 5;
        const vibratoGain = ctx.createGain();
        vibratoGain.gain.value = 8;
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc1.frequency);
        const oscGain = ctx.createGain();
        oscGain.gain.value = ambientVol * 0.4;
        osc1.connect(oscGain);
        osc2.connect(oscGain);
        oscGain.connect(gain);
        osc1.start();
        osc2.start();
        lfo.start();
        vibrato.start();
        nodes.push(osc1, osc2, lfo, vibrato);
      } else if (ambientType === '海鸥') {
        // 海鸥：滤波噪声短促爆发 + 间歇
        const gullInterval = setInterval(() => {
          if (stopped) return;
          // 每次发出 1-3 声海鸥叫
          const calls = 1 + Math.floor(Math.random() * 3);
          for (let c = 0; c < calls; c++) {
            setTimeout(() => {
              if (stopped) return;
              const noise = ctx.createBufferSource();
              noise.buffer = makeNoiseBuffer('white');
              const filter = ctx.createBiquadFilter();
              filter.type = 'bandpass';
              filter.frequency.value = 1500 + Math.random() * 1000;
              filter.Q.value = 5;
              const gullGain = ctx.createGain();
              gullGain.gain.setValueAtTime(0, ctx.currentTime);
              gullGain.gain.linearRampToValueAtTime(ambientVol * 0.5, ctx.currentTime + 0.05);
              gullGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
              noise.connect(filter);
              filter.connect(gullGain);
              gullGain.connect(gain);
              noise.start();
              noise.stop(ctx.currentTime + 0.35);
            }, c * 250);
          }
        }, 3000 + Math.random() * 4000);
        nodes.push({ stop: () => clearInterval(gullInterval) });
      }

      ambientAudioRef.current = {
        ctx, gain, nodes,
        stop: () => {
          stopped = true;
          nodes.forEach(n => { try { n.stop ? n.stop() : null; } catch (e) {} });
          try { ctx.close(); } catch (e) {}
        }
      };
    } catch (e) { console.error('环境音效启动失败:', e); }
    return () => {
      if (ambientAudioRef.current) {
        try { ambientAudioRef.current.stop(); } catch (e) {}
        ambientAudioRef.current = null;
      }
    };
  }, [ambientOn, ambientType]);

  // 音量变化时实时调整
  useEffect(() => {
    if (ambientAudioRef.current && ambientAudioRef.current.gain) {
      ambientAudioRef.current.gain.gain.value = ambientVol;
    }
    localStorage.setItem('ambientVol', String(ambientVol));
  }, [ambientVol]);

  useEffect(() => { localStorage.setItem('ambientOn', String(ambientOn)); }, [ambientOn]);
  useEffect(() => { localStorage.setItem('ambientType', ambientType); }, [ambientType]);

  // 天气联动背景：页面加载时获取天气，根据条件切换背景氛围
  useEffect(() => {
    const city = searchSettings.city || '';
    fetch(`${API_URL}/weather/current?city=${encodeURIComponent(city)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.condition) {
          setWeatherBg(data.condition);
        }
      })
      .catch(() => {});
  }, [searchSettings.city]);

  // 切换环境音效
  const toggleAmbient = () => {
    setAmbientOn(prev => !prev);
  };

  const playAmbient = (type) => {
    const validTypes = ['海浪', '雨声', '水泡', '鲸鸣', '海鸥'];
    if (validTypes.includes(type)) {
      setAmbientType(type);
      if (!ambientOn) setAmbientOn(true);
      // AI 开启音效时确保有音量，避免开了没声音
      if (ambientVol < 0.05) setAmbientVol(0.3);
    }
  };

  const stickToBottomRef = useRef(true);
  const lastScrollRef = useRef(0);

  // 直接赋值 scrollTop 最可靠；节流避免流式输出时每帧都触发滚动抖动
  const scrollToBottom = useCallback((force = false) => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const now = Date.now();
    if (!force && now - (lastScrollRef.current || 0) < 90) return;
    lastScrollRef.current = now;
    el.scrollTop = el.scrollHeight;
  }, []);

  // 新消息 / 加载状态变化 → 强制滚到底部（发送自己的消息时无视 stickToBottom 强制跟随）
  useEffect(() => {
    if (pendingScrollToBottomRef.current || stickToBottomRef.current) {
      pendingScrollToBottomRef.current = false;
      scrollToBottom(true);
    }
  }, [messages, loading, scrollToBottom]);

  // 流式输出过程中 → 节流跟随（保持贴底，但不抢用户上滑浏览历史）
  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(false);
  }, [streamingText, scrollToBottom]);

  // 键盘收起（视口变高）且原本贴底时，重新滚到底部，避免最后一条对话被顶上去
  useEffect(() => {
    const vp = (typeof window !== 'undefined') && window.visualViewport;
    if (!vp) return;
    let lastH = vp.height;
    const onResize = () => {
      if (vp.height > lastH && stickToBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
        setTimeout(() => scrollToBottom(true), 60);
      }
      lastH = vp.height;
    };
    vp.addEventListener('resize', onResize);
    return () => vp.removeEventListener('resize', onResize);
  }, [scrollToBottom]);

  useEffect(() => {
    if (showSplash) { sessionStorage.setItem('splashed', '1'); const timer = setTimeout(() => setShowSplash(false), 4400); return () => clearTimeout(timer); }
  }, [showSplash]);

  // 移动端自动播放限制：用户发消息（手势）后，AI 触发的播放可能被浏览器拦截。
  // 这里在任意一次用户交互（点屏幕/触摸）后，若音乐已就绪但未播放，就恢复播放。
  useEffect(() => {
    const unlock = () => {
      const a = musicAudioRef.current;
      if (a && a.src && a.paused) {
        a.play().then(() => setNowPlaying(prev => prev ? { ...prev, isPlaying: true } : prev)).catch(() => {});
      }
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('touchstart', unlock, { passive: true });
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('touchstart', unlock); };
  }, []);

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

  // 同步音乐队列/循环模式到 ref，供音频事件回调读取最新值
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { playlistRef.current = playlist; playlistIndexRef.current = playlistIndex; }, [playlist, playlistIndex]);

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
    try {
      const res = await fetch(`${API_URL}/profile`);
      const data = await res.json();
      if (data.data) {
        setProfile(data.data);
        if (Array.isArray(data.data.petImages) && data.data.petImages.length > 0) {
          setPetImages(data.data.petImages);
          try { localStorage.setItem('petImages', JSON.stringify(data.data.petImages)); } catch (e) {}
        } // 若后端为空（Render 实例重启丢失），保留 localStorage 中的本地副本
        if (data.data.petImage) {
          setPetSettings(prev => ({ ...prev, image: data.data.petImage }));
          localStorage.setItem('petImage', data.data.petImage);
        }
        if (typeof data.data.petSize === 'number') {
          setPetSettings(prev => ({ ...prev, size: data.data.petSize }));
          localStorage.setItem('petSize', String(data.data.petSize));
        }
      }
    } catch (err) { console.error('加载简介失败:', err); }
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

  // ===== 桌宠图片库（上传 / 持久化 / 删除 / 选择）=====
  const handlePetImageChange = (img) => {
    setPetSettings(prev => ({ ...prev, image: img }));
    localStorage.setItem('petImage', img);
    try { fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ petImage: img }) }); } catch (e) {}
  };
  const handlePetSizeChange = (sz) => {
    setPetSettings(prev => ({ ...prev, size: sz }));
    localStorage.setItem('petSize', String(sz));
    try { fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ petSize: sz }) }); } catch (e) {}
  };
  // 选桌宠：优先用缓存的抠图结果，没有则实时抠图并缓存
  const selectPet = async (pet) => {
    if (!pet || !pet.url) return;
    // 已有缓存的抠图结果，直接用
    if (pet.cutoutUrl) { handlePetImageChange(pet.cutoutUrl); return; }
    // 没有缓存：先设为原图（立即可见），后台异步抠图
    handlePetImageChange(pet.url);
    setPetCutoutLoading(true);
    try {
      const cut = await removeBackgroundDataUrl(pet.url);
      if (cut) {
        const cleaned = await cleanupPetImage(cut);
        // 缓存抠图结果到 petImages，下次同一张图不用重新抠
        const next = petImagesRef.current.map(x => x.id === pet.id ? { ...x, cutoutUrl: cleaned } : x);
        persistPetImages(next);
        handlePetImageChange(cleaned);
      }
    } catch (e) { /* 抠图失败，保持原图 */ }
    setPetCutoutLoading(false);
  };
  const savePetImages = async (next) => {
    try { await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ petImages: next }) }); } catch (e) {}
  };
  // localStorage + 后端双持久化，确保刷新/重进都不丢
  const persistPetImages = (next) => {
    setPetImages(next);
    try { localStorage.setItem('petImages', JSON.stringify(next)); } catch (e) {}
    savePetImages(next);
  };
    const addPetImage = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('图片不能超过5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 300;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        let dataUrl;
        try { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height); dataUrl = canvas.toDataURL('image/jpeg', 0.85); } catch (e) { dataUrl = reader.result; }
        const newPet = { id: 'pet_' + Date.now() + Math.random().toString(36).slice(2, 6), name: file.name || '图片', url: dataUrl };
        // 不再自动抠图：先以原图存入图片库，让用户在图片库中手动点击"智能抠图"
        persistPetImages([...petImagesRef.current, newPet]);
      };
      img.onerror = () => {
        const newPet = { id: 'pet_' + Date.now() + Math.random().toString(36).slice(2, 6), name: file.name || '图片', url: reader.result };
        persistPetImages([...petImagesRef.current, newPet]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  // 重新抠图（针对已上传、但仍是带背景的照片）
  const recutPet = async (p) => {
    if (!p || !p.url) return;
    setPetCutoutLoading(true);
    try {
      const cut = await removeBackgroundDataUrl(p.url);
      const cleaned = await cleanupPetImage(cut || p.url); // 重新抠图后同样清理边缘/去边框
      // 缓存到 cutoutUrl 字段，不覆盖原图 url
      const next = petImagesRef.current.map(x => x.id === p.id ? { ...x, cutoutUrl: cleaned } : x);
      persistPetImages(next);
      // 如果当前桌宠正在用这张图，切换到抠图后的版本
      if (petSettings.image === p.url || petSettings.image === p.cutoutUrl) handlePetImageChange(cleaned);
    } catch (e) { /* 失败则保持原样 */ }
    setPetCutoutLoading(false);
  };
  const removePetImage = (id) => {
    const target = petImages.find(p => p.id === id);
    const next = petImages.filter(p => p.id !== id);
    persistPetImages(next);
    if (target && (target.url === petSettings.image || target.cutoutUrl === petSettings.image)) handlePetImageChange('');
  };

  // ===== 构建聊天请求体 =====
  const buildChatBody = (sentInput, sentImages, sentFiles, sessionId, isRegenerate = false) => {
    const activeApi = getActiveModel();
    const chatBody = { message: sentInput, session_id: sessionId, model };
    // 用户引用的消息 id（供 AI 知道用户引用了哪句话）
    if (!isRegenerate && replyTo && replyTo.id) {
      chatBody.reply_to = replyTo.id;
      chatBody.reply_content = getReplyPreview(replyTo);
      chatBody.reply_role = replyTo.role;
    }
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
    // 表情包含义（供 AI 理解用户发的表情包）
    chatBody.sticker_meanings = stickers;
    // 桌宠图片库（随请求发给 AI，确保它总能看到最新上传，可自主更换）
    chatBody.pet_images = petImages;
    if (ttsConfig.apiKey) {
      chatBody.tts_config = { apiKey: ttsConfig.apiKey, voiceId: ttsConfig.customVoiceId || ttsConfig.voiceId || 'male-qn-qingse', customVoiceId: ttsConfig.customVoiceId || '', groupId: ttsConfig.groupId || '', speed: ttsConfig.speed || 1.0, model: ttsConfig.model || 'speech-02-hd' };
    }
    return chatBody;
  };

  // ===== 打字效果（逐字显示）=====
  const startTypingEffect = (fullText, onDone) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    typingBufferRef.current = fullText;
    let displayLen = 0;
    const totalLen = fullText.length;
    // 每帧显示的字符数（根据总长度动态调整速度）
    const charsPerTick = Math.max(1, Math.ceil(totalLen / 200));
    typingTimerRef.current = setInterval(() => {
      displayLen = Math.min(displayLen + charsPerTick, totalLen);
      setStreamingText(stripStreamingTags(fullText.slice(0, displayLen)));
      if (displayLen >= totalLen) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        if (onDone) onDone();
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
    const text = inputRef.current;
    // 空输入 + 有待回复消息 → 触发AI
    if (!text.trim() && pendingImages.length === 0 && pendingFiles.length === 0) {
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
        const res = await fetch(`${API_URL}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: text.slice(0, 20) || '新对话' }) });
        const data = await res.json();
        if (data.session) { setSessions(prev => [data.session, ...prev]); sessionId = data.session.id; setCurrentSessionId(sessionId); }
      } catch (err) { console.error('创建会话失败:', err); return; }
    }

    const userMsg = {
      id: genId(), role: 'user', content: text,
      images: pendingImages.length > 0 ? pendingImages : undefined,
      file_names: pendingFiles.length > 0 ? pendingFiles.map(f => f.name) : undefined,
      created_at: new Date().toISOString(), reply_to: replyTo?.id || null,
      reply_role: replyTo?.role || null,
      reply_content: replyTo ? getReplyPreview(replyTo) : null,
      reply_preview: replyTo ? `${replyTo.role === 'user' ? '我' : (profile.aiName || 'ClaudeAI')}: ${getReplyPreview(replyTo)}` : null
    };
    setMessages(prev => [...prev, userMsg]);
    // 发送后立刻滚到底部：即使键盘还开着，也能看到刚发的那条消息
    pendingScrollToBottomRef.current = true;
    requestAnimationFrame(() => { requestAnimationFrame(() => scrollToBottom(true)); });
    setTimeout(() => scrollToBottom(true), 300); // 兜底：键盘收起后的布局重排会导致再次偏移
    const sentInput = text;
    const sentImages = [...pendingImages];
    const sentFiles = [...pendingFiles];
    setInput(''); inputRef.current = ''; setPendingImages([]); setPendingFiles([]);
    setReplyTo(null); setShowToolbar(false);
    // 发送后保持输入框聚焦与键盘常开，方便连续输入（不再自动收起键盘）
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }

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
    // 表情包含义（供 AI 理解用户发的表情包）
    chatBody.sticker_meanings = stickers;
    // 桌宠图片库（随请求发给 AI，确保它总能看到最新上传，可自主更换）
    chatBody.pet_images = petImages;
    if (ttsConfig.apiKey) {
      chatBody.tts_config = { apiKey: ttsConfig.apiKey, voiceId: ttsConfig.customVoiceId || ttsConfig.voiceId || 'male-qn-qingse', customVoiceId: ttsConfig.customVoiceId || '', groupId: ttsConfig.groupId || '', speed: ttsConfig.speed || 1.0, model: ttsConfig.model || 'speech-02-hd' };
    }

    // 引用（双保险）：把最近一条用户消息的 reply_to 一并带上，确保后端一定能拿到被引用的消息
    const _lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (_lastUserMsg) {
      if (_lastUserMsg.reply_to) chatBody.reply_to = _lastUserMsg.reply_to;
      if (_lastUserMsg.reply_content) chatBody.reply_content = _lastUserMsg.reply_content;
      if (_lastUserMsg.reply_role) chatBody.reply_role = _lastUserMsg.reply_role;
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
      let replies = null;

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
            if (data.type === 'searching') { setTypingStatus('正在思考……'); }
            else if (data.type === 'delta') {
              fullText += data.content;
              setTypingStatus('');
              // 语音 / 音乐 / 工具标记不要以流式文字显示，避免"先打字再变语音"或"显示工具过程"的怪异观感
              if (/\[music\]/.test(fullText)) setStreamingText('正在找歌…');
              else if (/\[act\]/.test(fullText)) setStreamingText('正在处理…');
              else setStreamingText(stripStreamingTags(fullText));
            }
            else if (data.type === 'done') { usage = data.usage; replies = data.replies || null; }
            else if (data.type === 'error') { fullText = '抱歉，出了点问题: ' + (data.error || '未知错误'); setTypingStatus(''); }
          } catch (e) {}
        }
      }
      stopTypingEffect();
      setTypingStatus('');
      setStreamingText('');
      setLoading(false);
      setPendingCount(0);
      abortControllerRef.current = null;
      // 提取 AI 给出的指令标记（[music] 放歌 / [act] 自我操作），都不显示给用户
      const musicKeywords = [];
      const actCommands = [];
      const stripActMusic = (s) => {
        let t = (s || '');
        t = t.replace(/\[music\]([\s\S]*?)\[\/music\]/g, (m, kw) => { const x = (kw || '').trim(); if (x) musicKeywords.push(x); return ''; });
        t = t.replace(/\[act\]([\s\S]*?)\[\/act\]/g, (m, a) => { const x = (a || '').trim(); if (x) actCommands.push(x); return ''; });
        return t.trim();
      };
      // 用后端返回的 replies 渲染消息：含语音（voice: 已在后端合成好音频）与引用（reply_role/reply_content/reply_to）
      if (Array.isArray(replies) && replies.length > 0) {
        const bubbles = [];
        for (const r of replies) {
          const b = { id: genId(), role: 'assistant', created_at: r.created_at || new Date().toISOString() };
          b.content = stripActMusic(r.content || '');
          if (r.voice && r.voice.audio) { b.voice = r.voice; }
          else if (r.voice && r.voice.text && !b.content) { b.content = stripActMusic(r.voice.text); }
          if (r.reply_role) b.reply_role = r.reply_role;
          if (r.reply_content) b.reply_content = r.reply_content;
          if (r.reply_to) b.reply_to = r.reply_to;
          if ((b.content && b.content.length > 0) || b.voice) bubbles.push(b);
        }
        if (bubbles.length > 0) {
          bubbles[bubbles.length - 1].usage = usage;
          setMessages(prev => [...prev, ...bubbles]);
        }
      } else {
        // 兜底：后端未返回 replies 时，用完整文本落一条气泡
        const cleanText = stripActMusic(fullText);
        if (cleanText) {
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: cleanText, created_at: new Date().toISOString(), usage }]);
        }
      }
      // 让 AI 主动为用户放歌
      musicKeywords.forEach(kw => playMusicByKeyword(kw));
      // 执行 AI 的自我操作指令（切换主题 / 打开面板 / 打字 / 设置昵称等）
      actCommands.forEach((a, i) => setTimeout(() => executeAction(a), 400 + i * 300));
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
    // 引用（从最后一条用户消息透传，确保重新生成时 AI 仍能看到被引用的内容）
    const _regenLastUser = [...messages].reverse().find(m => m.role === 'user');
    if (_regenLastUser) {
      if (_regenLastUser.reply_to) chatBody.reply_to = _regenLastUser.reply_to;
      if (_regenLastUser.reply_content) chatBody.reply_content = _regenLastUser.reply_content;
      if (_regenLastUser.reply_role) chatBody.reply_role = _regenLastUser.reply_role;
    }
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
      let replies = null;

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
            if (data.type === 'searching') { setTypingStatus('正在思考……'); }
            else if (data.type === 'delta') {
              fullText += data.content;
              setTypingStatus('');
              // 语音 / 音乐 / 工具标记不要以流式文字显示，避免"先打字再变语音"或"显示工具过程"的怪异观感
              if (/\[music\]/.test(fullText)) setStreamingText('正在找歌…');
              else if (/\[act\]/.test(fullText)) setStreamingText('正在处理…');
              else setStreamingText(stripStreamingTags(fullText));
            }
            else if (data.type === 'done') { usage = data.usage; replies = data.replies || null; }
            else if (data.type === 'error') { fullText = '抱歉，出了点问题: ' + (data.error || '未知错误'); setTypingStatus(''); }
          } catch (e) {}
        }
      }
      stopTypingEffect();
      setTypingStatus('');
      setStreamingText('');
      setLoading(false);
      setPendingCount(0);
      abortControllerRef.current = null;
      // 提取 AI 给出的指令标记（[music] 放歌 / [act] 自我操作），都不显示给用户
      const musicKeywords = [];
      const actCommands = [];
      const stripActMusic = (s) => {
        let t = (s || '');
        t = t.replace(/\[music\]([\s\S]*?)\[\/music\]/g, (m, kw) => { const x = (kw || '').trim(); if (x) musicKeywords.push(x); return ''; });
        t = t.replace(/\[act\]([\s\S]*?)\[\/act\]/g, (m, a) => { const x = (a || '').trim(); if (x) actCommands.push(x); return ''; });
        return t.trim();
      };
      // 用后端返回的 replies 渲染消息：含语音（voice: 已在后端合成好音频）与引用（reply_role/reply_content/reply_to）
      if (Array.isArray(replies) && replies.length > 0) {
        const bubbles = [];
        for (const r of replies) {
          const b = { id: genId(), role: 'assistant', created_at: r.created_at || new Date().toISOString() };
          b.content = stripActMusic(r.content || '');
          if (r.voice && r.voice.audio) { b.voice = r.voice; }
          else if (r.voice && r.voice.text && !b.content) { b.content = stripActMusic(r.voice.text); }
          if (r.reply_role) b.reply_role = r.reply_role;
          if (r.reply_content) b.reply_content = r.reply_content;
          if (r.reply_to) b.reply_to = r.reply_to;
          if ((b.content && b.content.length > 0) || b.voice) bubbles.push(b);
        }
        if (bubbles.length > 0) {
          bubbles[bubbles.length - 1].usage = usage;
          setMessages(prev => [...prev, ...bubbles]);
        }
      } else {
        // 兜底：后端未返回 replies 时，用完整文本落一条气泡
        const cleanText = stripActMusic(fullText);
        if (cleanText) {
          setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: cleanText, created_at: new Date().toISOString(), usage }]);
        }
      }
      // 让 AI 主动为用户放歌
      musicKeywords.forEach(kw => playMusicByKeyword(kw));
      // 执行 AI 的自我操作指令（切换主题 / 打开面板 / 打字 / 设置昵称等）
      actCommands.forEach((a, i) => setTimeout(() => executeAction(a), 400 + i * 300));
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
    inputRef.current = e.target.value;
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; }
  };

  const onScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distance > 200);
    stickToBottomRef.current = distance < 120; // 贴近底部才自动跟随，上滑看历史时不打扰
  };
  const onQuote = (msg) => { setReplyTo(msg); if (textareaRef.current) textareaRef.current.focus(); };
  const onCopy = (msg) => { navigator.clipboard.writeText(msg.content || ''); };
  const onRead = useCallback((id) => { setReadSet(prev => { if (prev.has(id)) return prev; const n = new Set(prev); n.add(id); return n; }); }, []);
  const onEdit = (msg) => { setEditingId(msg.id); setEditContent(msg.content); };
  const onDelete = async (msg) => { if (!confirm('确定删除这条消息吗？')) return; try { await fetch(`${API_URL}/messages/${msg.id}`, { method: 'DELETE' }); setMessages(prev => prev.filter(m => m.id !== msg.id)); if (replyTo?.id === msg.id) setReplyTo(null); try { localStorage.removeItem(MSG_CACHE_PREFIX + currentSessionId); } catch (e) {} if (currentSessionId) fetchMessages(currentSessionId); } catch (err) { console.error('删除失败:', err); } };
  const saveEdit = async (msgId) => { try { await fetch(`${API_URL}/messages/${msgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editContent }) }); setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, edited: true } : m)); setEditingId(null); } catch (err) { console.error('编辑失败:', err); } };
  const onRecall = async (msg) => { if (!confirm('撤回这条消息？')) return; try { await fetch(`${API_URL}/messages/${msg.id}`, { method: 'DELETE' }); setMessages(prev => prev.filter(m => m.id !== msg.id)); if (replyTo?.id === msg.id) setReplyTo(null); try { localStorage.removeItem(MSG_CACHE_PREFIX + currentSessionId); } catch (e) {} if (currentSessionId) fetchMessages(currentSessionId); } catch (err) { console.error('撤回失败:', err); } };

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
    setReplyTo(prev => (prev && selectedMsgIds.has(prev.id)) ? null : prev);
    try { localStorage.removeItem(MSG_CACHE_PREFIX + currentSessionId); } catch (e) {}
    if (currentSessionId) fetchMessages(currentSessionId);
    exitMultiSelect();
  };
  const forwardSelectedMessages = () => {
    if (selectedMsgIds.size === 0) return;
    const selectedMsgs = messages.filter(m => selectedMsgIds.has(m.id));
    const text = selectedMsgs.map(m => `[${m.role === 'user' ? (profile.userName || '我') : (profile.aiName || 'ClaudeAI')}]\n${m.content}`).join('\n\n---\n\n');
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
  const toggleVoiceInput = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('你的浏览器不支持语音输入，请使用 Chrome / Edge / Safari 系统浏览器'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // 先请求麦克风权限（移动端浏览器需要显式授权后语音识别才稳定）
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (e) {
      alert('无法使用麦克风，请检查浏览器权限设置');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;      // 持续收音，避免移动端过早结束
    recognition.interimResults = true;    // 实时显示中间结果

    let pendingInterim = '';
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      pendingInterim = interimText;
      setInput(prev => {
        // 去掉上一轮 interim，追加最新 interim / final
        const base = prev.endsWith(pendingInterim) ? prev.slice(0, -pendingInterim.length) : prev;
        const next = base + finalText + interimText;
        return next;
      });
      if (finalText) pendingInterim = '';
      const ta = textareaRef.current;
      if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; }
    };
    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风');
      } else if (event.error === 'no-speech') {
        // 没说话就结束，不用弹窗
      } else if (event.error === 'network') {
        alert('语音识别网络错误，请检查网络连接');
      }
      setIsListening(false);
    };
    recognition.onend = () => { setIsListening(false); };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.error('启动语音识别失败:', e);
      alert('启动语音识别失败，请重试');
    }
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
        if (repeatModeRef.current === 'one') { try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} return; }
        setNowPlaying(prev => prev ? { ...prev, isPlaying: false, progress: 100, currentTime: a.duration || 0 } : prev);
        playNext();
      });
      a.addEventListener('error', () => {
        setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev);
      });
      musicAudioRef.current = a;
    }
    return musicAudioRef.current;
  };

  // 播放某首歌（取歌词/URL 再播放），并通知 AI 当前播放
  const playSong = async (song, list, idx) => {
    if (!song || !song.id) return;
    if (list && Array.isArray(list)) { setPlaylist(list); if (typeof idx === 'number') setPlaylistIndex(idx); }
    const audio = ensureAudio();
    try { audio.pause(); } catch (e) {}
    const coverUrl = song.cover || song.pic || '';
    const artist = song.artist || song.singer || '';
    const durationSec = (() => {
      if (typeof song.duration === 'number') return Math.round(song.duration / 1000) || 0;
      if (typeof song.duration === 'string') {
        const [m, s] = song.duration.split(':').map(Number);
        if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
      }
      return 0;
    })();
    setNowPlaying({
      id: song.id, name: song.name, artist, album: song.album || '',
      cover: coverUrl, lyric: song.lyric || '', url: '', isPlaying: false, progress: 0, currentTime: 0,
      duration: durationSec
    });
    try {
      // 1) 歌词（走后端代理 /music/lyric/:id，避免浏览器直连 ffapi.cn 被 CORS 拦截导致歌词永远出不来）
      try {
        const lr = await fetch(`${API_URL}/music/lyric/${encodeURIComponent(song.id)}`);
        const ld = await lr.json();
        const lyricText = (ld && (ld.lyric || ld.lrc)) || '';
        if (lyricText) setNowPlaying(prev => prev ? { ...prev, lyric: lyricText } : prev);
      } catch (e) { console.error('歌词获取失败:', e); }
      // 2) 播放地址（同样走后端代理 /music/url/:id，规避 CORS）
      let playUrl = '';
      try {
        const ur = await fetch(`${API_URL}/music/url/${encodeURIComponent(song.id)}`);
        const ud = await ur.json();
        if (ud && ud.success && ud.url) playUrl = ud.url;
      } catch (e) { console.error('播放地址获取失败:', e); }
      // 兜底：旧 GD Studio URL 格式（兼容历史 song 对象）
      if (!playUrl && String(song.id).length < 12) {
        try {
          const ur = await fetch(`${GD_MUSIC_API}?types=url&source=netease&id=${encodeURIComponent(song.id)}&br=320`);
          const ud = await ur.json();
          if (ud && ud.url) playUrl = ud.url;
        } catch (e) {}
      }
      if (playUrl) {
        setupMediaSession({ name: song.name, artist, album: song.album || '', cover: coverUrl });
        if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {} }
        audio.src = playUrl;
        setNowPlaying(prev => prev ? { ...prev, isPlaying: true, url: playUrl } : prev);
        const p = audio.play();
        if (p && p.then) p.catch(() => {});
      } else {
        setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev);
      }
    } catch (err) {
      console.error('播放失败:', err);
      setNowPlaying(prev => prev ? { ...prev, isPlaying: false } : prev);
    }
    // 通知 AI 当前播放的歌曲
    setMusicInfo({ name: song.name, artist, duration: durationSec ? durationSec + '秒' : null });
  };

  // AI（或用户）按关键词搜歌并播放——统一走后端 /music/search 代理（避免浏览器直连 ffapi.cn 被 CORS 拦截），并用“整串/标题子串优先”的评分避免放错歌
  const playMusicByKeyword = async (keyword) => {
    if (!keyword || !keyword.trim()) return;
    // 去掉 AI 可能夹带的口头语/书名号，只留「歌名 歌手」式内容
    const cleanKw = (keyword || '')
      .replace(/[《》「」“”‘’【】()（）\[\]]/g, ' ')
      .replace(/(好的|给你|为您|来一首|放一首|想听|请播放|播放|听听|搜一下|搜歌|找一首|我想听|整首|吧|呢|啊|哦)/g, ' ')
      .replace(/\s+/g, ' ').trim();
    const kw = cleanKw || keyword.trim();
    const segs = kw.split(/[\s\-—,，·|/]+/).map(s => s.trim()).filter(Boolean);
    if (segs.length === 0) return;
    const candidates = [];
    const seen = new Set();
    const normalize = (s) => ({
      id: String(s.id),
      name: s.name || s.title || '',
      artist: Array.isArray(s.artist) ? s.artist.join(' / ') : (s.artist || s.singer || ''),
      singer: s.singer || '',
      album: s.album || '',
      pic: s.pic || s.cover || '',
      cover: s.pic || s.cover || '',
      duration: s.duration || 0
    });
    // 评分：整串关键词是歌名子串 → 最高分；关键词含歌名 → 次高；各片段命中歌名/歌手累加
    const scoreSong = (song) => {
      const name = (song.name || '').toLowerCase();
      const artist = (song.artist || '').toLowerCase();
      const kwLower = kw.toLowerCase();
      let score = 0;
      if (kwLower && name.includes(kwLower)) score += 5;
      if (name.length >= 2 && kwLower.includes(name)) score += 4;
      for (const seg of segs) {
        const sg = seg.toLowerCase();
        if (!sg) continue;
        if (name.includes(sg)) score += 3;
        if (artist.includes(sg)) score += 1;
      }
      return score;
    };
    const collect = (arr) => {
      for (const raw of (arr || []).slice(0, 15)) {
        const song = normalize(raw);
        if (!song.id || !song.name) continue;
        const score = scoreSong(song);
        if (seen.has(song.id)) {
          const ex = candidates.find(c => c.song.id === song.id);
          if (ex && score > ex.score) ex.score = score;
        } else { seen.add(song.id); candidates.push({ song, score }); }
      }
    };
    const doSearch = async (q) => {
      try {
        const resp = await fetch(`${API_URL}/music/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: q })
        });
        const data = await resp.json();
        if (data && data.success && Array.isArray(data.songs) && data.songs.length > 0) { collect(data.songs); return true; }
      } catch (e) { console.error('音乐搜索失败:', e); }
      return false;
    };
    // 1) 用整串关键词搜索（后端 limit=15，网易已按相关度排序）
    await doSearch(kw);
    // 2) 若没命中，再拆片段兜底
    if (candidates.length === 0) {
      for (const seg of segs) { if (await doSearch(seg)) break; }
    }
    if (candidates.length === 0) return;
    // 3) 按相关度排序，优先「整串/标题命中」的歌
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    // 4) 若最佳匹配几乎不相关（score=0），宁可不乱放，避免“牛头不对马嘴”
    if (best.score <= 0) return;
    const list = candidates.map(c => c.song);
    await playSong(list[0], list, 0);
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

  // 上一首 / 下一首
  const playNext = () => {
    const list = playlistRef.current;
    if (!list || !list.length) return;
    let i = playlistIndexRef.current + 1;
    if (i >= list.length) {
      if (repeatModeRef.current === 'all') i = 0;
      else { closeMusic(); return; }
    }
    playSong(list[i], list, i);
  };
  const playPrev = () => {
    const list = playlistRef.current;
    if (!list || !list.length) return;
    let i = playlistIndexRef.current - 1;
    if (i < 0) {
      if (repeatModeRef.current === 'all') i = list.length - 1;
      else i = 0;
    }
    playSong(list[i], list, i);
  };
  const cycleRepeat = () => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  // 锁屏 / 后台媒体控制（息屏也能继续播放）
  const setupMediaSession = (song) => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name || '未知歌曲',
        artist: song.artist || '未知歌手',
        album: song.album || '',
        artwork: song.cover ? [{ src: song.cover, sizes: '512x512', type: 'image/png' }] : []
      });
      const ms = navigator.mediaSession;
      ms.setActionHandler('play', () => { if (musicAudioRef.current) musicAudioRef.current.play().catch(() => {}); });
      ms.setActionHandler('pause', () => { if (musicAudioRef.current) musicAudioRef.current.pause(); });
      ms.setActionHandler('nexttrack', () => playNext());
      ms.setActionHandler('previoustrack', () => playPrev());
      ms.setActionHandler('seekbackward', () => { if (musicAudioRef.current) musicAudioRef.current.currentTime = Math.max(0, musicAudioRef.current.currentTime - 10); });
      ms.setActionHandler('seekforward', () => { if (musicAudioRef.current) musicAudioRef.current.currentTime = Math.min(musicAudioRef.current.duration || 0, musicAudioRef.current.currentTime + 10); });
    } catch (e) {}
  };
  useEffect(() => {
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = nowPlaying && nowPlaying.isPlaying ? 'playing' : 'paused'; } catch (e) {}
    }
  }, [nowPlaying]);

  // 隐藏 AI 指令标记（[music] / [act] / [voice]），仅用于展示
  const stripCmdTags = (text) => {
    if (!text) return text;
    return text.replace(/\[music\]([\s\S]*?)\[\/music\]/g, '').replace(/\[act\]([\s\S]*?)\[\/act\]/g, '').replace(/\[voice\]([\s\S]*?)\[\/voice\]/g, '');
  };

  // 流式显示专用：在 stripCmdTags 基础上，顺手清掉"还没闭合"的标签片段
  // （例如流式刚吐出 "[voice" 或 "[act]theme:oce" 时，整段先不显示，避免气泡里闪英文/括号）
  const stripStreamingTags = (text) => {
    if (!text) return text;
    let t = text.replace(/\[(?:music|act|voice|quote)\]([\s\S]*?)\[\/(?:music|act|voice|quote)\]/g, '');
    t = t.replace(/\[(?:music|act|voice|quote)(?:[^\]]*\]$|[^\]]*$)/g, '');
    return t;
  };

  // 把 AI 设置的简介字段持久化
  const applyProfileField = async (field, value) => {
    const next = { ...profile, [field]: value };
    setProfile(next);
    try {
      await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    } catch (e) { console.error('保存简介字段失败:', e); }
  };

  // 执行 AI 通过 [act] 标记的界面操作
  const executeAction = (raw) => {
    if (!raw) return;
    const idx = raw.indexOf(':');
    const cmd = (idx === -1 ? raw : raw.slice(0, idx)).trim();
    const arg = idx === -1 ? '' : raw.slice(idx + 1).trim();
    switch (cmd) {
      case 'theme': {
        const map = { '海洋蓝': 'ocean', '浅橙': 'orange', '浅灰': 'gray', '浅紫': 'purple', '深海': 'deepsea', '珊瑚': 'coral', ocean: 'ocean', orange: 'orange', gray: 'gray', purple: 'purple', deepsea: 'deepsea', coral: 'coral' };
        const t = map[arg] || arg;
        if (['ocean', 'orange', 'gray', 'purple', 'deepsea', 'coral'].includes(t)) setTheme(t);
        break;
      }
      case 'open': {
        const map = { '音乐': () => setShowMusicPlayer(true), '简介': () => setShowProfile(true), '记忆宫殿': () => setShowMemoryPalace(true), '工具栏': () => setShowToolbar(true), '一起读': () => setShowReadTogether(true), '设置': () => setShowSettings(true) };
        const fn = map[arg];
        if (fn) fn();
        break;
      }
      case 'search': {
        // 直接开关"联网搜索"（等效于在设置面板里切换）
        if (arg === 'on' || arg === 'off') {
          setSearchSettings(prev => ({ ...prev, enabled: arg === 'on' }));
        }
        break;
      }
      case 'ambient': {
        // 环境音效控制：ambient:play:海浪 / ambient:stop / ambient:volume:0.5
        const parts = arg.split(':');
        const action = parts[0]?.trim();
        const param = parts.slice(1).join(':').trim();
        if (action === 'play') {
          playAmbient(param);
        } else if (action === 'stop') {
          setAmbientOn(false);
        } else if (action === 'volume') {
          const vol = parseFloat(param);
          if (!isNaN(vol) && vol >= 0 && vol <= 1) setAmbientVol(vol);
        }
        break;
      }
      case 'type': {
        inputRef.current = arg;
        setInput(arg);
        setTimeout(() => { if (textareaRef.current) { textareaRef.current.focus(); textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 110) + 'px'; } }, 30);
        break;
      }
      case 'send': {
        setTimeout(() => { sendMessage(); }, 150);
        break;
      }
      case 'nickname': {
        if (arg) applyProfileField('nickname', arg);
        break;
      }
      case 'ainame': {
        if (arg) applyProfileField('aiName', arg);
        break;
      }
      case 'pet': {
        const pet = petImages.find(p => String(p.id) === String(arg));
        if (pet) selectPet(pet);
        break;
      }
      default: break;
    }
  };
  if (typeof window !== 'undefined') window.__runAction = executeAction;

  // ===== 表情包 =====
  const addStickers = () => {
    const urls = stickerInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    const cat = stickerInputCategory.trim() || '默认';
    setStickers(prev => [...prev, ...urls.map(url => ({ id: 'st_' + Date.now() + Math.random().toString(36).slice(2, 6), url, meaning: '', category: cat }))]);
    setStickerInput('');
  };
  const removeSticker = (id) => setStickers(prev => prev.filter(s => s.id !== id));
  const insertSticker = (url) => { setInput(prev => prev + ` [贴纸]${url}[/贴纸] `); setShowStickerPicker(false); };
  const toggleStickerSelect = (id) => setStickerSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const deleteSelectedStickers = () => {
    if (stickerSelected.size === 0) return;
    if (!confirm(`确定删除选中的 ${stickerSelected.size} 个表情包吗？`)) return;
    setStickers(prev => prev.filter(s => !stickerSelected.has(s.id)));
    setStickerSelected(new Set());
    setStickerBatchMode(false);
  };
  const saveStickerMeaning = () => {
    if (!stickerEdit) return;
    setStickers(prev => prev.map(s => s.id === stickerEdit.id ? { ...s, meaning: stickerEdit.meaning } : s));
    setStickerEdit(null);
  };
  const visibleStickers = stickerCategory === '全部' ? stickers : stickers.filter(s => (s.category || '默认') === stickerCategory);
  const stickerCategories = ['全部', ...Array.from(new Set(stickers.map(s => s.category || '默认')))];

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
    <div className={`app weather-${weatherBg}`}>
      <DesktopPet image={petSettings.image} size={petSettings.size} shape={petShape} onImageChange={handlePetImageChange} onSizeChange={handlePetSizeChange} onShapeChange={(k) => { setPetShape(k); localStorage.setItem('petShape', k); }} />
      {/* 天气联动背景层 */}
      <div className={`weather-overlay weather-${weatherBg}`} />
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
        <div className={`sidebar-toolbox ${toolboxOpen ? 'open' : ''}`}>
          <button className="toolbox-header" onClick={() => setToolboxOpen(prev => !prev)}>
            <span>🧰 工具箱</span>
            <svg className={`toolbox-chevron ${toolboxOpen ? 'rotated' : ''}`} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <div className="toolbox-body">
            <div className="toolbox-content">
              <button className="sidebar-btn" onClick={() => setShowProfile(true)}>🐬 简介</button>
              <button className="sidebar-btn" onClick={() => setShowApiConfig(true)}>🔌 API配置</button>
              <button className="sidebar-btn" onClick={() => setShowMemoryPalace(true)}>🪸 记忆宫殿</button>
              <button className="sidebar-btn" onClick={exportMarkdown}>📝 导出Markdown</button>
              {/* 主题切换 */}
              <div className="theme-picker">
                <span className="theme-picker-label">主题</span>
                <div className="theme-dots">
                  <button className={`theme-dot ocean ${theme === 'ocean' ? 'active' : ''}`} onClick={() => setTheme('ocean')} title="海洋蓝" />
                  <button className={`theme-dot orange ${theme === 'orange' ? 'active' : ''}`} onClick={() => setTheme('orange')} title="浅橙色" />
                  <button className={`theme-dot gray ${theme === 'gray' ? 'active' : ''}`} onClick={() => setTheme('gray')} title="浅灰色" />
                  <button className={`theme-dot purple ${theme === 'purple' ? 'active' : ''}`} onClick={() => setTheme('purple')} title="浅紫色" />
                  <button className={`theme-dot deepsea ${theme === 'deepsea' ? 'active' : ''}`} onClick={() => setTheme('deepsea')} title="深海" />
                  <button className={`theme-dot coral ${theme === 'coral' ? 'active' : ''}`} onClick={() => setTheme('coral')} title="珊瑚" />
                </div>
              </div>
              {/* 环境音效 */}
              <div className="ambient-control">
                <button className={`ambient-toggle ${ambientOn ? 'on' : ''}`} onClick={toggleAmbient} title="环境音效">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {ambientOn
                      ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></>
                      : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                    }
                  </svg>
                  <span>环境音</span>
                </button>
                {ambientOn && (
                  <>
                    <div className="ambient-types">
                      <button className={`ambient-type ${ambientType === '海浪' ? 'active' : ''}`} onClick={() => setAmbientType('海浪')} title="海浪">🌊</button>
                      <button className={`ambient-type ${ambientType === '雨声' ? 'active' : ''}`} onClick={() => setAmbientType('雨声')} title="雨声">🌧️</button>
                      <button className={`ambient-type ${ambientType === '水泡' ? 'active' : ''}`} onClick={() => setAmbientType('水泡')} title="水泡">🫧</button>
                      <button className={`ambient-type ${ambientType === '鲸鸣' ? 'active' : ''}`} onClick={() => setAmbientType('鲸鸣')} title="鲸鸣">🐋</button>
                      <button className={`ambient-type ${ambientType === '海鸥' ? 'active' : ''}`} onClick={() => setAmbientType('海鸥')} title="海鸥">🕊️</button>
                    </div>
                    <div className="ambient-vol-row">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                      <input type="range" className="ambient-volume" min="0" max="1" step="0.05" value={ambientVol}
                        onChange={(e) => setAmbientVol(parseFloat(e.target.value))} />
                    </div>
                  </>
                )}
              </div>
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
                <div className="bubble streaming-bubble">{streamingText}</div>
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
          <button className="scroll-bottom-btn" onClick={() => scrollToBottom(true)} aria-label="回到底部">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 10 12 16 18 10" /></svg>
          </button>
        )}

        {/* 表情包选择器 */}
        {showStickerPicker && (
          <div className="sticker-picker">
            <div className="sticker-picker-header">
              <span>表情包{stickerBatchMode ? `（已选 ${stickerSelected.size}）` : ''}</span>
              <div className="sticker-picker-tools">
                <button className={stickerBatchMode ? 'active' : ''} onClick={() => { setStickerBatchMode(b => !b); setStickerSelected(new Set()); }}>{stickerBatchMode ? '取消' : '批量'}</button>
                {stickerBatchMode && <button className="danger" onClick={deleteSelectedStickers}>删除</button>}
                <button onClick={() => setShowStickerPicker(false)}>×</button>
              </div>
            </div>
            {!stickerBatchMode && (
              <div className="sticker-cats">
                {stickerCategories.map(cat => (
                  <button key={cat} className={`sticker-cat ${stickerCategory === cat ? 'active' : ''}`} onClick={() => setStickerCategory(cat)}>{cat}</button>
                ))}
              </div>
            )}
            <div className="sticker-list">
              {visibleStickers.length === 0 ? (<p className="sticker-empty">还没有表情包，在下方添加 URL</p>) : (
                visibleStickers.map(s => (
                  <StickerTile key={s.id} sticker={s} batchMode={stickerBatchMode} selected={stickerSelected.has(s.id)}
                    onInsert={insertSticker} onDelete={removeSticker} onToggleSelect={toggleStickerSelect}
                    onEdit={(st) => setStickerEdit({ id: st.id, meaning: st.meaning || '' })} />
                ))
              )}
            </div>
            {!stickerBatchMode && (
              <div className="sticker-add">
                <input className="sticker-cat-input" placeholder="分类（如：日常 / 搞笑，可留空）" value={stickerInputCategory} onChange={(e) => setStickerInputCategory(e.target.value)} />
                <textarea className="sticker-url-input" placeholder="粘贴表情包图片链接，每行一个&#10;例如：https://xxx.png" value={stickerInput} onChange={(e) => setStickerInput(e.target.value)} rows={4} />
                <button className="sticker-add-btn" onClick={addStickers}>＋ 添加表情包</button>
              </div>
            )}
          </div>
        )}

        {stickerEdit && (
          <div className="modal-overlay" onClick={() => setStickerEdit(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>表情包含义</h2>
              <p className="settings-hint">告诉 AI 这个表情包的意思，AI 会更懂你的情绪和意图。</p>
              <div className="modal-field"><label>含义说明</label><textarea value={stickerEdit.meaning} onChange={(e) => setStickerEdit({ ...stickerEdit, meaning: e.target.value })} placeholder="例如：开心、无奈、求安慰……" rows={3} /></div>
              <div className="modal-actions"><button className="btn-cancel" onClick={() => setStickerEdit(null)}>取消</button><button className="btn-save" onClick={saveStickerMeaning}>保存</button></div>
            </div>
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
            favorites={musicFavorites}
            onToggleFavorite={toggleFavorite}
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
              <span className="reply-bar-name">{replyTo.role === 'user' ? '我' : (profile.aiName || 'ClaudeAI')}</span>
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

        {/* 歌词窄条：只显示当前一句，半透明不遮挡聊天 */}
        {nowPlaying && nowPlaying.lyric && nowPlaying.lyric.trim() && showLyricBar && (() => {
          const lines = nowPlaying.lyric.split('\n').map(l => {
            const m = l.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/);
            if (m) {
              const t = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / Math.pow(10, m[3].length) : 0);
              return { time: t, text: (m[4] || '').trim() };
            }
            return { time: -1, text: l.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim() };
          }).filter(l => l.text);
          const hasTiming = lines.some(l => l.time >= 0);
          let curText = '';
          if (hasTiming) {
            curText = lines[0]?.text || '';
            for (const l of lines) { if (l.time <= (nowPlaying.currentTime || 0)) curText = l.text; else break; }
          } else if (lines.length > 0) {
            // 无时间戳：按播放进度比例取行
            const prog = (nowPlaying.currentTime || 0) / (nowPlaying.duration || 1);
            curText = lines[Math.min(lines.length - 1, Math.floor(prog * lines.length))]?.text || lines[0]?.text || '';
          }
          if (!curText) return null;
          return (
            <div className="lyric-bar" key={curText}>
              <span className="lyric-bar-text">{curText}</span>
              <button className="lyric-bar-close" onClick={() => setShowLyricBar(false)} aria-label="关闭歌词" title="关闭歌词">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>
          );
        })()}

        {/* 输入区 */}
        <div className="input-area">
          <div className="input-wrapper">
            <button className="plus-btn" onClick={() => { setShowToolbar(!showToolbar); setShowStickerPicker(false); }}>+</button>
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
              {/* 表情包按钮（放在发送键旁边）*/}
              <button className="sticker-btn" onClick={() => { setShowStickerPicker(!showStickerPicker); setShowToolbar(false); }} aria-label="表情包">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M8 14.5c1.5 1.8 4.5 1.8 6 0" /><circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </button>
              {/* 发送/停止按钮 */}
              {loading ? (
              <button className="send-btn stop-btn" onClick={stopGeneration} title="停止生成">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button className={`send-btn ${pendingCount > 0 && !input.trim() ? 'pending-trigger' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={sendMessage} disabled={!input.trim() && pendingImages.length === 0 && pendingFiles.length === 0 && pendingCount === 0}>
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
            onPrev={playPrev}
            onNext={playNext}
            repeatMode={repeatMode}
            onCycleRepeat={cycleRepeat}
            isFav={isFavorited(nowPlaying)}
            onToggleFav={() => toggleFavorite(nowPlaying)}
            onToggleLyrics={() => setShowLyricBar(prev => !prev)}
            lyricsOn={showLyricBar}
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
                <div className="modal-field"><label>桌宠图片URL（留空用默认🐠）</label><input type="text" value={petSettings.image} onChange={(e) => handlePetImageChange(e.target.value)} placeholder="粘贴图片URL" /></div>
                <div className="modal-field"><label>桌宠大小: {petSettings.size}px</label><input type="range" min="20" max="100" value={petSettings.size} onChange={(e) => handlePetSizeChange(parseInt(e.target.value))} /></div>
              </div>
              <div className="settings-section">
                <h3 className="settings-section-title">桌宠图片库</h3>
                <div className="pet-library">
                  <div className="pet-lib-upload-tile" onClick={() => petLibFileRef.current?.click()} title="上传桌宠图片（默认使用原图，可在图片库中手动抠图）">
                    <span className="pet-lib-plus">＋</span>
                    <span className="pet-lib-upload-text">{petCutoutLoading ? (<><span className="pet-cut-spinner" /> 抠图中…</>) : '上传图片'}</span>
                  </div>
                  {petImages.map(p => (
                    <div key={p.id} className={`pet-lib-item ${petSettings.image === (p.cutoutUrl || p.url) ? 'active' : ''}`} onClick={() => selectPet(p)}>
                      <img src={p.cutoutUrl || p.url} alt={p.name || '桌宠'} />
                      <button className="pet-lib-recut" onClick={(e) => { e.stopPropagation(); recutPet(p); }} title="智能抠图" disabled={petCutoutLoading}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" /></svg></button>
                      <button className="pet-lib-del" onClick={(e) => { e.stopPropagation(); removePetImage(p.id); }}>×</button>
                      {p.cutoutUrl && <span className="pet-lib-badge cached" title="已缓存抠图">✓</span>}
                      {petSettings.image === (p.cutoutUrl || p.url) && <span className="pet-lib-badge">使用中</span>}
                    </div>
                  ))}
                  {petImages.length === 0 && <p className="pet-lib-empty">点击左上角「＋」上传你的桌宠形象吧</p>}
                </div>
                <input ref={petLibFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; addPetImage(f); e.target.value = ''; }} />
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
            <div className="modal-field"><label>昵称（AI 给你的称呼）</label><input value={profile.nickname || ''} onChange={(e) => setProfile({ ...profile, nickname: e.target.value })} placeholder="AI 熟悉你后可能会自动填写" /></div>
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
