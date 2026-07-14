import { useState } from 'react';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

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
  const [temperature, setTemperature] = useState(() => {
    const saved = parseFloat(localStorage.getItem('apiTemperature'));
    return isNaN(saved) ? 0.7 : saved;
  });
  const [aiParams, setAiParams] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aiParams') || '{}'); } catch { return {}; }
  });

  // 表单区域的测试/拉取状态
  const [formTestStatus, setFormTestStatus] = useState('idle'); // idle | loading | ok | fail
  const [formTestMsg, setFormTestMsg] = useState('');
  const [formFetchStatus, setFormFetchStatus] = useState('idle');
  const [formFetchMsg, setFormFetchMsg] = useState('');

  const handleTempChange = (val) => {
    setTemperature(val);
    localStorage.setItem('apiTemperature', String(val));
  };

  const handleAiParamChange = (key, val) => {
    const next = { ...aiParams, [key]: val };
    setAiParams(next);
    localStorage.setItem('aiParams', JSON.stringify(next));
  };

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
    setFormTestStatus('idle');
    setFormTestMsg('');
    setFormFetchStatus('idle');
    setFormFetchMsg('');
    onClose && onClose();
  };

  // 测试表单里填的连接
  const testFormConnection = async () => {
    const baseUrl = form.baseUrl.trim();
    const apiKey = form.apiKey.trim();
    const modelName = form.modelsInput.split(',')[0]?.trim();
    if (!baseUrl || !apiKey) {
      setFormTestStatus('fail');
      setFormTestMsg('请先填写 Base URL 和 API Key');
      return;
    }
    if (!modelName) {
      setFormTestStatus('fail');
      setFormTestMsg('请先填写至少一个模型名');
      return;
    }
    setFormTestStatus('loading');
    setFormTestMsg('');
    try {
      const res = await fetch(`${API_URL}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, model: modelName }),
      });
      const result = await res.json();
      if (result.success) {
        setFormTestStatus('ok');
        setFormTestMsg('连接成功 ✓');
      } else {
        setFormTestStatus('fail');
        setFormTestMsg(result.error || '连接失败');
      }
    } catch (err) {
      setFormTestStatus('fail');
      setFormTestMsg('网络错误: ' + err.message);
    }
  };

  // 拉取模型列表
  const fetchModels = async () => {
    const baseUrl = form.baseUrl.trim();
    const apiKey = form.apiKey.trim();
    if (!baseUrl || !apiKey) {
      setFormFetchStatus('fail');
      setFormFetchMsg('请先填写 Base URL 和 API Key');
      return;
    }
    setFormFetchStatus('loading');
    setFormFetchMsg('');
    try {
      const res = await fetch(`${API_URL}/fetch-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey }),
      });
      const result = await res.json();
      if (result.success && result.models && result.models.length > 0) {
        setForm(f => ({ ...f, modelsInput: result.models.join(', ') }));
        setFormFetchStatus('ok');
        setFormFetchMsg(`已拉取 ${result.models.length} 个模型 ✓`);
      } else {
        setFormFetchStatus('fail');
        setFormFetchMsg(result.error || '未获取到模型列表');
      }
    } catch (err) {
      setFormFetchStatus('fail');
      setFormFetchMsg('网络错误: ' + err.message);
    }
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

  const S = {
    overlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 30, 50, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      boxSizing: 'border-box',
    },
    modal: {
      background: '#ffffff',
      borderRadius: '18px',
      width: '100%',
      maxWidth: '500px',
      maxHeight: '86vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 24px 64px rgba(0,40,70,0.25)',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 22px 14px',
      borderBottom: '1px solid #e0eff8',
      flexShrink: 0,
    },
    headerTitle: { margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e5a78' },
    closeBtn: {
      background: '#f0f8fc', border: 'none', width: '34px', height: '34px',
      borderRadius: '50%', fontSize: '20px', color: '#5ba3c4', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    body: {
      overflowY: 'auto', padding: '20px 22px 28px', flex: 1,
      display: 'flex', flexDirection: 'column', gap: '24px',
    },
    sectionLabel: {
      margin: '0 0 10px 0', fontSize: '11px', fontWeight: 700,
      letterSpacing: '1px', textTransform: 'uppercase', color: '#7ab0c4',
    },
    card: (isActive) => ({
      border: isActive ? '1.5px solid #5ba3c4' : '1.5px solid #daeef8',
      borderRadius: '12px', padding: '14px 16px',
      background: isActive ? '#edf6fb' : '#f7fbfe',
      display: 'flex', flexDirection: 'column', gap: '10px',
      boxShadow: isActive ? '0 0 0 3px rgba(91,163,196,0.13)' : 'none',
      marginBottom: '10px',
    }),
    cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' },
    cardName: { fontSize: '14px', fontWeight: 600, color: '#1e5a78', display: 'block', marginBottom: '3px' },
    cardUrl: { fontSize: '11px', color: '#7ab0c4', wordBreak: 'break-all' },
    cardBtns: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    badge: {
      fontSize: '11px', background: '#cce8f5', color: '#1e6a8a',
      borderRadius: '20px', padding: '3px 10px', fontWeight: 600, whiteSpace: 'nowrap',
    },
    testOk: { fontSize: '12px', padding: '7px 10px', borderRadius: '8px', background: '#e8f8f0', color: '#1e7a4a', lineHeight: 1.5 },
    testFail: { fontSize: '12px', padding: '7px 10px', borderRadius: '8px', background: '#fdf0f0', color: '#b84040', lineHeight: 1.5, wordBreak: 'break-all' },
    modelsArea: { borderTop: '1px solid #e0eff8', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
    modelsTitle: { fontSize: '11px', color: '#7ab0c4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' },
    tags: { display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '24px' },
    tag: {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: '#d4eaf7', color: '#1e5a78', borderRadius: '20px',
      padding: '4px 10px 4px 12px', fontSize: '12px', fontWeight: 500,
    },
    tagBtn: { background: 'none', border: 'none', color: '#7ab0c4', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' },
    addModelRow: { display: 'flex', gap: '8px', alignItems: 'center' },
    input: {
      width: '100%', padding: '10px 13px', border: '1.5px solid #c8e0ed',
      borderRadius: '9px', fontSize: '13px', color: '#2a4a5a', outline: 'none',
      background: 'white', fontFamily: 'inherit', boxSizing: 'border-box',
    },
    form: { display: 'flex', flexDirection: 'column', gap: '14px' },
    field: { display: 'flex', flexDirection: 'column', gap: '5px' },
    fieldLabel: { fontSize: '12px', fontWeight: 600, color: '#4a7a8a' },
    btnRow: { display: 'flex', gap: '8px' },
    btnUse: { border: 'none', borderRadius: '7px', padding: '5px 11px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap', background: '#e4f2f9', color: '#1e5a78' },
    btnTest: (disabled) => ({ border: 'none', borderRadius: '7px', padding: '5px 11px', fontSize: '12px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap', background: '#d4eaf7', color: '#1e5a78', opacity: disabled ? 0.5 : 1 }),
    btnDel: { border: 'none', borderRadius: '7px', padding: '5px 11px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap', background: '#fdeaea', color: '#b84040' },
    btnAdd: { border: 'none', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, background: '#5ba3c4', color: 'white' },
    btnOutline: (disabled) => ({
      flex: 1, border: '1.5px solid #c8e0ed', borderRadius: '9px', padding: '10px 12px',
      fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      fontWeight: 500, background: 'white', color: '#1e5a78',
      opacity: disabled ? 0.5 : 1,
    }),
    btnSubmit: {
      border: 'none', borderRadius: '10px', padding: '13px 18px', fontSize: '14px',
      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, marginTop: '4px', width: '100%',
      background: 'linear-gradient(135deg, #5ba3c4 0%, #3d8aaa 100%)', color: 'white',
    },
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        <div style={S.header}>
          <h2 style={S.headerTitle}>🔑 API 配置</h2>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={S.body}>

          {/* ====== 步骤1：添加新提供商 ====== */}
          <div>
            <p style={S.sectionLabel}>步骤 1 · 添加 API 提供商</p>
            <div style={S.form}>
              <div style={S.field}>
                <label style={S.fieldLabel}>名称</label>
                <input style={S.input} placeholder="如：OpenAI、我的中转站"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={S.field}>
                <label style={S.fieldLabel}>Base URL</label>
                <input style={S.input} placeholder="如：https://api.openai.com"
                  value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
              </div>
              <div style={S.field}>
                <label style={S.fieldLabel}>API Key</label>
                <input style={S.input} type="password" placeholder="sk-..."
                  value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
              </div>
              <div style={S.field}>
                <label style={S.fieldLabel}>模型（逗号分隔，可手动填写或点下方拉取）</label>
                <input style={S.input} placeholder="如：gpt-4o, gpt-3.5-turbo"
                  value={form.modelsInput} onChange={e => setForm(f => ({ ...f, modelsInput: e.target.value }))} />
              </div>

              {/* 测试连接 + 拉取模型 */}
              <div style={S.btnRow}>
                <button
                  style={S.btnOutline(formTestStatus === 'loading')}
                  onClick={testFormConnection}
                  disabled={formTestStatus === 'loading'}
                >
                  {formTestStatus === 'loading' ? '测试中…' : '🔗 测试连接'}
                </button>
                <button
                  style={S.btnOutline(formFetchStatus === 'loading')}
                  onClick={fetchModels}
                  disabled={formFetchStatus === 'loading'}
                >
                  {formFetchStatus === 'loading' ? '拉取中…' : '📋 拉取模型'}
                </button>
              </div>

              {/* 测试结果提示 */}
              {formTestMsg && (
                <div style={formTestStatus === 'ok' ? S.testOk : S.testFail}>
                  {formTestMsg}
                </div>
              )}
              {formFetchMsg && (
                <div style={formFetchStatus === 'ok' ? S.testOk : S.testFail}>
                  {formFetchMsg}
                </div>
              )}

              <button style={S.btnSubmit} onClick={addProvider}>💾 保存</button>
            </div>
          </div>

          {/* ====== 步骤2：管理已有提供商 ====== */}
          {data.providers.length > 0 && (
            <div>
              <p style={S.sectionLabel}>步骤 2 · 已添加的提供商</p>
              {data.providers.map(p => (
                <div key={p.id} style={S.card(data.activeId === p.id)}>
                  <div style={S.cardTop}>
                    <div style={{ minWidth: 0 }}>
                      <span style={S.cardName}>{p.name}</span>
                      <span style={S.cardUrl}>{p.baseUrl}</span>
                    </div>
                    <div style={S.cardBtns}>
                      {data.activeId === p.id
                        ? <span style={S.badge}>使用中</span>
                        : <button style={S.btnUse} onClick={() => setActive(p.id)}>切换</button>
                      }
                      <button
                        style={S.btnTest(testStatus[p.id] === 'loading')}
                        onClick={() => testConnection(p)}
                        disabled={testStatus[p.id] === 'loading'}
                      >
                        {testStatus[p.id] === 'loading' ? '测试中…' : '测试'}
                      </button>
                      <button style={S.btnDel} onClick={() => deleteProvider(p.id)}>删除</button>
                    </div>
                  </div>

                  {testMsg[p.id] && (
                    <div style={testStatus[p.id] === 'ok' ? S.testOk : S.testFail}>
                      {testMsg[p.id]}
                    </div>
                  )}

                  <div style={S.modelsArea}>
                    <span style={S.modelsTitle}>模型列表</span>
                    <div style={S.tags}>
                      {(p.models || []).length === 0 && (
                        <span style={{ fontSize: '12px', color: '#aac8d8', fontStyle: 'italic' }}>
                          还没有模型，在下方添加
                        </span>
                      )}
                      {(p.models || []).map(m => (
                        <span key={m} style={S.tag}>
                          {m}
                          <button style={S.tagBtn} onClick={() => removeModel(p.id, m)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={S.addModelRow}>
                      <input
                        style={{ ...S.input, flex: 1 }}
                        placeholder="输入模型名，如 gpt-4o，回车添加"
                        value={newModelInput[p.id] || ''}
                        onChange={e => setNewModelInput(s => ({ ...s, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addModelToProvider(p.id); }}
                      />
                      <button style={S.btnAdd} onClick={() => addModelToProvider(p.id)}>添加</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ====== 步骤3：温度（基础生成参数） ====== */}
          <div>
            <p style={S.sectionLabel}>步骤 3 · 温度（生成随机性）</p>
            <div style={S.field}>
              <label style={S.fieldLabel}>温度 (Temperature)：{temperature.toFixed(1)}</label>
              <input
                type="range" min="0" max="1" step="0.1"
                value={temperature}
                onChange={e => handleTempChange(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  appearance: 'none', WebkitAppearance: 'none',
                  background: 'linear-gradient(to right, #c8e0ed, #5ba3c4)',
                  outline: 'none', margin: '10px 0 6px',
                  cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7ab0c4', padding: '0 4px' }}>
                <span>精确 (0.0)</span>
                <span>平衡 (0.5)</span>
                <span>创意 (1.0)</span>
              </div>
            </div>
          </div>

          {/* ====== 步骤4：AI 高级参数 ====== */}
          <div>
            <p style={S.sectionLabel}>步骤 4 · AI 高级参数</p>
            <div style={S.field}>
              <label style={S.fieldLabel}>上下文轮数：{aiParams.max_context_rounds || 250}</label>
              <input
                type="range" min="50" max="500" step="10"
                value={aiParams.max_context_rounds || 250}
                onChange={e => handleAiParamChange('max_context_rounds', parseInt(e.target.value))}
                style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  appearance: 'none', WebkitAppearance: 'none',
                  background: 'linear-gradient(to right, #c8e0ed, #5ba3c4)',
                  outline: 'none', margin: '10px 0 6px', cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7ab0c4', padding: '0 4px' }}>
                <span>50</span><span>250</span><span>500</span>
              </div>
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>自动总结阈值（每N轮对话后触发总结）：{aiParams.auto_summarize_after || 50}</label>
              <input
                type="range" min="10" max="200" step="5"
                value={aiParams.auto_summarize_after || 50}
                onChange={e => handleAiParamChange('auto_summarize_after', parseInt(e.target.value))}
                style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  appearance: 'none', WebkitAppearance: 'none',
                  background: 'linear-gradient(to right, #c8e0ed, #5ba3c4)',
                  outline: 'none', margin: '10px 0 6px', cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7ab0c4', padding: '0 4px' }}>
                <span>10轮</span><span>50轮</span><span>200轮</span>
              </div>
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>总结后保留近N轮对话：{aiParams.compress_keep_rounds || 15}</label>
              <input
                type="range" min="5" max="50" step="1"
                value={aiParams.compress_keep_rounds || 15}
                onChange={e => handleAiParamChange('compress_keep_rounds', parseInt(e.target.value))}
                style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  appearance: 'none', WebkitAppearance: 'none',
                  background: 'linear-gradient(to right, #c8e0ed, #5ba3c4)',
                  outline: 'none', margin: '10px 0 6px', cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7ab0c4', padding: '0 4px' }}>
                <span>5轮</span><span>15轮</span><span>50轮</span>
              </div>
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>最大回复 Token：{aiParams.max_reply_tokens || 1024}</label>
              <input
                type="range" min="256" max="8192" step="256"
                value={aiParams.max_reply_tokens || 1024}
                onChange={e => handleAiParamChange('max_reply_tokens', parseInt(e.target.value))}
                style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  appearance: 'none', WebkitAppearance: 'none',
                  background: 'linear-gradient(to right, #c8e0ed, #5ba3c4)',
                  outline: 'none', margin: '10px 0 6px', cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7ab0c4', padding: '0 4px' }}>
                <span>256</span><span>1024</span><span>8192</span>
              </div>
            </div>
            <div style={S.field}>
              <label style={{ ...S.fieldLabel, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={aiParams.delete_after_summarize || false}
                  onChange={e => handleAiParamChange('delete_after_summarize', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                总结后删除原始消息（节省存储，但无法恢复）
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
