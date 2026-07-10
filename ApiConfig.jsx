import { useState, useEffect } from 'react';
import './ApiConfig.css';

const API_URL = 'https://my-home-backend-9j56.onrender.com';

function loadProviders() {
  try {
    const saved = localStorage.getItem('apiProviders');
    if (!saved) return { providers: [], activeId: null };
    return JSON.parse(saved);
  } catch {
    return { providers: [], activeId: null };
  }
}

function saveProviders(data) {
  localStorage.setItem('apiProviders', JSON.stringify(data));
}

export default function ApiConfig({ onClose, onConfigChange }) {
  const [data, setData] = useState(loadProviders);

  // 新增提供商的表单状态
  const [form, setForm] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelsInput: '',
  });

  // 编辑状态
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // 测试状态：key = providerId, value = 'idle'|'loading'|'ok'|'fail'
  const [testStatus, setTestStatus] = useState({});
  const [testMsg, setTestMsg] = useState({});

  // 手动添加模型输入（每个provider独立）
  const [newModelInput, setNewModelInput] = useState({});

  const persist = (next) => {
    setData(next);
    saveProviders(next);
    onConfigChange && onConfigChange();
  };

  // 添加新提供商
  const addProvider = () => {
    const name = form.name.trim();
    const baseUrl = form.baseUrl.trim();
    const apiKey = form.apiKey.trim();
    const models = form.modelsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!name || !baseUrl || !apiKey) {
      alert('名称、Base URL 和 API Key 都不能为空');
      return;
    }

    const newProvider = {
      id: Date.now().toString(),
      name,
      baseUrl,
      apiKey,
      models: models.length > 0 ? models : [],
    };

    const next = {
      providers: [...data.providers, newProvider],
      activeId: data.activeId || newProvider.id,
    };
    persist(next);
    setForm({ name: '', baseUrl: '', apiKey: '', modelsInput: '' });
  };

  // 删除提供商
  const deleteProvider = (id) => {
    if (!confirm('确定删除这个提供商吗？')) return;
    const nextProviders = data.providers.filter(p => p.id !== id);
    const nextActiveId =
      data.activeId === id
        ? (nextProviders[0]?.id || null)
        : data.activeId;
    persist({ providers: nextProviders, activeId: nextActiveId });
  };

  // 切换激活提供商
  const setActive = (id) => {
    persist({ ...data, activeId: id });
  };

  // 测试连接
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

  // 给某个提供商添加模型
  const addModelToProvider = (providerId) => {
    const val = (newModelInput[providerId] || '').trim();
    if (!val) return;
    const next = {
      ...data,
      providers: data.providers.map(p =>
        p.id === providerId
          ? { ...p, models: [...(p.models || []), val] }
          : p
      ),
    };
    persist(next);
    setNewModelInput(s => ({ ...s, [providerId]: '' }));
  };

  // 删除某个提供商的某个模型
  const removeModel = (providerId, model) => {
    const next = {
      ...data,
      providers: data.providers.map(p =>
        p.id === providerId
          ? { ...p, models: p.models.filter(m => m !== model) }
          : p
      ),
    };
    persist(next);
  };

  return (
    <div className="api-overlay" onClick={onClose}>
      <div className="api-modal" onClick={e => e.stopPropagation()}>
        <div className="api-modal-header">
          <h2>API 配置</h2>
          <button className="api-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="api-modal-body">

          {/* 已有提供商列表 */}
          {data.providers.length > 0 && (
            <div className="api-section">
              <h3 className="api-section-title">已添加的提供商</h3>
              {data.providers.map(p => (
                <div
                  key={p.id}
                  className={`api-provider-card ${data.activeId === p.id ? 'active' : ''}`}
                >
                  <div className="api-provider-top">
                    <div className="api-provider-info">
                      <span className="api-provider-name">{p.name}</span>
                      <span className="api-provider-url">{p.baseUrl}</span>
                    </div>
                    <div className="api-provider-actions">
                      {data.activeId !== p.id && (
                        <button
                          className="api-btn api-btn-use"
                          onClick={() => setActive(p.id)}
                        >
                          使用
                        </button>
                      )}
                      {data.activeId === p.id && (
                        <span className="api-active-badge">当前使用</span>
                      )}
                      <button
                        className="api-btn api-btn-test"
                        onClick={() => testConnection(p)}
                        disabled={testStatus[p.id] === 'loading'}
                      >
                        {testStatus[p.id] === 'loading' ? '测试中…' : '测试'}
                      </button>
                      <button
                        className="api-btn api-btn-delete"
                        onClick={() => deleteProvider(p.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {/* 测试结果 */}
                  {testMsg[p.id] && (
                    <div className={`api-test-result ${testStatus[p.id] === 'ok' ? 'ok' : 'fail'}`}>
                      {testStatus[p.id] === 'ok' ? '✓ ' : '✗ '}
                      {testMsg[p.id]}
                    </div>
                  )}

                  {/* 模型列表 */}
                  <div className="api-models">
                    <span className="api-models-label">模型：</span>
                    <div className="api-model-tags">
                      {(p.models || []).map(m => (
                        <span key={m} className="api-model-tag">
                          {m}
                          <button onClick={() => removeModel(p.id, m)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="api-add-model-row">
                      <input
                        className="api-input"
                        placeholder="添加模型名，如 gpt-4o"
                        value={newModelInput[p.id] || ''}
                        onChange={e =>
                          setNewModelInput(s => ({ ...s, [p.id]: e.target.value }))
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter') addModelToProvider(p.id);
                        }}
                      />
                      <button
                        className="api-btn api-btn-add"
                        onClick={() => addModelToProvider(p.id)}
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 添加新提供商 */}
          <div className="api-section">
            <h3 className="api-section-title">添加新提供商</h3>
            <div className="api-form">
              <div className="api-field">
                <label>名称</label>
                <input
                  className="api-input"
                  placeholder="如：OpenAI、我的中转"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="api-field">
                <label>Base URL</label>
                <input
                  className="api-input"
                  placeholder="如：https://api.openai.com"
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                />
              </div>
              <div className="api-field">
                <label>API Key</label>
                <input
                  className="api-input"
                  type="password"
                  placeholder="sk-..."
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                />
              </div>
              <div className="api-field">
                <label>模型（用逗号分隔，可留空后续添加）</label>
                <input
                  className="api-input"
                  placeholder="如：gpt-4o, gpt-3.5-turbo"
                  value={form.modelsInput}
                  onChange={e => setForm(f => ({ ...f, modelsInput: e.target.value }))}
                />
              </div>
              <button className="api-btn api-btn-submit" onClick={addProvider}>
                添加提供商
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
