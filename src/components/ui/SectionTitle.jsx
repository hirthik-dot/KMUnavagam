import './SectionTitle.css';

/**
 * SECTION TITLE COMPONENT
 * Consistent section headings with green accent
 */
function SectionTitle({ children, className = '' }) {
    const titleClass = `section-title ${className}`.trim();

    return (
        <h2 className={titleClass}>{children}</h2>
    );
}

export default SectionTitle;
