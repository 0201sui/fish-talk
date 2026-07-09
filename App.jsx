import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'https://my-home-backend-9j56.onrender.com';

function App() {
  // 状态管理
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(localStorage.getItem('selectedModel') || 'claude');
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [settings, setSettings] = useState({
    system_prompt: '',
    temperature: 0.7,
    max_context_rounds: 20,
    compress_threshold: 4000,
    compress_keep_rounds: 6,
    max_reply_tokens: 1024
  });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // 加载会话列表
  useEffect(() => {
    fetchSessions();
    fetchSettings();
  }, []);

  // 切换会话时加载消息
  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId]);

  // 保存模型选择
  useEffect(() => {
    localStorage.setItem('selectedModel', model);
  }, [model]);

  // ===== API 调用函数 =====

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
      }
    } catch (err) {
      console.error('创建会话失败:', err);
    }
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
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
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

  // 在这片海域留下你的声音...
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // 如果没有会话，先创建一个
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const res = await fetch(`${API_URL}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: input.slice(0, 20) || '新对话' })
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

    const userMessage = { role: 'user', content: input, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          session_id: sessionId,
          model: model
        })
      });
      const data = await res.json();
      if (data.reply) {
        const assistantMessage = { role: 'assistant', content: data.reply, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = { role: 'assistant', content: '抱歉，出了点问题: ' + (data.error || '未知错误'), created_at: new Date().toISOString() };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage = { role: 'assistant', content: '网络错误，请稍后再试', created_at: new Date().toISOString() };
      setMessages(prev => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  // 输入消息
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 自动调整输入框高度
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="app">
      {/* 手机端侧边栏遮罩 */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      {/* 侧边栏 */}
      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>对话列表</h2>
          <button className="new-chat-btn" onClick={createSession}>+ 新对话</button>
        </div>
        <div className="session-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => { setCurrentSessionId(session.id); setShowSidebar(false); }}
            >
              <span className="session-name" onDoubleClick={(e) => renameSession(session.id, e)}>
                {session.name || '未命名对话'}
              </span>
              <button className="delete-btn" onClick={(e) => deleteSession(session.id, e)}>×</button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p style={{ padding: '20px', color: '#b0a090', fontSize: '13px', textAlign: 'center' }}>
              还没有对话，点击上方"+ 新对话"开始
            </p>
          )}
        </div>
      </aside>

      {/* 主区域 */}
      <div className="main-area">
        {/* 顶栏 */}
        <header className="chat-header">
          <div className="chat-header-left">
            <button className="menu-btn" onClick={() => setShowSidebar(true)}>☰</button>
         <title>裴拟的海洋馆 🐠</title>
          </div>
          <div className="chat-header-right">
            <select className="model-select" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="claude">Claude</option>
              <option value="deepseek">DeepSeek</option>
            </select>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙ 设置</button>
          </div>
        </header>

        {/* 消息列表 */}
        <div className="messages-area">
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <h2>欢迎来到海洋馆 🌊</h2>
              <p>输入消息开始对话吧</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="bubble">
                <p>{msg.content}</p>
              </div>
            </div>
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

        {/* 输入区域 */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              rows={1}
            />
            <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
              发送
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
              <textarea
                value={settings.system_prompt}
                onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                placeholder="定义 AI 的人格和行为方式..."
              />
            </div>
            <div className="modal-field">
              <label>温度 (0-1，越高越有创意)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              />
            </div>
            <div className="modal-field">
              <label>上下文保留轮数</label>
              <input
                type="number"
                value={settings.max_context_rounds}
                onChange={(e) => setSettings({ ...settings, max_context_rounds: parseInt(e.target.value) })}
              />
            </div>
            <div className="modal-field">
              <label>压缩触发阈值 (token 数)</label>
              <input
                type="number"
                value={settings.compress_threshold}
                onChange={(e) => setSettings({ ...settings, compress_threshold: parseInt(e.target.value) })}
              />
            </div>
            <div className="modal-field">
              <label>压缩后保留轮数</label>
              <input
                type="number"
                value={settings.compress_keep_rounds}
                onChange={(e) => setSettings({ ...settings, compress_keep_rounds: parseInt(e.target.value) })}
              />
            </div>
            <div className="modal-field">
              <label>最大回复 token 数</label>
              <input
                type="number"
                value={settings.max_reply_tokens}
                onChange={(e) => setSettings({ ...settings, max_reply_tokens: parseInt(e.target.value) })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>取消</button>
              <button className="btn-save" onClick={saveSettings}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
