import { localDb } from './db';
import { supabase } from './supabase';

export class SyncEngine {
  private static isSyncing = false;

  static async syncOfflineData() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      // Fetch all pending actions, ordered by creation time
      const pendingItems = await localDb.syncQueue
        .where('status')
        .equals('PENDING')
        .sortBy('created_at');

      for (const item of pendingItems) {
        try {
          // Attempt to sync to Supabase based on action
          if (item.action === 'INSERT') {
            const { error } = await supabase
              .from(item.table_name)
              .insert(item.payload);
            
            if (error) throw error;
          } else if (item.action === 'UPDATE') {
             // For update, payload must contain id
             const { error } = await supabase
              .from(item.table_name)
              .update(item.payload)
              .eq('id', item.payload.id);
             
             if (error) throw error;
          }

          // Mark as synced locally
          await localDb.syncQueue.update(item.id!, {
            status: 'SYNCED'
          });
        } catch (err: any) {
          console.error('Error syncing item:', item, err);
          // Mark as failed so we can review later, don't block the whole queue
          await localDb.syncQueue.update(item.id!, {
            status: 'FAILED',
            error: err.message
          });
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  static async queueAction(table_name: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    await localDb.syncQueue.add({
      table_name,
      action,
      payload,
      created_at: new Date().toISOString(),
      status: 'PENDING'
    });

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.syncOfflineData();
    }
  }
}

// Automatically try to sync when internet comes back
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    SyncEngine.syncOfflineData();
  });
}
