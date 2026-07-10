import { useState, useEffect } from 'react';
import './MemoryPalace.css';

const API_URL = 'https://my-home-backend-9j56.onrender.com';

export default function MemoryPalace({ onClose, currentSessionId }) {
  const [memories, setMemories] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKeyword, setActiveKeyword] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formKeywords, setFormKeywords] = useState('');

  useEffect(() => {
    loadMemories();
    loadKeywords();
  }, []);

  const loadMemories = async (keyword) => {
    setLoading(true);
    try {
      let url = `${API_URL}/memories`;
      if (keyword) url += '?keyword=' + encodeURIComponent(keyword);
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.success) setMemories(data.data || []);
    } catch (err) {
      console.error('加载记忆失败:', err);
    }
    setLoading(false);
  };

  const loadKeywords = async () => {
    try {
      const resp = await fetch(`${API_URL}/memories/keywords`);
      const data = await resp.json();
      if (data.success) setKeywords(data.data || []);
    } catch (err) {
      console.error('加载关键词失败:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setActiveKeyword(null);
      loadMemories();
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/memories/search?q=` + encodeURIComponent(searchQuery));
      const data = await resp.json();
      if (data.success) setMemories(data.data || []);
    } catch (err) {
      console.error('搜索失败:', err);
    }
    setLoading(false);
  };

  const handleKeywordClick = (kw) => {
    if (activeKeyword === kw) {
      setActiveKeyword(null);
      loadMemories();
    } else {
      setActiveKeyword(kw);
      loadMemories(kw);
    }
  };

  const handleCompress = async () => {
    if (!currentSessionId) {
      alert('请先选择一个会话');
      return;
    }
    setCompressing(true);
    try {
      const resp = await fetch(`${API_URL}/memories/compress/${currentSessionId}`, {
        method: 'POST'
      });
      const data = await resp.json();
      if (data.success) {
        alert('压缩成功！生成记忆: ' + (data.data.title || '新记忆'));
        loadMemories();
        loadKeywords();
      } else {
        alert(data.error || '压缩失败');
      }
    } catch (err) {
      alert('请求失败: ' + err.message);
    }
    setCompressing(false);
  };

  const handleCreate = async () => {
    if (!formSummary.trim()) {
      alert('摘要不能为空');
      return;
    }
    try {
      const keywordsArr = formKeywords.split(/[,，\s]+/).filter(k => k.trim());
      const resp = await fetch(`${API_URL}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          summary: formSummary,
          keywords: keywordsArr
        })
      });
      const data = await resp.json();
      if (data.success) {
        setShowCreateForm(false);
        setFormTitle('');
        setFormSummary('');
        setFormKeywords('');
        loadMemories();
        loadKeywords();
      }
    } catch (err) {
      alert('创建失败: ' + err.message);
    }
  };

  const handleUpdate = async (id) => {
    try {
      const keywordsArr = formKeywords.split(/[,，\s]+/).filter(k => k.trim());
      const resp = await fetch(`${API_URL}/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          summary: formSummary,
          keywords: keywordsArr
        })
      });
      const data = await resp.json();
      if (data.success) {
        setEditingId(null);
        setFormTitle('');
        setFormSummary('');
        setFormKeywords('');
        loadMemories();
        loadKeywords();
      }
    } catch (err) {
      alert('更新失败: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条记忆吗？')) return;
    try {
      const resp = await fetch(`${API_URL}/memories/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        loadMemories();
        loadKeywords();
      }
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  };

  const startEdit = (memory) => {
    setEditingId(memory.id);
    setExpandedId(memory.id);
    setFormTitle(memory.title || '');
    setFormSummary(memory.summary || '');
    setFormKeywords((memory.keywords || []).join(', '));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormTitle('');
    setFormSummary('');
    setFormKeywords('');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="memory-palace">
      <div className="mp-header">
        <h2>🧠 记忆宫殿</h2>
        <button className="mp-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="mp-search">
        <input
          type="text"
          placeholder="输入关键词搜索记忆..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>搜索</button>
      </div>

      {keywords.length > 0 && (
        <div className="mp-keywords">
          {keywords.slice(0, 20).map(({ keyword, count }) => (
            <span
              key={keyword}
              className={`mp-keyword-tag ${activeKeyword === keyword ? 'active' : ''}`}
              onClick={() => handleKeywordClick(keyword)}
            >
              {keyword}
              <span className="mp-keyword-count">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mp-actions">
        <button className="mp-btn-compress" onClick={handleCompress} disabled={compressing}>
          {compressing ? '压缩中...' : '🗜️ 压缩当前对话'}
        </button>
        <button className="mp-btn-create" onClick={() => { setShowCreateForm(!showCreateForm); cancelEdit(); }}>
          ✏️ 手动添加
        </button>
      </div>

      {showCreateForm && (
        <div className="mp-form">
          <input
            type="text"
            placeholder="标题（可选，如：关于旅行的讨论）"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          <textarea
            placeholder="记忆摘要内容..."
            value={formSummary}
            onChange={(e) => setFormSummary(e.target.value)}
            rows={3}
          />
          <input
            type="text"
            placeholder="关键词（逗号或空格分隔，如：旅行, 计划, 夏天）"
            value={formKeywords}
            onChange={(e) => setFormKeywords(e.target.value)}
          />
          <div className="mp-form-btns">
            <button className="mp-form-save" onClick={handleCreate}>保存</button>
            <button className="mp-form-cancel" onClick={() => setShowCreateForm(false)}>取消</button>
          </div>
        </div>
      )}

      <div className="mp-list">
        {loading && <div className="mp-empty">加载中...</div>}
        {!loading && memories.length === 0 && (
          <div className="mp-empty">
            还没有记忆～<br />聊天后点击「压缩当前对话」生成第一条记忆
          </div>
        )}
        {memories.map(memory => (
          <div
            key={memory.id}
            className={`mp-card ${expandedId === memory.id ? 'expanded' : ''}`}
          >
            {editingId === memory.id ? (
              <div className="mp-form">
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="标题"
                />
                <textarea
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  rows={3}
                />
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="关键词（逗号分隔）"
                />
                <div className="mp-form-btns">
                  <button className="mp-form-save" onClick={() => handleUpdate(memory.id)}>保存</button>
                  <button className="mp-form-cancel" onClick={cancelEdit}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="mp-card-header"
                  onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                >
                  <span className="mp-card-title">{memory.title || '无标题记忆'}</span>
                  <span className="mp-card-date">{formatDate(memory.timestamp)}</span>
                </div>
                <div className="mp-card-summary">
                  {expandedId === memory.id
                    ? memory.summary
                    : (memory.summary || '').slice(0, 80) + ((memory.summary || '').length > 80 ? '...' : '')
                  }
                </div>
                {memory.keywords && memory.keywords.length > 0 && (
                  <div className="mp-card-tags">
                    {memory.keywords.map(kw => (
                      <span key={kw} className="mp-tag">{kw}</span>
                    ))}
                  </div>
                )}
                {expandedId === memory.id && (
                  <div className="mp-card-btns">
                    <button onClick={() => startEdit(memory)}>编辑</button>
                    <button className="mp-btn-del" onClick={() => handleDelete(memory.id)}>删除</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
