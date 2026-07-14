import { useState, useEffect, useRef } from 'react';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

export default function ReadTogether({ sessionId, onClose }) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const fileRef = useRef(null);
  const readerRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API_URL}/read/content/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setReading(data.data);
          setScrollProgress(data.data.progress || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  // 恢复阅读进度
  useEffect(() => {
    if (reading && readerRef.current && scrollProgress > 0) {
      const el = readerRef.current;
      setTimeout(() => {
        el.scrollTop = (el.scrollHeight - el.clientHeight) * (scrollProgress / 100);
      }, 100);
    }
  }, [reading]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('文件不能超过5MB'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resp = await fetch(`${API_URL}/read/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            title: file.name,
            content: reader.result
          })
        });
        const data = await resp.json();
        if (data.success) {
          setReading({ title: file.name, content: reader.result, progress: 0 });
          setScrollProgress(0);
        }
      } catch (err) {
        alert('上传失败: ' + err.message);
      }
      setUploading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleScroll = () => {
    if (!readerRef.current) return;
    const el = readerRef.current;
    const progress = el.scrollHeight > el.clientHeight
      ? (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
      : 100;
    setScrollProgress(progress);
    // 防抖保存进度
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`${API_URL}/read/progress/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      });
    }, 1000);
  };

  const handleDelete = async () => {
    if (!confirm('确定删除这篇阅读内容吗？')) return;
    await fetch(`${API_URL}/read/${sessionId}`, { method: 'DELETE' });
    setReading(null);
    setScrollProgress(0);
  };

  if (loading) {
    return (
      <div className="read-together-panel">
        <div className="rt-header">
          <span>一起读</span>
          <button onClick={onClose}>x</button>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ocean-accent)' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="read-together-panel">
      <div className="rt-header">
        <span>一起读</span>
        <div className="rt-header-actions">
          {reading && (
            <>
              <span className="rt-progress-label">{Math.round(scrollProgress)}%</span>
              <button className="rt-delete-btn" onClick={handleDelete} title="删除">删除</button>
            </>
          )}
          <button onClick={onClose}>x</button>
        </div>
      </div>

      {!reading ? (
        <div className="rt-upload-area">
          <div className="rt-upload-icon">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--theme-accent, #5ba3c4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className="rt-upload-hint">上传文本文件，和AI一起阅读</p>
          <p className="rt-upload-formats">支持 .txt .md .json 等文本格式</p>
          <input ref={fileRef} type="file" accept=".txt,.md,.json,.csv,.log,.html,.xml,.yaml,.yml,.text" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="rt-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '上传中...' : '选择文件'}
          </button>
        </div>
      ) : (
        <>
          <div className="rt-title-bar">
            <span className="rt-title">{reading.title}</span>
          </div>
          <div className="rt-progress-bar">
            <div className="rt-progress-fill" style={{ width: `${scrollProgress}%` }} />
          </div>
          <div ref={readerRef} className="rt-reader" onScroll={handleScroll}>
            <pre className="rt-content">{reading.content}</pre>
          </div>
          <div className="rt-footer">
            <span className="rt-position">已读 {Math.round(scrollProgress)}%</span>
            <span className="rt-hint">进度自动保存，下次打开继续阅读</span>
          </div>
        </>
      )}
    </div>
  );
}
