import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ReportPage from './pages/ReportPage';
import MapPage from './pages/MapPage';
import WorkerPage from './pages/WorkerPage';
import WorkerDashboard from './pages/WorkerDashboard';

function App() {
  const { user, loading } = useAuth();
  const path = window.location.pathname;

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', 
    height:'100vh', fontFamily:'Inter,sans-serif', color:'#C1440E', fontSize:'18px' }}>
      Loading SafAI...
    </div>
  );

  if (path === '/worker-login') return <LoginPage />;

  if (!user) return <LoginPage />;

  if (path === '/map') return <MapPage />;
  if (path === '/worker' || path === '/worker-dashboard') {
    if (user.role !== 'worker' && user.role !== 'admin') {
      window.location.href = '/';
      return null;
    }
    return <WorkerDashboard />;
  }
  if (user.role === 'worker') return <WorkerDashboard />;
  return <ReportPage />;
}

export default App;
