import { useState, useEffect, useRef } from 'react';
import './CyberDiary.css';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://my-home-backend-9j56.onrender.com';

// 动态加载 Chart.js（带备用 CDN，避免单一源被墙/超时）
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}
async function loadChart() {
  if (window.Chart) return window.Chart;
  const urls = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
  ];
  for (const u of urls) {
    try { await loadScript(u); if (window.Chart) return window.Chart; } catch (e) { /* try next */ }
  }
  return null;
}

function hexToRgba(hex, a) {
  hex = (hex || '').trim();
  if (hex.startsWith('#')) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  return hex;
}

export default function CyberDiary({ onClose }) {
  const [days, setDays] = useState(7);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState(null);
  const [avg, setAvg] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/emotion/history?days=${days}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const pts = d.points || [];
        setPoints(pts);
        const valid = pts.filter(p => p.score != null);
        setLatest(valid.length ? valid[valid.length - 1] : null);
        setAvg(valid.length ? (valid.reduce((s, p) => s + p.score, 0) / valid.length).toFixed(1) : null);
      })
      .catch(e => console.error('加载情绪数据失败', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  useEffect(() => {
    let active = true;
    loadChart().then(Chart => {
      if (!active || !Chart || !canvasRef.current) return;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--ocean-accent').trim() || '#5ba3c4';
      const deeper = getComputedStyle(document.documentElement).getPropertyValue('--ocean-deeper').trim() || '#2a6b8a';
      const labels = points.map(p => p.date.slice(5));
      const scores = points.map(p => p.score);
      const ctx = canvasRef.current.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 240);
      grad.addColorStop(0, hexToRgba(accent, 0.35));
      grad.addColorStop(1, hexToRgba(accent, 0.02));
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: '情绪分数',
            data: scores,
            borderColor: accent,
            backgroundColor: grad,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            spanGaps: true,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: accent,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: {
              min: 0, max: 10,
              ticks: { stepSize: 2, color: deeper, font: { size: 12 } },
              grid: { color: 'rgba(120,140,160,0.15)' }
            },
            x: {
              ticks: { color: deeper, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11 } },
              grid: { display: false }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => ` 分数：${item.parsed.y}/10`,
                afterLabel: (item) => {
                  const p = points[item.dataIndex];
                  return (p && p.summary) ? p.summary : '';
                }
              }
            }
          }
        }
      });
    });
    return () => {
      active = false;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [points]);

  const hasData = points.filter(p => p.score != null).length > 0;

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="cd-modal" onClick={e => e.stopPropagation()}>
        <div className="cd-top">
          <h2>📔 我的赛博日记</h2>
          <button className="cd-x" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="cd-body">
          <div className="cd-stats">
            <div className="cd-stat">
              <span className="cd-stat-label">最近一次</span>
              <span className="cd-stat-value">{latest ? `${latest.score}/10` : '—'}</span>
              {latest && <span className="cd-stat-sub">{latest.date}</span>}
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">{days}天平均</span>
              <span className="cd-stat-value">{avg ? `${avg}` : '—'}</span>
            </div>
            <div className="cd-seg">
              <button className={days === 7 ? 'active' : ''} onClick={() => setDays(7)}>7天</button>
              <button className={days === 30 ? 'active' : ''} onClick={() => setDays(30)}>30天</button>
            </div>
          </div>

          <div className="cd-chart-wrap">
            {loading && <div className="cd-loading">正在读取今日的潮汐…</div>}
            {!loading && !hasData && (
              <div className="cd-empty">
                <div className="cd-empty-icon">🌊</div>
                <p>还没有情绪记录</p>
                <p className="cd-empty-sub">多聊几句，AI 会在每天结束时为你写上一篇赛博日记</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{ display: (loading || !hasData) ? 'none' : 'block', width: '100%', height: '100%' }}
            />
          </div>

          {latest && latest.summary && (
            <div className="cd-latest-note">
              <span className="cd-latest-label">今日心情</span>
              <p>{latest.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
