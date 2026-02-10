import { useState } from 'react';
import BillingPage from './pages/BillingPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App() {
  // State to track which page to show
  const [currentPage, setCurrentPage] = useState('billing'); // 'billing' or 'admin'

  return (
    <div className="app">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-content">
          <h1 className="app-title">KM Unavagam - Billing System</h1>
          <div className="nav-buttons">
            <button
              className={`nav-btn ${currentPage === 'billing' ? 'active' : ''}`}
              onClick={() => setCurrentPage('billing')}
            >
              Billing
            </button>
            <button
              className={`nav-btn ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentPage('admin')}
            >
              Admin
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="page-content">
        {currentPage === 'billing' ? <BillingPage /> : <AdminPage />}
      </main>
    </div>
  );
}

export default App;
