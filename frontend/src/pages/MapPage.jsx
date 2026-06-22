import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { getAllReports, getStats } from '../services/api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon bug
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Colored icons for markers
const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const orangeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapPage() {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalReports: 0, resolved: 0, pending: 0, avgResolutionTime: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsRes, statsRes] = await Promise.all([
          getAllReports(),
          getStats()
        ]);
        setReports(reportsRes.data.reports || []);
        setStats(statsRes.data.stats || { totalReports: 0, resolved: 0, pending: 0, avgResolutionTime: 0 });
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', backgroundColor: '#F7F7F8', paddingBottom: '64px', boxSizing: 'border-box' }}>
      {/* Styles */}
      <style>{`
        .nav-btn-report {
          border: 1px solid #E8E8ED;
          background-color: #FFFFFF;
          color: #1A1A1A;
          transition: all 0.2s ease;
        }
        .nav-btn-report:hover {
          background-color: #F7F7F8;
          border-color: #D1D1D6;
        }
        .nav-btn-workers {
          background-color: #C1440E;
          color: #FFFFFF;
          border: none;
          transition: background-color 0.2s ease;
        }
        .nav-btn-workers:hover {
          background-color: #A03608;
        }
        /* Custom styles for Leaflet Popup */
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          padding: 4px !important;
          border: 1px solid #E8E8ED;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
        }
        .leaflet-popup-content {
          margin: 12px 14px !important;
          line-height: 1.4 !important;
        }
        .leaflet-popup-tip {
          border: 1px solid #E8E8ED;
          box-shadow: none !important;
        }

        /* Mobile Responsiveness Rules */
        @media (max-width: 480px) {
          .nav-user-greeting {
            display: none !important;
          }
          .nav-btn-report {
            display: none !important;
          }
          .nav-btn-workers {
            display: none !important;
          }
          .stats-overlay {
            top: 10px !important;
            right: 10px !important;
            padding: 10px !important;
            min-width: 130px !important;
            gap: 6px !important;
            border-radius: 10px !important;
          }
          .stats-overlay h4 {
            font-size: 12px !important;
          }
          .stats-overlay span {
            font-size: 11px !important;
          }
          .stats-overlay div {
            gap: 4px !important;
          }
          .map-legend {
            bottom: 10px !important;
            left: 10px !important;
            padding: 8px !important;
            min-width: 90px !important;
            gap: 4px !important;
          }
          .map-legend span {
            font-size: 11px !important;
          }
        }
      `}</style>

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
        zIndex: 1000
      }}>
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#C1440E',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>
            S
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ color: '#1A1A1A', fontWeight: 700, fontSize: '16px' }}>SafAI</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
              <span className="nav-user-greeting" style={{ fontSize: '12px', color: '#9999AA' }}>Hi, {user.name}</span>
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
          <button
            onClick={() => window.location.href = '/'}
            className="nav-btn-report"
            style={{
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📋 Report
          </button>
          <button
            onClick={() => window.location.href = '/?page=workers'}
            className="nav-btn-workers"
            style={{
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            👷 Workers
          </button>
        </div>
      </nav>

      {/* MAIN MAP CONTAINER */}
      <div style={{ position: 'relative', flex: 1, width: '100%', overflow: 'hidden' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            backgroundColor: '#F7F7F8',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#5C5C6E'
          }}>
            🔄 Loading Map Data...
          </div>
        ) : (
          <>
            <MapContainer
              center={[22.7196, 75.8577]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {reports.map((report) => {
                let markerIcon = redIcon;
                if (report.status === 'assigned') markerIcon = orangeIcon;
                if (report.status === 'done') markerIcon = greenIcon;

                return (
                  <Marker
                    key={report._id}
                    position={[report.location.lat, report.location.lng]}
                    icon={markerIcon}
                  >
                    <Popup>
                      <div style={{ fontFamily: "'Inter', sans-serif", minWidth: '180px' }}>
                        {/* Address */}
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 700, color: '#1A1A1A' }}>
                          {report.location.address || 'Address captured'}
                        </h4>
                        
                        {/* Status + Severity badges on same row */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            backgroundColor:
                              report.status === 'done' ? '#E8F5E9' :
                              report.status === 'assigned' ? '#FFF3E0' : '#FFE8E8',
                            color:
                              report.status === 'done' ? '#1E8C45' :
                              report.status === 'assigned' ? '#E07B00' : '#CC2222'
                          }}>
                            {report.status}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            backgroundColor:
                              report.severity === 'high' ? '#FFE8E8' :
                              report.severity === 'medium' ? '#FFF3E0' : '#E8F5E9',
                            color:
                              report.severity === 'high' ? '#CC2222' :
                              report.severity === 'medium' ? '#E07B00' : '#1E8C45'
                          }}>
                            {report.severity}
                          </span>
                        </div>

                        {/* Confidence */}
                        <div style={{ fontSize: '11px', margin: '4px 0', color: '#5C5C6E' }}>
                          <strong>Confidence:</strong>{' '}
                          <span style={{ color: '#C1440E', fontWeight: 700 }}>
                            {report.aiConfidence.toFixed(0)}%
                          </span>
                        </div>

                        {/* Worker assigned */}
                        {report.assignedWorker && (
                          <div style={{ fontSize: '11px', margin: '4px 0', borderTop: '1px solid #E8E8ED', paddingTop: '4px', color: '#1A1A1A' }}>
                            <strong>Worker:</strong> {report.assignedWorker.name}
                          </div>
                        )}

                        {/* Image(s) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                          <div>
                            <span style={{ fontSize: '9px', display: 'block', color: '#9999AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                              Before Upload
                            </span>
                            <img
                              src={report.imageUrl}
                              alt="Garbage before"
                              style={{ width: '100%', borderRadius: '8px', objectFit: 'cover', height: '80px', border: '1px solid #E8E8ED' }}
                            />
                          </div>

                          {report.status === 'done' && report.completionImageUrl && (
                            <div>
                              <span style={{ fontSize: '9px', display: 'block', color: '#9999AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                                Cleaned Proof
                              </span>
                              <img
                                src={report.completionImageUrl}
                                alt="Garbage after"
                                style={{ width: '100%', borderRadius: '8px', objectFit: 'cover', height: '80px', border: '1px solid #E8E8ED' }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* STATS OVERLAY (top right) */}
            <div className="stats-overlay" style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid #E8E8ED',
              minWidth: '180px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxSizing: 'border-box'
            }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📊 Live Stats
              </h4>
              <hr style={{ border: 'none', height: '1px', backgroundColor: '#E8E8ED', margin: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#C1440E' }} />
                    <span style={{ color: '#5C5C6E' }}>Total Reports</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{stats.totalReports}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1E8C45' }} />
                    <span style={{ color: '#5C5C6E' }}>Resolved</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#1E8C45' }}>{stats.resolved}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#CC2222' }} />
                    <span style={{ color: '#5C5C6E' }}>Pending</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#CC2222' }}>{stats.pending}</span>
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#9999AA', display: 'block', marginTop: '2px', fontStyle: 'italic' }}>
                Live · Updates on report
              </span>
            </div>

            {/* LEGEND (bottom left of map, above zoom controls / bottom-left position) */}
            <div className="map-legend" style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              padding: '10px 14px',
              border: '1px solid #E8E8ED',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              zIndex: 1000,
              minWidth: '120px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <span style={{ fontSize: '11px', color: '#9999AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Legend
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#1A1A1A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔴</span>
                  <span>Open</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🟠</span>
                  <span>Assigned</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🟢</span>
                  <span>Resolved</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---------------- BOTTOM NAVIGATION BAR ---------------- */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E8E8ED',
        display: 'flex',
        zIndex: 2000,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)'
      }}>
        {/* Camera tab */}
        <button
          onClick={() => {
            window.location.href = '/?page=camera';
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            fontSize: '10px',
            fontWeight: 600,
            color: '#9CA3AF',
            outline: 'none'
          }}
        >
          <span style={{ fontSize: '22px' }}>📷</span>
          <span>Snap</span>
        </button>

        {/* My Reports tab */}
        <button
          onClick={() => {
            window.location.href = '/?page=myreports';
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            fontSize: '10px',
            fontWeight: 600,
            color: '#9CA3AF',
            outline: 'none'
          }}
        >
          <span style={{ fontSize: '22px' }}>📋</span>
          <span>My Reports</span>
        </button>

        {/* Live Map tab */}
        <button
          onClick={() => {
            window.location.href = '/map';
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            fontSize: '10px',
            fontWeight: 600,
            color: '#C1440E',
            outline: 'none'
          }}
        >
          <span style={{ fontSize: '22px' }}>🗺️</span>
          <span>Live Map</span>
        </button>

        {/* Workers tab */}
        <button
          onClick={() => {
            window.location.href = '/?page=workers';
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            fontSize: '10px',
            fontWeight: 600,
            color: '#9CA3AF',
            outline: 'none'
          }}
        >
          <span style={{ fontSize: '22px' }}>👷</span>
          <span>Workers</span>
        </button>
      </div>
    </div>
  );
}

export default MapPage;
