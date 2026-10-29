import './PageHeader.css';

function PageHeader({ onNavigate, backTo = 'home', showBack = true }) {
    return (
        <header className="page-header-container">
            <div className="header-left">
                {showBack && onNavigate && (
                    <button
                        className="back-button-header"
                        onClick={() => onNavigate(backTo)}
                        aria-label="Go back"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                )}
            </div>

            <div className="header-center">
                <h1 className="app-title-header">KM UNAVAGAM</h1>
            </div>

            <div className="header-right">
                {/* Reserved for future profile/settings icons */}
            </div>
        </header>
    );
}

export default PageHeader;
