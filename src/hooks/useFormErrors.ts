import { useState, useEffect } from 'react';

export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) {
      setTimeout(() => {
        const firstErrorElement = document.querySelector('.has-error');
        if (firstErrorElement) {
          firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [fieldErrors]);

  const setGlobalError = (errorMessage: string) => {
    const newErrors: Record<string, string> = {};
    const lowerMsg = errorMessage.toLowerCase();

    // Mapping Supabase/generic errors to specific fields
    if (lowerMsg.includes('password') || lowerMsg.includes('whatsapp') || lowerMsg.includes('6 characters')) {
      newErrors['whatsapp_number'] = errorMessage;
      newErrors['guardian_whatsapp'] = errorMessage;
    } else if (lowerMsg.includes('email') || lowerMsg.includes('username') || lowerMsg.includes('already registered')) {
      newErrors['email'] = errorMessage;
      newErrors['guardian_email'] = errorMessage;
    } else if (lowerMsg.includes('cnic')) {
      newErrors['cnic'] = errorMessage;
    } else if (lowerMsg.includes('roll number') || lowerMsg.includes('roll_number')) {
      newErrors['roll_number'] = errorMessage;
    } else {
      newErrors['general'] = errorMessage;
    }
    
    setFieldErrors(newErrors);
    return newErrors;
  };

  const clearErrors = () => setFieldErrors({});

  return { fieldErrors, setFieldErrors, setGlobalError, clearErrors };
}
