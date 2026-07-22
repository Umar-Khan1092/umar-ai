import React, { useState } from 'react';
import { X, UploadCloud, FileType, AlertCircle } from 'lucide-react';
import './BulkUploadModal.css';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'student' | 'staff';
  onSuccess: () => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, entityType, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, message: string, errors?: string[] }>({ type: null, message: '' });

  if (!isOpen) return null;

  const getTemplateUrl = () => {
    // Generate a simple CSV blob URL for download based on entityType
    const headers = entityType === 'student' 
      ? "name,father_name,cnic,dob,gender,academic_class,section,roll_number,monthly_fee\n"
      : "name,cnic,email,qualification,experience,salary_type,salary,joining_date\n";
    
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    return URL.createObjectURL(blob);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatusMsg({ type: null, message: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMsg({ type: 'error', message: 'Please select a file first.' });
      return;
    }

    setIsUploading(true);
    setStatusMsg({ type: null, message: '' });

    const formData = new FormData();
    formData.append('file', file);

    const endpoint = entityType === 'student' ? '/api/students/bulk-upload' : '/api/staff/bulk-upload';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }
      
      setStatusMsg({ type: 'success', message: data.message, errors: data.errors });
      setTimeout(() => {
        onSuccess();
        onClose();
        setFile(null);
      }, 2000);
      
    } catch (err: any) {
      let errorData;
      try {
        errorData = JSON.parse(err.message);
      } catch {
        errorData = { detail: err.message };
      }
      
      if (typeof errorData.detail === 'string') {
        setStatusMsg({ type: 'error', message: errorData.detail });
      } else if (errorData.detail && errorData.detail.message) {
         setStatusMsg({ type: 'error', message: errorData.detail.message, errors: errorData.detail.errors });
      } else {
         setStatusMsg({ type: 'error', message: 'An unknown error occurred during upload.' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-upload-modal">
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        
        <h2>Import {entityType === 'student' ? 'Students' : 'Staff'} from CSV</h2>
        
        <div className="upload-instructions">
          <p>1. Download the template file.</p>
          <a href={getTemplateUrl()} download={`${entityType}_template.csv`} className="btn-secondary template-btn">
            Download CSV Template
          </a>
          <p>2. Fill in the data without changing column names.</p>
          <p>3. Upload the filled CSV file below.</p>
        </div>

        <div className="file-drop-area">
          <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" />
          <label htmlFor="csv-upload" className="file-drop-label">
            <UploadCloud size={40} className="upload-icon" />
            <span className="file-name">{file ? file.name : 'Click to choose a CSV file'}</span>
          </label>
        </div>
        
        {statusMsg.type && (
          <div className={`upload-status ${statusMsg.type}`}>
            <div className="status-header">
              {statusMsg.type === 'error' ? <AlertCircle size={18}/> : <FileType size={18}/>}
              <span>{statusMsg.message}</span>
            </div>
            {statusMsg.errors && statusMsg.errors.length > 0 && (
              <ul className="error-list">
                {statusMsg.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleUpload} disabled={isUploading || !file}>
            {isUploading ? 'Uploading...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
