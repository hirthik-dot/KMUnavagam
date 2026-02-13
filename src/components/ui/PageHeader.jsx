import './PageHeader.css';
import Button from './Button';

/**
 * PAGE HEADER COMPONENT
 * Consistent header across all pages with back button
 */
function PageHeader({ 
    title, 
    subtitle = null, 
    icon = null, 
    onBack = null,
    backText = 'Back to Home'
}) {
    return (
        <div className="page-header">
            {onBack && (
                <Button 
                    variant="secondary" 
                    onClick={onBack}
                    icon="←"
                    className="page-header-back"
                >
                    {backText}
                </Button>
            )}
            <div className="page-header-content">
                {icon && <span className="page-header-icon">{icon}</span>}
                <div className="page-header-text">
                    <h1 className="page-header-title">{title}</h1>
                    {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}

export default PageHeader;
