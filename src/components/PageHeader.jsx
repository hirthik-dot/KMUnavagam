import './PageHeader.css';

function PageHeader({ onNavigate, backTo = 'home', showBack = true }) {
    return (
        <div className="page-header-container">
            {showBack && onNavigate ? (
                <button 
                    className="back-button-header" 
                    onClick={() => onNavigate(backTo)}
                >
                    ← Back
                </button>
            ) : (
                <div className="back-button-placeholder"></div>
            )}
            
            <h1 className="app-title-header">KM UNAVAGAM</h1>
            
            <div className="header-spacer"></div>
        </div>
    );
}

export default PageHeader;
