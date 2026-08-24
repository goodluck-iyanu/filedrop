'use client';

import { useState, useRef } from "react";

export default function Home() {
  const [role, setRole] = useState<'idle' | 'uploading' | 'sender'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [status, setStatus] = useState('Preparing file...');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setRole('uploading');
    setStatus('Uploading file to secure cloud bridge...');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('fileToUpload', selectedFile);

      // Using Catbox API for reliable, CORS-friendly browser file uploads
      const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const downloadUrl = await response.text();
      if (!downloadUrl || !downloadUrl.startsWith('http')) {
        throw new Error('Invalid download link received from server.');
      }

      setShareLink(downloadUrl.trim());
      setRole('sender');
      setStatus('Ready for phone scan');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Upload failed. Please try again.');
      setRole('idle');
    }
  };

  const resetApp = () => {
    setRole('idle');
    setFile(null);
    setShareLink('');
    setErrorMsg('');
    setStatus('Ready to share');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const qrImageUrl = shareLink 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareLink)}` 
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#FFFFFF', color: '#000000', lineHeight: 1.6 }}>
      
      {/* Navigation */}
      <nav style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, textDecoration: 'none', color: '#FFFFFF' }}>
            File<span style={{ color: '#C8001A' }}>Drop</span>
          </a>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <a href="https://hoberg.com.ng/tools/" style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF', textDecoration: 'none' }}>All Tools</a>
            <a href="https://hoberg.com.ng/" style={{ background: '#FFFFFF', color: '#000000', padding: '8px 16px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Agency</a>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: '1 0 auto' }}>
        <header style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '80px 0 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '100px', fontSize: '13px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#C8001A"><path d="M12 2L2 22h20L12 2z"/></svg>
              <span>Built by <a href="https://hoberg.com.ng/tools/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Tools</a>. Powered by <a href="https://hoberg.com.ng/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Digital</a>.</span>
            </div>
            
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '16px', fontWeight: 700 }}>Instant File Transfer</h1>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 40px' }}>Transfer files instantly between laptop and iPhone. Secure, fast, and fully compatible with all mobile browsers.</p>
            
            {/* Error Banner */}
            {errorMsg && (
              <div style={{ maxWidth: '600px', margin: '0 auto 24px', background: '#FFEEEE', border: '1px solid #C8001A', color: '#C8001A', padding: '12px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            {role === 'idle' && (
              <div style={{ maxWidth: '600px', margin: '0 auto', background: '#FFFFFF', padding: '40px 32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📁</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#000000', marginBottom: '8px' }}>Send Files Instantly</h3>
                <p style={{ color: '#888888', fontSize: '14px', marginBottom: '24px' }}>Supports documents, videos, and media up to 200MB</p>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: '#C8001A', color: '#FFFFFF', border: 'none', padding: '16px 32px', borderRadius: '6px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Select File to Share
                </button>
              </div>
            )}

            {role === 'uploading' && (
              <div style={{ maxWidth: '600px', margin: '0 auto', background: '#FFFFFF', padding: '50px 32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center', color: '#000000' }}>
                <div style={{ width: '48px', height: '48px', border: '5px solid rgba(200,0,26,0.2)', borderRadius: '50%', borderTopColor: '#C8001A', animation: 'spin 1s ease-in-out infinite', margin: '0 auto 20px' }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '8px' }}>Uploading File...</h3>
                <p style={{ color: '#888888', fontSize: '14px' }}>Generating your mobile QR code</p>
              </div>
            )}

            {role === 'sender' && (
              <div style={{ background: '#FFFFFF', borderRadius: '8px', maxWidth: '650px', margin: '0 auto', padding: '32px', textAlign: 'center', color: '#000000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', marginBottom: '8px' }}>Sharing: {file?.name}</h3>
                <p style={{ color: '#888888', fontSize: '14px', marginBottom: '24px' }}>Scan this QR code with your iPhone camera to download instantly</p>
                
                {qrImageUrl && (
                  <div style={{ background: '#F5F5F5', padding: '16px', display: 'inline-block', borderRadius: '8px', marginBottom: '24px' }}>
                    <img src={qrImageUrl} alt="Scan to Download" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                )}

                <div style={{ margin: '16px 0 24px' }}>
                  <a href={shareLink} target="_blank" rel="noopener noreferrer" style={{ color: '#C8001A', fontSize: '14px', wordBreak: 'break-all', textDecoration: 'underline' }}>
                    {shareLink}
                  </a>
                </div>

                <button onClick={resetApp} style={{ background: 'transparent', border: '2px solid #000000', color: '#000000', padding: '12px 24px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                  Share Another File
                </button>
              </div>
            )}

          </div>
        </header>

        {/* Hoberg Agency CTA */}
        <section style={{ backgroundColor: '#000000', color: '#FFFFFF', textAlign: 'center', borderTop: '1px solid #222', padding: '80px 0' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '16px', fontWeight: 700 }}>Need custom software?</h2>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 32px' }}>Hoberg Digital Agency builds robust web applications, peer-to-peer tools, and custom digital solutions for businesses.</p>
            <a href="https://hoberg.com.ng/" style={{ display: 'inline-block', background: '#FFFFFF', color: '#000000', padding: '16px 40px', borderRadius: '6px', fontWeight: 700, textDecoration: 'none' }}>Talk to Hoberg</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#F5F5F5', color: '#000000', padding: '80px 0 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '48px', borderBottom: '1px solid #E0E0E0', paddingBottom: '48px', marginBottom: '32px' }}>
            <div>
              <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, textDecoration: 'none', color: '#000000', display: 'block', marginBottom: '16px' }}>
                File<span style={{ color: '#C8001A' }}>Drop</span>
              </a>
              <p style={{ color: '#888888', fontSize: '15px', maxWidth: '350px' }}>FileDrop is a secure file utility platform built, maintained, and secured by Hoberg Digital Agency.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
            <p style={{ color: '#888888', fontSize: '13px' }}>&copy; 2026 FileDrop. Powered by Hoberg Digital Agency.</p>
            <p style={{ color: '#000000', fontSize: '13px', fontWeight: 700 }}>Secure Cloud Transfer Bridge</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}