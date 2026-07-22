import React from 'react';

interface HighlightTextProps {
  text: string;
  highlight: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <>{text}</>;
  }

  // Create a regex to match the highlight string (case-insensitive)
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="highlighted-text" style={{ backgroundColor: '#FEF08A', color: 'inherit', padding: '0 2px', borderRadius: '2px' }}>
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};
