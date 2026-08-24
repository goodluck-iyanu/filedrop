'use client';

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [role, setRole] = useState<'idle' | 'preparing' | 'sender' | 'receiver'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [peerId, setPeerId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [status, setStatus] = useState('Initializing secure connection...');
  const [progress, setProgress] = useState(0);
  const [receivedFileUrl, setReceivedFileUrl] = useState<string | null>(null);
  const [receivedFileName, setReceivedFileName] = useState('');
  const [transferSpeed, setTransferSpeed] = useState('');

  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    script.async = true;
    script.onload = () => {
      initPeer();
    };
    document.body.appendChild(script);

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const initPeer = () => {
    // @ts-ignore
    const Peer = window.Peer;
    if (!Peer) return;

    const peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });
    peerRef.current = peer;

    peer.on('open', (id: string) => {
      setPeerId(id);
      
      const hash = window.location.hash;
      if (hash.includes('#peer=')) {
        const senderId = hash.split('#peer=')[1];
        if (senderId) {
          setRole('receiver');
          connectToSender(senderId, peer);
        }
      }
    });

    // Sender side: Handle incoming connection from phone
    peer.on('connection', (conn: any) => {
      connRef.current = conn;
      setRole('sender');
      setStatus('Phone connected! Waiting for handshake...');

      // Wait for receiver ready signal before sending data to prevent race conditions
      conn.on('data', (data: any) => {
        if (data && data.type === 'ready') {
          setStatus('Transferring file...');
          if (file) {
            sendFile(file, conn);
          }
        }
      });
    });

    peer.on('error', (err: any) => {
      console.error('PeerJS error:', err);
      setStatus('Connection error. Please refresh and retry.');
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setRole('preparing');

    setTimeout(() => {
      const link = `${window.location.origin}${window.location.pathname}#peer=${peerId}`;
      setShareLink(link);
      setRole('sender');
      setStatus('Ready for phone scan');
    }, 1200);
  };

  const sendFile = async (fileObj: File, conn: any) => {
    startTimeRef.current = Date.now();

    conn.send({
      type: 'metadata',
      name: fileObj.name,
      size: fileObj.size,
      mimeType: fileObj.type
    });

    const CHUNK_SIZE = 16384; 
    const reader = new FileReader();
    let offset = 0;

    const sendNextChunk = () => {
      if (offset >= fileObj.size) {
        setStatus('Transfer complete!');
        return;
      }

      const dataChannel = conn.dataChannel;
      if (dataChannel && dataChannel.bufferedAmount > 65536) {
        setTimeout(sendNextChunk, 20);
        return;
      }

      const slice = fileObj.slice(offset, offset + CHUNK_SIZE);
      reader.onload = (e) => {
        if (!e.target?.result) return;
        const buffer = e.target.result as ArrayBuffer;
        conn.send(buffer);
        offset += buffer.byteLength;

        const percent = Math.round((offset / fileObj.size) * 100);
        setProgress(percent);

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const speed = (offset / (1024 * 1024)) / (elapsed || 1);
        setTransferSpeed(`${speed.toFixed(2)} MB/s`);

        sendNextChunk();
      };
      reader.readAsArrayBuffer(slice);
    };

    sendNextChunk();
  };

  const connectToSender = (senderId: string, peerInstance: any) => {
    setStatus('Connecting to sender...');
    const conn = peerInstance.connect(senderId);
    connRef.current = conn;

    let incomingFile: { name: string; size: number; mimeType: string; chunks: ArrayBuffer[]; receivedSize: number } | null = null;

    conn.on('open', () => {
      setStatus('Connected! Initializing handshake...');
      // Send ready signal so sender knows data channel is active
      conn.send({ type: 'ready' });
    });

    conn.on('data', (data: any) => {
      if (data && data.type === 'metadata') {
        incomingFile = {
          name: data.name,
          size: data.size,
          mimeType: data.mimeType,
          chunks: [],
          receivedSize: 0
        };
        setStatus(`Receiving ${data.name} (${(data.size / (1024*1024)).toFixed(1)} MB)...`);
        startTimeRef.current = Date.now();
      } else if (incomingFile) {
        incomingFile.chunks.push(data);
        incomingFile.receivedSize += data.byteLength;

        const percent = Math.round((incomingFile.receivedSize / incomingFile.size) * 100);
        setProgress(percent);

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const speed = (incomingFile.receivedSize / (1024 * 1024)) / (elapsed || 1);
        setTransferSpeed(`${speed.toFixed(2)} MB/s`);

        if (incomingFile.receivedSize >= incomingFile.size) {
          const blob = new Blob(incomingFile.chunks, { type: incomingFile.mimeType });
          const url = URL.createObjectURL(blob);
          setReceivedFileUrl(url);
          setReceivedFileName(incomingFile.name);
          setStatus('Transfer complete!');
        }
      }
    });

    conn.on('error', (err: any) => {
      console.error('Connection error:', err);
      setStatus('Connection failed. Make sure the sender page is still open.');
    });
  };

  const resetApp = () => {
    setRole('idle');
    setFile(null);
    setProgress(0);
    setReceivedFileUrl(null);
    setStatus('Ready to share');
    window.location.hash = '';
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
            
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '16px', fontWeight: 700 }}>Peer-to-Peer File Transfer</h1>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 40px' }}>Transfer files instantly between laptop and phone. Zero server storage, direct browser-to-browser P2P speed.</p>
            
            {role === 'idle' && (
              <div style={{ maxWidth: '600px', margin: '0 auto', background: '#FFFFFF', padding: '40px 32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📁</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#000000', marginBottom: '8px' }}>Send Files Instantly</h3>
                <p style={{ color: '#888888', fontSize: '14px', marginBottom: '24px' }}>Supports documents, videos, and media up to 100MB+</p>
                
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

            {role === 'preparing' && (
              <div style={{ maxWidth: '600px', margin: '0 auto', background: '#FFFFFF', padding: '50px 32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center', color: '#000000' }}>
                <div style={{ width: '48px', height: '48px', border: '5px solid rgba(200,0,26,0.2)', borderRadius: '50%', borderTopColor: '#C8001A', animation: 'spin 1s ease-in-out infinite', margin: '0 auto 20px' }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '8px' }}>Generating Secure Link...</h3>
                <p style={{ color: '#888888', fontSize: '14px' }}>Setting up direct P2P connection channel</p>
              </div>
            )}

            {role === 'sender' && (
              <div style={{ background: '#FFFFFF', borderRadius: '8px', maxWidth: '650px', margin: '0 auto', padding: '32px', textAlign: 'center', color: '#000000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', marginBottom: '8px' }}>Sharing: {file?.name}</h3>
                <p style={{ color: '#888888', fontSize: '14px', marginBottom: '24px' }}>Scan this QR code with your phone camera to download instantly</p>
                
                {qrImageUrl && (
                  <div style={{ background: '#F5F5F5', padding: '16px', display: 'inline-block', borderRadius: '8px', marginBottom: '24px' }}>
                    <img src={qrImageUrl} alt="Scan to Download" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                )}

                <div style={{ background: '#F5F5F5', padding: '16px', borderRadius: '6px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Status: {status}</div>
                  {progress > 0 && (
                    <>
                      <div style={{ width: '100%', background: '#E0E0E0', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '12px 0 8px' }}>
                        <div style={{ width: `${progress}%`, background: '#C8001A', height: '100%', transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#888888' }}>
                        <span>{progress}% transferred</span>
                        <span>{transferSpeed}</span>
                      </div>
                    </>
                  )}
                </div>

                <button onClick={resetApp} style={{ background: 'transparent', border: '2px solid #000000', color: '#000000', padding: '12px 24px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                  Cancel / Share Another
                </button>
              </div>
            )}

            {role === 'receiver' && (
              <div style={{ background: '#FFFFFF', borderRadius: '8px', maxWidth: '650px', margin: '0 auto', padding: '32px', textAlign: 'center', color: '#000000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', marginBottom: '16px' }}>Incoming File Transfer</h3>
                
                <div style={{ background: '#F5F5F5', padding: '20px', borderRadius: '6px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{status}</div>
                  
                  {progress > 0 && !receivedFileUrl && (
                    <>
                      <div style={{ width: '100%', background: '#E0E0E0', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '12px 0 8px' }}>
                        <div style={{ width: `${progress}%`, background: '#C8001A', height: '100%', transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#888888' }}>
                        <span>{progress}% received</span>
                        <span>{transferSpeed}</span>
                      </div>
                    </>
                  )}
                </div>

                {receivedFileUrl && (
                  <div>
                    <a href={receivedFileUrl} download={receivedFileName} style={{ display: 'inline-block', background: '#C8001A', color: '#FFFFFF', padding: '16px 32px', borderRadius: '6px', fontWeight: 700, textDecoration: 'none', fontSize: '16px' }}>
                      Download {receivedFileName}
                    </a>
                  </div>
                )}
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
              <p style={{ color: '#888888', fontSize: '15px', maxWidth: '350px' }}>FileDrop is a peer-to-peer transfer utility platform built, maintained, and secured by Hoberg Digital Agency.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignContent: 'center', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
            <p style={{ color: '#888888', fontSize: '13px' }}>&copy; 2026 FileDrop. Powered by Hoberg Digital Agency.</p>
            <p style={{ color: '#000000', fontSize: '13px', fontWeight: 700 }}>Direct Browser-to-Browser P2P Transfer</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}