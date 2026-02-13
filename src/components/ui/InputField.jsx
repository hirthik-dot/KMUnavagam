import './InputField.css';

/**
 * INPUT FIELD COMPONENT
 * Large touch-friendly input with clear labels
 */
function InputField({ 
    label, 
    type = 'text', 
    value, 
    onChange, 
    placeholder = '', 
    required = false,
    error = null,
    name = '',
    id = '',
    disabled = false,
    min = null,
    max = null,
    step = null,
    accept = null,
    autoFocus = false,
    onKeyPress = null
}) {
    const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="input-field">
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                    {required && <span className="input-required">*</span>}
                </label>
            )}
            <input
                id={inputId}
                name={name || inputId}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                accept={accept}
                autoFocus={autoFocus}
                onKeyPress={onKeyPress}
                className={`input-control ${error ? 'input-error' : ''}`}
            />
            {error && <span className="input-error-text">{error}</span>}
        </div>
    );
}

export default InputField;
