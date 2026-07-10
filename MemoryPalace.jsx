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

  // 手风琴展开状态
  const [openSection, setOpenSection] = useState(null);

  // 记忆相关
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // 压缩设置
  const [maxWords, setMaxWords] = useState(200);
  const [deleteAfterCompress, setDeleteAfterCompress] = useState(false);

  // 表单
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

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="memory-palace">
      <div className="mp-header">
        <h2>记忆宫殿</h2>
        <button className="mp-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="mp-body">

        {/* ===== 板块一：总结 ===== */}
        <div className="mp-section">
          <div className="mp-section-btn" onClick={() => toggleSection('compress')}>
            <span className="mp-section-title">总结</span>
            <span className={`mp-arrow ${openSection === 'compress' ? 'open' : ''}`}>›</span>
          </div>

          {openSection === 'compress' && (
            <div className="mp-section-content">
              {/* 压缩控制 */}
              <div className="mp-compress-controls">
                <div className="mp-field">
                  <label>总结字数上限</label>
                  <div className="mp-word-options">
                    {[100, 150, 200, 300, 500].map(n => (
                      <button key={n} className={`mp-word-btn ${maxWords === n ? 'active' : ''}`} onClick={() => setMaxWords(n)}>
                        {n}字
                      </button>
                    ))}
                  </div>
                </div>

                <label className="mp-checkbox-label">
                  <input type="checkbox" checked={deleteAfterCompress} onChange={(e) => setDeleteAfterCompress(e.target.checked)} />
                  总结后删除对应聊天记录
                </label>

                <button className="mp-btn-compress-main" onClick={handleCompress} disabled={compressing || !currentSessionId}>
                  {compressing ? '总结中...' : '开始总结当前对话'}
                </button>
                {!currentSessionId && <p className="mp-hint">请先在聊天页面选择一个会话</p>}
              </div>

              {/* 已总结的记忆列表 */}
              {memories.length > 0 && (
                <div className="mp-summary-list">
                  <div className="mp-summary-list-header">
                    <span>已总结的内容 ({memories.length})</span>
                    {selectedIds.length >= 2 && (
                      <button className="mp-btn-merge" onClick={handleMerge} disabled={merging}>
                        {merging ? '合并中...' : `合并(${selectedIds.length})`}
                      </button>
                    )}
                  </div>
                  {memories.map(memory => (
                    <div key={memory.id} className={`mp-memory-item ${expandedId === memory.id ? 'expanded' : ''} ${selectedIds.includes(memory.id) ? 'selected' : ''}`}>
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
                              <span className="mp-memory-title">{memory.title || '无标题'}</span>
                            </div>
                            <div className="mp-memory-right">
                              <span className="mp-memory-date">{formatDate(memory.timestamp)}</span>
                              <span className={`mp-arrow-sm ${expandedId === memory.id ? 'open' : ''}`}>›</span>
                            </div>
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
              )}
            </div>
          )}
        </div>

        {/* ===== 板块二：记忆 ===== */}
        <div className="mp-section">
          <div className="mp-section-btn" onClick={() => toggleSection('memories')}>
            <span className="mp-section-title">记忆</span>
            <span className={`mp-arrow ${openSection === 'memories' ? 'open' : ''}`}>›</span>
          </div>

          {openSection === 'memories' && (
            <div className="mp-section-content">
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

              <button className="mp-btn-add" onClick={() => { setShowCreateForm(!showCreateForm); cancelEdit(); }}>
                手动添加记忆
              </button>

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

              {loading && <p className="mp-hint">加载中...</p>}
              {!loading && memories.length === 0 && <p className="mp-hint">还没有记忆，先去总结一些对话吧</p>}
            </div>
          )}
        </div>

        {/* ===== 板块三：导入/导出 ===== */}
        <div className="mp-section">
          <div className="mp-section-btn" onClick={() => toggleSection('data')}>
            <span className="mp-section-title">导入 / 导出</span>
            <span className={`mp-arrow ${openSection === 'data' ? 'open' : ''}`}>›</span>
          </div>

          {openSection === 'data' && (
            <div className="mp-section-content">
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

              <p className="mp-hint">导出为 JSON 文件，可用于备份或迁移。</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
