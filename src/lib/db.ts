import Dexie, { Table } from 'dexie';

export interface LocalStudent {
  id: string;
  name: string;
  roll_number?: string;
  academic_class: string;
  section: string;
  photo_url?: string;
}

export interface SyncQueueItem {
  id?: number;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  created_at: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  error?: string;
}

export class AppDatabase extends Dexie {
  students!: Table<LocalStudent>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('school_erp_local_db');
    
    // Define the schema
    this.version(1).stores({
      students: 'id, academic_class, section', // Primary key and indexed props
      syncQueue: '++id, status, created_at'
    });
  }
}

export const localDb = new AppDatabase();
