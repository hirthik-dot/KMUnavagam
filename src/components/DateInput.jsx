import { useRef, useLayoutEffect, useState } from 'react';
import { formatToDisplayDate } from '../utils/DateUtils';
import './DateInput.css';

// Keys still allowed on the field (everything else would type into the hidden native segments)
const ALLOWED_KEYS = ['Tab', 'Backspace', 'Delete', 'Escape', 'Enter'];

/**
 * DATE INPUT
 * Drop-in for <input type="date"> that always shows dd/mm/yyyy.
 * The native date input displays the date in the Windows region format (mm/dd/yyyy on some PCs),
 * so its own text is made transparent and the date is drawn on top as dd/mm/yyyy.
 * Value and onChange stay native (YYYY-MM-DD). Clicking anywhere opens the calendar.
 */
function DateInput({ value, className = '', onClick, onKeyDown, ...rest }) {
    const inputRef = useRef(null);
    const [overlay, setOverlay] = useState(null);

    // Place the dd/mm/yyyy text exactly over the input's text area, using the input's own font and colour
    useLayoutEffect(() => {
        const input = inputRef.current;
        if (!input) return undefined;

        const measure = () => {
            const cs = getComputedStyle(input);
            const textColor = cs.color;
            setOverlay({
                left: input.offsetLeft,
                top: input.offsetTop,
                width: input.offsetWidth,
                height: input.offsetHeight,
                paddingLeft: `calc(${cs.paddingLeft} + ${cs.borderLeftWidth})`,
                font: cs.font,
                color: textColor,
            });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(input);
        if (input.offsetParent) observer.observe(input.offsetParent);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [className]);

    const handleClick = (e) => {
        try { inputRef.current.showPicker(); } catch (err) { /* picker already open or not supported */ }
        if (onClick) onClick(e);
    };

    const handleKeyDown = (e) => {
        if (!ALLOWED_KEYS.includes(e.key)) e.preventDefault();
        if (onKeyDown) onKeyDown(e);
    };

    return (
        <>
            <input
                ref={inputRef}
                type="date"
                value={value}
                className={`${className} date-input-native`.trim()}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                {...rest}
            />
            {overlay && (
                <span
                    className={`date-input-display ${value ? '' : 'empty'}`}
                    aria-hidden="true"
                    style={{
                        left: overlay.left,
                        top: overlay.top,
                        width: overlay.width,
                        height: overlay.height,
                        paddingLeft: overlay.paddingLeft,
                        font: overlay.font,
                        color: overlay.color,
                    }}
                >
                    {value ? formatToDisplayDate(value) : 'dd/mm/yyyy'}
                </span>
            )}
        </>
    );
}

export default DateInput;
