import React, { type InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, className = '', ...props }) => {
  const id = props.id || props.name;
  return (
    <div className={`input-group ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={id} className="input-label">
        {label} {props.required && <span className="required-indicator">*</span>}
      </label>
      <input id={id} className="input-field" {...props} />
      {error && <span className="error-message">{error}</span>}
      {helperText && !error && <span className="helper-text">{helperText}</span>}
    </div>
  );
};
