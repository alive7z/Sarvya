import './components/accessibility/vision.css';
import AuditDashboard from './pages/AuditDashboard.jsx';
import { VisionProvider } from './components/accessibility/VisionPreferences.jsx';

export default function App() {
  return <VisionProvider><AuditDashboard /></VisionProvider>;
}
