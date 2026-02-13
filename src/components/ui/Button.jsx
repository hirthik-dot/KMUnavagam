import './Button.css';

/**
 * BUTTON COMPONENT
 * Elderly-friendly touch button with large text and clear variants
 * Variants: primary (green), secondary (outline), danger (red)
 */
function Button({ 
    children, 
    variant = 'primary', 
    onClick, 
    disabled = false, 
    type = 'button',
    icon = null,
    iconPosition = 'left',
    className = ''
}) {
    const buttonClass = `ui-button ui-button-${variant} ${className}`.trim();

    return (
        <button 
            type={type}
            className={buttonClass}
            onClick={onClick}
            disabled={disabled}
        >
            {icon && iconPosition === 'left' && <span className="button-icon">{icon}</span>}
            <span className="button-text">{children}</span>
            {icon && iconPosition === 'right' && <span className="button-icon">{icon}</span>}
        </button>
    );
}

export default Button;
