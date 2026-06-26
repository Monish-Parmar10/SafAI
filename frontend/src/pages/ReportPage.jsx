import { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitReport, deleteReport } from '../services/api';

const BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : '';

const playChimeSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
    gain1.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc1.start();
    osc1.stop(audioContext.currentTime + 0.15);

    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      gain2.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      osc2.start();
      osc2.stop(audioContext.currentTime + 0.3);
    }, 100);
  } catch (err) {
    console.error('Error playing notification sound:', err);
  }
};

function ReportPage() {
  const { user, logout } = useAuth();
  
  // Refs
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // States
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('camera'); // 'camera' | 'preview' | 'result'
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isHovered, setIsHovered] = useState(false); // capture button hover state
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Overhaul states
  const queryParams = new URLSearchParams(window.location.search);
  const initialPage = queryParams.get('page') || 'camera';
  const [activePage, setActivePage] = useState(initialPage); // 'camera' | 'myreports' | 'map' | 'workers' | 'profile'
  const [myReports, setMyReports] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('safai_user_notifications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }
    return [
      { id: 'mock-1', text: 'Welcome to SafAI! Real-time notifications will appear here.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), read: false, icon: '🌿', timestamp: new Date().toISOString() }
    ];
  });
  const [showNotif, setShowNotif] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const isInitialLoadRef = useRef(true);
  const prevReportsRef = useRef([]);

  const handleReportsUpdate = (newReports) => {
    if (isInitialLoadRef.current) {
      prevReportsRef.current = newReports;
      isInitialLoadRef.current = false;
      return;
    }

    const prevReportsMap = new Map(prevReportsRef.current.map(r => [r._id, r]));
    let pendingNewNotifs = [];
    let shouldPlaySound = false;

    newReports.forEach(report => {
      const prevReport = prevReportsMap.get(report._id);
      if (prevReport) {
        const prevStatus = prevReport.status;
        const newStatus = report.status;

        const wasPending = prevStatus === 'open' || prevStatus === 'pending';
        const isAssigned = newStatus === 'assigned' || newStatus === 'accepted';
        
        const wasNotCompleted = prevStatus !== 'completed' && prevStatus !== 'done';
        const isCompleted = newStatus === 'completed' || newStatus === 'done';

        const lat = report.location?.lat || report.lat;
        const lng = report.location?.lng || report.lng;
        const addr = report.location?.address || 
          (lat && lng ? `${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E` : 'Location saved');

        if (wasPending && isAssigned) {
          const workerName = report.assignedWorker?.name || 'A worker';
          const text = `Report at ${addr} was accepted by ${workerName}!`;
          pendingNewNotifs.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            text,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: false,
            icon: '🚗',
            timestamp: new Date().toISOString()
          });
          shouldPlaySound = true;

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Report Accepted 🚗', {
              body: text,
              icon: '🌿'
            });
          }
        } else if (wasNotCompleted && isCompleted) {
          const text = `Report at ${addr} has been marked as cleaned!`;
          pendingNewNotifs.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            text,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: false,
            icon: '✅',
            timestamp: new Date().toISOString()
          });
          shouldPlaySound = true;

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Report Cleaned ✅', {
              body: text,
              icon: '🌿'
            });
          }
        }
      }
    });

    if (pendingNewNotifs.length > 0) {
      setNotifications(prev => {
        const updated = [...pendingNewNotifs, ...prev];
        localStorage.setItem('safai_user_notifications', JSON.stringify(updated));
        return updated;
      });
      if (shouldPlaySound) {
        playChimeSound();
      }
    }

    prevReportsRef.current = newReports;
  };

  const handleDeleteAccount = async () => {
    const token = localStorage.getItem('safai_token');
    setDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success) {
        // Clear all local data and redirect
        localStorage.removeItem('safai_token');
        localStorage.removeItem('safai_user');
        localStorage.removeItem('safai_user_notifications');
        localStorage.removeItem('safai_notifications_enabled');
        window.location.href = '/';
      } else {
        alert('Failed to delete account: ' + (data.message || 'Unknown error'));
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteReport = async (id) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      setReportsLoading(true);
      await deleteReport(id);
      setMyReports(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete report.');
    } finally {
      setReportsLoading(false);
    }
  };

  // Fetch reports on mount (to populate profile stats)
  useEffect(() => {
    setReportsLoading(true);
    fetch(`${BASE_URL}/api/reports`)
      .then(r => r.json())
      .then(d => {
        setMyReports(d.reports || []);
        setReportsLoading(false);
        handleReportsUpdate(d.reports || []);
      })
      .catch(() => setReportsLoading(false));
  }, []);

  // Fetch reports or workers based on activePage
  useEffect(() => {
    if (activePage === 'myreports') {
      setReportsLoading(true);
      fetch(`${BASE_URL}/api/reports`)
        .then(r => r.json())
        .then(d => {
          setMyReports(d.reports || []);
          setReportsLoading(false);
          handleReportsUpdate(d.reports || []);
        })
        .catch(() => setReportsLoading(false));
    }
    if (activePage === 'workers') {
      setWorkersLoading(true);
      fetch(`${BASE_URL}/api/workers`)
        .then(r => r.json())
        .then(d => { setWorkers(d.workers || []); setWorkersLoading(false); })
        .catch(() => setWorkersLoading(false));
    }
  }, [activePage]);

  // Polling for real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${BASE_URL}/api/reports`)
        .then(r => r.json())
        .then(d => {
          if (d.success && d.reports) {
            setMyReports(d.reports);
            handleReportsUpdate(d.reports);
          }
        })
        .catch(err => console.error('Error polling reports:', err));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Media Stream functions
  const startCamera = async () => {
    stopCamera();
    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: facingMode, 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          },
          audio: false
        });
      } catch (constraintErr) {
        console.warn('Ideal camera constraints failed, trying fallback:', constraintErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      setStream(mediaStream);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera. Please check your camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setCameraActive(false);
  };

  // Request Permissions (Location and Camera)
  const requestPermissions = () => {
    setPermissionRequested(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        startCamera();
      },
      (err) => {
        console.error('Location error:', err);
        alert('GPS location permission is required to report garbage.');
        setPermissionRequested(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Start camera when facingMode or view changes to 'camera', only if permission was granted
  useEffect(() => {
    if (view === 'camera' && location && permissionRequested && activePage === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [facingMode, view, activePage]);

  // Bind stream to video element when it becomes available
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, cameraActive]);

  // Capture Photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `safai_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCapturedPhoto(file);
      setCapturedPreview(URL.createObjectURL(blob));
      stopCamera();
      setView('preview');
    }, 'image/jpeg', 0.9);
  };

  // Gallery File upload selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedPhoto(file);
      setCapturedPreview(URL.createObjectURL(file));
      stopCamera();
      setView('preview');
    }
  };

  // Flip Camera
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Submit Report
  const handleSubmit = async () => {
    if (!capturedPhoto || !location) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', capturedPhoto);
      formData.append('lat', location.lat);
      formData.append('lng', location.lng);
      formData.append('address', ''); 
      const res = await submitReport(formData);
      setResult(res.data);
      setView('result');
      
      // Also refetch reports to update profile statistics
      fetch(`${BASE_URL}/api/reports`)
        .then(r => r.json())
        .then(d => { setMyReports(d.reports || []); });
    } catch (err) {
      console.error(err);
      alert('Failed to submit. Check server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif", minHeight:'100vh', background:'#F7F8FA', position:'relative'}}>
      
      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        /* Animated background blobs */
        .safai-bg {
          position: fixed; inset: 0; z-index: 0;
          pointer-events: none; overflow: hidden;
        }
        .blob {
          position: absolute; border-radius: 50%;
          filter: blur(60px); opacity: 0.07;
          animation: blobmove 12s ease-in-out infinite;
        }
        .blob-1 { width:300px; height:300px; background:#C1440E; top:-80px; right:-80px; animation-delay:0s; }
        .blob-2 { width:250px; height:250px; background:#16A34A; bottom:-60px; left:-60px; animation-delay:4s; }
        .blob-3 { width:180px; height:180px; background:#F59E0B; top:40%; left:30%; animation-delay:8s; }
        @keyframes blobmove {
          0%,100% { transform: scale(1) translate(0,0); }
          33% { transform: scale(1.1) translate(20px,-20px); }
          66% { transform: scale(0.95) translate(-15px,15px); }
        }

        /* Floating mini icons */
        .floaticons { position:fixed; inset:0; pointer-events:none; z-index:0; overflow:hidden; }
        .fi { position:absolute; opacity:0.035; font-size:40px; animation:floatie 10s ease-in-out infinite; }
        .fi:nth-child(1){top:8%;left:6%;animation-delay:0s;font-size:32px;}
        .fi:nth-child(2){top:20%;right:8%;animation-delay:2s;font-size:48px;}
        .fi:nth-child(3){top:55%;left:4%;animation-delay:5s;font-size:36px;}
        .fi:nth-child(4){top:72%;right:6%;animation-delay:1s;font-size:44px;}
        .fi:nth-child(5){top:88%;left:22%;animation-delay:3s;font-size:28px;}
        .fi:nth-child(6){top:38%;right:18%;animation-delay:7s;font-size:40px;}
        @keyframes floatie {
          0%,100%{transform:translateY(0) rotate(0deg);}
          33%{transform:translateY(-14px) rotate(6deg);}
          66%{transform:translateY(8px) rotate(-4deg);}
        }

        /* Bottom nav */
        .bnav {
          position:fixed; bottom:0; left:0; right:0; height:68px;
          background:rgba(255,255,255,0.96); backdrop-filter:blur(16px);
          border-top:1px solid rgba(232,232,237,0.9);
          display:flex; z-index:300;
          box-shadow:0 -4px 24px rgba(0,0,0,0.1);
        }
        .bnav-tab {
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:3px; border:none; background:none;
          cursor:pointer; position:relative; padding:6px 4px;
          transition:all 0.2s;
        }
        .bnav-tab.act { color:#C1440E; }
        .bnav-tab:not(.act) { color:#9CA3AF; }
        .bnav-tab.act::after {
          content:''; position:absolute; top:0; left:25%; right:25%;
          height:3px; background:#C1440E; border-radius:0 0 6px 6px;
        }
        .bnav-icon { font-size:22px; line-height:1; }
        .bnav-label { font-size:10px; font-weight:700; letter-spacing:0.03em; }

        /* Notif badge */
        .nbadge {
          position:absolute; top:5px; right:calc(50% - 18px);
          background:#DC2626; color:white; border-radius:10px;
          padding:1px 5px; font-size:9px; font-weight:800;
          border:2px solid white;
        }

        /* Cards */
        .rcard {
          background:white; border-radius:20px; margin-bottom:14px;
          overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.07);
          border:1px solid rgba(240,240,245,0.8);
          transition:transform 0.15s, box-shadow 0.15s;
        }
        .rcard:active { transform:scale(0.98); box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .wcard {
          background:white; border-radius:20px; margin-bottom:12px;
          overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.07);
          border:1px solid rgba(240,240,245,0.8);
          transition:transform 0.15s;
        }
        .wcard:active { transform:scale(0.98); }

        /* Shimmer */
        @keyframes shimmer {
          0%{background-position:-200% 0;} 100%{background-position:200% 0;}
        }
        .shim {
          background:linear-gradient(90deg,#f5f5f5 25%,#ebebeb 50%,#f5f5f5 75%);
          background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:10px;
        }

        /* Notification panel */
        .notif-panel {
          position:fixed; top:0; right:0; bottom:0; left:0; z-index:400;
        }
        .notif-backdrop {
          position:absolute; inset:0; background:rgba(0,0,0,0.4);
          backdrop-filter:blur(4px);
        }
        .notif-drawer {
          position:absolute; top:0; right:0; bottom:0; width:88%; max-width:360px;
          background:white; box-shadow:-8px 0 40px rgba(0,0,0,0.2);
          display:flex; flex-direction:column; animation:slideIn 0.25s ease;
        }
        @keyframes slideIn { from{transform:translateX(100%);} to{transform:translateX(0);} }

        /* Profile page */
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        .fade-up { animation:fadeUp 0.4s ease forwards; }

        /* Pulse for live dot */
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.6;transform:scale(1.3);} }
        .pulse-dot {
          width:7px; height:7px; border-radius:50%; background:#16A34A;
          animation:pulse 1.8s ease-in-out infinite; display:inline-block; margin-right:4px;
        }

        /* Camera controls positioning overrides */
        .camera-overlay-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 24px 20px 40px;
          background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }
        .camera-overlay-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 20px;
          background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }
        .icon-btn {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.1s ease;
          outline: none;
        }
        .icon-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .icon-btn:active {
          transform: scale(0.95);
        }
        .capture-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: none;
          outline: none;
        }
        .capture-inner {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: white;
          transition: background-color 0.2s ease, transform 0.1s ease;
        }
        .capture-ring:active .capture-inner {
          transform: scale(0.9);
        }
        .nav-btn-result {
          border: 1px solid #E8E8ED;
          background-color: #FFFFFF;
          color: #1A1A1A;
          transition: all 0.2s ease;
        }
        .nav-btn-result:hover {
          background-color: #F7F7F8;
          border-color: #D1D1D6;
        }
      `}</style>

      {/* Animated background — only show on non-camera pages */}
      {activePage !== 'camera' && (
        <>
          <div className="safai-bg">
            <div className="blob blob-1"/><div className="blob blob-2"/><div className="blob blob-3"/>
          </div>
          <div className="floaticons">
            <span className="fi">🧹</span><span className="fi">🗑️</span>
            <span className="fi">♻️</span><span className="fi">🌿</span>
            <span className="fi">🧹</span><span className="fi">🌱</span>
          </div>
        </>
      )}

      {/* NOTIFICATION DRAWER */}
      {showNotif && (
        <div className="notif-panel">
          <div className="notif-backdrop" onClick={() => setShowNotif(false)} />
          <div className="notif-drawer">
            <div style={{padding:'20px 20px 16px',borderBottom:'1px solid #F0F0F5',
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'18px',fontWeight:800,color:'#1A1A1A'}}>Notifications</div>
                <div style={{fontSize:'12px',color:'#9CA3AF',marginTop:'2px'}}>
                  {unreadCount} unread
                </div>
              </div>
              <button onClick={() => setShowNotif(false)}
                style={{background:'#F7F8FA',border:'none',borderRadius:'50%',
                  width:'36px',height:'36px',fontSize:'18px',cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                ✕
              </button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
              {notifications.map(n => (
                <div key={n.id}
                  onClick={() => setNotifications(prev => {
                    const updated = prev.map(x => x.id===n.id ? {...x,read:true} : x);
                    localStorage.setItem('safai_user_notifications', JSON.stringify(updated));
                    return updated;
                  })}
                  style={{padding:'14px',borderRadius:'14px',marginBottom:'8px',
                    background: n.read ? '#FAFAFA' : '#FFF7F5',
                    border:`1px solid ${n.read ? '#F0F0F5' : '#FDDDD5'}`,
                    cursor:'pointer',display:'flex',gap:'12px',alignItems:'flex-start'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'12px',
                    background: n.read ? '#F7F8FA' : '#FAEEE8',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'20px',flexShrink:0}}>
                    {n.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px',fontWeight: n.read ? 500 : 700,
                      color:'#1A1A1A',lineHeight:'1.4'}}>
                      {n.text}
                    </div>
                    <div style={{fontSize:'11px',color:'#9CA3AF',marginTop:'4px'}}>
                      {n.time}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',
                      background:'#C1440E',flexShrink:0,marginTop:'4px'}}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{padding:'16px',borderTop:'1px solid #F0F0F5'}}>
              <button onClick={() => setNotifications(prev => {
                const updated = prev.map(n=>({...n,read:true}));
                localStorage.setItem('safai_user_notifications', JSON.stringify(updated));
                return updated;
              })}
                style={{width:'100%',background:'#F7F8FA',border:'1px solid #E8E8ED',
                  borderRadius:'12px',padding:'12px',fontWeight:700,fontSize:'13px',
                  color:'#6B7280',cursor:'pointer'}}>
                Mark all as read
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVBAR — show on all non-camera pages */}
      {(activePage !== 'camera') && (
        <nav style={{position:'sticky',top:0,zIndex:200,height:'64px',
          background:'rgba(255,255,255,0.95)',backdropFilter:'blur(16px)',
          borderBottom:'1px solid rgba(232,232,237,0.7)',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'0 16px'}}>
          {/* Logo */}
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'36px',height:'36px',borderRadius:'10px',
              background:'linear-gradient(135deg,#C1440E,#A03608)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'18px'}}>
              🌿
            </div>
            <div>
              <div style={{fontSize:'16px',fontWeight:900,color:'#1A1A1A',
                letterSpacing:'-0.03em'}}>
                SafAI
              </div>
              <div style={{fontSize:'9px',color:'#9CA3AF',fontWeight:600,
                letterSpacing:'0.08em',marginTop:'-1px'}}>
                CIVIC INTELLIGENCE
              </div>
            </div>
          </div>
          {/* Right icons */}
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            {/* Location pill */}
            <div style={{display:'flex',alignItems:'center',gap:'4px',
              background: location ? '#F0FDF4' : '#F7F8FA',
              color: location ? '#16A34A' : '#9CA3AF',
              borderRadius:'20px',padding:'5px 10px',fontSize:'11px',fontWeight:700,
              border:`1px solid ${location ? '#BBF7D0' : '#E8E8ED'}`}}>
              {location ? <><span className="pulse-dot"/>Live</> : '📍 ...'}
            </div>
            {/* Notif bell */}
            <button onClick={async () => {
              setShowNotif(true);
              if ('Notification' in window && Notification.permission === 'default') {
                try {
                  await Notification.requestPermission();
                } catch (e) {
                  console.error('Error requesting notification permission', e);
                }
              }
            }}
              style={{position:'relative',background:'#F7F8FA',border:'1px solid #E8E8ED',
                borderRadius:'12px',width:'38px',height:'38px',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>
              🔔
              {unreadCount > 0 && (
                <span style={{position:'absolute',top:'-4px',right:'-4px',
                  background:'#DC2626',color:'white',borderRadius:'10px',
                  padding:'1px 5px',fontSize:'9px',fontWeight:800,border:'2px solid white'}}>
                  {unreadCount}
                </span>
              )}
            </button>
            {/* Avatar — goes to profile */}
            <button onClick={() => setActivePage('profile')}
              style={{width:'38px',height:'38px',borderRadius:'12px',
                background:'linear-gradient(135deg,#C1440E,#A03608)',
                border:'none',cursor:'pointer',color:'white',
                fontSize:'16px',fontWeight:800,
                display:'flex',alignItems:'center',justifyContent:'center'}}>
              {user?.name?.[0]?.toUpperCase()}
            </button>
          </div>
        </nav>
      )}

      {/* ── CAMERA VIEW (existing logic, keep 100%) ── */}
      {activePage === 'camera' && view === 'camera' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 68px)', width: '100%', overflow: 'hidden', paddingBottom: '68px', boxSizing: 'border-box' }}>
          {/* NAVBAR */}
          <nav style={{
            height: '60px',
            backgroundColor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(232,232,237,0.6)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 16px',
            boxSizing: 'border-box',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            {/* Left: SafAI Logo */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#1A4A1A', fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🌿 SafAI
              </span>
              <span style={{ fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>
                Civic Intelligence
              </span>
            </div>
            
            {/* Right: User welcome, logout, and live location pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#9999AA', fontWeight: 500 }}>Hi, {user.name}</span>
                  <button
                    onClick={logout}
                    style={{
                      border: '1px solid #E8E8ED',
                      backgroundColor: '#FFFFFF',
                      color: '#CC2222',
                      borderRadius: '20px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
              
              <div style={{
                backgroundColor: location ? '#DCFCE7' : '#F3F4F6',
                color: location ? '#16A34A' : '#6B7280',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span className={location ? 'live-dot' : ''}></span>
                {location ? 'Live' : 'Locating...'}
              </div>
            </div>
          </nav>

          {/* Camera Frame or Permission Screen */}
          {(!location || !cameraActive) ? (
            /* Permissions request gate screen */
            <div style={{
              height: 'calc(100vh - 128px)',
              width: '100%',
              backgroundColor: '#F7F7F8',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '24px',
              boxSizing: 'border-box',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📸</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 700, color: '#1A1A1A' }}>
                Camera & Location Access
              </h2>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#5C5C6E', lineHeight: '1.5', maxWidth: '320px' }}>
                SafAI requires camera and GPS location access to snap garbage photos and assign cleanup workers to the exact spot.
              </p>
              <button
                onClick={requestPermissions}
                disabled={permissionRequested}
                style={{
                  backgroundColor: '#C1440E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 28px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: permissionRequested ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(193, 68, 14, 0.2)',
                  outline: 'none',
                  width: '100%',
                  maxWidth: '280px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                {permissionRequested ? 'Requesting access...' : 'Enable Camera & GPS'}
              </button>
            </div>
          ) : (
            /* Active Camera stream frame */
            <div style={{
              width: '100%',
              height: 'calc(100vh - 128px)',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: 'black'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              {/* Bottom Bar Controls */}
              <div className="camera-overlay-bottom" style={{ paddingBottom: '80px' }}>
                {/* Gallery Picker */}
                <div className="icon-btn" onClick={() => fileInputRef.current.click()}>
                  <span style={{ fontSize: '22px' }}>🖼️</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {/* Snap Button */}
                <button
                  className="capture-ring"
                  onClick={capturePhoto}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  <div 
                    className="capture-inner" 
                    style={{ backgroundColor: isHovered ? '#f0f0f0' : 'white' }}
                  />
                </button>

                {/* Camera Switcher */}
                <div className="icon-btn" onClick={flipCamera}>
                  <span style={{ fontSize: '22px' }}>🔄</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activePage === 'camera' && view === 'preview' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'black',
          zIndex: 99
        }}>
          {/* Captured Image */}
          <img
            src={capturedPreview}
            alt="Captured trash"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          />

          {/* Top Bar */}
          <div className="camera-overlay-top">
            <button
              onClick={() => {
                setView('camera');
                setCapturedPhoto(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                outline: 'none'
              }}
            >
              ←
            </button>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>Review Photo</span>
            <div style={{ width: '24px' }}></div> {/* Spacer */}
          </div>

          {/* Bottom Bar */}
          <div className="camera-overlay-bottom" style={{ gap: '16px', paddingBottom: '80px', marginBottom: '68px' }}>
            {/* Retake Button */}
            <button
              onClick={() => {
                setView('camera');
                setCapturedPhoto(null);
              }}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '14px 28px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                outline: 'none'
              }}
            >
              Retake
            </button>

            {/* Analyse Button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !location}
              style={{
                flex: 1,
                backgroundColor: (!location || loading) ? '#E8E8ED' : '#C1440E',
                color: (!location || loading) ? '#9999AA' : 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 28px',
                fontSize: '15px',
                fontWeight: 700,
                boxShadow: (!location || loading) ? 'none' : '0 4px 16px rgba(193, 68, 14, 0.5)',
                cursor: (!location || loading) ? 'not-allowed' : 'pointer',
                outline: 'none'
              }}
            >
              {loading ? '🔄 Analysing...' : 'Analyse'}
            </button>
          </div>
        </div>
      )}

      {activePage === 'camera' && view === 'result' && result && (
        <div style={{ minHeight: '100vh', backgroundColor: '#F7F7F8', display: 'flex', flexDirection: 'column' }}>
          {/* NAVBAR */}
          <nav style={{
            height: '60px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E8E8ED',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 20px',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            {/* Left: Back */}
            <button
              onClick={() => {
                setView('camera');
                setResult(null);
                setCapturedPhoto(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: '#5C5C6E',
                cursor: 'pointer',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back
            </button>

            {/* Center: Title */}
            <span style={{ color: '#C1440E', fontWeight: 700, fontSize: '18px' }}>SafAI 🌿</span>

            {/* Right: Map */}
            <button
              onClick={() => window.open('/map', '_self')}
              className="nav-btn-result"
              style={{
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🗺️ Map
            </button>
          </nav>

          {/* CONTENT CONTAINER */}
          <main style={{
            maxWidth: '480px',
            width: '100%',
            margin: '0 auto',
            padding: '16px 16px 80px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Result Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E8E8ED',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              overflow: 'hidden'
            }}>
              {/* Top Accent bar */}
              <div style={{
                height: '6px',
                width: '100%',
                backgroundColor: result.aiResult.detected ? '#C1440E' : '#5C5C6E'
              }} />

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {result.aiResult.detected ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🗑️</span>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A1A1A' }}>
                        Garbage Detected
                      </h3>
                    </div>

                    {/* Confidence */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#5C5C6E' }}>AI Confidence</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#C1440E' }}>
                          {Math.round(result.aiResult.confidence)}%
                        </span>
                      </div>
                      <div style={{ width: '100%', backgroundColor: '#E8E8ED', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${result.aiResult.confidence}%`,
                          backgroundColor: '#C1440E',
                          height: '100%',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>

                    {/* Severity Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#5C5C6E' }}>Severity:</span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        backgroundColor:
                          result.aiResult.severity === 'high' ? '#FFE8E8' :
                          result.aiResult.severity === 'medium' ? '#FFF3E0' : '#E8F5E9',
                        color:
                          result.aiResult.severity === 'high' ? '#CC2222' :
                          result.aiResult.severity === 'medium' ? '#E07B00' : '#1E8C45'
                      }}>
                        {result.aiResult.severity}
                      </span>
                    </div>

                    <hr style={{ border: 'none', height: '1px', backgroundColor: '#E8E8ED', margin: 0 }} />

                    {/* Worker assignment */}
                    {result.assignedWorker ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9999AA', letterSpacing: '0.08em' }}>
                          ASSIGNED TO
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A' }}>
                            {result.assignedWorker.name}
                          </div>
                          <div style={{ fontSize: '13px', color: '#5C5C6E' }}>
                            Ward: {result.assignedWorker.ward}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#C1440E', marginTop: '2px' }}>
                            📞 {result.assignedWorker.phone}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#5C5C6E', fontStyle: 'italic' }}>
                        Status: Open (No workers available at the moment)
                      </div>
                    )}

                    {/* AI Explanation */}
                    {result.aiResult.reason && (
                      <div style={{
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: '#5C5C6E',
                        backgroundColor: '#F7F7F8',
                        borderLeft: '3px solid #C1440E',
                        padding: '10px 14px',
                        borderRadius: '0 8px 8px 0',
                        lineHeight: '1.4'
                      }}>
                        "{result.aiResult.reason}"
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '32px' }}>✅</span>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A1A1A' }}>
                      Area looks clean
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#5C5C6E', lineHeight: '1.4' }}>
                      The uploaded image does not appear to contain garbage according to our AI analysis.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SHARE TO AUTHORITIES SECTION */}
            {result.aiResult.detected && (
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E8E8ED',
                padding: '16px',
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A' }}>
                  📣 Share with Authorities
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const lat = location?.lat || 'unknown';
                      const lng = location?.lng || 'unknown';
                      const msg = `🚨 *Garbage Reported on SafAI* 🚨\n\nGarbage has been reported here: https://maps.google.com/?q=${lat},${lng}\n\nPlease take action.\n#SwachhBharat #SafAI`;
                      window.open(`https://wa.me/919999999999?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    style={{
                      backgroundColor: '#25D366',
                      color: 'white',
                      borderRadius: '10px',
                      padding: '10px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      outline: 'none'
                    }}
                  >
                    <span>💬</span> WhatsApp IMC
                  </button>

                  {/* Twitter */}
                  <button
                    onClick={() => {
                      const lat = location?.lat || 'unknown';
                      const lng = location?.lng || 'unknown';
                      const text = `Garbage reported via @SafAI_App! Location: https://maps.google.com/?q=${lat},${lng} @SwachhBharatGov @advpushyamitra please help keep our city clean! 🌿🧹`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    style={{
                      backgroundColor: '#1DA1F2',
                      color: 'white',
                      borderRadius: '10px',
                      padding: '10px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      outline: 'none'
                    }}
                  >
                    <span>🐦</span> Tweet Issue
                  </button>
                </div>

                {/* Native Share */}
                {navigator.share && (
                  <button
                    onClick={() => {
                      const lat = location?.lat || 'unknown';
                      const lng = location?.lng || 'unknown';
                      navigator.share({
                        title: 'SafAI Garbage Report',
                        text: 'Garbage reported! Help keep the city clean.',
                        url: `https://maps.google.com/?q=${lat},${lng}`
                      }).catch(console.error);
                    }}
                    style={{
                      backgroundColor: '#F7F8FA',
                      color: '#5C5C6E',
                      borderRadius: '10px',
                      padding: '10px',
                      border: '1px solid #E8E8ED',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px',
                      outline: 'none'
                    }}
                  >
                    <span>📤</span> Share Link
                  </button>
                )}
              </div>
            )}

            {/* MY REPORTS SECTION */}
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => {
                  setView('camera');
                  setResult(null);
                  setCapturedPhoto(null);
                  setActivePage('myreports');
                }}
                style={{
                  backgroundColor: '#FAEEE8',
                  color: '#C1440E',
                  borderRadius: '10px',
                  padding: '12px',
                  width: '100%',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: '1px solid #C1440E',
                  cursor: 'pointer',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                View All My Reports →
              </button>
            </div>

            {/* REPORT ANOTHER BUTTON */}
            <button
              onClick={() => {
                setView('camera');
                setResult(null);
                setCapturedPhoto(null);
              }}
              style={{
                width: '100%',
                backgroundColor: '#C1440E',
                color: 'white',
                borderRadius: '12px',
                padding: '14px',
                fontWeight: 700,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(193,68,14,0.2)'
              }}
            >
              📷 Report Another
            </button>
          </main>
        </div>
      )}

      {/* ── PROFILE PAGE ── */}
      {activePage === 'profile' && (
        <div style={{minHeight:'calc(100vh - 64px)',paddingBottom:'80px', position:'relative',zIndex:1}}>
          
          {/* Hero banner */}
          <div style={{background:'linear-gradient(135deg,#C1440E 0%,#7A2508 100%)',
            padding:'32px 20px 60px',textAlign:'center',position:'relative',overflow:'hidden'}}>
            {/* bg pattern */}
            <div style={{position:'absolute',inset:0,opacity:0.07,
              fontSize:'36px',display:'flex',flexWrap:'wrap',gap:'16px',
              alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              🌿♻️🧹🌿♻️🧹🌿♻️🧹🌿♻️🧹
            </div>
            <div style={{position:'relative',zIndex:1}}>
              {/* Avatar */}
              <div style={{width:'88px',height:'88px',borderRadius:'50%',
                background:'rgba(255,255,255,0.2)',
                border:'3px solid rgba(255,255,255,0.5)',
                display:'flex',alignItems:'center',justifyContent:'center',
                margin:'0 auto 14px',fontSize:'36px',fontWeight:900,color:'white',
                boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div style={{color:'white',fontSize:'24px',fontWeight:900,
                letterSpacing:'-0.02em'}}>
                {user?.name}
              </div>
              <div style={{color:'rgba(255,255,255,0.7)',fontSize:'13px',marginTop:'4px',
                display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                <span>📱</span> {user?.phone}
              </div>
              <div style={{display:'inline-flex',alignItems:'center',gap:'6px',
                background:'rgba(255,255,255,0.15)',borderRadius:'20px',
                padding:'6px 14px',marginTop:'12px',
                color:'rgba(255,255,255,0.9)',fontSize:'12px',fontWeight:600,
                backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.2)'}}>
                🌟 Eco Citizen
              </div>
            </div>
          </div>

          {/* Stats row — overlaps hero */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',
            gap:'10px',margin:'-28px 16px 0',position:'relative',zIndex:2}}>
            {[
              {label:'Reports Sent', value: myReports.length || '—', icon:'📤'},
              {label:'Cleaned', value: myReports.filter(r=>r.status==='completed'||r.status==='done').length || '0', icon:'✅'},
              {label:'Pending', value: myReports.filter(r=>r.status==='pending'||r.status==='open').length || '0', icon:'⏳'},
            ].map((s,i) => (
              <div key={i} style={{background:'white',borderRadius:'16px',
                padding:'14px 10px',textAlign:'center',
                boxShadow:'0 8px 24px rgba(0,0,0,0.1)',
                border:'1px solid rgba(240,240,245,0.8)'}}
                className="fade-up">
                <div style={{fontSize:'22px',marginBottom:'4px'}}>{s.icon}</div>
                <div style={{fontSize:'22px',fontWeight:900,color:'#1A1A1A'}}>{s.value}</div>
                <div style={{fontSize:'10px',color:'#9CA3AF',fontWeight:600,
                  marginTop:'2px',lineHeight:'1.3'}}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Info card */}
          <div style={{margin:'20px 16px 0',background:'white',borderRadius:'20px',
            padding:'20px',boxShadow:'0 4px 20px rgba(0,0,0,0.06)',
            border:'1px solid rgba(240,240,245,0.8)'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#9CA3AF',
              letterSpacing:'0.08em',marginBottom:'14px'}}>
              ACCOUNT INFO
            </div>
            {[
              {icon:'👤', label:'Full Name', value: user?.name},
              {icon:'📱', label:'Phone', value: user?.phone},
              {icon:'🏷️', label:'Role', value:'Citizen'},
              {icon:'🌆', label:'City', value:'Indore, MP'},
            ].map((row,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'14px',
                padding:'12px 0',
                borderBottom: i<3 ? '1px solid #F7F8FA' : 'none'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'12px',
                  background:'#FFF7F5',display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:'18px',flexShrink:0}}>
                  {row.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'11px',color:'#9CA3AF',fontWeight:600}}>
                    {row.label}
                  </div>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#1A1A1A',marginTop:'1px'}}>
                    {row.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{margin:'16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <button onClick={() => setActivePage('myreports')}
              style={{background:'linear-gradient(135deg,#FFF7F5,#FAEEE8)',
                border:'1px solid #FDDDD5',borderRadius:'16px',padding:'16px',
                cursor:'pointer',textAlign:'left'}}>
              <div style={{fontSize:'24px',marginBottom:'6px'}}>📋</div>
              <div style={{fontSize:'13px',fontWeight:700,color:'#C1440E'}}>My Reports</div>
              <div style={{fontSize:'11px',color:'#9CA3AF',marginTop:'2px'}}>View all submissions</div>
            </button>
            <button onClick={() => window.location.href='/map'}
              style={{background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',
                border:'1px solid #BBF7D0',borderRadius:'16px',padding:'16px',
                cursor:'pointer',textAlign:'left'}}>
              <div style={{fontSize:'24px',marginBottom:'6px'}}>🗺️</div>
              <div style={{fontSize:'13px',fontWeight:700,color:'#16A34A'}}>Live Map</div>
              <div style={{fontSize:'11px',color:'#9CA3AF',marginTop:'2px'}}>See active cleanups</div>
            </button>
          </div>

          {/* Logout */}
          <div style={{margin:'4px 16px 0'}}>
            <button onClick={logout}
              style={{width:'100%',background:'linear-gradient(135deg,#FEE2E2,#FECACA)',
                border:'1px solid #FECACA',borderRadius:'16px',padding:'16px',
                color:'#DC2626',fontWeight:700,fontSize:'15px',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              🚪 Logout
            </button>
          </div>

          {/* Delete Account */}
          <div style={{margin:'10px 16px 0'}}>
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{width:'100%',background:'transparent',
                border:'1.5px dashed #FCA5A5',borderRadius:'16px',padding:'14px',
                color:'#9CA3AF',fontWeight:600,fontSize:'13px',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                transition:'all 0.2s'}}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#DC2626'; e.currentTarget.style.color='#DC2626'; e.currentTarget.style.background='#FFF5F5'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#FCA5A5'; e.currentTarget.style.color='#9CA3AF'; e.currentTarget.style.background='transparent'; }}>
              🗑️ Delete Account
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL ── */}
      {showDeleteConfirm && (
        <div style={{
          position:'fixed',inset:0,zIndex:600,
          display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'
        }}>
          {/* Backdrop */}
          <div style={{
            position:'absolute',inset:0,
            background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)'
          }} onClick={() => !deleting && setShowDeleteConfirm(false)} />

          {/* Modal Card */}
          <div style={{
            position:'relative',zIndex:1,
            background:'white',borderRadius:'24px',
            padding:'28px 24px',maxWidth:'340px',width:'100%',
            boxShadow:'0 24px 64px rgba(0,0,0,0.2)',
            textAlign:'center',
            animation:'fadeUp 0.25s ease'
          }}>
            {/* Icon */}
            <div style={{
              width:'72px',height:'72px',borderRadius:'50%',
              background:'linear-gradient(135deg,#FEE2E2,#FECACA)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'32px',margin:'0 auto 16px',
              border:'3px solid #FECACA'
            }}>⚠️</div>

            <div style={{fontSize:'20px',fontWeight:900,color:'#1A1A1A',marginBottom:'8px'}}>
              Delete Account?
            </div>
            <div style={{fontSize:'13px',color:'#6B7280',lineHeight:'1.6',marginBottom:'24px'}}>
              This action is <strong>permanent</strong> and cannot be undone.
              All your data including reports and profile will be deleted forever.
            </div>

            {/* Buttons */}
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  width:'100%',
                  background: deleting ? '#E8E8ED' : 'linear-gradient(135deg,#DC2626,#B91C1C)',
                  color: deleting ? '#9CA3AF' : 'white',
                  border:'none',borderRadius:'14px',padding:'14px',
                  fontWeight:800,fontSize:'15px',cursor: deleting ? 'not-allowed' : 'pointer',
                  boxShadow: deleting ? 'none' : '0 4px 16px rgba(220,38,38,0.35)',
                  transition:'all 0.2s'
                }}>
                {deleting ? '⏳ Deleting...' : '🗑️ Yes, Delete My Account'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  width:'100%',
                  background:'#F7F8FA',border:'1px solid #E8E8ED',
                  borderRadius:'14px',padding:'14px',
                  fontWeight:700,fontSize:'14px',
                  color:'#6B7280',cursor:'pointer'
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MY REPORTS PAGE ── */}
      {activePage === 'myreports' && (
        <div style={{minHeight:'calc(100vh - 64px)',paddingBottom:'80px',
          position:'relative',zIndex:1}}>
          
          {/* Header */}
          <div style={{padding:'20px 16px 16px',background:'white',
            borderBottom:'1px solid #F0F0F5',
            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <h2 style={{margin:0,fontSize:'22px',fontWeight:900,color:'#1A1A1A',
                letterSpacing:'-0.02em'}}>
                My Reports
              </h2>
              <p style={{margin:'3px 0 0',fontSize:'13px',color:'#9CA3AF'}}>
                {myReports.length} total submissions
              </p>
            </div>
            <div style={{background:'#FFF7F5',borderRadius:'12px',
              padding:'8px 14px',border:'1px solid #FDDDD5'}}>
              <span style={{fontSize:'13px',fontWeight:700,color:'#C1440E'}}>
                {myReports.filter(r=>r.status==='completed'||r.status==='done').length} cleaned ✅
              </span>
            </div>
          </div>

          <div style={{padding:'16px'}}>
            {reportsLoading ? (
              [1,2,3].map(i => (
                <div key={i} style={{background:'white',borderRadius:'20px',
                  marginBottom:'14px',overflow:'hidden'}}>
                  <div className="shim" style={{height:'180px',width:'100%',borderRadius:0}}/>
                  <div style={{padding:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div className="shim" style={{height:'18px',width:'50%'}}/>
                    <div className="shim" style={{height:'13px',width:'75%'}}/>
                    <div className="shim" style={{height:'13px',width:'40%'}}/>
                  </div>
                </div>
              ))
            ) : myReports.length === 0 ? (
              <div style={{textAlign:'center',padding:'70px 20px',color:'#6B7280'}}>
                <div style={{fontSize:'64px',marginBottom:'16px',
                  animation:'floatie 3s ease-in-out infinite'}}>📋</div>
                <div style={{fontSize:'18px',fontWeight:800,color:'#1A1A1A',marginBottom:'8px'}}>
                  No reports yet
                </div>
                <div style={{fontSize:'14px',color:'#9CA3AF',lineHeight:'1.5'}}>
                  Help keep your city clean.<br/>Snap your first garbage report!
                </div>
                <button onClick={() => setActivePage('camera')}
                  style={{marginTop:'24px',background:'linear-gradient(135deg,#C1440E,#A03608)',
                    color:'white',border:'none',borderRadius:'14px',
                    padding:'14px 28px',fontWeight:800,cursor:'pointer',
                    fontSize:'15px',boxShadow:'0 4px 16px rgba(193,68,14,0.35)'}}>
                  📷 Snap Now
                </button>
              </div>
            ) : myReports.map((report, idx) => {
              const status = report.status;
              let sBg, sColor, sText, sIcon;
              if(status==='completed'||status==='done'){
                sBg='#F0FDF4';sColor='#16A34A';sText='Cleaned';sIcon='✅';
              } else if(status==='accepted'||status==='assigned'){
                sBg='#EFF6FF';sColor='#2563EB';sText='In Progress';sIcon='🚗';
              } else {
                sBg='#FFFBEB';sColor='#D97706';sText='Pending';sIcon='⏳';
              }
              const lat = report.location?.lat || report.lat;
              const lng = report.location?.lng || report.lng;
              const addr = report.location?.address || 
                (lat && lng ? `${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E` : 'Location saved');
              const conf = report.aiResult?.confidence || report.aiConfidence;
              const sev = report.severity || report.aiResult?.severity;
              let sevColor = '#16A34A';
              if(sev==='high') sevColor='#DC2626';
              else if(sev==='medium') sevColor='#D97706';
              
              return (
                <div key={report._id || idx} className="rcard">
                  {/* Image with overlays */}
                  <div style={{position:'relative'}}>
                    <img src={report.imageUrl} alt="garbage"
                      style={{width:'100%',height:'190px',objectFit:'cover',display:'block'}}/>
                    {/* Gradient overlay */}
                    <div style={{position:'absolute',bottom:0,left:0,right:0,height:'80px',
                      background:'linear-gradient(transparent,rgba(0,0,0,0.6))'}}/>
                    {/* Status pill top-right */}
                    <div style={{position:'absolute',top:'12px',right:'12px',
                      background:sBg,color:sColor,borderRadius:'20px',
                      padding:'5px 12px',fontSize:'12px',fontWeight:700,
                      backdropFilter:'blur(8px)',
                      boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>
                      {sIcon} {sText}
                    </div>
                    {/* Severity top-left */}
                    {sev && (
                      <div style={{position:'absolute',top:'12px',left:'12px',
                        background:'rgba(0,0,0,0.6)',color:'white',borderRadius:'8px',
                        padding:'4px 8px',fontSize:'10px',fontWeight:700,
                        textTransform:'uppercase',backdropFilter:'blur(4px)'}}>
                        <span style={{color:sevColor}}>●</span> {sev}
                      </div>
                    )}
                    {/* Location bottom of image */}
                    <div style={{position:'absolute',bottom:'10px',left:'12px',right:'12px',
                      color:'white',fontSize:'12px',fontWeight:600,
                      display:'flex',alignItems:'center',gap:'4px'}}>
                      <span>📍</span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {addr}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{padding:'14px'}}>
                    {/* AI reason */}
                    {report.aiResult?.reason && (
                      <div style={{background:'#FFF7F5',borderRadius:'10px',
                        padding:'10px 12px',marginBottom:'12px',
                        borderLeft:'3px solid #C1440E'}}>
                        <div style={{fontSize:'10px',fontWeight:700,color:'#C1440E',
                          letterSpacing:'0.06em',marginBottom:'3px'}}>
                          AI ANALYSIS
                        </div>
                        <div style={{fontSize:'13px',color:'#374151',
                          fontStyle:'italic',lineHeight:'1.4'}}>
                          "{report.aiResult.reason}"
                        </div>
                      </div>
                    )}

                    {/* Bottom row */}
                    <div style={{display:'flex',justifyContent:'space-between',
                      alignItems:'center'}}>
                      <div style={{fontSize:'11px',color:'#9CA3AF'}}>
                        {new Date(report.createdAt).toLocaleDateString('en-IN',
                          {day:'numeric',month:'short',year:'numeric'})}
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                        {conf && (
                          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                            <div style={{width:'60px',height:'5px',background:'#F0F0F5',
                              borderRadius:'3px',overflow:'hidden'}}>
                              <div style={{width:`${conf}%`,height:'100%',
                                background:'linear-gradient(90deg,#C1440E,#F59E0B)',
                                borderRadius:'3px'}}/>
                            </div>
                            <span style={{fontSize:'11px',fontWeight:700,color:'#C1440E'}}>
                              {Math.round(conf)}%
                            </span>
                          </div>
                        )}
                        <button 
                          onClick={() => handleDeleteReport(report._id)}
                          style={{
                            background: '#FEE2E2', 
                            color: '#DC2626', 
                            border: 'none', 
                            borderRadius: '8px', 
                            padding: '6px 10px', 
                            fontSize: '12px', 
                            fontWeight: 'bold', 
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Worker assigned row */}
                    {report.assignedWorker && (
                      <div style={{marginTop:'10px',padding:'10px 12px',
                        background:'#F7F8FA',borderRadius:'10px',
                        display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'18px'}}>👷</span>
                        <div>
                          <div style={{fontSize:'12px',fontWeight:700,color:'#1A1A1A'}}>
                            {report.assignedWorker.name || 'Worker Assigned'}
                          </div>
                          {report.assignedWorker.phone && (
                            <a href={'tel:'+report.assignedWorker.phone}
                              style={{fontSize:'11px',color:'#C1440E',fontWeight:600,
                                textDecoration:'none'}}>
                              📞 {report.assignedWorker.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WORKERS PAGE ── */}
      {activePage === 'workers' && (
        <div style={{minHeight:'calc(100vh - 64px)',paddingBottom:'80px',
          position:'relative',zIndex:1}}>
          
          {/* Green header */}
          <div style={{background:'linear-gradient(135deg,#1A4A1A 0%,#2D7A2D 100%)',
            padding:'24px 16px 28px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,opacity:0.07,fontSize:'32px',
              display:'flex',flexWrap:'wrap',gap:'12px',alignItems:'center',
              justifyContent:'center',pointerEvents:'none'}}>
              🧹♻️🌿🧹♻️🌿🧹♻️
            </div>
            <h2 style={{margin:0,fontSize:'22px',fontWeight:900,color:'white',
              position:'relative',zIndex:1}}>
              🧹 Nagar Nigam
            </h2>
            <p style={{margin:'4px 0 0',fontSize:'13px',color:'rgba(255,255,255,0.75)',
              position:'relative',zIndex:1}}>
              Contact workers & helplines near you
            </p>
          </div>

          <div style={{padding:'16px'}}>
            {/* Official helplines */}
            <div style={{fontSize:'11px',fontWeight:700,color:'#9CA3AF',
              letterSpacing:'0.08em',marginBottom:'10px'}}>
              OFFICIAL HELPLINES
            </div>
            {[
              {name:'Nagar Nigam Helpline', phone:'1533', ward:'All Wards', emoji:'🏛️', bg:'#F0FDF4', border:'#BBF7D0', btnBg:'#16A34A'},
              {name:'Indore Municipal Corp', phone:'0731-2970000', ward:'Indore City', emoji:'🏢', bg:'#EFF6FF', border:'#BFDBFE', btnBg:'#2563EB'},
              {name:'Swachh Bharat Helpline', phone:'1969', ward:'National', emoji:'🇮🇳', bg:'#FFFBEB', border:'#FDE68A', btnBg:'#D97706'},
            ].map((c,i) => (
              <div key={i} className="wcard" style={{padding:'14px 16px',
                display:'flex',alignItems:'center',gap:'12px',
                background:`linear-gradient(135deg,white,${c.bg})`,
                border:`1px solid ${c.border}`}}>
                <div style={{width:'48px',height:'48px',borderRadius:'14px',
                  background:c.bg,display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:'22px',flexShrink:0,
                  border:`1px solid ${c.border}`}}>
                  {c.emoji}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'14px',fontWeight:800,color:'#1A1A1A'}}>
                    {c.name}
                  </div>
                  <div style={{fontSize:'12px',color:'#6B7280',marginTop:'2px'}}>
                    📍 {c.ward}
                  </div>
                </div>
                <a href={'tel:'+c.phone}
                  style={{background:c.btnBg,color:'white',borderRadius:'12px',
                    padding:'10px 14px',fontWeight:700,fontSize:'13px',
                    textDecoration:'none',flexShrink:0,
                    boxShadow:`0 4px 12px ${c.btnBg}44`}}>
                  📞 {c.phone}
                </a>
              </div>
            ))}

            {/* Registered workers */}
            <div style={{fontSize:'11px',fontWeight:700,color:'#9CA3AF',
              letterSpacing:'0.08em',margin:'20px 0 10px'}}>
              REGISTERED WORKERS ({workers.length})
            </div>
            {workersLoading ? (
              [1,2].map(i => (
                <div key={i} style={{background:'white',borderRadius:'20px',
                  marginBottom:'12px',padding:'16px',display:'flex',gap:'12px'}}>
                  <div className="shim" style={{width:'52px',height:'52px',borderRadius:'50%',flexShrink:0}}/>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:'8px'}}>
                    <div className="shim" style={{height:'16px',width:'55%'}}/>
                    <div className="shim" style={{height:'12px',width:'35%'}}/>
                    <div className="shim" style={{height:'12px',width:'45%'}}/>
                  </div>
                </div>
              ))
            ) : workers.length === 0 ? (
              <div style={{textAlign:'center',padding:'40px 20px',background:'white',
                borderRadius:'20px',color:'#9CA3AF'}}>
                <div style={{fontSize:'48px',marginBottom:'12px'}}>👷</div>
                <div style={{fontSize:'15px',fontWeight:700,color:'#6B7280'}}>
                  No workers registered yet
                </div>
              </div>
            ) : workers.map(w => (
              <div key={w._id} className="wcard" style={{padding:'16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                  {/* Avatar */}
                  <div style={{width:'54px',height:'54px',borderRadius:'50%',
                    background:'linear-gradient(135deg,#C1440E,#7A2508)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'white',fontSize:'22px',fontWeight:900,flexShrink:0,
                    boxShadow:'0 4px 12px rgba(193,68,14,0.3)'}}>
                    {w.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'15px',fontWeight:800,color:'#1A1A1A'}}>
                      {w.name}
                    </div>
                    <div style={{fontSize:'12px',color:'#6B7280',marginTop:'2px'}}>
                      📍 Ward: {w.ward || 'General'}
                    </div>
                    <div style={{marginTop:'6px',display:'flex',
                      alignItems:'center',gap:'8px'}}>
                      <span style={{
                        background:w.status==='available'?'#F0FDF4':'#FEF2F2',
                        color:w.status==='available'?'#16A34A':'#DC2626',
                        borderRadius:'20px',padding:'3px 10px',
                        fontSize:'11px',fontWeight:700}}>
                        {w.status==='available'?'🟢 Available':'🔴 On Task'}
                      </span>
                    </div>
                  </div>
                  <a href={'tel:'+w.phone}
                    style={{width:'48px',height:'48px',borderRadius:'14px',
                      background:'linear-gradient(135deg,#C1440E,#A03608)',
                      color:'white',textDecoration:'none',flexShrink:0,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:'20px',boxShadow:'0 4px 12px rgba(193,68,14,0.3)'}}>
                    📞
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV (always visible) ── */}
      <nav className="bnav">
        {[
          {id:'camera', icon:'📷', label:'Snap'},
          {id:'myreports', icon:'📋', label:'My Reports'},
          {id:'map', icon:'🗺️', label:'Live Map'},
          {id:'workers', icon:'👷', label:'Workers'},
          {id:'profile', icon:'👤', label:'Profile'},
        ].map(tab => (
          <button key={tab.id}
            className={`bnav-tab ${activePage===tab.id?'act':''}`}
            onClick={() => {
              if(tab.id==='map'){window.location.href='/map';return;}
              if(tab.id==='camera'){
                setActivePage('camera');
                if(view!=='camera') setView('camera');
                if(!cameraActive && location) startCamera();
                return;
              }
              setActivePage(tab.id);
            }}>
            <span className="bnav-icon">{tab.icon}</span>
            <span className="bnav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

export default ReportPage;
