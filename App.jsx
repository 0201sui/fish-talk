import { useState, useEffect, useRef, useCallback } from 'react'

// ========== 开屏动画组件 ==========
function SplashScreen({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => onFinish(), 2500)
    return () => clearTimeout(timer)
  }, [onFinish])

  return (
    <div className="splash-screen">
      <div className="splash-whale">🐋</div>
      <div className="splash-title">鱼 说</div>
      <div className="splash-subtitle">Fish-Talk · 在深海里，安静地说话</div>
      <div className="splash-bubbles">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="splash-bubble" />
        ))}
      </div>
    </div>
  )
}

// ========== 主应用 ==========
export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [sessions, setSessions] = useState([
    { id: 1, name: '新对话', created_at: new Date().toISOString() }
  ])
  const [activeSession, setActiveSession] = useState(1)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const messagesEndRef = useRef(null)
  const messagesAreaRef = useRef(null)
  const textareaRef = useRef(null)

  // 后端地址（本地开发用 localhost，上线后换成 Render 地址）
  const API_BASE = 'http://localhost:10000'

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // 监听滚动，显示/隐藏回到底部按钮
  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    setShowScrollBtn(!isNearBottom)
  }, [])

  useEffect(() => {
    scrollToBottom(false)
  }, [messages, scrollToBottom])

  // 自动调整输入框高度
  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }

  // 发送消息（占位，后面接入后端）
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    // 重置输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // TODO: 后续章节接入后端 API
    // 目前先模拟一个回复
    setTimeout(() => {
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '🐋 嗨！我是裴拟。你刚才说：「' + text + '」。\n\n目前后端还没有连接上，等第四章完成后，这里就会变成真正的 AI 回复啦～',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, aiMsg])
      setIsLoading(false)
    }, 1000)
  }

  // 键盘发送
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 新建会话
  const handleNewSession = () => {
    const newSession = {
      id: Date.now(),
      name: '新对话',
      created_at: new Date().toISOString()
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSession(newSession.id)
    setMessages([])
  }

  // 格式化时间
  const formatTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <div className="app-container">
        {/* ========== 侧边栏 ========== */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <span className="whale">🐋</span>
              <span>鱼说</span>
            </div>
            <button className="sidebar-new-btn" onClick={handleNewSession} title="新建对话">
              +
            </button>
          </div>

          <div className="session-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === activeSession ? 'active' : ''}`}
                onClick={() => {
                  setActiveSession(session.id)
                  setMessages([])
                  setSidebarOpen(false)
                }}
              >
                <span>{session.name}</span>
                <div className="session-actions">
                  <button title="重命名" onClick={(e) => { e.stopPropagation(); /* TODO */ }}>
                    ✎
                  </button>
                  <button title="删除" onClick={(e) => { e.stopPropagation(); /* TODO */ }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <button onClick={() => setSidebarOpen(false)}>⚙ 设置</button>
            <button>💾 备份</button>
          </div>
        </aside>

        {/* ========== 主聊天区 ========== */}
        <main className="main-chat" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <div className="chat-header">
            <div className="chat-header-left">
              <button
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
                onClick={(e) => { e.stopPropagation(); setSidebarOpen(true) }}
              >
                ☰
              </button>
              <span style={{ fontWeight: 500, color: 'var(--ocean-blue)' }}>
                {sessions.find(s => s.id === activeSession)?.name || '鱼说'}
              </span>
            </div>
            <select className="model-selector" defaultValue="claude">
              <option value="claude">🐋 Claude (中转站)</option>
              <option value="deepseek">🔍 DeepSeek</option>
            </select>
          </div>

          <div
            className="messages-area"
            ref={messagesAreaRef}
            onScroll={handleScroll}
            style={{ position: 'relative' }}
          >
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', gap: '12px', minHeight: '300px'
              }}>
                <div style={{ fontSize: '60px' }}>🐋</div>
                <div style={{ fontSize: '16px' }}>在深海里，安静地说一句话吧</div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '🐠' : '🐋'}
                </div>
                <div className="message-body">
                  <div className="message-bubble">
                    {msg.content}
                  </div>
                  <div className="message-time">{formatTime(msg.created_at)}</div>
                  <div className="message-actions">
                    <button>复制</button>
                    <button>引用</button>
                    {msg.role === 'user' && <button>编辑</button>}
                    <button>删除</button>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-row assistant">
                <div className="message-avatar">🐋</div>
                <div className="message-body">
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />

            {showScrollBtn && (
              <button className="scroll-to-bottom" onClick={() => scrollToBottom()}>
                ↓
              </button>
            )}
          </div>

          <div className="input-area">
            <div className="input-container">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="说点什么吧..."
                rows={1}
                disabled={isLoading}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
              >
                ↑
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
