import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UserChat from './pages/UserChat'; 
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserChat />} />
        <Route path="/admin-hq" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;