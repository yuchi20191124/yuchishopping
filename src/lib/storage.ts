/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  enableIndexedDbPersistence,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  Character, 
  Series, 
  Product, 
  ClientOrder, 
  PreOrder, 
  Shipment, 
  PackagingCost 
} from '../types';

// Check if Firebase configuration is provided and valid
const isFirebaseActive = !!(
  firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.apiKey !== ""
);

let db: any = null;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let userId: string | null = null;
  let email: string | null = null;
  let emailVerified: boolean | null = null;
  let isAnonymous: boolean | null = null;
  let tenantId: string | null = null;
  let providerInfo: any[] = [];
  try {
    const auth = getAuth();
    if (auth.currentUser) {
      userId = auth.currentUser.uid;
      email = auth.currentUser.email;
      emailVerified = auth.currentUser.emailVerified;
      isAnonymous = auth.currentUser.isAnonymous;
      tenantId = auth.currentUser.tenantId;
      providerInfo = auth.currentUser.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [];
    }
  } catch (e) {
    // Auth or app not initialized yet
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId,
      email,
      emailVerified,
      isAnonymous,
      tenantId,
      providerInfo
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

if (isFirebaseActive) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    
    // Enable offline persistence in browser/standalone PWA for resilient offline support
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore offline persistence failed: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore offline persistence is not supported by current browser');
      }
    });

    // Validate Connection to Firestore as per SKILL.md
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

// Low-level helper to load from client-side localStorage safeguard
const getLocal = (key: string, defaultValue: any): any => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error(`Failed to parse localStorage key ${key}:`, e);
    return defaultValue;
  }
};

