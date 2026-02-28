import { useState, useEffect } from 'react';
import UserForm from './pages/UserForm';
import AdminDashboard from './pages/AdminDashboard';

type Page = 'user' | 'admin';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('user');

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      setCurrentPage('admin');
    } else {
      setCurrentPage('user');
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setCurrentPage(window.location.pathname === '/admin' ? 'admin' : 'user');
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  if (currentPage === 'admin') {
    return <AdminDashboard />;
  }

  return <UserForm />;
}

export default App;
