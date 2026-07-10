import { useState } from 'react';
import './ApiConfig.css';

const API_URL = 'https://my-home-backend-9j56.onrender.com';

function loadData() {
  try {
    const saved = localStorage.getItem('apiProviders');
    if (!saved) return { providers: [], activeId: null };
    return JSON.parse(saved);
  } catch {
    return { providers: [], activeId: null };
  }
}

function saveData(data) {
  localStorage.setItem('apiProviders', JSON.stringify(data));
}

export default function ApiConfig({ onClose, onConfigChange }) {
  const [data, setData] = useState(loadData);
  const [form, setForm] = useState({ name: '', baseUrl: '', apiKey: '', modelsInput: '' });
  const [testStatus, setTestStatus] = useState({});
  const [testMsg, setTestMsg] = useState({});
  const [newModelInput, setNewModelInput] = useState({});

  const persist = (next) => {
    setData(next);
    saveData(next);
    onConfigChange && onConfigChange();
  };

  const addProvider = () => {
    const name = form.name.trim();
    const baseUrl = form.baseUrl.trim();
    const apiKey = form.apiKey.trim();
    const models = form.modelsInput.split(',').map(s => s.trim()).filter(Boolean);
    if (!name || !baseUrl || !apiKey) {
      alert('名称、Base URL 和 API Key 都不能为空');
      return;
    }
    const newProvider = { id: Date.now().toString(), name, baseUrl, apiKey, models };
    const next = {
      providers: [...data.providers, newProvider],
      activeId: data.activeId || newProvider.id,
    };
    persist(next);
    setForm({ name: '', baseUrl: '', apiKey: '', modelsInput: '' });
  };

  const deleteProvider = (id) => {
    if (!confirm('确定删除这个提供商吗？')) return;
    const nextProviders = data.providers.filter(p => p.id !== id);
    const nextActiveId = data.activeId === id ? (nextProviders[0]?.id || null) : data.activeId;
    persist({ providers: nextProviders, activeId: nextActiveId });
  };

  const setActive = (id) => persist({ ...data, activeId: id });

  const testConnection = async (provider) => {
    const firstModel = provider.models[0];
    if (!firstModel) {
      setTestStatus(s => ({ ...s, [provider.id]: 'fail' }));
      setTestMsg(m => ({ ...m, [provider.id]: '请先添加至少一个模型名' }));
      return;
    }
    setTestStatus(s => ({ ...s, [provider.id]: 'loading' }));
    setTestMsg(m => ({ ...m, [provider.id]: '' }));
    try {
      const res = await fetch(`${API_URL}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: provider.baseUrl, api_key: provider.apiKey, model: firstModel }),
      });
      const result = await res.json();
      if (result.success) {
        setTestStatus(s => ({ ...s, [provider.id]: 'ok' }));
        setTestMsg(m => ({ ...m, [provider.id]: '连接成功' }));
      } else {
        setTestStatus(s => ({ ...s, [provider.id]: 'fail' }));
        setTestMsg(m => ({ ...m, [provider.id]: result.error || '连接失败' }));
      }
    } catch (err) {
      setTestStatus(s => ({ ...s, [provider.id]: 'fail' }));
      setTestMsg(m => ({ ...m, [provider.id]: '网络错误: ' + err.message }));
    }
  };

  const addModelToProvider = (providerId) => {
    const val = (newModelInput[providerId] || '').trim();
    if (!val) return;
    persist({
      ...data,
      providers: data.providers.map(p =>
        p.id === providerId ? { ...p, models: [...(p.models || []), val] } : p
      ),
    });
    setNewModelInput(s => ({ ...s, [providerId]: '' }));
  };

  const removeModel = (providerId, model) => {
    persist({
      ...data,
      providers: data.providers.map(p =>
        p.id === providerId ? { ...p, models: p.models.filter(m => m !== model) } : p
      ),
    });
  };

  // 关键：inline style 强制 fixed 全屏，防止父容器 transform 导致 fixed 失效
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #0a1628, #0f2035)',
    color: '#e0e8f0',
  };

  return (
    <div style={overlayStyle}>
      <div className="apicfg-top">
        <h2>API 配置</h2>
        <button className="apicfg-close" onClick={onClose}>✕</button>
      </div>

      <div className="apicfg-scroll">

        {/* 已有提供商 */}
        {data.providers.length > 0 && (
          <div className="apicfg-section">
            <p className="apicfg-section-label">已添加的提供商</p>
            {data.providers.map(p => (
              <div key={p.id} className={`apicfg-card ${data.activeId === p.id ? 'apicfg-card-active' : ''}`}>

                <div className="apicfg-card-header">
                  <div className="apicfg-card-info">
                    <span className="apicfg-card-name">{p.name}</span>
                    <span className="apicfg-card-url">{p.baseUrl}</span>
                  </div>
                  <div className="apicfg-card-actions">
                    {data.activeId === p.id
                      ? <span className="apicfg-badge">使用中</span>
                      : <button className="apicfg-btn-outline" onClick={() => setActive(p.id)}>切换</button>
                    }
                    <button
                      className="apicfg-btn-outline"
                      onClick={() => testConnection(p)}
                      disabled={testStatus[p.id] === 'loading'}
                    >
                      {testStatus[p.id] === 'loading' ? '测试中...' : '测试'}
                    </button>
                    <button className="apicfg-btn-danger" onClick={() => deleteProvider(p.id)}>删除</button>
                  </div>
                </div>

                {testMsg[p.id] && (
                  <p className={`apicfg-msg ${testStatus[p.id] === 'ok' ? 'apicfg-msg-ok' : 'apicfg-msg-fail'}`}>
                    {testMsg[p.id]}
                  </p>
                )}

                <div className="apicfg-models">
                  <span className="apicfg-models-title">模型列表</span>
                  <div className="apicfg-tags">
                    {(p.models || []).length === 0 && (
                      <span className="apicfg-empty">还没有模型，在下方添加</span>
                    )}
                    {(p.models || []).map(m => (
                      <span key={m} className="apicfg-tag">
                        {m}
                        <button onClick={() => removeModel(p.id, m)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="apicfg-model-add">
                    <input
                      className="apicfg-input"
                      placeholder="输入模型名，回车添加"
                      value={newModelInput[p.id] || ''}
                      onChange={e => setNewModelInput(s => ({ ...s, [p.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addModelToProvider(p.id); }}
                    />
                    <button className="apicfg-btn-small" onClick={() => addModelToProvider(p.id)}>添加</button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* 添加新提供商 */}
        <div className="apicfg-section">
          <p className="apicfg-section-label">添加新提供商</p>
          <div className="apicfg-form">
            <div className="apicfg-field">
              <label>名称</label>
              <input className="apicfg-input" placeholder="如：OpenAI、我的中转站"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="apicfg-field">
              <label>Base URL</label>
              <input className="apicfg-input" placeholder="如：https://api.openai.com"
                value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
            </div>
            <div className="apicfg-field">
              <label>API Key</label>
              <input className="apicfg-input" type="password" placeholder="sk-..."
                value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
            </div>
            <div className="apicfg-field">
              <label>模型（逗号分隔，可留空后续添加）</label>
              <input className="apicfg-input" placeholder="如：gpt-4o, gpt-3.5-turbo"
                value={form.modelsInput} onChange={e => setForm(f => ({ ...f, modelsInput: e.target.value }))} />
            </div>
            <button className="apicfg-btn-primary" onClick={addProvider}>添加提供商</button>
          </div>
        </div>

      </div>
    </div>
  );
}
