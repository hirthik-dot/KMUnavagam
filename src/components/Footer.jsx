import './Footer.css';

function Footer() {
    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-copyright">
                    © LancingHub
                </div>
                <div className="footer-links">
                    <span className="footer-text">For software queries:</span>
                    <a href="tel:9999999999" className="footer-link">
                        <i className="fas fa-phone"></i> +91 9514001712
                    </a>
                    <a href="https://lancinghub.vercel.app/" target="_blank" rel="noopener noreferrer" className="footer-link">
                        <i className="fas fa-globe"></i> Website
                    </a>
                    <a href="https://instagram.com/lancinghub" target="_blank" rel="noopener noreferrer" className="footer-link">
                        <i className="https://www.instagram.com/lancing_hub?igsh=bzA3czhseGlmM2o3"></i> Instagram
                    </a>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
