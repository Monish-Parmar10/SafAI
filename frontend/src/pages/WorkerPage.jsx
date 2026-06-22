import React, { useEffect, useState } from 'react';
import { getAllReports, getStats, completeReport } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : '';  // In dev, Vite proxies /uploads → localhost:5000

function WorkerPage() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [completionPreview, setCompletionPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ totalReports: 0, resolved: 0, pending: 0, avgResolutionTime: 0 });
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [reportsRes, statsRes] = await Promise.all([
        getAllReports(),
        getStats()
      ]);
      
      const allReports = reportsRes.data.reports || [];
      const assignedTasks = allReports.filter(report => report.status === 'assigned');
      setTasks(assignedTasks);

      setStats(statsRes.data.stats || { totalReports: 0, resolved: 0, pending: 0, avgResolutionTime: 0 });
    } catch (error) {
      console.error('Error fetching worker dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle completion file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCompletionPhoto(file);
      setCompletionPreview(URL.createObjectURL(file));
    }
  };

  // Submit complete status
  const handleSubmitCompletion = async (e) => {
    e.preventDefault();
    if (!completionPhoto || !selectedTask) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('photo', completionPhoto); // Note: field name should match Multer field in backend ('photo' or 'completionPhoto'?)
    // Wait, let's verify what field name the backend expects for completeReport.
    // In reportController.js: completeReport requires req.file. 
    // And in routes/reportRoutes.js: router.patch('/:id/complete', upload.single('photo'), completeReport)
    // Wait, the previous WorkerPage was doing: formData.append('completionPhoto', completionPhoto);
    // Let's verify which name was correct by looking at routes/reportRoutes.js!
    // Let's check reportRoutes.js using view_file or grep search.

    try {
      await completeReport(selectedTask._id, formData);
      setDone(true);
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to submit completion. Please verify connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#F7F7F8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
        .nav-btn-map {
          background-color: #C1440E;
          color: #FFFFFF;
          border: none;
          transition: background-color 0.2s ease;
        }
        .nav-btn-map:hover {
          background-color: #A03608;
        }
        .action-btn-navigate {
          border: 1px solid #E8E8ED;
          background-color: #FFFFFF;
          color: #1A1A1A;
          transition: all 0.2s ease;
          display: flex;
          alignItems: 'center';
          justifyContent: 'center';
          textDecoration: 'none';
        }
        .action-btn-navigate:hover {
          background-color: #F0F0F3;
        }
        .action-btn-complete {
          background-color: #C1440E;
          color: #FFFFFF;
          border: none;
          transition: background-color 0.2s ease;
        }
        .action-btn-complete:hover {
          background-color: #A03608;
        }
        .upload-zone-completion {
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        .upload-zone-completion:hover {
          border-color: #C1440E;
          background-color: #FAEEE8;
        }
        .btn-cancel {
          background-color: #FFFFFF;
          color: #5C5C6E;
          border: 1px solid #E8E8ED;
          transition: background-color 0.2s ease;
        }
        .btn-cancel:hover {
          background-color: #F7F7F8;
        }
        .btn-submit-done {
          transition: all 0.2s ease;
        }
        .btn-submit-done:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(193,68,14,0.3);
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
        position: 'sticky',
        top: 0,
        zIndex: 100
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
              <span style={{ fontSize: '12px', color: '#9999AA' }}>Hi, {user.name}</span>
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
            onClick={() => window.location.href = '/map'}
            className="nav-btn-map"
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
            🗺️ Map
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={{
        background: 'linear-gradient(135deg, #C1440E 0%, #A03608 100%)',
        padding: '24px 20px',
        color: '#FFFFFF',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Worker Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 400 }}>
            Manage your assigned tasks
          </p>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{
        display: 'flex',
        gap: '12px',
        padding: '16px',
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(193,68,14,0.04)',
          borderTop: '3px solid #C1440E',
          borderLeft: '1px solid #E8E8ED',
          borderRight: '1px solid #E8E8ED',
          borderBottom: '1px solid #E8E8ED'
        }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', display: 'block' }}>
            {stats.totalReports}
          </span>
          <span style={{ fontSize: '11px', color: '#9999AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total
          </span>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(193,68,14,0.04)',
          borderTop: '3px solid #1E8C45',
          borderLeft: '1px solid #E8E8ED',
          borderRight: '1px solid #E8E8ED',
          borderBottom: '1px solid #E8E8ED'
        }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#1E8C45', display: 'block' }}>
            {stats.resolved}
          </span>
          <span style={{ fontSize: '11px', color: '#9999AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Resolved
          </span>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(193,68,14,0.04)',
          borderTop: '3px solid #E07B00',
          borderLeft: '1px solid #E8E8ED',
          borderRight: '1px solid #E8E8ED',
          borderBottom: '1px solid #E8E8ED'
        }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#E07B00', display: 'block' }}>
            {stats.pending}
          </span>
          <span style={{ fontSize: '11px', color: '#9999AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending
          </span>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <main style={{
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
        padding: '0 16px 40px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        flex: 1
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontWeight: 'bold', color: '#5C5C6E' }}>
            🔄 Loading tasks...
          </div>
        ) : done ? (
          /* SUCCESS SCREEN */
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '40px 20px',
            border: '1px solid #E8E8ED',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#FAEEE8',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '36px'
            }}>
              ✅
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700, color: '#1A1A1A' }}>
                Task Completed!
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#5C5C6E' }}>
                Proof of cleanup has been successfully uploaded.
              </p>
            </div>

            {selectedTask && (
              <div style={{
                display: 'flex',
                gap: '12px',
                width: '100%',
                marginTop: '10px',
                boxSizing: 'border-box'
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{
                    backgroundColor: '#FFE8E8',
                    color: '#CC2222',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: 600,
                    display: 'inline-block',
                    marginBottom: '6px'
                  }}>
                    BEFORE
                  </span>
                  <img
                                        src={selectedTask.imageUrl}
                    alt="Before cleanup"
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E8E8ED' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{
                    backgroundColor: '#E8F5E9',
                    color: '#1E8C45',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: 600,
                    display: 'inline-block',
                    marginBottom: '6px'
                  }}>
                    AFTER
                  </span>
                  <img
                    src={completionPreview}
                    alt="After cleanup"
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E8E8ED' }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { window.location.reload(); }}
              className="btn-submit-done"
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #C1440E, #A03608)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
        ) : selectedTask ? (
          /* COMPLETION FLOW */
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #E8E8ED',
            boxShadow: '0 2px 12px rgba(193,68,14,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div>
              <span style={{
                color: '#C1440E',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: '2px'
              }}>
                TASK COMPLETION
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A1A1A' }}>
                Upload Proof of Cleanup
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#5C5C6E', lineHeight: '1.4' }}>
                📍 {selectedTask.location.address || 'Reported Location'}
              </p>
            </div>

            {/* Before Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  backgroundColor: '#FFE8E8',
                  color: '#CC2222',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '10px',
                  fontWeight: 600
                }}>
                  BEFORE
                </span>
              </div>
              <img
                                    src={selectedTask.imageUrl}
                alt="Garbage before"
                style={{
                  width: '100%',
                  maxHeight: '180px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  border: '1px solid #E8E8ED'
                }}
              />
            </div>

            {/* After Photo Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  backgroundColor: '#E8F5E9',
                  color: '#1E8C45',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '10px',
                  fontWeight: 600
                }}>
                  AFTER
                </span>
              </div>
              <div
                onClick={() => document.getElementById('completionInput').click()}
                className="upload-zone-completion"
                style={{
                  border: '2px dashed #E8E8ED',
                  borderRadius: '12px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  backgroundColor: '#F7F7F8',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontSize: '24px' }}>📸</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#5C5C6E' }}>
                  {completionPhoto ? 'Change Proof Photo' : 'Upload proof photo'}
                </span>
                <input
                  id="completionInput"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
              {completionPreview && (
                <img
                  src={completionPreview}
                  alt="Garbage after preview"
                  style={{
                    width: '100%',
                    maxHeight: '180px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    border: '1px solid #E8E8ED',
                    marginTop: '4px'
                  }}
                />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => { setSelectedTask(null); setCompletionPhoto(null); setCompletionPreview(''); }}
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn-submit-done"
                onClick={handleSubmitCompletion}
                disabled={!completionPhoto || submitting}
                style={{
                  flex: 2,
                  height: '44px',
                  borderRadius: '10px',
                  background: (!completionPhoto || submitting) ? '#E8E8ED' : 'linear-gradient(135deg, #C1440E, #A03608)',
                  color: (!completionPhoto || submitting) ? '#9999AA' : '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: (!completionPhoto || submitting) ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? '🔄 Submitting...' : 'Submit Completion'}
              </button>
            </div>
          </div>
        ) : (
          /* TASK LIST */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A1A1A' }}>
              🧹 Assigned Tasks ({tasks.length})
            </h3>
            
            {tasks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 10px',
                borderRadius: '16px',
                border: '2px dashed #E8E8ED',
                color: '#5C5C6E',
                backgroundColor: '#FFFFFF'
              }}>
                ✅ No pending tasks right now.
              </div>
            ) : (
              tasks.map((task) => {
                let severityColor = '#1E8C45';
                if (task.severity === 'high') severityColor = '#CC2222';
                else if (task.severity === 'medium') severityColor = '#E07B00';

                return (
                  <div key={task._id} style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #E8E8ED',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '8px'
                  }}>
                    {/* Top Severity Accent Bar */}
                    <div style={{ height: '4px', width: '100%', backgroundColor: severityColor }} />

                    {/* Image */}
                    <img
                                            src={task.imageUrl}
                      alt="Task garbage"
                      style={{
                        width: '100%',
                        height: '180px',
                        objectFit: 'cover'
                      }}
                    />

                    {/* Content padding 16px */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1A1A1A', lineHeight: '1.4' }}>
                        {task.location.address || 'Address captured'}
                      </h4>

                      {/* Location Pill */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span style={{
                          backgroundColor: '#F7F7F8',
                          color: '#5C5C6E',
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 500
                        }}>
                          📍 {task.location.lat.toFixed(6)}, {task.location.lng.toFixed(6)}
                        </span>

                        {/* Confidence Badge */}
                        <span style={{
                          backgroundColor: '#FAEEE8',
                          color: '#C1440E',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {task.aiConfidence ? task.aiConfidence.toFixed(0) : 0}% confidence
                        </span>
                      </div>

                      {/* Worker Row */}
                      {task.assignedWorker && (
                        <div style={{
                          fontSize: '13px',
                          color: '#5C5C6E',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px'
                        }}>
                          <span>👷</span>
                          <span>
                            {task.assignedWorker.name} · Ward {task.assignedWorker.ward}
                          </span>
                        </div>
                      )}

                      {task.aiResult && task.aiResult.reason && (
                        <div style={{
                          fontSize: '12px',
                          fontStyle: 'italic',
                          color: '#5C5C6E',
                          marginTop: '4px',
                          lineHeight: '1.4'
                        }}>
                          "{task.aiResult.reason}"
                        </div>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div style={{
                      padding: '12px 16px',
                      borderTop: '1px solid #E8E8ED',
                      backgroundColor: '#FAFAFA',
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.location.lat},${task.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-btn-navigate"
                        style={{
                          flex: 1,
                          height: '38px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        🧭 Navigate
                      </a>
                      <button
                        type="button"
                        onClick={() => { setSelectedTask(task); setCompletionPhoto(null); setCompletionPreview(''); }}
                        className="action-btn-complete"
                        style={{
                          flex: 2,
                          height: '38px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Mark Complete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkerPage;
