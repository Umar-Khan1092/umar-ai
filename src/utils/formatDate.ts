export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  // Handle YYYY-MM-DD format explicitly to avoid timezone issues
  if (typeof dateString === 'string') {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  
  return dateString as string;
};

export const formatTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '';
  const parts = timeString.split(':');
  if (parts.length < 2) return timeString;
  
  let hour = parseInt(parts[0], 10);
  const minStr = parts[1];
  
  if (isNaN(hour)) return timeString;
  
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'
  
  return `${hour.toString().padStart(2, '0')}:${minStr} ${ampm}`;
};