// Low-level helper to write to client-side localStorage safeguard
const saveLocal = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save localStorage key ${key}:`, e);
  }
};

/**
 * Storage Service combining local persistence + seamless Cloud Firestore Sync
 */
export const StorageService = {
  isCloudActive(): boolean {
    return isFirebaseActive && db !== null;
  },

  // 1. CHARACTERS
  async getChars(): Promise<Character[]> {
    const local = getLocal("of_chars", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_chars"));
      const items: Character[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as Character);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_chars", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_chars");
      return local;
    }
  },

  async saveChar(item: Character): Promise<void> {
    const current = getLocal("of_chars", []);
    const updated = current.some(c => c.id === item.id)
      ? current.map(c => c.id === item.id ? item : c)
      : [...current, item];
    
    saveLocal("of_chars", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_chars", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_chars/${item.id}`);
      }
    }
  },

  async deleteChar(id: string): Promise<void> {
    const current = getLocal("of_chars", []);
    const updated = current.filter(c => c.id !== id);
    saveLocal("of_chars", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_chars", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_chars/${id}`);
      }
    }
  },

  // 2. SERIES
  async getSeries(): Promise<Series[]> {
    const local = getLocal("of_series", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_series"));
      const items: Series[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as Series);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_series", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_series");
      return local;
    }
  },

  async saveSeries(item: Series): Promise<void> {
    const current = getLocal("of_series", []);
    const updated = current.some(s => s.id === item.id)
      ? current.map(s => s.id === item.id ? item : s)
      : [...current, item];
    
    saveLocal("of_series", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_series", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_series/${item.id}`);
      }
    }
  },

  async deleteSeries(id: string): Promise<void> {
    const current = getLocal("of_series", []);
    const updated = current.filter(s => s.id !== id);
    saveLocal("of_series", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_series", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_series/${id}`);
      }
    }
  },

  // 3. PRODUCTS
  async getProducts(): Promise<Product[]> {
    const local = getLocal("of_products", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_products"));
      const items: Product[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as Product);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_products", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_products");
      return local;
    }
  },

  async saveProduct(item: Product): Promise<void> {
    const current = getLocal("of_products", []);
    const updated = current.some(p => p.id === item.id)
      ? current.map(p => p.id === item.id ? item : p)
      : [...current, item];
    
    saveLocal("of_products", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_products", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_products/${item.id}`);
      }
    }
  },

  async deleteProduct(id: string): Promise<void> {
    const current = getLocal("of_products", []);
    const updated = current.filter(p => p.id !== id);
    saveLocal("of_products", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_products", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_products/${id}`);
      }
    }
  },

  // 4. CLIENT ORDERS
  async getClientOrders(): Promise<ClientOrder[]> {
    const local = getLocal("of_cos", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_cos"));
      const items: ClientOrder[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as ClientOrder);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_cos", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_cos");
      return local;
    }
  },

  async saveClientOrder(item: ClientOrder): Promise<void> {
    const current = getLocal("of_cos", []);
    const updated = current.some(c => c.id === item.id)
      ? current.map(c => c.id === item.id ? item : c)
      : [...current, item];
    
    saveLocal("of_cos", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_cos", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_cos/${item.id}`);
      }
    }
  },

  async deleteClientOrder(id: string): Promise<void> {
    const current = getLocal("of_cos", []);
    const updated = current.filter(c => c.id !== id);
    saveLocal("of_cos", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_cos", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_cos/${id}`);
      }
    }
  },

  // 5. PRE ORDERS
  async getPreOrders(): Promise<PreOrder[]> {
    const local = getLocal("of_pos", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_pos"));
      const items: PreOrder[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as PreOrder);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_pos", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_pos");
      return local;
    }
  },

  async savePreOrder(item: PreOrder): Promise<void> {
    const current = getLocal("of_pos", []);
    const updated = current.some(p => p.id === item.id)
      ? current.map(p => p.id === item.id ? item : p)
      : [...current, item];
    
    saveLocal("of_pos", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_pos", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_pos/${item.id}`);
      }
    }
  },

  async deletePreOrder(id: string): Promise<void> {
    const current = getLocal("of_pos", []);
    const updated = current.filter(p => p.id !== id);
    saveLocal("of_pos", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_pos", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_pos/${id}`);
      }
    }
  },

  // 6. SHIPMENTS
  async getShipments(): Promise<Shipment[]> {
    const local = getLocal("of_ships", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_ships"));
      const items: Shipment[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as Shipment);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_ships", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_ships");
      return local;
    }
  },

  async saveShipment(item: Shipment): Promise<void> {
    const current = getLocal("of_ships", []);
    const updated = current.some(s => s.id === item.id)
      ? current.map(s => s.id === item.id ? item : s)
      : [...current, item];
    
    saveLocal("of_ships", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_ships", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_ships/${item.id}`);
      }
    }
  },

  async deleteShipment(id: string): Promise<void> {
    const current = getLocal("of_ships", []);
    const updated = current.filter(s => s.id !== id);
    saveLocal("of_ships", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_ships", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_ships/${id}`);
      }
    }
  },

  // 7. PACKAGING COSTS
  async getPackagingCosts(): Promise<PackagingCost[]> {
    const local = getLocal("of_pkgs", []);
    if (!this.isCloudActive()) return local;

    try {
      const snap = await getDocs(collection(db, "of_pkgs"));
      const items: PackagingCost[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as PackagingCost);
      });
      const merged = items.length > 0 ? items : local;
      saveLocal("of_pkgs", merged);
      return merged;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, "of_pkgs");
      return local;
    }
  },

  async savePackagingCost(item: PackagingCost): Promise<void> {
    const current = getLocal("of_pkgs", []);
    const updated = current.some(p => p.id === item.id)
      ? current.map(p => p.id === item.id ? item : p)
      : [...current, item];
    
    saveLocal("of_pkgs", updated);

    if (this.isCloudActive()) {
      try {
        await setDoc(doc(db, "of_pkgs", item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `of_pkgs/${item.id}`);
      }
    }
  },

  async deletePackagingCost(id: string): Promise<void> {
    const current = getLocal("of_pkgs", []);
    const updated = current.filter(p => p.id !== id);
    saveLocal("of_pkgs", updated);

    if (this.isCloudActive()) {
      try {
        await deleteDoc(doc(db, "of_pkgs", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `of_pkgs/${id}`);
      }
    }
  },

  // DATA BACKUP & RESTORE UTILITIES
  exportAllData(): string {
    const data = {
      of_chars: getLocal("of_chars", []),
      of_series: getLocal("of_series", []),
      of_products: getLocal("of_products", []),
      of_cos: getLocal("of_cos", []),
      of_pos: getLocal("of_pos", []),
      of_ships: getLocal("of_ships", []),
      of_pkgs: getLocal("of_pkgs", [])
    };
    return JSON.stringify(data, null, 2);
  },

  async importAllData(jsonStr: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonStr);
      const keys = ["of_chars", "of_series", "of_products", "of_cos", "of_pos", "of_ships", "of_pkgs"];
      
      // Perform validation check to verify we aren't uploading dynamic noise
      for (const k of keys) {
        if (data[k] && Array.isArray(data[k])) {
          saveLocal(k, data[k]);
          
          // If cloud is active, batch sync them to cloud
          if (this.isCloudActive()) {
            for (const docItem of data[k]) {
              if (docItem && docItem.id) {
                try {
                  await setDoc(doc(db, k, docItem.id), docItem);
                } catch (e) {
                  handleFirestoreError(e, OperationType.WRITE, `${k}/${docItem.id}`);
                }
              }
            }
          }
        }
      }
      return true;
    } catch (e) {
      console.error("Failed to import json backups:", e);
      return false;
    }
  }
};
