import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : '';  // In dev, Vite proxies /uploads → localhost:5000

// Fix Leaflet default marker icon bug
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Marker icons
const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

const formatDistance = (distKm) => {
  if (distKm === null || distKm === undefined) return '';
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m`;
  }
  return `${distKm.toFixed(2)} km`;
};

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
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
      osc2.frequency.setValueAtTime(1046.50, audioContext.currentTime); // C6 note
      gain2.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
      osc2.start();
      osc2.stop(audioContext.currentTime + 0.25);
    }, 120);
  } catch (err) {
    console.error('Error playing notification sound:', err);
  }
};

function WorkerDashboard() {
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeTab, setActiveTab] = useState('available'); // 'profile' | 'available' | 'mine' | 'settings'
  const [availableView, setAvailableView] = useState('list'); // 'list' | 'map'
  const [loading, setLoading] = useState(true);
  const [workerLocation, setWorkerLocation] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(() => {
    return localStorage.getItem('safai_notifications_enabled') === 'true';
  });

  const requestsRef = React.useRef(requests);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const toggleNotifications = async () => {
    if (pushNotificationsEnabled) {
      setPushNotificationsEnabled(false);
      localStorage.setItem('safai_notifications_enabled', 'false');
    } else {
      if (!('Notification' in window)) {
        alert('This browser does not support desktop notifications.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushNotificationsEnabled(true);
        localStorage.setItem('safai_notifications_enabled', 'true');
        playNotificationSound();
        new Notification('SafAI Cleanups', {
          body: 'Sound notifications enabled successfully!',
          icon: '🌿'
        });
      } else {
        alert('Notification permission denied. Please allow notifications in your browser settings.');
      }
    }
  };

  // User info from localStorage
  const userJson = localStorage.getItem('safai_user') || localStorage.getItem('user');
  const workerUser = userJson ? JSON.parse(userJson) : {};

  // Verification and fetch on mount
  useEffect(() => {
    const token = localStorage.getItem('safai_token') || localStorage.getItem('token');
    const user = workerUser;

    if (!token || !user || (user.role !== 'worker' && user.role !== 'admin')) {
      window.location.href = '/worker-login';
      return;
    }

    const workerId = user.id || user._id;

    // Fetch worker location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWorkerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error('Error fetching worker location:', err)
    );

    // Fetch all reports
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api/reports`, {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        const data = await res.json();
        
        if (data.success && data.reports) {
          const reports = data.reports;
          
          // Available requests: status is open/pending and not assigned to anyone
          const available = reports.filter(r => 
            (r.status === 'pending' || r.status === 'open') && !r.assignedWorker
          );
          
          // My requests: assigned to this worker and not completed/done
          const mine = reports.filter(r => {
            const assignedId = r.assignedWorker?._id || r.assignedWorker;
            return String(assignedId) === String(workerId) && r.status !== 'completed' && r.status !== 'done';
          });

          // Completed by this worker
          const completed = reports.filter(r => {
            const assignedId = r.assignedWorker?._id || r.assignedWorker;
            return String(assignedId) === String(workerId) && (r.status === 'completed' || r.status === 'done');
          });

          setRequests(available);
          setMyRequests(mine);
          setCompletedCount(completed.length);
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Poll for new reports to show real-time notifications with sound
  useEffect(() => {
    const token = localStorage.getItem('safai_token') || localStorage.getItem('token');
    if (!token) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/reports`, {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        const data = await res.json();
        if (data.success && data.reports) {
          const workerId = workerUser.id || workerUser._id;
          const latestAvailable = data.reports.filter(r => 
            (r.status === 'pending' || r.status === 'open') && !r.assignedWorker
          );
          
          // Check for new reports compared to current requestsRef.current
          const existingIds = new Set(requestsRef.current.map(r => String(r._id)));
          let hasNew = false;
          
          latestAvailable.forEach(r => {
            if (!existingIds.has(String(r._id))) {
              hasNew = true;
            }
          });

          if (hasNew && pushNotificationsEnabled) {
            playNotificationSound();
            new Notification('New Garbage Report! 🚨', {
              body: `A new garbage report is available. Tap to accept.`,
              icon: '🗑️'
            });
          }
          
          setRequests(latestAvailable);
          
          const mine = data.reports.filter(r => {
            const assignedId = r.assignedWorker?._id || r.assignedWorker;
            return String(assignedId) === String(workerId) && r.status !== 'completed' && r.status !== 'done';
          });
          const completed = data.reports.filter(r => {
            const assignedId = r.assignedWorker?._id || r.assignedWorker;
            return String(assignedId) === String(workerId) && (r.status === 'completed' || r.status === 'done');
          });
          
          setMyRequests(mine);
          setCompletedCount(completed.length);
        }
      } catch (err) {
        console.error('Error polling reports:', err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [pushNotificationsEnabled]);

  // Handle Accept Request
  const handleAccept = async (reportId) => {
    const token = localStorage.getItem('safai_token') || localStorage.getItem('token');
    setAcceptingId(reportId);
    
    try {
      const response = await fetch(`${BASE_URL}/api/reports/` + reportId + '/accept', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token 
        }
      });
      
      if (!response.ok) {
        if (response.status === 409) {
          const data = await response.json();
          alert(data.message || 'Already taken by another worker.');
          // Remove from available
          setRequests(prev => prev.filter(r => r._id !== reportId));
          return;
        }
        throw new Error('Failed to accept report');
      }
      
      // Remove from available, add to myRequests
      const accepted = requests.find(r => r._id === reportId);
      setRequests(prev => prev.filter(r => r._id !== reportId));
      setMyRequests(prev => [...prev, { ...accepted, status: 'accepted' }]);
      setActiveTab('mine');
    } catch (err) {
      console.error(err);
      alert('Failed to accept task.');
    } finally {
      setAcceptingId(null);
    }
  };

  // Handle Mark Done (Proof upload and verification)
  const handleMarkDone = async (reportId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setLoading(true);
      const formData = new FormData();
      formData.append('afterPhoto', file);
      
      const token = localStorage.getItem('safai_token') || localStorage.getItem('token');
      try {
        const res = await fetch(`${BASE_URL}/api/reports/` + reportId + '/complete', {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData
        });
        const data = await res.json();
        
        if (data.success) {
          alert('✅ Verified! Area marked as clean.');
          setMyRequests(prev => prev.filter(r => r._id !== reportId));
          setCompletedCount(prev => prev + 1);
        } else {
          alert('❌ AI could not verify cleaning: ' + (data.message || 'Try again.'));
        }
      } catch (err) {
        console.error(err);
        alert('❌ Error uploading proof of cleanup.');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/worker-login';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F7F8', fontFamily: "'Inter', sans-serif", paddingBottom: '80px', boxSizing: 'border-box' }}>
      <style>{`
        .worker-bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 68px;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(12px);
          border-top: 1px solid #E8E8ED;
          display: flex; z-index: 200;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
        }
        .w-nav-tab {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 3px; cursor: pointer; border: none;
          background: none; padding: 8px 4px;
          transition: all 0.2s;
        }
        @keyframes wfloat {
          0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)}
        }
        .shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .worker-card {
          background: white; border-radius: 16px; margin-bottom: 12px;
          overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid #F0F0F5;
          transition: transform 0.2s, box-shadow 0.2s;
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        height: '64px',
        background: 'linear-gradient(135deg, #1A4A1A 0%, #2D7A2D 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <span style={{ fontWeight: 800, color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🌿 SafAI Worker
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '20px', cursor: 'pointer', color: 'white', opacity: 0.8 }}>🔔</span>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
              color: '#FCA5A5',
              border: '1px solid rgba(220, 38, 38, 0.4)',
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
      </nav>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: '480px', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div className="shimmer" style={{ height: '40px', width: '100%', marginBottom: '16px' }} />
            <div className="shimmer" style={{ height: '180px', width: '100%', marginBottom: '16px' }} />
            <div className="shimmer" style={{ height: '180px', width: '100%' }} />
          </div>
        )}

        {/* Requests (Available) Tab Content */}
        {!loading && activeTab === 'available' && (
          <div style={{ padding: '0 16px', paddingTop: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1A1A1A' }}>
                  📋 Live Requests
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
                  Accept pending cleanups in your area
                </p>
              </div>
            </div>

            {/* List/Map Toggle */}
            <div style={{ display: 'flex', background: '#E8E8ED', borderRadius: '8px', padding: '2px', marginBottom: '16px' }}>
              <button
                onClick={() => setAvailableView('list')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  background: availableView === 'list' ? 'white' : 'transparent',
                  fontWeight: 600,
                  fontSize: '13px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: availableView === 'list' ? '#1A4A1A' : '#6B7280',
                  boxShadow: availableView === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                📋 List View
              </button>
              <button
                onClick={() => setAvailableView('map')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  background: availableView === 'map' ? 'white' : 'transparent',
                  fontWeight: 600,
                  fontSize: '13px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: availableView === 'map' ? '#1A4A1A' : '#6B7280',
                  boxShadow: availableView === 'map' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🗺️ Map View
              </button>
            </div>

            {availableView === 'list' ? (
              requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280', background: 'white', borderRadius: '16px', border: '1px solid #F0F0F5' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A', marginBottom: '8px' }}>
                    No pending requests!
                  </div>
                  <div style={{ fontSize: '13px' }}>All garbage locations cleared.</div>
                </div>
              ) : (
                requests.map((report) => {
                  const lat = report.location?.lat || report.lat;
                  const lng = report.location?.lng || report.lng;
                  const address = report.location?.address || report.address || `Near ${lat?.toFixed(4)}, ${lng?.toFixed(4)}`;
                  const reason = report.aiResult?.reason || report.aiReason || report.reason || 'Garbage detected';
                  const severity = report.severity || 'low';
                  const dist = workerLocation ? getDistance(workerLocation.lat, workerLocation.lng, lat, lng) : null;

                  let severityBg = '#DCFCE7';
                  let severityColor = '#16A34A';
                  if (severity === 'high') {
                    severityBg = '#FEE2E2';
                    severityColor = '#DC2626';
                  } else if (severity === 'medium') {
                    severityBg = '#FEF3C7';
                    severityColor = '#D97706';
                  }

                  const timeAgo = Math.floor((Date.now() - new Date(report.createdAt)) / 60000);

                  return (
                    <div key={report._id} className="worker-card">
                      <img
                        src={report.imageUrl}
                        alt="Garbage report"
                        style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                      />
                      <div style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            backgroundColor: severityBg,
                            color: severityColor,
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            {severity}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            {timeAgo <= 0 ? 'Just now' : `${timeAgo}m ago`}
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📍 {address}
                        </div>

                        {dist !== null && (
                          <div style={{ fontSize: '12px', color: '#16A34A', fontWeight: 700, marginTop: '4px' }}>
                            📏 Distance: {formatDistance(dist)}
                          </div>
                        )}

                        <div style={{
                          fontSize: '13px',
                          color: '#374151',
                          marginTop: '6px',
                          lineHeight: '1.4',
                          fontStyle: 'italic'
                        }}>
                          "{reason}"
                        </div>

                        <button
                          onClick={() => handleAccept(report._id)}
                          disabled={acceptingId === report._id}
                          style={{
                            width: '100%',
                            backgroundColor: '#16A34A',
                            color: 'white',
                            borderRadius: '12px',
                            border: 'none',
                            padding: '12px',
                            fontWeight: 700,
                            marginTop: '10px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            boxShadow: '0 4px 12px rgba(22,163,74,0.2)'
                          }}
                        >
                          {acceptingId === report._id ? 'Accepting...' : 'Accept Task'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* Map View for Worker */
              <div style={{ height: 'calc(100vh - 250px)', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E8E8ED', position: 'relative', zIndex: 10 }}>
                {workerLocation ? (
                  <MapContainer
                    center={[workerLocation.lat, workerLocation.lng]}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {/* Worker current marker */}
                    <Marker position={[workerLocation.lat, workerLocation.lng]} icon={blueIcon}>
                      <Popup>
                        <div style={{ fontWeight: 600 }}>Your Location</div>
                      </Popup>
                    </Marker>

                    {/* Pending reports */}
                    {requests.map(report => {
                      const lat = report.location?.lat || report.lat;
                      const lng = report.location?.lng || report.lng;
                      const dist = getDistance(workerLocation.lat, workerLocation.lng, lat, lng);
                      const address = report.location?.address || report.address || `Lat: ${lat?.toFixed(4)}, Lng: ${lng?.toFixed(4)}`;
                      return (
                        <Marker key={report._id} position={[lat, lng]} icon={redIcon}>
                          <Popup>
                            <div style={{ width: '180px', fontFamily: "'Inter', sans-serif" }}>
                              <img src={report.imageUrl} alt="Garbage" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1A1A1A', marginBottom: '4px' }}>
                                📍 {address}
                              </div>
                              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, marginBottom: '8px' }}>
                                📏 Distance: {formatDistance(dist)}
                              </div>
                              <button
                                onClick={() => handleAccept(report._id)}
                                disabled={acceptingId === report._id}
                                style={{
                                  width: '100%',
                                  backgroundColor: '#16A34A',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '8px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                {acceptingId === report._id ? 'Accepting...' : 'Accept Request'}
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: 'white', color: '#6B7280', fontSize: '13px' }}>
                    Locating worker GPS position...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Jobs Tab Content */}
        {!loading && activeTab === 'mine' && (
          <div style={{ padding: '0 16px', paddingTop: '16px' }}>
            {/* Header */}
            <div style={{ paddingBottom: '12px', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1A1A1A' }}>
                ✅ Active Jobs
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
                Tasks you are currently working on
              </p>
            </div>

            {myRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280', background: 'white', borderRadius: '16px', border: '1px solid #F0F0F5' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A', marginBottom: '8px' }}>
                  No active jobs!
                </div>
                <div style={{ fontSize: '13px' }}>Go to Live Requests to accept a task.</div>
              </div>
            ) : (
              myRequests.map((report) => {
                const lat = report.location?.lat || report.lat;
                const lng = report.location?.lng || report.lng;
                const address = report.location?.address || report.address || `Near ${lat?.toFixed(4)}, ${lng?.toFixed(4)}`;
                const reason = report.aiResult?.reason || report.aiReason || report.reason || 'Garbage detected';
                const severity = report.severity || 'low';
                const dist = workerLocation ? getDistance(workerLocation.lat, workerLocation.lng, lat, lng) : null;

                let severityBg = '#DCFCE7';
                let severityColor = '#16A34A';
                if (severity === 'high') {
                  severityBg = '#FEE2E2';
                  severityColor = '#DC2626';
                } else if (severity === 'medium') {
                  severityBg = '#FEF3C7';
                  severityColor = '#D97706';
                }

                const timeAgo = Math.floor((Date.now() - new Date(report.createdAt)) / 60000);

                return (
                  <div key={report._id} className="worker-card">
                    <img
                      src={report.imageUrl}
                      alt="Garbage report"
                      style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          backgroundColor: severityBg,
                          color: severityColor,
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {severity}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          {timeAgo <= 0 ? 'Just now' : `${timeAgo}m ago`}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px', fontWeight: 500 }}>
                        📍 {address}
                      </div>

                      {dist !== null && (
                        <div style={{ fontSize: '12px', color: '#16A34A', fontWeight: 700, marginTop: '4px' }}>
                          📏 Distance: {formatDistance(dist)}
                        </div>
                      )}

                      <div style={{
                        fontSize: '13px',
                        color: '#374151',
                        marginTop: '6px',
                        lineHeight: '1.4',
                        fontStyle: 'italic'
                      }}>
                        "{reason}"
                      </div>

                      {/* Status Badge */}
                      <div style={{
                        backgroundColor: '#E6F4EA',
                        color: '#137333',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '13px',
                        marginTop: '10px',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        🚗 Accepted — Head to location
                      </div>

                      {/* View on Map */}
                      <button
                        onClick={() => window.open('https://maps.google.com/?q=' + lat + ',' + lng, '_blank')}
                        style={{
                          width: '100%',
                          backgroundColor: '#1A1A1A',
                          color: 'white',
                          borderRadius: '12px',
                          border: 'none',
                          padding: '12px',
                          fontWeight: 600,
                          marginTop: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        View On Map
                      </button>

                      {/* Mark Done */}
                      <button
                        onClick={() => handleMarkDone(report._id)}
                        style={{
                          width: '100%',
                          backgroundColor: '#FFFFFF',
                          color: '#16A34A',
                          borderRadius: '12px',
                          border: '2px solid #16A34A',
                          padding: '10px',
                          fontWeight: 700,
                          marginTop: '8px',
                          cursor: 'pointer',
                          boxSizing: 'border-box'
                        }}
                      >
                        Mark Done
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Profile Tab Content */}
        {!loading && activeTab === 'profile' && (
          <div style={{ minHeight: 'calc(100vh - 132px)', paddingBottom: '80px', background: '#F7F7F8' }}>
            {/* Green header */}
            <div style={{ background: 'linear-gradient(135deg, #1A4A1A, #2D7A2D)', padding: '32px 20px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Floating bg icons */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.06, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', fontSize: '32px', pointerEvents: 'none' }}>
                🧹🗑️♻️🌿🧹🌱🗑️♻️
              </div>
              {/* Settings icon top right */}
              <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '20px', cursor: 'pointer' }} onClick={() => setActiveTab('settings')}>⚙️</div>
              {/* Avatar */}
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifycontent: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '36px', fontWeight: 800, color: 'white' }}>
                {workerUser.name?.[0]?.toUpperCase() || 'W'}
              </div>
              <div style={{ color: 'white', fontSize: '22px', fontWeight: 800 }}>
                {workerUser.name || 'Nagar Nigam Worker'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>
                ID: Nagar Nigam · {workerUser.ward || 'General Ward'}
              </div>
            </div>

            {/* Stats grid — offset to overlap the green header */}
            <div style={{ margin: '-20px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', position: 'relative', zIndex: 1 }}>
              {[
                { label: 'Current Tasks', value: myRequests.length, color: '#C1440E' },
                { label: 'Performance', value: '95%', color: '#16A34A' },
                { label: 'Common Tasks', value: myRequests.length + completedCount, color: '#2563EB' },
                { label: 'Separators', value: '10', color: '#D97706' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '16px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '1px solid #F0F0F5' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', fontWeight: 600 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Info card */}
            <div style={{ margin: '16px', background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0F0F5' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📞</span>
                  <div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>PHONE</div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{workerUser.phone}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📍</span>
                  <div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>WARD</div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{workerUser.ward || 'General'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout */}
            <div style={{ margin: '0 16px' }}>
              <button onClick={handleLogout}
                style={{ width: '100%', background: 'linear-gradient(135deg,#DC2626,#B91C1C)', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(220,38,38,0.3)' }}>
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Settings Tab Content */}
        {!loading && activeTab === 'settings' && (
          <div style={{ minHeight: 'calc(100vh - 128px)', backgroundColor: '#F7F7F8', paddingBottom: '80px', position: 'relative', zIndex: 1, paddingTop: '16px' }}>
            <div style={{ padding: '0 16px' }}>
              {/* Header */}
              <div style={{ paddingBottom: '12px', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1A1A1A' }}>
                  ⚙️ Settings
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
                  Manage preferences & app info
                </p>
              </div>

              {/* Settings Card */}
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #F0F0F5', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0F0F5', paddingBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A' }}>Push Notifications</span>
                  {/* Toggle UI */}
                  <div 
                    onClick={toggleNotifications}
                    style={{ 
                      width: '48px', 
                      height: '24px', 
                      borderRadius: '12px', 
                      background: pushNotificationsEnabled ? '#16A34A' : '#D1D1D6', 
                      padding: '2px', 
                      display: 'flex', 
                      justifyContent: pushNotificationsEnabled ? 'flex-end' : 'flex-start', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease-in-out' 
                    }}
                  >
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid #F0F0F5', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>APP VERSION</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A', marginTop: '2px' }}>1.0.0</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>DEVELOPED BY</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A', marginTop: '2px' }}>SafAI App</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ---------------- BOTTOM NAVIGATION BAR (Worker) ---------------- */}
      <div className="worker-bottom-nav">
        {[
          { id: 'profile', icon: '👤', label: 'Profile' },
          { id: 'available', icon: '📋', label: 'Live Requests' },
          { id: 'mine', icon: '✅', label: 'Completed' },
          { id: 'settings', icon: '⚙️', label: 'Settings' },
        ].map(tab => (
          <button
            key={tab.id}
            className="w-nav-tab"
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              color: activeTab === tab.id ? '#16A34A' : '#9CA3AF',
              position: 'relative'
            }}
          >
            <span style={{ 
              fontSize: '22px', 
              transition: 'transform 0.2s', 
              animation: activeTab === tab.id ? 'wfloat 2s ease-in-out infinite' : 'none',
              display: 'inline-block'
            }}>
              {tab.icon}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em' }}>{tab.label}</span>
            {tab.id === 'available' && requests.length > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: 'calc(50% - 18px)',
                background: '#DC2626', color: 'white', borderRadius: '10px',
                padding: '1px 6px', fontSize: '9px', fontWeight: 700
              }}>
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default WorkerDashboard;
