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
        body: JSON.stringify({
          base_url: provider.baseUrl,
          api_key: provider.apiKey,
          model: firstModel,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setTestStatus(s => ({ ...s, [provider.id]: 'ok' }));
        setTestMsg(m => ({ ...m, [provider.id]: '连接成功 ✓' }));
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
    const next = {
      ...data,
      providers: data.providers.map(p =>
        p.id === providerId ? { ...p, models: [...(p.models || []), val] } : p
      ),
    };
    persist(next);
    setNewModelInput(s => ({ ...s, [providerId]: '' }));
  };

  const removeModel = (providerId, model) => {
    const next = {
      ...data,
      providers: data.providers.map(p =>
        p.id === providerId ? { ...p, models: p.models.filter(m => m !== model) } : p
      ),
    };
    persist(next);
  };

  return (
    <div className="ac-overlay" onClick={onClose}>
      <div className="ac-modal" onClick={e => e.stopPropagation()}>

        <div className="ac-header">
          <h2>🔑 API 配置</h2>
          <button className="ac-close" onClick={onClose}>×</button>
        </div>

        <div className="ac-body">

          {data.providers.length > 0 && (
            <div className="ac-section">
              <p className="ac-section-label">已添加的提供商</p>
              {data.providers.map(p => (
                <div key={p.id} className={`ac-card ${data.activeId === p.id ? 'ac-card-active' : ''}`}>

                  <div className="ac-card-top">
                    <div className="ac-card-info">
                      <span className="ac-card-name">{p.name}</span>
                      <span className="ac-card-url">{p.baseUrl}</span>
                    </div>
                    <div className="ac-card-btns">
                      {data.activeId === p.id
                        ? <span className="ac-badge">使用中</span>
                        : <button className="ac-btn ac-btn-use" onClick={() => setActive(p.id)}>切换</button>
                      }
                      <button
                        className="ac-btn ac-btn-test"
                        onClick={() => testConnection(p)}
                        disabled={testStatus[p.id] === 'loading'}
                      >
                        {testStatus[p.id] === 'loading' ? '测试中…' : '测试'}
                      </button>
                      <button className="ac-btn ac-btn-del" onClick={() => deleteProvider(p.id)}>删除</button>
                    </div>
                  </div>

                  {testMsg[p.id] && (
                    <div className={`ac-test-msg ${testStatus[p.id] === 'ok' ? 'ac-ok' : 'ac-fail'}`}>
                      {testMsg[p.id]}
                    </div>
                  )}

                  <div className="ac-models-area">
                    <span className="ac-models-title">模型列表</span>
                    <div className="ac-tags">
                      {(p.models || []).length === 0 && (
                        <span className="ac-no-model">还没有模型，在下方添加</span>
                      )}
                      {(p.models || []).map(m => (
                        <span key={m} className="ac-tag">
                          {m}
                          <button onClick={() => removeModel(p.id, m)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="ac-add-model">
                      <input
                        className="ac-input"
                        placeholder="输入模型名，如 gpt-4o，回车添加"
                        value={newModelInput[p.id] || ''}
                        onChange={e => setNewModelInput(s => ({ ...s, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addModelToProvider(p.id); }}
                      />
                      <button className="ac-btn ac-btn-add" onClick={() => addModelToProvider(p.id)}>添加</button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          <div className="ac-section">
            <p className="ac-section-label">添加新提供商</p>
            <div className="ac-form">
              <div className="ac-field">
                <label>名称</label>
                <input className="ac-input" placeholder="如：OpenAI、我的中转站"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="ac-field">
                <label>Base URL</label>
                <input className="ac-input" placeholder="如：https://api.openai.com"
                  value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
              </div>
              <div className="ac-field">
                <label>API Key</label>
                <input className="ac-input" type="password" placeholder="sk-..."
                  value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
              </div>
              <div className="ac-field">
                <label>模型（逗号分隔，可留空后续添加）</label>
                <input className="ac-input" placeholder="如：gpt-4o, gpt-3.5-turbo"
                  value={form.modelsInput} onChange={e => setForm(f => ({ ...f, modelsInput: e.target.value }))} />
              </div>
              <button className="ac-btn-submit" onClick={addProvider}>＋ 添加提供商</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
