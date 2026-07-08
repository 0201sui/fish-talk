import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('检查后端连接...');

  useEffect(() => {
    fetch('https://my-home-backend-9j56.onrender.com/health')
      .then(res => res.json())
      .then(data => {
        setStatus('? 后端连接正常：' + data.message);
      })
      .catch(() => {
        setStatus('? 后端未启动，请检查 Render 服务');
      });
  }, []);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResponse('思考中...');
    try {
      const res = await fetch('https://my-home-backend-9j56.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setResponse(data.reply || data.error || '无回复');
    } catch (error) {
      setResponse('? 请求失败');
    }
    setLoading(false);
  };

  return (
    <div className="app">
      <div className="chat-container">
        <header className="chat-header">
          <h1>?? Bunny's Home</h1>
          <p className="subtitle">给你的 AI 一个家</p>
          <p className="status" style={{ color: status.includes('?') ? '#7c9a7c' : '#c47a7a' }}>
            {status}
          </p>
        </header>

        <main className="chat-main">
          {response && (
            <div className="message assistant">
              <span className="avatar">??</span>
              <div className="bubble">
                <p>{response}</p>
              </div>
            </div>
          )}
          {loading && (
            <div className="message assistant">
              <span className="avatar">??</span>
              <div className="bubble thinking">
                <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
              </div>
            </div>
          )}
        </main>

        <footer className="chat-footer">
          <div className="input-area">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="说点什么吧..."
              className="chat-input"
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <button onClick={sendMessage} className="send-btn" disabled={loading}>
              {loading ? '发送中' : '发送'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
