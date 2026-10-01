import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    window.location.replace('/wwwroot/index.html');
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: "'Inter', sans-serif",
      backgroundColor: '#071524',
      color: '#ffffff',
      textAlign: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: 60,
        height: 60,
        background: 'linear-gradient(135deg, #0d233a 0%, #1a3c61 100%)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f59e0b',
        fontSize: '2rem',
        marginBottom: 20,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        border: '1px solid rgba(245, 158, 11, 0.4)'
      }}>
        🏡
      </div>
      <h1 style={{ fontSize: '2.2rem', fontFamily: "'Poppins', sans-serif", marginBottom: '0.5rem', color: '#ffffff' }}>
        ISHEMA <span style={{ color: '#f59e0b' }}>REAL ESTATE</span>
      </h1>
      <p style={{ color: '#cbd5e1', fontSize: '1.1rem', maxWidth: 500, marginBottom: '2rem' }}>
        "Find Your Home. Find Your Land. Build Your Future."
      </p>
      <a
        href="/wwwroot/index.html"
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#ffffff',
          fontWeight: 600,
          padding: '12px 28px',
          borderRadius: 8,
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)',
          transition: 'transform 0.2s ease'
        }}
      >
        Enter ISHEMA Real Estate Platform →
      </a>
    </div>
  );
}
