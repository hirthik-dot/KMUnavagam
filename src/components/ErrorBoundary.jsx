import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * ERROR BOUNDARY
 * If a page crashes while drawing, show a recovery screen instead of a blank white window,
 * and write the error to the app log. App.jsx keys it by page, so opening another page resets it.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        window.electronAPI?.logError?.({
            message: error?.message || String(error),
            stack: `${error?.stack || ''}\n${info?.componentStack || ''}`,
            page: this.props.page,
        });
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="error-boundary">
                <i className="fas fa-triangle-exclamation"></i>
                <h2>Something went wrong on this screen</h2>
                <p>Your bills and data are safe. Go back to Home and try again.</p>
                <button className="error-boundary-btn" onClick={() => this.props.onHome?.()}>
                    <i className="fas fa-house"></i> Go to Home
                </button>
            </div>
        );
    }
}

export default ErrorBoundary;
