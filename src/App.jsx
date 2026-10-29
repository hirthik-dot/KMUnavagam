import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import BillingPage from './pages/BillingPage';
import RecordsPage from './pages/RecordsPage';
import ExpensesPage from './pages/ExpensesPage';
import AdminPage from './pages/AdminPage';
import CreditsPage from './pages/CreditsPage';
import CreditDetailsPage from './pages/CreditDetailsPage';
import StaffPage from './pages/StaffPage';
import PrintPreviewPage from './pages/PrintPreviewPage';
import './App.css';
import './index.css';

/**
 * MAIN APP COMPONENT
 * Handles navigation between all pages
 */
function App() {
  // Global prevention for number input scroll changing values
  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // State to track which page to show
  // Options: 'home', 'billing', 'records', 'expenses', 'admin', 'credits', 'credit-details', 'print-preview'
  const [currentPage, setCurrentPage] = useState('home');
  const [navData, setNavData] = useState(null);

  // Navigation function
  const handleNavigate = (page, data = null) => {
    setCurrentPage(page);
    setNavData(data);
    // Reset scroll position to top when navigating
    window.scrollTo(0, 0);
  };

  // Render the appropriate page based on currentPage state
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;

      case 'billing':
        return <BillingPage onNavigate={handleNavigate} creditCustomer={navData} />;

      case 'records':
        return <RecordsPage onNavigate={handleNavigate} />;

      case 'expenses':
        return <ExpensesPage onNavigate={handleNavigate} initialTab={navData?.tab} />;

      case 'admin':
        return <AdminPage onNavigate={handleNavigate} />;

      case 'credits':
        return <CreditsPage onNavigate={handleNavigate} navData={navData} />;

      case 'credit-details':
        return <CreditDetailsPage onNavigate={handleNavigate} customerId={navData} />;

      case 'staff':
        return <StaffPage onNavigate={handleNavigate} />;

      case 'print-preview':
        return <PrintPreviewPage onNavigate={handleNavigate} billData={navData} />;

      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app">
      {renderPage()}
    </div>
  );
}

export default App;
