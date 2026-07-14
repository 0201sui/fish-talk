import { useState, useEffect } from 'react';
import './MemoryPalace.css';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

export default function MemoryPalace({ onClose, currentSessionId }) {
  const [memories, setMemories] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKeyword, setActiveKeyword] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [merging, setMerging] = useState(false);

  const [openSection, setOpenSection] = useState(null);
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
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadKeywords = async () => {
    try {
      const resp = await fetch(`${API_URL}/memories/keywords`);
      const data = await resp.json();
      if (data.success) setKeywords(data.data || []);
    } catch (err) { console.error(err); }
  };

  const loadCompressSettings = () => {
    const saved = localStorage.getItem('compressSettings');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.maxWords) setMaxWords(p.maxWords);
        if (p.autoCompressRounds) setAutoCompressRounds(p.autoCompressRounds);
        if (p.deleteAfterCompress) setDeleteAfterCompress(p.deleteAfterCompress);
      } catch (e) {}
    }
  };

  const saveCS = (w, r, d) => {
    localStorage.setItem('compressSettings', JSON.stringify({ maxWords: w, autoCompressRounds: r, deleteAfterCompress: d }));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setActiveKeyword(null); loadMemories(); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/memories/search?q=` + encodeURIComponent(searchQuery));
      const data = await resp.json();
      if (data.success) setMemories(data.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleKeywordClick = (kw) => {
    if (activeKeyword === kw) { setActiveKeyword(null); loadMemories(); }
    else { setActiveKeyword(kw); loadMemories(kw); }
  };

  const handleCompress = async () => {
    if (!currentSessionId) { alert('请先选择一个会话'); return; }
    setCompressing(true);
    try {
      const resp = await fetch(`${API_URL}/memories/compress/${currentSessionId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_words: maxWords, delete_after: deleteAfterCompress })
      });
      const data = await resp.json();
      if (data.success) {
        alert('总结成功！' + (data.data.title || '') + '\n处理了 ' + data.message_count + ' 条消息' + (data.deleted ? '\n已隐藏对应聊天记录' : ''));
        loadMemories(); loadKeywords();
      } else { alert(data.error || '总结失败'); }
    } catch (err) { alert('请求失败: ' + err.message); }
    setCompressing(false);
  };

  const handleDeleteSource = async (memoryId) => {
    if (!confirm('确定删除对应的原始聊天记录吗？')) return;
    try {
      const resp = await fetch(`${API_URL}/memories/delete-source/${memoryId}`, { method: 'POST' });
      const data = await resp.json();
      if (data.success) alert('已隐藏 ' + data.deleted_count + ' 条聊天记录');
      else alert(data.error || '操作失败');
    } catch (err) { alert(err.message); }
  };

  const handleMerge = async () => {
    if (selectedIds.length < 2) { alert('请至少选择2条记忆'); return; }
    if (!confirm(`合并 ${selectedIds.length} 条记忆？原记忆会被删除。`)) return;
    setMerging(true);
    try {
      const resp = await fetch(`${API_URL}/memories/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory_ids: selectedIds, max_words: maxWords })
      });
      const data = await resp.json();
      if (data.success) { alert('合并成功！'); setSelectedIds([]); loadMemories(); loadKeywords(); }
      else { alert(data.error || '合并失败'); }
    } catch (err) { alert(err.message); }
    setMerging(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!formSummary.trim()) { alert('摘要不能为空'); return; }
    try {
      const kArr = formKeywords.split(/[,，\s]+/).filter(k => k.trim());
      const resp = await fetch(`${API_URL}/memories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, summary: formSummary, keywords: kArr })
      });
      const data = await resp.json();
      if (data.success) { setShowCreateForm(false); resetForm(); loadMemories(); loadKeywords(); }
    } catch (err) { alert(err.message); }
  };

  const handleUpdate = async (id) => {
    try {
      const kArr = formKeywords.split(/[,，\s]+/).filter(k => k.trim());
      const resp = await fetch(`${API_URL}/memories/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, summary: formSummary, keywords: kArr })
      });
      const data = await resp.json();
      if (data.success) { setEditingId(null); resetForm(); loadMemories(); loadKeywords(); }
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除这条记忆吗？')) return;
    try { await fetch(`${API_URL}/memories/${id}`, { method: 'DELETE' }); loadMemories(); loadKeywords(); }
    catch (err) { alert(err.message); }
  };

  const handleExportChat = async () => {
    if (!currentSessionId) { alert('请先选择一个会话'); return; }
    try {
      const resp = await fetch(`${API_URL}/export/chat/${currentSessionId}`);
      const data = await resp.json();
      if (data.success) { dl(JSON.stringify(data.data, null, 2), `chat_${data.data.session?.name || 'export'}_${today()}.json`); }
    } catch (err) { alert(err.message); }
  };

  const handleImportChat = () => {
    pickFile(async (text) => {
      const importData = JSON.parse(text);
      const resp = await fetch(`${API_URL}/import/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importData)
      });
      const data = await resp.json();
      if (data.success) alert('导入成功！' + data.imported_count + ' 条消息');
      else alert(data.error || '导入失败');
    });
  };

  const handleExportMemories = async () => {
    try {
      const resp = await fetch(`${API_URL}/export/memories`);
      const data = await resp.json();
      if (data.success) { dl(JSON.stringify(data.data, null, 2), `memories_${today()}.json`); }
    } catch (err) { alert(err.message); }
  };

  const handleImportMemories = () => {
    pickFile(async (text) => {
      const importData = JSON.parse(text);
      const resp = await fetch(`${API_URL}/import/memories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories: importData.memories || importData })
      });
      const data = await resp.json();
      if (data.success) { alert('导入成功！' + data.imported_count + ' 条记忆'); loadMemories(); loadKeywords(); }
      else alert(data.error || '导入失败');
    });
  };

  const dl = (content, filename) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const pickFile = (callback) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { callback(await file.text()); } catch (err) { alert('文件读取失败: ' + err.message); }
    };
    input.click();
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const startEdit = (m) => { setEditingId(m.id); setExpandedId(m.id); setFormTitle(m.title || ''); setFormSummary(m.summary || ''); setFormKeywords((m.keywords || []).join(', ')); };
  const resetForm = () => { setFormTitle(''); setFormSummary(''); setFormKeywords(''); };
  const cancelEdit = () => { setEditingId(null); resetForm(); };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const toggle = (s) => setOpenSection(openSection === s ? null : s);

  return (
    <div className="mp" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
      <div className="mp-top">
        <h2>记忆宫殿</h2>
        <button className="mp-x" onClick={onClose}>×</button>
      </div>

      <div className="mp-scroll">

        {/* ========== 记忆 ========== */}
        <div className="mp-block">
          <div className="mp-block-btn" onClick={() => toggle('mem')}>
            <span>记忆</span>
            <span className={`mp-arr ${openSection === 'mem' ? 'open' : ''}`}>▸</span>
          </div>
          {openSection === 'mem' && (
            <div className="mp-block-body">
              <div className="mp-search">
                <input placeholder="搜索关键词..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch}>搜索</button>
              </div>

              {keywords.length > 0 && (
                <div className="mp-kw-wrap">
                  {keywords.slice(0,20).map(({keyword,count}) => (
                    <span key={keyword} className={`mp-kw ${activeKeyword===keyword?'on':''}`} onClick={() => handleKeywordClick(keyword)}>
                      {keyword}<span className="mp-kw-n">{count}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="mp-toolbar">
                <button className="mp-btn-outline" onClick={() => { setShowCreateForm(!showCreateForm); cancelEdit(); }}>手动添加</button>
                {selectedIds.length >= 2 && <button className="mp-btn-green" onClick={handleMerge} disabled={merging}>{merging ? '合并中...' : `合并(${selectedIds.length})`}</button>}
                {selectedIds.length > 0 && <button className="mp-btn-ghost" onClick={() => setSelectedIds([])}>取消选择</button>}
              </div>

              {showCreateForm && (
                <div className="mp-form">
                  <input placeholder="标题（可选）" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                  <textarea placeholder="记忆摘要..." value={formSummary} onChange={e => setFormSummary(e.target.value)} rows={3} />
                  <input placeholder="关键词（逗号分隔）" value={formKeywords} onChange={e => setFormKeywords(e.target.value)} />
                  <div className="mp-form-act"><button className="mp-btn-pri" onClick={handleCreate}>保存</button><button className="mp-btn-ghost" onClick={() => setShowCreateForm(false)}>取消</button></div>
                </div>
              )}

              {loading && <p className="mp-note">加载中...</p>}
              {!loading && memories.length === 0 && <p className="mp-note">还没有记忆，去总结一些对话吧</p>}

              <div className="mp-item-list">
                {memories.map(m => (
                  <div key={m.id} className={`mp-item ${selectedIds.includes(m.id)?'sel':''}`}>
                    {editingId === m.id ? (
                      <div className="mp-form">
                        <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="标题" />
                        <textarea value={formSummary} onChange={e => setFormSummary(e.target.value)} rows={3} />
                        <input value={formKeywords} onChange={e => setFormKeywords(e.target.value)} placeholder="关键词" />
                        <div className="mp-form-act"><button className="mp-btn-pri" onClick={() => handleUpdate(m.id)}>保存</button><button className="mp-btn-ghost" onClick={cancelEdit}>取消</button></div>
                      </div>
                    ) : (
                      <>
                        <div className="mp-item-head" onClick={() => setExpandedId(expandedId===m.id?null:m.id)}>
                          <div className="mp-item-left">
                            <input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => toggleSelect(m.id)} onClick={e => e.stopPropagation()} />
                            <span className={`mp-arr-s ${expandedId===m.id?'open':''}`}>▸</span>
                            <span className="mp-item-title">{m.title || '无标题'}</span>
                          </div>
                          <span className="mp-item-date">{formatDate(m.timestamp)}</span>
                        </div>
                        {expandedId === m.id && (
                          <div className="mp-item-body">
                            <p>{m.summary}</p>
                            {m.keywords && m.keywords.length > 0 && (
                              <div className="mp-tags">{m.keywords.map(k => <span key={k} className="mp-tag">{k}</span>)}</div>
                            )}
                            <div className="mp-item-act">
                              <button onClick={() => startEdit(m)}>编辑</button>
                              <button onClick={() => handleDeleteSource(m.id)}>删原始记录</button>
                              <button className="mp-del" onClick={() => handleDelete(m.id)}>删除</button>
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
        </div>

        {/* ========== 总结 ========== */}
        <div className="mp-block">
          <div className="mp-block-btn" onClick={() => toggle('comp')}>
            <span>总结</span>
            <span className={`mp-arr ${openSection === 'comp' ? 'open' : ''}`}>▸</span>
          </div>
          {openSection === 'comp' && (
            <div className="mp-block-body">
              <div className="mp-field">
                <label>总结字数上限：<b>{maxWords}</b> 字</label>
                <input type="range" min="50" max="800" step="1" value={maxWords} onChange={e => { setMaxWords(+e.target.value); saveCS(+e.target.value, autoCompressRounds, deleteAfterCompress); }} className="mp-range" />
                <div className="mp-range-lab"><span>50 字</span><span>800 字</span></div>
              </div>
              <div className="mp-field">
                <label>自动总结：<b>{autoCompressRounds === 0 ? '关闭' : `每 ${autoCompressRounds} 轮`}</b></label>
                <input type="range" min="0" max="100" step="5" value={autoCompressRounds} onChange={e => { setAutoCompressRounds(+e.target.value); saveCS(maxWords, +e.target.value, deleteAfterCompress); }} className="mp-range" />
                <div className="mp-range-lab"><span>关闭</span><span>100 轮</span></div>
                <p className="mp-note">{autoCompressRounds === 0 ? '手动模式，需要你自己点按钮触发' : `每聊 ${autoCompressRounds} 轮自动总结，不重复处理`}</p>
              </div>
              <label className="mp-check">
                <input type="checkbox" checked={deleteAfterCompress} onChange={e => { setDeleteAfterCompress(e.target.checked); saveCS(maxWords, autoCompressRounds, e.target.checked); }} />
                总结后删除对应聊天记录
              </label>
              <button className="mp-btn-big" onClick={handleCompress} disabled={compressing || !currentSessionId}>
                {compressing ? '总结中...' : '手动总结当前对话'}
              </button>
              {!currentSessionId && <p className="mp-note">请先在聊天页面选择一个会话</p>}
            </div>
          )}
        </div>

        {/* ========== 导入/导出 ========== */}
        <div className="mp-block">
          <div className="mp-block-btn" onClick={() => toggle('data')}>
            <span>导入 / 导出</span>
            <span className={`mp-arr ${openSection === 'data' ? 'open' : ''}`}>▸</span>
          </div>
          {openSection === 'data' && (
            <div className="mp-block-body">
              <div className="mp-data-sec">
                <h4>聊天记录</h4>
                <div className="mp-data-row">
                  <button onClick={handleExportChat} disabled={!currentSessionId}>导出当前会话</button>
                  <button onClick={handleImportChat}>导入聊天记录</button>
                </div>
                {!currentSessionId && <p className="mp-note">导出需先选择一个会话</p>}
              </div>
              <div className="mp-data-sec">
                <h4>记忆数据</h4>
                <div className="mp-data-row">
                  <button onClick={handleExportMemories}>导出所有记忆</button>
                  <button onClick={handleImportMemories}>导入记忆</button>
                </div>
              </div>
              <p className="mp-note">导出为 JSON 文件，可备份或迁移。</p>
            </div>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}
