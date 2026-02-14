import './Footer.css';

function Footer() {
    return (
        <footer className="app-footer">
            <div className="footer-container">
                <div className="footer-top">
                    <div className="footer-brand">
                        <span className="footer-brand-name">LancingHub</span>
                        <p className="footer-tagline">Excellence in Digital Solutions</p>
                    </div>
                    
                    <div className="footer-contact-info">
                        <span className="footer-contact-title">Software Support</span>
                        <div className="footer-contact-links">
                            <a href="tel:+919514001712" className="footer-contact-item">
                                <i className="fas fa-phone-alt"></i>
                                <span>+91 9514001712</span>/<span>+91 9952652246</span>
                            </a>
                            <a href="https://lancinghub.vercel.app/" target="_blank" rel="noopener noreferrer" className="footer-contact-item">
                                <i className="fas fa-external-link-alt"></i>
                                <span>lancinghub.vercel.app</span>
                            </a>
                        </div>
                    </div>

                    <div className="footer-social-section">
                        <span className="footer-social-title">Connect With Us</span>
                        <div className="footer-social-icons">
                            <a href="https://www.instagram.com/lancing_hub?igsh=bzA3czhseGlmM2o3" target="_blank" rel="noopener noreferrer" className="social-icon-btn">
                                <i className="fab fa-instagram"></i>
                            </a>
                            <a href="https://wa.me/919514001712" target="_blank" rel="noopener noreferrer" className="social-icon-btn">
                                <i className="fab fa-whatsapp"></i>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p className="copyright-text">© {new Date().getFullYear()} LancingHub. All Rights Reserved.</p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
