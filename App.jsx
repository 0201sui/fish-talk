import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // ---------- 状态 ----------
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // 设置弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    systemPrompt: '你是一个友好的AI助手，叫“鱼说”。',
    temperature: 0.7,
    model: '[特特价次kiro]claude-opus-4-6',
  });

  const API_BASE = 'https://my-home-backend-9j56.onrender.com';

  // ---------- 初始化：加载会话列表 ----------
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
        if (data.data.length > 0) {
          setCurrentSessionId(data.data[0].id);
        } else {
          createNewSession();
        }
      }
    } catch (e) {
      console.error('加载会话失败', e);
    }
  };

  // ---------- 创建新会话 ----------
  const createNewSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新对话' }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions([data.data, ...sessions]);
        setCurrentSessionId(data.data.id);
        setMessages([]);
      }
    } catch (e) {
      console.error('创建会话失败', e);
    }
  };

  // ---------- 切换会话 ----------
  const switchSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/messages?session_id=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (e) {
      console.error('加载消息失败', e);
    }
  };

  // ---------- 发送消息 ----------
  const sendMessage = async () => {
    if (!input.trim() || !currentSessionId) return;
    setLoading(true);

    const userMsg = { role: 'user', content: input };
    setMessages([...messages, userMsg]);
    setInput('');

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          session_id: currentSessionId,
          system_prompt: settings.systemPrompt,
          temperature: settings.temperature,
          model: settings.model,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        const aiMsg = { role: 'assistant', content: data.reply };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        alert('AI 回复失败');
      }
    } catch (e) {
      alert('请求失败');
    }
    setLoading(false);
  };

  // ---------- 删除会话 ----------
  const deleteSession = async (sessionId) => {
    if (!confirm('确定删除这个对话吗？')) return;
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
          switchSession(remaining[0].id);
        } else {
          createNewSession();
        }
      }
    } catch (e) {
      console.error('删除失败', e);
    }
  };

  // ---------- 渲染 ----------
  return (
    <div className="app">
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>🐟 鱼说</h2>
          <button onClick={createNewSession} className="new-btn">+ 新对话</button>
        </div>
        <ul className="session-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={s.id === currentSessionId ? 'active' : ''}
              onClick={() => switchSession(s.id)}
            >
              <span>{s.name || '未命名'}</span>
              <button
                className="del-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <button onClick={() => setShowSettings(true)} className="settings-btn">
            ⚙️ 设置
          </button>
        </div>
      </aside>

      {/* 主聊天区 */}
      <main className="chat-main">
        <header className="chat-header">
          <span>
            {sessions.find((s) => s.id === currentSessionId)?.name || '鱼说'}
          </span>
        </header>
        <div className="message-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg ${msg.role}`}>
              <div className="bubble">{msg.content}</div>
            </div>
          ))}
          {loading && <div className="msg assistant"><div className="bubble typing">🐟 思考中...</div></div>}
        </div>
        <div className="input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button onClick={sendMessage} disabled={loading}>
            {loading ? '发送中' : '发送'}
          </button>
        </div>
      </main>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ 设置</h2>
            <label>系统提示词</label>
            <textarea
              rows="3"
              value={settings.systemPrompt}
              onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
            />
            <label>温度 (0.1 ~ 1.0)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="1.0"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
            />
            <label>模型</label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            />
            <button onClick={() => setShowSettings(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
