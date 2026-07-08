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
        setStatus('✅ 后端连接正常：' + data.message);
      })
      .catch(() => {
        setStatus('❌ 后端未启动，请检查 Render 服务');
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
      setResponse('❌ 请求失败');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🧪 前后端联调测试</h1>
      <p style={{ color: status.includes('✅') ? 'green' : 'red' }}>{status}</p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入消息..."
          style={{ flex: 1, padding: '10px', fontSize: '16px' }}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          {loading ? '发送中...' : '发送'}
        </button>
      </div>
      {response && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
          <strong>🤖 回复：</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{response}</p>
        </div>
      )}
    </div>
  );
}

export default App;
