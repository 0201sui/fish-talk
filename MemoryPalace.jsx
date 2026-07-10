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
  const [merging, setMerging] = useState(false);

  const [activeTab, setActiveTab] = useState('memories');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [maxWords, setMaxWords] = useState(200);
  const [deleteAfterCompress, setDeleteAfterCompress] = useState(false);
  const [autoCompressRounds, setAutoCompressRounds] = useState(0);

  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formKeywords, setFormKeywords] = useState('');

  useEffect(() => {
    loadMemories();
    loadKeywords();
    loadCompressSettings();
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

  const loadCompressSettings = () => {
    const saved = localStorage.getItem('compressSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.maxWords) setMaxWords(parsed.maxWords);
        if (parsed.autoCompressRounds) setAutoCompressRounds(parsed.autoCompressRounds);
        if (parsed.deleteAfterCompress) setDeleteAfterCompress(parsed.deleteAfterCompress);
      } catch (e) {}
    }
  };

  const saveCompressSettings = (words, rounds, deleteAfter) => {
    localStorage.setItem('compressSettings', JSON.stringify({
      maxWords: words,
      autoCompressRounds: rounds,
      deleteAfterCompress: deleteAfter
    }));
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
    if (!currentSessionId) { alert('请先选择一个会话'); return; }
    setCompressing(true);
    try {
      const resp = await fetch(`${API_URL}/memories/compress/${currentSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_words: maxWords, delete_after: deleteAfterCompress })
      });
      const data = await resp.json();
      if (data.success) {
        let msg = '总结成功！生成记忆: ' + (data.data.title || '新记忆');
        msg += '\n处理了 ' + data.message_count + ' 条消息';
        if (data.deleted) msg += '\n已隐藏对应聊天记录';
        alert(msg);
        loadMemories();
        loadKeywords();
      } else {
        alert(data.error || '总结失败');
      }
    } catch (err) { alert('请求失败: ' + err.message); }
    setCompressing(false);
  };

  const handleDeleteSource = async (memoryId) => {
    if (!confirm('确定删除这条记忆对应的原始聊天记录吗？')) return;
    try {
      const resp = await fetch(`${API_URL}/memories/delete-source/${memoryId}`, { method: 'POST' });
      const data = await resp.json();
      if (data.success) alert('已隐藏 ' + data.deleted_count + ' 条聊天记录');
      else alert(data.error || '操作失败');
    } catch (err) { alert('请求失败: ' + err.message); }
  };

  const handleMerge = async () => {
    if (selectedIds.length < 2) { alert('请至少选择2条记忆'); return; }
    if (!confirm(`合并选中的 ${selectedIds.length} 条记忆？合并后原记忆会被删除。`)) return;
    setMerging(true);
    try {
      const resp = await fetch(`${API_URL}/memories/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory_ids: selectedIds, max_words: maxWords })
      });
      const data = await resp.json();
      if (data.success) {
        alert('合并成功！');
        setSelectedIds([]);
        loadMemories();
        loadKeywords();
      } else { alert(data.error || '合并失败'); }
    } catch (err) { alert('合并失败: ' + err.message); }
    setMerging(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!formSummary.trim()) { alert('摘要不能为空'); return; }
    try {
      const keywordsArr = formKeywords.split(/[,，\s]+/).filter(k => k.trim());
      const resp = await fetch(`${API_URL}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, summary: formSummary, keywords: keywordsArr })
      });
      const data = await resp.json();
      if (data.success) { setShowCreateForm(false); resetForm(); loadMemories(); loadKeywords(); }
    } catch (err) { alert('创建失败: ' + err.message); }
  };

  const handleUpdate = async (id) => {
    try {
      const keywordsArr = formKeywords.split(/[,，\s]+/).filter(k => k.trim());
      const resp = await fetch(`${API_URL}/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, summary: formSummary, keywords: keywordsArr })
      });
      const data = await resp.json();
      if (data.success) { setEditingId(null); resetForm(); loadMemories(); loadKeywords(); }
    } catch (err) { alert('更新失败: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除这条记忆吗？')) return;
    try {
      await fetch(`${API_URL}/memories/${id}`, { method: 'DELETE' });
      loadMemories();
      loadKeywords();
    } catch (err) { alert('删除失败: ' + err.message); }
  };

  const handleExportChat = async () => {
    if (!currentSessionId) { alert('请先选择一个会话'); return; }
    try {
      const resp = await fetch(`${API_URL}/export/chat/${currentSessionId}`);
      const data = await resp.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${data.data.session?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) { alert('导出失败: ' + err.message); }
  };

  const handleImportChat = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        const resp = await fetch(`${API_URL}/import/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importData)
        });
        const data = await resp.json();
        if (data.success) alert('导入成功！导入了 ' + data.imported_count + ' 条消息');
        else alert(data.error || '导入失败');
      } catch (err) { alert('导入失败: ' + err.message); }
    };
    input.click();
  };

  const handleExportMemories = async () => {
    try {
      const resp = await fetch(`${API_URL}/export/memories`);
      const data = await resp.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memories_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) { alert('导出失败: ' + err.message); }
  };

  const handleImportMemories = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        const resp = await fetch(`${API_URL}/import/memories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memories: importData.memories || importData })
        });
        const data = await resp.json();
        if (data.success) { alert('导入成功！导入了 ' + data.imported_count + ' 条记忆'); loadMemories(); loadKeywords(); }
        else alert(data.error || '导入失败');
      } catch (err) { alert('导入失败: ' + err.message); }
    };
    input.click();
  };

  const startEdit = (memory) => {
    setEditingId(memory.id);
    setExpandedId(memory.id);
    setFormTitle(memory.title || '');
    setFormSummary(memory.summary || '');
    setFormKeywords((memory.keywords || []).join(', '));
  };

  const resetForm = () => { setFormTitle(''); setFormSummary(''); setFormKeywords(''); };
  const cancelEdit = () => { setEditingId(null); resetForm(); };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleMaxWordsChange = (val) => {
    const v = parseInt(val);
    setMaxWords(v);
    saveCompressSettings(v, autoCompressRounds, deleteAfterCompress);
  };

  const handleAutoRoundsChange = (val) => {
    const v = parseInt(val);
    setAutoCompressRounds(v);
    saveCompressSettings(maxWords, v, deleteAfterCompress);
  };

  const handleDeleteAfterChange = (checked) => {
    setDeleteAfterCompress(checked);
    saveCompressSettings(maxWords, autoCompressRounds, checked);
  };

  return (
    <div className="memory-palace">
      {/* 顶栏 */}
      <div className="mp-header">
        <h2>记忆宫殿</h2>
        <button className="mp-close-btn" onClick={onClose}>×</button>
      </div>

      {/* 三个并排标签 */}
      <div className="mp-tabs">
        <button className={`mp-tab ${activeTab === 'memories' ? 'active' : ''}`} onClick={() => setActiveTab('memories')}>
          记忆
        </button>
        <button className={`mp-tab ${activeTab === 'compress' ? 'active' : ''}`} onClick={() => setActiveTab('compress')}>
          总结
        </button>
        <button className={`mp-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
          导入/导出
        </button>
      </div>

      {/* ===== 记忆页 ===== */}
      {activeTab === 'memories' && (
        <div className="mp-page">
          <div className="mp-search">
            <input
              type="text"
              placeholder="搜索关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch}>搜索</button>
          </div>

          {keywords.length > 0 && (
            <div className="mp-keywords">
              {keywords.slice(0, 20).map(({ keyword, count }) => (
                <span key={keyword} className={`mp-keyword-tag ${activeKeyword === keyword ? 'active' : ''}`} onClick={() => handleKeywordClick(keyword)}>
                  {keyword}<span className="mp-keyword-count">{count}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mp-memory-toolbar">
            <button className="mp-btn-add" onClick={() => { setShowCreateForm(!showCreateForm); cancelEdit(); }}>
              手动添加
            </button>
            {selectedIds.length >= 2 && (
              <button className="mp-btn-merge" onClick={handleMerge} disabled={merging}>
                {merging ? '合并中...' : `合并(${selectedIds.length})`}
              </button>
            )}
            {selectedIds.length > 0 && (
              <button className="mp-btn-cancel-sel" onClick={() => setSelectedIds([])}>取消选择</button>
            )}
          </div>

          {showCreateForm && (
            <div className="mp-form-inline">
              <input type="text" placeholder="标题（可选）" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <textarea placeholder="记忆摘要..." value={formSummary} onChange={(e) => setFormSummary(e.target.value)} rows={3} />
              <input type="text" placeholder="关键词（逗号分隔）" value={formKeywords} onChange={(e) => setFormKeywords(e.target.value)} />
              <div className="mp-form-btns">
                <button className="mp-form-save" onClick={handleCreate}>保存</button>
                <button className="mp-form-cancel" onClick={() => setShowCreateForm(false)}>取消</button>
              </div>
            </div>
          )}

          {/* 记忆列表 */}
          <div className="mp-memory-list">
            {loading && <p className="mp-hint">加载中...</p>}
            {!loading && memories.length === 0 && <p className="mp-hint">还没有记忆，去「总结」生成一些吧</p>}
            {memories.map(memory => (
              <div key={memory.id} className={`mp-memory-item ${selectedIds.includes(memory.id) ? 'selected' : ''}`}>
                {editingId === memory.id ? (
                  <div className="mp-form-inline">
                    <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="标题" />
                    <textarea value={formSummary} onChange={(e) => setFormSummary(e.target.value)} rows={3} />
                    <input type="text" value={formKeywords} onChange={(e) => setFormKeywords(e.target.value)} placeholder="关键词（逗号分隔）" />
                    <div className="mp-form-btns">
                      <button className="mp-form-save" onClick={() => handleUpdate(memory.id)}>保存</button>
                      <button className="mp-form-cancel" onClick={cancelEdit}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mp-memory-header" onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}>
                      <div className="mp-memory-left">
                        <input
                          type="checkbox"
                          className="mp-checkbox"
                          checked={selectedIds.includes(memory.id)}
                          onChange={() => toggleSelect(memory.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={`mp-arrow-sm ${expandedId === memory.id ? 'open' : ''}`}>›</span>
                        <span className="mp-memory-title">{memory.title || '无标题'}</span>
                      </div>
                      <span className="mp-memory-date">{formatDate(memory.timestamp)}</span>
                    </div>

                    {expandedId === memory.id && (
                      <div className="mp-memory-body">
                        <p className="mp-memory-summary">{memory.summary}</p>
                        {memory.keywords && memory.keywords.length > 0 && (
                          <div className="mp-memory-tags">
                            {memory.keywords.map(kw => <span key={kw} className="mp-tag">{kw}</span>)}
                          </div>
                        )}
                        <div className="mp-memory-actions">
                          <button onClick={() => startEdit(memory)}>编辑</button>
                          <button onClick={() => handleDeleteSource(memory.id)}>删原始记录</button>
                          <button className="mp-btn-del" onClick={() => handleDelete(memory.id)}>删除</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 总结页 ===== */}
      {activeTab === 'compress' && (
        <div className="mp-page">
          <div className="mp-compress-panel">
            <div className="mp-field">
              <label>总结字数上限：<b>{maxWords}</b> 字</label>
              <input
                type="range"
                min="50"
                max="800"
                step="1"
                value={maxWords}
                onChange={(e) => handleMaxWordsChange(e.target.value)}
                className="mp-slider"
              />
              <div className="mp-slider-labels">
                <span>50 字</span>
                <span>800 字</span>
              </div>
            </div>

            <div className="mp-field">
              <label>自动总结：<b>{autoCompressRounds === 0 ? '关闭（手动）' : `每 ${autoCompressRounds} 轮`}</b></label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={autoCompressRounds}
                onChange={(e) => handleAutoRoundsChange(e.target.value)}
                className="mp-slider"
              />
              <div className="mp-slider-labels">
                <span>关闭</span>
                <span>100 轮</span>
              </div>
              <p className="mp-hint">
                {autoCompressRounds === 0
                  ? '手动模式：你自己决定什么时候总结'
                  : `每聊 ${autoCompressRounds} 轮自动总结，不会重复已处理内容`}
              </p>
            </div>

            <label className="mp-checkbox-label">
              <input type="checkbox" checked={deleteAfterCompress} onChange={(e) => handleDeleteAfterChange(e.target.checked)} />
              总结后删除对应聊天记录
            </label>

            <button className="mp-btn-compress-main" onClick={handleCompress} disabled={compressing || !currentSessionId}>
              {compressing ? '总结中，请等待...' : '手动总结当前对话'}
            </button>
            {!currentSessionId && <p className="mp-hint">请先在聊天页面选择一个会话</p>}
          </div>
        </div>
      )}

      {/* ===== 导入导出页 ===== */}
      {activeTab === 'data' && (
        <div className="mp-page">
          <div className="mp-data-panel">
            <div className="mp-data-group">
              <h4>聊天记录</h4>
              <div className="mp-data-btns">
                <button onClick={handleExportChat} disabled={!currentSessionId}>导出当前会话</button>
                <button onClick={handleImportChat}>导入聊天记录</button>
              </div>
              {!currentSessionId && <p className="mp-hint">导出需先选择一个会话</p>}
            </div>

            <div className="mp-data-group">
              <h4>记忆数据</h4>
              <div className="mp-data-btns">
                <button onClick={handleExportMemories}>导出所有记忆</button>
                <button onClick={handleImportMemories}>导入记忆</button>
              </div>
            </div>

            <p className="mp-hint">导出为 JSON 文件，可备份或迁移到其他设备。</p>
          </div>
        </div>
      )}
    </div>
  );
}
