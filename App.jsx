import { useState, useEffect, useRef, useCallback } from 'react';
import MemoryPalace from './MemoryPalace';
import ApiConfig from './ApiConfig';
import './App.css';

const API_URL = 'https://my-home-backend-9j56.onrender.com';

function getCurrentLocalTimeText() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find(part => part.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function getApiConfig() {
  try {
    const saved = localStorage.getItem('apiProviders');
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    const provider = (parsed.providers || []).find(p => p.id === parsed.activeId);

    return provider || null;
  } catch (e) {
    return null;
  }
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

  const [modelList, setModelList] = useState([]);
  const [model, setModel] = useState('');

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const messagesRef use(null const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const messageRefs = useRef([]);

  const refreshModelList = useCallback(() => {
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
      const defaultModels = ['claude', 'deepseek'];
      setModelList(defaultModels);

      const saved = getActiveModel();
      setModel(saved || 'claude');
    }
  }, []);

  useEffect(() => {
    refreshModelList();
  }, [refreshModelList]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2500);
    const removeTimer = setTimeout(() => setShowSplash(false), 3300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    setTimeout(() => {
      if (messagesAreaRef.current) {
        messagesAreaRef.current.scrollTo({
          top: messagesAreaRef.current.scrollHeight,
 []);

  {
    const area = messagesAreaRef.current;
    if (!area) return true;

    const distance = area.scrollHeight - area.scrollTop - area.clientHeight;
    return distance < 120;
  }, []);

  const handleScroll = useCallback(() => {
    const area = messagesAreaRef.current;
    if (!area) return;

    const distance = area.scrollHeight - area.scrollTop - area.clientHeight;
    setShowScrollBtn(distance > 120);
  }, []);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;

    if (loading || isNearBottom()) {
      scrollToBottom(false);
    }
  }, [messages, loading, isNearBottom, scrollToBottom]);

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
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (model) {
      localStorage.setItem('selectedModel', model);
    }
  }, [model]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearch      query searchQuery.toLowerCase();
    const results = [];

    messages.forEach((msg, index) => {
      if ((msg.content || '').toLowerCase().includes(query)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (currentSearchIndex < 0) return;

    const msgIndex = searchResults[currentSearchIndex];
    const msgEl = messageRefs.current[msgIndex];

    if (msgEl) {
      msgEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentSearchIndex, searchResults]);

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
    } catch (err) {
      console.error('加载会话失败:', err);
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`);
      const data = await res.json();

      if (data.messages) {
        setMessages(data.messages);
        setTimeout(() => scrollToBottom(false), 100);
      }
    } catch (err) {
      console.error('加载消息失败:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      const data = await res.json();

      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('加载设置失败:', err);
    }
  };

  const createSession = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新对话' })
      });

      const data = await res.json();

      if (data.session) {
        setSessions(prev => [data.session, ...prev]);
        setCurrentSessionId(data.session.id);
        setMessages([]);
        setShowSidebar(false);
      }
    } catch (err) {
      console.error('创建会话失败:', err);
    }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();

    if (!confirm('确定删除这个对话吗？')) return;

    try {
      await fetch(`${API_URL}/sessions/${id}`, {
        method: 'DELETE'
      });

      setSessions(prev => {
        const nextSessions = prev.filter(s => s.id !== id);

        if (currentSessionId === id) {
          const nextSession = nextSessions[0] || null;
          setCurrentSessionId(nextSession ? nextSession.id : null);
          setMessages([]);
        }

        return nextSessions;
      });
    } catch (err) {
      console.error('删除会话失败:', err);
    }
  };

  const renameSession = async (id, e) => {
    e.stopPropagation();

    const newName = prompt('输入新名称:');
    if (!newName) return;

    try {
      await fetch(`${API_URL}/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });

      setSessions(prev =>
        prev.map(s => s.id === id ? { ...s, name: newName } : s)
      );
    } catch (err) {
      console.error('重命名失败:', err);
    }
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      setShowSettings(false);
    } catch (err) {
      console.error('保存设置失败:', err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    let sessionId = currentSessionId;
    const currentInput = input.trim();
    const currentTime = getCurrentLocalTimeText();

    if (!sessionId) {
      try {
        const res = await fetch(`${API_URL}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: currentInput.slice(0, 20) || '新对话'
          })
        });

        const data = await res.json();

        if (data.session) {
          setSessions(prev => [data.session, ...prev]);
          sessionId = data.session.id;
          setCurrentSessionId(sessionId);
        }
      } catch (err) {
        console.error('创建会话失败:', err);
        return;
      }
    }

    const userMessage = {
      role: 'user',
      content: currentInput,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }

    try {
      const provider = getApiConfig();
      const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const currentTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const chatBody = {
  message: currentInput,
  session_id: sessionId,
  model: model,
  current_time: currentTime,
  timezone: 'Asia/Shanghai'
};
      if (provider) {
        chatBody.api_key = provider.apiKey;
        chatBody.base_url = provider.baseUrl;
      }

      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody)
      });

      const data = await res.json();

      if (data.reply) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            created_at: new Date().toISOString()
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: '抱歉，出了点问题: ' + (data.error || '未知错误'),
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('发送消息失败:', err);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '网络错误，请稍后再试',
          created_at: new Date().toISOString()
        }
      ]);
    }

    try {
      const compressSettings = JSON.parse(localStorage.getItem('compressSettings') || '{}');
      const autoRounds = compressSettings.autoCompressRounds || 0;

      if (autoRounds > 0 && sessionId) {
        const countResp = await fetch(`${API_URL}/sessions/${sessionId}/messages`);
        const countData = await countResp.json();
        const msgCount = countData.messages ? countData.messages.length : 0;

        if (msgCount > 0 && msgCount % autoRounds === 0) {
          await fetch(`${API_URL}/memories/compress/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              max_words: compressSettings.maxWords || 200,
              delete_after: compressSettings.deleteAfterCompress || false
            })
          });
        }
      }
    } catch (e) {
      console.warn('自动总结检查失败:', e);
    }

    setLoading(false);
    setTimeout(() => fetchSessions(), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }
  };

  const toggleSearch = () => {
    setShowSearch(prev => !prev);

    if (showSearch) {
      setSearchQuery('');
      setSearchResults([]);
      setCurrentSearchIndex(-1);
    }
  };

  const nextSearchResult = () => {
    if (searchResults.length === 0) return;

    setCurrentSearchIndex(prev => {
      if (prev < 0) return 0;
      return (prev + 1) % searchResults.length;
    });
  };

  const prevSearchResult = () => {
    if (searchResults.length === 0) return;

    setCurrentSearchIndex(prev => {
      if (prev < 0) return 0;
      return (prev - 1 + searchResults.length) % searchResults.length;
    });
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  const highlightText = (text, query) => {
    if (!query.trim()) return text;

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = String(text || '').split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <mark key={index} className="search-highlight">
            {part}
          </mark>
        );
      }

      return part;
    });
  };

  if (showSplash) {
    return (
      <div className={`splash ${splashFading ? 'splash-fading' : ''}`}>
        <div className="splash-bubbles">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div className="splash-top"></div>

        <div className="splash-center">
          <div className="splash-whale">🐋</div>
        </div>

        <div className="splash-bottom">
          <div className="splash-bottom-bubbles">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          <h1 className="splash-title">鱼说</h1>
          <p className="splash-subtitle">在深海里，听见你的声音</p>

          <div className="splash-wave-group">
            <div className="splash-wave splash-wave-1"></div>
            <div className="splash-wave splash-wave-2"></div>
            <div className="splash-wave splash-wave-3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {showSidebar && (
        <div
          className="sidebar-overlay"
          onClick={() => setShowSidebar(false)}
        />
      )}

      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🐚 对话列表</h2>
          <button className="new-chat-btn" onClick={createSession}>
            + 新对话
          </button>
        </div>

        <div className="session-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => {
                setCurrentSessionId(session.id);
                setShowSidebar(false);
              }}
            >
              <span
                className="session-name"
                onDoubleClick={(e) => renameSession(session.id, e)}
                title="双击可以重命名"
              >
                🫧 {session.name || '未命名对话'}
              </span>

              <button
                className="delete-btn"
                onClick={(e) => deleteSession(session.id, e)}
                title="删除对话"
              >
                ×
              </button>
            </div>
          ))}

          {sessions.length === 0 && (
            <p
              style={{
                padding: '20px',
                color: '#7ab0c4',
                fontSize: '13px',
                textAlign: 'center'
              }}
            >
              海洋里还没有故事，点击「+ 新对话」开始吧 🌊
            </p>
          )}
        </div>

        <div className="sidebar-bottom">
          <button
            className="memory-palace-btn"
            onClick={() => {
              setShowMemoryPalace(true);
              setShowSidebar(false);
            }}
          >
            记忆宫殿
          </button>

          <button
            className="memory-palace-btn"
            style={{ marginTop: '8px' }}
            onClick={() => {
              setShowApiConfig(true);
              setShowSidebar(false);
            }}
          >
            API 配置
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="chat-header">
          <div className="chat-header-left">
            <button
              className="menu-btn"
              onClick={() => setShowSidebar(true)}
            >
              ☰
            </button>

            <h1>裴拟的海洋馆</h1>
          </div>

          <div className="chat-header-right">
            <button
              className="search-toggle-btn"
              onClick={toggleSearch}
              title="搜索消息"
            >
              🔍
            </button>

            <select
              className="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {modelList.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              className="settings-btn"
              onClick={() => setShowSettings(true)}
            >
              ⚙
            </button>
          </div>
        </header>

        {showSearch && (
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="搜索当前对话里的消息..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            <span className="search-count">
              {searchResults.length > 0 && currentSearchIndex >= 0
                ? `${currentSearchIndex + 1}/${searchResults.length}`
                : searchQuery.trim()
                  ? '0/0'
                  : ''}
            </span>

            <button
              className="search-nav-btn"
              onClick={prevSearchResult}
              disabled={searchResults.length === 0}
            >
              ↑
            </button>

            <button
              className="search-nav-btn"
              onClick={nextSearchResult}
              disabled={searchResults.length === 0}
            >
              ↓
            </button>

            <button
              className="search-close-btn"
              onClick={closeSearch}
            >
              ✕
            </button>
          </div>
        )}

        <div
          className="messages-area"
          ref={messagesAreaRef}
          onScroll={handleScroll}
        >
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
              key={`${msg.role}-${msg.created_at || index}-${index}`}
              className={`message ${msg.role} ${
                searchResults.includes(index) ? 'search-match' : ''
              } ${
                searchResults[currentSearchIndex] === index ? 'search-active' : ''
              }`}
              ref={(el) => {
                messageRefs.current[index] = el;
              }}
            >
              <div className="bubble">
                <p>
                  {showSearch && searchQuery
                    ? highlightText(msg.content, searchQuery)
                    : msg.content}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="bubble">
                <div className="typing-indicator">
                  <span></span                 span>
                 span>
