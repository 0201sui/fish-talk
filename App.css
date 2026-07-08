import { useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('https://my-home-backend-9j56.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setResponse(data.reply || '无回复');
    } catch (error) {
      setResponse('? 请求失败');
    }
    setLoading(false);
  };

  return (
    <div className="app">
      <div className="chat-container">
        <header className="chat-header">
          <h1>?? 鱼说</h1>
          <p>简单 · 温柔 · 聊得来</p>
        </header>

        <div className="chat-body">
          {response && (
            <div className="bubble bot">
              <div className="bubble-content">{response}</div>
            </div>
          )}
          {loading && (
            <div className="bubble bot">
              <div className="bubble-content typing">?? 思考中...</div>
            </div>
          )}
        </div>

        <div className="chat-footer">
          <textarea
            className="input-area"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入消息..."
            rows="2"
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading}>
            {loading ? '发送中' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
