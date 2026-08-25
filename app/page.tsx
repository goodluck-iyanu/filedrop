'use client';

import { useState, useRef, useCallback } from "react";

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface TrackedFile {
  file: File;
  status: FileStatus;
  error?: string;
}

export default function Home() {
  const [role, setRole] = useState<'idle' | 'uploading' | 'sender'>('idle');
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [shareLink, setShareLink] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const updateFileStatus = (index: number, status: FileStatus, error?: string) => {
    setTrackedFiles(prev =>
      prev.map((f, i) => i === index ? { ...f, status, error } : f)
    );
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const initial: TrackedFile[] = files.map(f => ({ file: f, status: 'pending' }));
    setTrackedFiles(initial);
    setRole('uploading');
    setErrorMsg('');
    setUploadedCount(0);
    setShareLink('');

    try {
      // Get best GoFile server once
      const serverRes = await fetch('https://api.gofile.io/servers');
      if (!serverRes.ok) throw new Error('Could not reach GoFile servers.');
      const serverData = await serverRes.json();
      const server: string = serverData?.data?.servers?.[0]?.name;
      if (!server) throw new Error('No GoFile server available.');

      let folderId: string | null = null;
      let folderPage: string | null = null;

      for (let i = 0; i < files.length; i++) {
        updateFileStatus(i, 'uploading');

        try {
          const formData = new FormData();
          formData.append('file', files[i]);
          // After first file, append all subsequent to same folder
          if (folderId) formData.append('folderId', folderId);

          const uploadRes = await fetch(`https://${server}.gofile.io/contents/uploadfile`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) throw new Error(`HTTP ${uploadRes.status}`);

          const uploadData = await uploadRes.json();
          if (uploadData.status !== 'ok') throw new Error(uploadData.message || 'Upload rejected.');

          // Capture folder info from first upload
          if (!folderId) {
            folderId = uploadData?.data?.parentFolder;
            folderPage = uploadData?.data?.downloadPage;
          }

          updateFileStatus(i, 'done');
          setUploadedCount(c => c + 1);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed';
          updateFileStatus(i, 'error', msg);
          setUploadedCount(c => c + 1);
        }
      }

      if (!folderPage) throw new Error('No download link returned.');
      setShareLink(folderPage);
      setRole('sender');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setErrorMsg(message);
      setRole('idle');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles(files);
    // reset inputs so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const resetApp = () => {
    setRole('idle');
    setTrackedFiles([]);
    setShareLink('');
    setErrorMsg('');
    setUploadedCount(0);
  };

  const qrImageUrl = shareLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareLink)}`
    : '';

  const totalFiles = trackedFiles.length;
  const progressPct = totalFiles > 0 ? Math.round((uploadedCount / totalFiles) * 100) : 0;

  const statusIcon = (s: FileStatus) => {
    if (s === 'done') return <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>;
    if (s === 'error') return <span style={{ color: '#C8001A', fontWeight: 700 }}>✗</span>;
    if (s === 'uploading') return <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(200,0,26,0.2)', borderRadius: '50%', borderTopColor: '#C8001A', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />;
    return <span style={{ color: '#888' }}>○</span>;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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

      {/* Main Content */}
      <main style={{ flex: '1 0 auto' }}>
        <header style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '80px 0 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '100px', fontSize: '13px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#C8001A"><path d="M12 2L2 22h20L12 2z"/></svg>
              <span>Built by <a href="https://hoberg.com.ng/tools/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Tools</a>. Powered by <a href="https://hoberg.com.ng/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Digital</a>.</span>
            </div>

            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '16px', fontWeight: 700 }}>Instant File Transfer</h1>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 40px' }}>Transfer files, folders, or anything instantly. Scan the QR code on your phone to download everything at once.</p>

            {errorMsg && (
              <div style={{ maxWidth: '640px', margin: '0 auto 24px', background: '#FFEEEE', border: '1px solid #C8001A', color: '#C8001A', padding: '12px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            {/* ── IDLE ── */}
            {role === 'idle' && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                style={{
                  maxWidth: '640px', margin: '0 auto', background: '#FFFFFF',
                  padding: '48px 32px', borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  border: isDragging ? '2px dashed #C8001A' : '2px dashed transparent',
                  transition: 'border 0.2s',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#000000', marginBottom: '8px' }}>Drop files or a folder here</h3>
                <p style={{ color: '#888888', fontSize: '14px', marginBottom: '32px' }}>Or use the buttons below — select multiple files or an entire folder</p>

                {/* Hidden inputs */}
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileInput} />
                {/* @ts-expect-error webkitdirectory is a non-standard attribute */}
                <input ref={folderInputRef} type="file" webkitdirectory="" style={{ display: 'none' }} onChange={handleFileInput} />

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: '#C8001A', color: '#FFFFFF', border: 'none', padding: '14px 28px', borderRadius: '6px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    📄 Select Files
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    style={{ background: 'transparent', color: '#000000', border: '2px solid #000000', padding: '14px 28px', borderRadius: '6px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    📁 Select Folder
                  </button>
                </div>
              </div>
            )}

            {/* ── UPLOADING ── */}
            {role === 'uploading' && (
              <div style={{ maxWidth: '640px', margin: '0 auto', background: '#FFFFFF', padding: '32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'left', color: '#000000' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '4px', textAlign: 'center' }}>
                  Uploading {uploadedCount} / {totalFiles} files...
                </h3>
                <p style={{ color: '#888888', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>Generating shared QR code</p>

                {/* Progress bar */}
                <div style={{ background: '#F0F0F0', borderRadius: '99px', height: '8px', marginBottom: '24px', overflow: 'hidden' }}>
                  <div style={{ background: '#C8001A', height: '100%', width: `${progressPct}%`, borderRadius: '99px', transition: 'width 0.4s ease' }} />
                </div>

                {/* File list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                  {trackedFiles.map((tf, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#F9F9F9', borderRadius: '6px', fontSize: '13px' }}>
                      <span style={{ flexShrink: 0 }}>{statusIcon(tf.status)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tf.file.name}</span>
                      <span style={{ color: '#888', flexShrink: 0 }}>{formatSize(tf.file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SENDER / DONE ── */}
            {role === 'sender' && (
              <div style={{ background: '#FFFFFF', borderRadius: '12px', maxWidth: '640px', margin: '0 auto', padding: '32px', textAlign: 'center', color: '#000000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', marginBottom: '4px' }}>
                  {trackedFiles.length} file{trackedFiles.length !== 1 ? 's' : ''} ready to share
                </h3>
                <p style={{ color: '#888888', fontSize: '14px', marginBottom: '24px' }}>Scan the QR code with your phone camera to download everything</p>

                {qrImageUrl && (
                  <div style={{ background: '#F5F5F5', padding: '16px', display: 'inline-block', borderRadius: '8px', marginBottom: '20px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrImageUrl} alt="Scan to Download" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                )}

                <div style={{ margin: '0 0 20px' }}>
                  <a href={shareLink} target="_blank" rel="noopener noreferrer" style={{ color: '#C8001A', fontSize: '14px', wordBreak: 'break-all', textDecoration: 'underline' }}>
                    {shareLink}
                  </a>
                </div>

                {/* Summary of files */}
                <div style={{ textAlign: 'left', background: '#F9F9F9', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', maxHeight: '180px', overflowY: 'auto' }}>
                  {trackedFiles.map((tf, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '4px 0', borderBottom: i < trackedFiles.length - 1 ? '1px solid #ECECEC' : 'none' }}>
                      <span>{statusIcon(tf.status)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tf.file.name}</span>
                      <span style={{ color: '#888' }}>{formatSize(tf.file.size)}</span>
                    </div>
                  ))}
                </div>

                <button onClick={resetApp} style={{ background: 'transparent', border: '2px solid #000000', color: '#000000', padding: '12px 24px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                  Share More Files
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
    </div>
  );
}