Name="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="在这片海域留下你的声音..."
              rows={1}
            />

            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              🐋
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div
          className="modal-overlay            onClick={(e) => e.stopPropagation()}
          >
            <h2>⚙ 设置</h2>

            <div className="modal-field">
              <label>系统提示词</label>
              <textarea
                value={settings.system_prompt || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    system_prompt: e.target.value
                  })
                }
                placeholder="定义 AI 的人格和行为方式..."
              />
            </div>

            <div className="modal-field">
              <label>温度 0-1</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={ ??0.}
Change={(e) =>
                  setSettings({
                    ...settings,
                    temperature: parseFloat(e.target.value)
                  })
                }
              />
            </div>

            <div className="modal-field">
              <label>上下文保留轮数</label>
              <input
                type="number"
               settings on({
: parseInt(e.target.value, 10)
                  })
                }
              />
            </div>

            <div className="modal-field">
              <label>压缩触发阈值 token</label>
              <input
                type="number"
                value={settings.compress_threshold ?? 4000}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    compress_threshold: parseInt(e.target.value, 10)
                  })
                }
              />
            </div>

            <div className="modal-field">
              <label>压缩后保留轮数</label>
              <input
                type="number"
                value={settings.compress_keep_rounds ?? 6}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    compress_keep_rounds: parseInt(e.target.value, 10)
                  })
                }
              />
            </div>

            <div className="modal-field">
              <label>最大回复 token</label>
              <input
                type="number"
                value={settings.max_reply_tokens ?? 1024}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_reply_tokens: parseInt(e.target.value, 10)
                  })
                }
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowSettings(false)}
              >
                取消
              </button>

              <button
                className="btn-save"
                onClick={saveSettings}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemoryPalace && (
        <MemoryPalace
          onClose={() => setShowMemoryPalace(false)}
          currentSessionId={currentSessionId}
        />
      )}

      {showApiConfig && (
        <ApiConfig
          onClose={() => {
            setShowApiConfig(false);
            refreshModelList();
          }}
          onConfigChange={() => refreshModelList()}
        />
      )}
    </div>
  );
}

export default App;
