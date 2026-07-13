import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ApiConfig from './ApiConfig.jsx';
import MemoryPalace from './MemoryPalace.jsx';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

// ===== 从 localStorage 读取 API 配置 =====
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

// ===== 开屏动画组件 =====
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);
  return (
    <div className={`splash ${phase >= 2 ? 'fade-out' : ''}`}>
      <div className="splash-ocean" />
      <div className="splash-content">
        <div className="splash-fish">🐟</div>
        <h1 className="splash-title" style={{ opacity: phase >= 1 ? 1 : 0 }}>鱼说</h1>
        <p className="splash-sub" style={{ opacity: phase >= 1 ? 1 : 0 }}>Fish Talk</p>
        <div className="splash-wave" />
      </div>
    </div>
  );
}

// ===== 桌宠组件 =====
function DesktopPet() {
  const [pos, setPos] = useState({ x: 50, y: 80 });
  const [dir, setDir] = useState(1);
  const petRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let raf;
    let t = 0;
    const animate = () => {
      t += 0.02;
      if (!dragging.current) {
        setPos(p => ({
          x: Math.max(10, Math.min(window.innerWidth - 60, p.x + dir * 0.3)),
          y: p.y + Math.sin(t) * 0.5
        }));
        if (pos.x > window.innerWidth - 80) setDir(-1);
        if (pos.x < 20) setDir(1);
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [dir, pos.x]);

  const startDrag = (e) => {
    dragging.current = true;
    const touch = e.touches ? e.touches[0] : e;
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
  };
  const onDrag = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    setPos({ x: touch.clientX - offset.current.x, y: touch.clientY - offset.current.y });
  };
  const endDrag = () => { dragging.current = false; };

  return (
    <div
      ref={petRef}
      className="desktop-pet"
      style={{ left: pos.x, top: pos.y, transform: dir < 0 ? 'scaleX(-1)' : '' }}
      onMouseDown={startDrag}
      onMouseMove={onDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={startDrag}
      onTouchMove={onDrag}
      onTouchEnd={endDrag}
    >
      🐠
    </div>
  );
}

// ===== 消息气泡组件 =====
function MessageBubble({ msg, index, onQuote, onEdit, onDelete, onCopy, editingId, setEditingId, editContent, setEditContent, saveEdit }) {
  const [showActions, setShowActions] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const isUser = msg.role === 'user';

  const onTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };
  const onTouchMove = (e) => {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    if (delta > 0 && delta < 80) setSwipeX(delta);
    else setSwipeX(0);
  };
  const onTouchEnd = () => {
    if (swipeX > 40) {
      onQuote(msg);
    }
    setSwipeX(0);
    setTouchStart(null);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div
      className={`message ${msg.role}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: swipeX > 0 ? `translateX(${swipeX}px)` : '' }}
    >
      <div className="message-inner">
        {msg.reply_to && (
          <div className="reply-indicator">↩ 引用消息</div>
        )}
        {editingId === msg.id ? (
          <div className="edit-mode">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
            />
            <div className="edit-actions">
              <button onClick={() => saveEdit(msg.id)}>保存</button>
              <button onClick={() => setEditingId(null)}>取消</button>
            </div>
          </div>
        ) : (
          <div className="bubble" onClick={() => setShowActions(!showActions)}>
            {msg.stickers && (
              <div className="msg-stickers">
                {msg.stickers.map((s, i) => <img key={i} src={s} alt="贴纸" />)}
              </div>
            )}
            <p>{msg.content}</p>
            <span className="msg-time">{formatTime(msg.created_at)}{msg.edited && ' ✏️'}</span>
          </div>
        )}
        {showActions && editingId !== msg.id && (
          <div className="msg-actions">
            <button onClick={() => onQuote(msg)}>引用</button>
            <button onClick={() => onCopy(msg)}>复制</button>
            {isUser && <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}>编辑</button>}
            <button className="msg-del" onClick={() => onDelete(msg)}>删除</button>
          </div>
        )}
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
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [stickers, setStickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stickers') || '[]'); } catch { return []; }
  });
  const [stickerInput, setStickerInput] = useState('');
  const [profile, setProfile] = useState({ userBio: '', aiBio: '', userName: '我', aiName: '鱼说' });
  const [settings, setSettings] = useState({
    system_prompt: '', temperature: 0.7, max_context_rounds: 20,
    compress_threshold: 4000, compress_keep_rounds: 6, max_reply_tokens: 1024,
    auto_summarize: true, auto_summarize_after: 10, delete_after_summarize: false
  });

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);

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
      const timer = setTimeout(() => setShowSplash(false), 2600);
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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

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

    const userMsg = { role: 'user', content: input, created_at: new Date().toISOString(), reply_to: replyTo?.id || null };
    setMessages(prev => [...prev, userMsg]);
    const sentInput = input;
    setInput('');
    setLoading(true);
    setReplyTo(null);
    if (textareaRef.current) textareaRef.current.blur();

    // 获取当前激活的 API 配置
    const activeApi = getActiveModel();
    const chatBody = { message: sentInput, session_id: sessionId, model };
    if (activeApi) {
      chatBody.api_url = activeApi.baseUrl;
      chatBody.api_key = activeApi.apiKey;
      chatBody.api_model = activeApi.name;
    }

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody)
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，出了点问题: ' + (data.error || '未知错误'), created_at: new Date().toISOString() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请稍后再试', created_at: new Date().toISOString() }]);
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
    navigator.clipboard.writeText(msg.content);
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

  const addStickers = () => {
    const urls = stickerInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setStickers(prev => [...prev, ...urls.map(url => ({ id: Date.now() + Math.random(), url }))]);
    setStickerInput('');
  };

  const removeSticker = (id) => {
    setStickers(prev => prev.filter(s => s.id !== id));
  };

  const insertSticker = (url) => {
    setInput(prev => prev + ` [贴纸]${url}[/贴纸] `);
    setShowStickerPicker(false);
  };

  // 获取可用模型列表
  const activeApi = getActiveModel();
  const availableModels = activeApi?.allModels || ['claude', 'deepseek'];

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <div className="app">
      <DesktopPet />

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
              海洋里还没有故事，点击"+ 新对话"开始吧 🌊
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
            <h1>🐟 鱼说</h1>
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

        {/* 引用消息预览 */}
        {replyTo && (
          <div className="reply-preview">
            <span>↩ 回复: {replyTo.content.slice(0, 50)}...</span>
            <button onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}

        {/* 消息区 */}
        <div className="messages-area" ref={messagesAreaRef} onScroll={onScroll}>
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <div className="welcome-icon">🌊</div>
              <h2>欢迎来到鱼说</h2>
              <p>在这片属于我们的海域，留下你的故事吧</p>
              <div className="welcome-decoration">🐠 🐙 🦈 🐚 🪸</div>
              {activeApi && <p className="welcome-model">当前模型: {activeApi.name}</p>}
            </div>
          )}
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id || index}
              msg={msg}
              index={index}
              onQuote={onQuote}
              onEdit={() => {}}
              onDelete={onDelete}
              onCopy={onCopy}
              editingId={editingId}
              setEditingId={setEditingId}
              editContent={editContent}
              setEditContent={setEditContent}
              saveEdit={saveEdit}
            />
          ))}
          {loading && (
            <div className="message assistant">
              <div className="bubble">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 回到底部按钮 */}
        {showScrollBtn && (
          <button className="scroll-bottom-btn" onClick={scrollToBottom}>↓</button>
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

        {/* 输入区 */}
        <div className="input-area">
          <div className="input-wrapper">
            <button className="sticker-btn" onClick={() => setShowStickerPicker(!showStickerPicker)}>😊</button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="在这片海域留下你的声音..."
              rows={1}
            />
            <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
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
