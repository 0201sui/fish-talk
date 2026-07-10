import './ApiConfig.css';

export default function ApiConfig({ onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'red',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{ color: 'white', fontSize: '40px' }}>文件生效了</h1>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, fontSize: '30px', background: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer' }}>关闭</button>
    </div>
  );
}
