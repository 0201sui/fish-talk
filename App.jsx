import { useState, useEffect, useRef, useCallback } from 'react';
import MemoryPalace from './MemoryPalace';
import ApiConfig from './ApiConfig';
import './App.css';

const API_URL = 'https://my-home-backend-9j56.onrender.com';

function getApiConfig() {
  try {
    const saved = localStorage.getItem('apiProviders');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const provider = (parsed.providers || []).find(p => p.id === parsed.activeId);
    return provider || null;
  } catch (e) { return null; }
}

function getActiveModel() {
  return localStorage.getItem('selectedModel') || '';
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMemoryPalace, setShowMemoryPalace] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [settings, setSettings] = useState({
    system_prompt: '',
    temperature: 0.7,
    max_context_rounds: 20,
    compress_threshold: 4000,
    compress_keep_rounds: 6,
    max_reply_tokens: 1024
  });

  // 动态模型列表
  const [modelList, setModelList] = useState([]);
  const [model, setModel] = useState('');

  // 回到底部按钮
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // 消息搜索
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const messageRefs = useRef([]);

  const refreshModelList = () => {
    const provider = getApiConfig();
    if (provider && provider.models && provider.models.length > 0) {
      setModelList(provider.models);
      const saved = getActiveModel();
      if (saved && provider.models.includes(saved)) {
        setModel(saved);
      } else {
        setModel(provider.models[0]);
        localStorage.setItem('selectedModel', provider.models[0]);
      }
    } else {
      setModelList(['claude', 'deepseek']);
      const saved = getActiveModel();
      setModel(saved || 'claude');
    }
  };

  useEffect(() => {
    refreshModelList();
  }, []);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2500);
    const removeTimer = setTimeout(() => setShowSplash(false), 3300);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, []);

  const scrollToBottom = (smooth = false) => {
    setTimeout(() => {
      if (messagesAreaRef.current) {
        messagesAreaRef.current.scrollTo({
          top: messagesAreaRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }, 50);
  };

  // 检测是否在底部
  const handleScroll = useCallback(() => {
    if (messagesAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
      setShowScrollBtn(!isAtBottom);
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    fetchSessions();
    fetchSettings();
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
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

  // 搜索逻辑
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results = [];
    messages.forEach((msg, index) => {
      if (msg.content && msg.content.toLowerCase().includes(query)) {
        results.push(index);
      }
    });
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, messages]);

  // 搜索结果切换时滚动到对应消息
  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex] !== undefined) {
      const msgIndex = searchResults[currentSearchIndex];
      const msgEl = messageRefs.current[msgIndex];
      if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSearchIndex, searchResults]);

  const nextSearchResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
  };

  const prevSearchResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  // 高亮消息文本
  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
    );
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        if (!currentSessionId && data.sessions.length > 0) {
          setCurrentSessionId(data.sessions[0].id);
        }
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
        setCurrentSessionId(sessions.find(s => s.id !== id)?.id || null);
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

    const userMessage = { role: 'user', content: input, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    if (textareaRef.current) textareaRef.current.blur();

    try {
      const provider = getApiConfig();
      const chatBody = {
        message: currentInput,
        session_id: sessionId,
        model: model
      };

      if (provider) {
        chatBody.api_key = provider.apiKey;
        chatBody.base_url = provider.baseUrl;
      }

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

    // 自动总结检查
    try {
      const compressSettings = JSON.parse(localStorage.getItem('compressSettings') || '{}');
      const autoRounds = compressSettings.autoCompressRounds || 0;
      if (autoRounds > 0 && sessionId) {
        const countResp = await fetch(`${API_URL}/sessions/${sessionId}/messages`);
        const countData = await countResp.json();
        const msgCount = countData.messages ? countData.messages.length : 0;
        if (msgCount > 0 && msgCount % autoRounds === 0) {
          await fetch(`${API_URL}/memories/compress/${sessionId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_words: compressSettings.maxWords || 200, delete_after: compressSettings.deleteAfterCompress || false })
          });
        }
      }
    } catch (e) {}

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }
  };

  if (showSplash) {
    return (
      <div className={`splash ${splashFading ? 'splash-fading' : ''}`}>
        <div className="splash-bubbles"><span></span><span></span><span></span><span></span><span></span></div>
        <div className="splash-top"></div>
        <div className="splash-center"><div className="splash-whale">🐋</div></div>
        <div className="splash-bottom">
          <div className="splash-bottom-bubbles"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          <h1 className="splash-title">鱼说</h1>
          <p className="splash-subtitle">在深海里，听见你的声音</p>
          <div className="splash-wave-group">
            <div className="splash-wave splash-wave-1"></div>wave splash-wave-3"></divSididebar(false)}ebar ? 'open🐚话列-chat-btn" onClick={createSession}>+ 新对话</button>
        </div>
        <div className="session-list">
          {sessions.map(session => (
            <div key={session.id} className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => { setCurrentSessionId(session.id); setShowSidebar(false); }}>
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
        <div className="sidebar-bottom">
          <button className="memory-palace-btn" onClick={() => { setShowMemoryPalace(true); setShowSidebar(false); }}>
            记忆宫殿
          </button>
          <button className="memory-palace-btn" style={{ marginTop: '8px' }} onClick={() => { setShowApiConfig(true); setShowSidebar(false); }}>
            API 配置
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="chat-header">
          <div className="chat-header-left">
            <button className="menu-btn" onClick={() => setShowSidebar(true)}>☰</button>
            <h1>裴拟的海洋馆</h1>
          </div>
          <div className="chat-header-right">
            <button className="search-toggle-btn" onClick={() => setShowSearch(!showSearch)}>🔍</button>
            <select className="model-select" value={model} onChange={(e) => setModel(e.target.value)}>
              {modelList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
          </div>
        </header>

        {showSearch && (
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="搜索消息..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchResults.length > 0 && (
              <span className="search-count">{currentSearchIndex + 1}/{searchResults.length}</span>
            )}
            <button className="search-nav-btn" onClick={prevSearchResult} disabled={searchResults.length === 0}>↑</button>
            <button className="search-nav-btn" onClick={nextSearchResult} disabled={searchResults.length === 0}>↓</button>
            <button className="search-close-btn" onClick={closeSearch}>✕</button>
          </div>
        )}

        <div className="messages-area" ref={messagesAreaRef} onScroll={handleScroll}>
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <div className="welcome-icon">🌊</div>
              <h2>欢迎来到海洋馆🐋</h2>
              <p>在这片属于我们的海域，留下你的故事吧</p>
              <div className="welcome-decoration">🐠 🐙 🦈 🐚 🪸</div>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role} ${searchResults.includes(index) ? 'search-match' : ''} ${searchResults[currentSearchIndex] === index ? 'search-active' : ''}`}
              ref={(el) => { messageRefs.current[index] = el; }}
            >
              <div className="bubble">
                <p>{showSearch && searchQuery ? highlightText(msg.content, searchQuery) : msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="bubble">
                <div className="typing-indicator"><span></span><span></span><span></span></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showScrollBtn && (
          <button className="scroll-to-bottom-btn" onClick={() => scrollToBottom(true)}>↓</button>
        )}

        <div className="input-area">
          <div className="input-wrapper">
            <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
              placeholder="在这片海域留下你的声音..." rows={1} />
            <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>🐋</button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙ 设置</h2>
            <div className="modal-field">
              <label>系统提示词</label>
              <textarea value={settings.system_prompt} onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })} placeholder="定义 AI 的人格和行为方式..." />
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
              <label>压缩触发阈值 (token)</label>
              <input type="number" value={settings.compress_threshold} onChange={(e) => setSettings({ ...settings, compress_threshold: parseInt(e.target.value) })} />
            </div>
            <div className="modal-field">
              <label>压缩后保留轮数</label>
              <input type="number" value={settings.compress_keep_rounds} onChange={(e) => setSettings({ ...settings, compress_keep_rounds: parseInt(e.target.value) })} />
            </div>
            <div className="modal-field">
              <label>最大回复 token</label>
              <input type="number" value={settings.max_reply_tokens} onChange={(e) => setSettings({ ...settings, max_reply_tokens: parseInt(e.target.value) })} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>取消</button>
              <button className="btn-save" onClick={saveSettings}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showMemoryPalace && <MemoryPalace onClose={() => setShowMemoryPalace(false)} currentSessionId={currentSessionId} />}

      {showApiConfig && <ApiConfig onClose={() => { setShowApiConfig(false); refreshModelList(); }} onConfigChange={() => refreshModelList()} />}
    </div>
  );
}

export default App;
