import './Card.css';

/**
 * CARD COMPONENT
 * Clean white card with soft shadow for content grouping
 */
function Card({ children, title = null, className = '' }) {
    const cardClass = `ui-card ${className}`.trim();

    return (
        <div className={cardClass}>
            {title && <h3 className="ui-card-title">{title}</h3>}
            <div className="ui-card-content">{children}</div>
        </div>
    );
}

export default Card;
