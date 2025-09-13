/**
 * Firebase Configuration Module
 * 
 * This module handles Firebase Admin SDK initialization and provides
 * database connection utilities for the KMRL fleet management system.
 */

const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

let db = null;
let isConnected = false;

/**
 * Initialize Firebase Admin SDK
 */
async function connectFirebase() {
  try {
    if (isConnected) {
      logger.info('Firebase already connected');
      return db;
    }

    // Check if in demo mode
    const isDemoMode = process.env.NODE_ENV === 'development' && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (isDemoMode) {
      logger.warn('Running in demo mode - Firebase operations will be mocked');
      isConnected = true;
      // Create a mock db object for demo
      db = {
        collection: (name) => ({
          doc: () => ({
            set: async () => ({ id: 'demo-doc' }),
            get: async () => ({ exists: true, data: () => ({ demo: true }) }),
            update: async () => ({ writeTime: new Date() }),
            delete: async () => ({ writeTime: new Date() })
          }),
          add: async () => ({ id: 'demo-doc' }),
          get: async () => ({ docs: [], empty: true }),
          where: () => ({ get: async () => ({ docs: [], empty: true }) })
        })
      };
      logger.info('Demo mode initialized - using mock Firebase operations');
      return db;
    }

    // Initialize Firebase Admin SDK
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
      // Use service account file
      const serviceAccount = require(path.resolve(serviceAccountPath));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // Use default credentials (for deployment environments)
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }

    // Get Firestore instance
    db = admin.firestore();
    
    // Test connection
    await db.collection('health').doc('test').set({
      status: 'connected',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    isConnected = true;
    logger.info(`Firebase connected successfully to project: ${process.env.FIREBASE_PROJECT_ID}`);
    
    return db;
  } catch (error) {
    logger.error('Firebase connection failed:', error);
    // In development, continue with demo mode
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Falling back to demo mode due to Firebase connection error');
      isConnected = true;
      db = {
        collection: (name) => ({
          doc: () => ({
            set: async () => ({ id: 'demo-doc' }),
            get: async () => ({ exists: true, data: () => ({ demo: true }) }),
            update: async () => ({ writeTime: new Date() }),
            delete: async () => ({ writeTime: new Date() })
          }),
          add: async () => ({ id: 'demo-doc' }),
          get: async () => ({ docs: [], empty: true }),
          where: () => ({ get: async () => ({ docs: [], empty: true }) })
        })
      };
      return db;
    }
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
}

/**
 * Get Firestore database instance
 */
function getDB() {
  if (!db) {
    throw new Error('Firebase not initialized. Call connectFirebase() first.');
  }
  return db;
}

/**
 * Firebase collection references
 */
const collections = {
  users: () => getDB().collection('users'),
  trainsets: () => getDB().collection('trainsets'),
  healthAndMaintenance: () => getDB().collection('health_and_maintenance'),
  brandingPriorities: () => getDB().collection('branding_priorities'),
  stablingBays: () => getDB().collection('stabling_bays'),
  cleaningSlots: () => getDB().collection('cleaning_slots'),
  optimizationHistory: () => getDB().collection('optimization_history'),
  chatHistory: () => getDB().collection('chat_history'),
  notifications: () => getDB().collection('notifications'),
  systemLogs: () => getDB().collection('system_logs')
};

/**
 * Common database operations
 */
const dbOperations = {
  // Create document
  async create(collectionName, data, docId = null) {
    try {
      const collection = getDB().collection(collectionName);
      const docData = {
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (docId) {
        await collection.doc(docId).set(docData);
        return { id: docId, ...docData };
      } else {
        const docRef = await collection.add(docData);
        return { id: docRef.id, ...docData };
      }
    } catch (error) {
      logger.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  },

  // Read document
  async read(collectionName, docId) {
    try {
      const doc = await getDB().collection(collectionName).doc(docId).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error(`Error reading document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  },

  // Update document
  async update(collectionName, docId, data) {
    try {
      const updateData = {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await getDB().collection(collectionName).doc(docId).update(updateData);
      return { id: docId, ...updateData };
    } catch (error) {
      logger.error(`Error updating document ${docId} in ${collectionName}:`, error);
      throw error;
    }
  },

  // Delete document
  async delete(collectionName, docId) {
    try {
      await getDB().collection(collectionName).doc(docId).delete();
      return { id: docId, deleted: true };
    } catch (error) {
      logger.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  },

  // Query documents
  async query(collectionName, filters = [], orderBy = null, limit = null) {
    try {
      let query = getDB().collection(collectionName);

      // Apply filters
      filters.forEach(filter => {
        const [field, operator, value] = filter;
        query = query.where(field, operator, value);
      });

      // Apply ordering
      if (orderBy) {
        const [field, direction = 'asc'] = Array.isArray(orderBy) ? orderBy : [orderBy];
        query = query.orderBy(field, direction);
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  },

  // Get all documents from collection
  async getAll(collectionName) {
    try {
      const snapshot = await getDB().collection(collectionName).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error(`Error getting all documents from ${collectionName}:`, error);
      throw error;
    }
  },

  // Batch operations
  async batchWrite(operations) {
    try {
      const batch = getDB().batch();
      
      operations.forEach(operation => {
        const { type, collection, docId, data } = operation;
        const docRef = getDB().collection(collection).doc(docId);
        
        switch (type) {
          case 'set':
            batch.set(docRef, {
              ...data,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...data,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();
      return { success: true, operations: operations.length };
    } catch (error) {
      logger.error('Error in batch write operation:', error);
      throw error;
    }
  }
};

/**
 * Firebase utility functions
 */
const firebaseUtils = {
  // Convert Firestore timestamp to JavaScript Date
  timestampToDate(timestamp) {
    if (!timestamp) return null;
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  },

  // Get server timestamp
  serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  },

  // Array union operation
  arrayUnion(...elements) {
    return admin.firestore.FieldValue.arrayUnion(...elements);
  },

  // Array remove operation
  arrayRemove(...elements) {
    return admin.firestore.FieldValue.arrayRemove(...elements);
  },

  // Increment field
  increment(value) {
    return admin.firestore.FieldValue.increment(value);
  }
};

module.exports = {
  connectFirebase,
  getDB,
  collections,
  dbOperations,
  firebaseUtils,
  admin
};
