import { useState, useEffect } from 'react';
import './ApiConfig.css';

export default function ApiConfig({ onClose, onConfigChange }) {
  const [providers, setProviders] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});

  // 表单
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formModels, setFormModels] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const saved = localStorage.getItem('apiProviders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProviders(parsed.providers || []);
        setActiveId(parsed.activeId || null);
      } catch (e) {}
    }
  };

  const saveConfig = (newProviders, newActiveId) => {
    const config = { providers: newProviders, activeId: newActiveId };
    localStorage.setItem('apiProviders', JSON.stringify(config));
    setProviders(newProviders);
    setActiveId(newActiveId);
    if (onConfigChange) onConfigChange(config);
  };

  const handleAdd = () => {
    if (!formName.trim() || !formUrl.trim() || !formKey.trim()) {
      alert('名称、URL 和 Key 都不能为空');
      return;
    }
    const modelsArr = formModels.split(/[,，\n]+/).map(s => s.trim()).filter(s => s);
    if (modelsArr.length === 0) {
      alert('请至少输入一个模型名称');
      return;
    }
    const newProvider = {
      id: 'prov_' + Date.now(),
      name: formName.trim(),
      baseUrl: formUrl.trim().replace(/\/+$/, ''),
      apiKey: formKey.trim(),
      models: modelsArr
    };
    const newProviders = [...providers, newProvider];
    const newActiveId = activeId || newProvider.id;
    saveConfig(newProviders, newActiveId);
    resetForm();
    setShowAddForm(false);
  };

  const handleUpdate = (id) => {
    const modelsArr = formModels.split(/[,，\n]+/).map(s => s.trim()).filter(s => s);
    if (!formName.trim() || !formUrl.trim() || !formKey.trim() || modelsArr.length === 0) {
      alert('所有字段都不能为空，且至少需要一个模型');
      return;
    }
    const newProviders = providers.map(p => {
      if (p.id === id) {
        return { ...p, name: formName.trim(), baseUrl: formUrl.trim().replace(/\/+$/, ''), apiKey: formKey.trim(), models: modelsArr };
      }
      return p;
    });
    saveConfig(newProviders, activeId);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = (id) => {
    if (!confirm('确定删除这个提供商吗？')) return;
    const newProviders = providers.filter(p => p.id !== id);
    let newActiveId = activeId;
    if (activeId === id) {
      newActiveId = newProviders.length > 0 ? newProviders[0].id : null;
    }
    saveConfig(newProviders, newActiveId);
  };

  const handleSetActive = (id) => {
    saveConfig(providers, id);
  };

  const handleTest = async (provider) => {
    setTesting(provider.id);
    setTestResult({ ...testResult, [provider.id]: null });
    try {
      const backendUrl = 'https://my-home-backend-9j56.onrender.com';
      const resp = await fetch(`${backendUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: provider.baseUrl,
          api_key: provider.apiKey,
          model: provider.models[0]
        })
      });
      const data = await resp.json();
      if (data.success) {
        setTestResult({ ...testResult, [provider.id]: '连接成功！' });
      } else {
        setTestResult({ ...testResult, [provider.id]: '失败: ' + (data.error || '未知错误') });
      }
    } catch (err) {
      setTestResult({ ...testResult, [provider.id]: '请求失败: ' + err.message });
    }
    setTesting(null);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setExpandedId(p.id);
    setFormName(p.name);
    setFormUrl(p.baseUrl);
    setFormKey(p.apiKey);
    setFormModels(p.models.join(', '));
  };

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormKey('');
    setFormModels('');
  };

  const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  return (
    <div className="ac">
      <div className="ac-top">
        <h2>API 配置</h2>
        <button className="ac-x" onClick={onClose}>×</button>
      </div>

      <div className="ac-scroll">
        {/* 添加按钮 */}
        <button className="ac-btn-add" onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); resetForm(); }}>
          {showAddForm ? '取消添加' : '+ 添加提供商'}
        </button>

        {/* 添加表单 */}
        {showAddForm && (
          <div className="ac-form">
            <input placeholder="名称（如：我的中转站）" value={formName} onChange={e => setFormName(e.target.value)} />
            <input placeholder="Base URL（如：https://api.example.com）" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
            <input placeholder="API Key" type="password" value={formKey} onChange={e => setFormKey(e.target.value)} />
            <textarea placeholder="模型列表（逗号或换行分隔，如：gpt-4, claude-3）" value={formModels} onChange={e => setFormModels(e.target.value)} rows={3} />
            <div className="ac-form-act">
              <button className="ac-btn-pri" onClick={handleAdd}>保存</button>
              <button className="ac-btn-ghost" onClick={() => { setShowAddForm(false); resetForm(); }}>取消</button>
            </div>
          </div>
        )}

        {/* 提供商列表 */}
        {providers.length === 0 && !showAddForm && (
          <p className="ac-note">还没有配置任何 API 提供商，点击上方按钮添加</p>
        )}

        {providers.map(p => (
          <div key={p.id} className={`ac-card ${activeId === p.id ? 'active' : ''}`}>
            {editingId === p.id ? (
              <div className="ac-form">
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="名称" />
                <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="Base URL" />
                <input value={formKey} onChange={e => setFormKey(e.target.value)} placeholder="API Key" type="password" />
                <textarea value={formModels} onChange={e => setFormModels(e.target.value)} placeholder="模型列表" rows={3} />
                <div className="ac-form-act">
                  <button className="ac-btn-pri" onClick={() => handleUpdate(p.id)}>保存</button>
                  <button className="ac-btn-ghost" onClick={() => { setEditingId(null); resetForm(); }}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div className="ac-card-head" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <div className="ac-card-left">
                    {activeId === p.id && <span className="ac-badge">当前</span>}
                    <span className="ac-card-name">{p.name}</span>
                  </div>
                  <span className={`mp-arr-s ${expandedId === p.id ? 'open' : ''}`}>▸</span>
                </div>

                {expandedId === p.id && (
                  <div className="ac-card-body">
                    <div className="ac-info-row">
                      <span className="ac-label">URL</span>
                      <span className="ac-value">{p.baseUrl}</span>
                    </div>
                    <div className="ac-info-row">
                      <span className="ac-label">Key</span>
                      <span className="ac-value">{maskKey(p.apiKey)}</span>
                    </div>
                    <div className="ac-info-row">
                      <span className="ac-label">模型</span>
                      <div className="ac-models">
                        {p.models.map(m => <span key={m} className="ac-model-tag">{m}</span>)}
                      </div>
                    </div>

                    {testResult[p.id] && (
                      <p className={`ac-test-result ${testResult[p.id].startsWith('连接成功') ? 'ok' : 'fail'}`}>
                        {testResult[p.id]}
                      </p>
                    )}

                    <div className="ac-card-actions">
                      {activeId !== p.id && (
                        <button className="ac-btn-use" onClick={() => handleSetActive(p.id)}>设为当前</button>
                      )}
                      <button className="ac-btn-test" onClick={() => handleTest(p)} disabled={testing === p.id}>
                        {testing === p.id ? '测试中...' : '测试连接'}
                      </button>
                      <button className="ac-btn-ghost" onClick={() => startEdit(p)}>编辑</button>
                      <button className="ac-btn-del" onClick={() => handleDelete(p.id)}>删除</button>
                    </div>
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
