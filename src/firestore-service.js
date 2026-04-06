import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase-config';

function normalizeFirestoreValue(value) {
  if (value == null) return value;

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestoreValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([entryKey, entryValue]) => [entryKey, normalizeFirestoreValue(entryValue)])
    );
  }

  return value;
}

function sanitizeForFirestore(value) {
  if (value == null) return value;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([entryKey, entryValue]) => [entryKey, sanitizeForFirestore(entryValue)])
    );
  }

  return value;
}

/**
 * 사용자 프로필을 생성하거나 업데이트
 */
export async function createOrUpdateUser(userId, userData) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        ...userData,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

/**
 * 사용자 프로필 조회
 */
export async function getUser(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? normalizeFirestoreValue(userSnap.data()) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

export async function getUserCollection(userId, collectionName) {
  try {
    const collectionRef = collection(db, `users/${userId}/${collectionName}`);
    const querySnap = await getDocs(collectionRef);
    return querySnap.docs.map((snapshotDoc) => normalizeFirestoreValue(snapshotDoc.data()));
  } catch (error) {
    console.error(`Error getting ${collectionName}:`, error);
    throw error;
  }
}

export async function migrateWorkspaceData(sourceUserId, targetUserId, fallbackProfile = {}) {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
    return { migrated: false };
  }

  const sourceProfile = await getUser(sourceUserId);
  const collectionNames = ['events', 'expenses', 'dailyTemplates', 'meetings', 'memos'];
  const collectionEntries = await Promise.all(
    collectionNames.map(async (collectionName) => {
      const items = await getUserCollection(sourceUserId, collectionName);
      return [collectionName, items || []];
    })
  );

  const hasAnyCollectionData = collectionEntries.some(([, items]) => items.length > 0);
  if (!sourceProfile && !hasAnyCollectionData) {
    return { migrated: false };
  }

  await createOrUpdateUser(targetUserId, {
    ...fallbackProfile,
    ...(sourceProfile || {}),
    uid: targetUserId,
  });

  await Promise.all(
    collectionEntries.map(([collectionName, items]) => replaceUserCollection(targetUserId, collectionName, items))
  );

  return { migrated: true, sourceUserId, targetUserId };
}

export function subscribeUserProfile(userId, callback) {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(normalizeFirestoreValue(snapshot.data()));
  });
}

export async function saveUserProfile(userId, userData) {
  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    {
      ...sanitizeForFirestore(userData),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeUserCollection(userId, collectionName, callback) {
  const collectionRef = collection(db, `users/${userId}/${collectionName}`);
  return onSnapshot(collectionRef, (snapshot) => {
    const items = snapshot.docs.map((item) => normalizeFirestoreValue(item.data()));
    callback(items);
  });
}

export async function replaceUserCollection(userId, collectionName, items) {
  const collectionRef = collection(db, `users/${userId}/${collectionName}`);
  const snapshot = await getDocs(collectionRef);
  const batch = writeBatch(db);

  const nextItems = (items || []).map((item) => {
    const normalized = sanitizeForFirestore(item);
    return {
      ...normalized,
      id: normalized.id || doc(collectionRef).id,
    };
  });

  const nextIds = new Set(nextItems.map((item) => item.id));

  snapshot.docs.forEach((snapshotDoc) => {
    if (!nextIds.has(snapshotDoc.id)) {
      batch.delete(snapshotDoc.ref);
    }
  });

  nextItems.forEach((item) => {
    const itemRef = doc(db, `users/${userId}/${collectionName}`, item.id);
    batch.set(
      itemRef,
      {
        ...item,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

/**
 * 이벤트 생성
 */
export async function createEvent(userId, eventData) {
  try {
    const eventRef = doc(collection(db, `users/${userId}/events`));
    await setDoc(eventRef, {
      ...eventData,
      id: eventRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return eventRef.id;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

/**
 * 사용자의 모든 이벤트 조회
 */
export async function getUserEvents(userId) {
  try {
    const eventsRef = collection(db, `users/${userId}/events`);
    const querySnap = await getDocs(eventsRef);
    return querySnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
}

/**
 * 이벤트 업데이트
 */
export async function updateEvent(userId, eventId, eventData) {
  try {
    const eventRef = doc(db, `users/${userId}/events`, eventId);
    await updateDoc(eventRef, {
      ...eventData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
}

/**
 * 이벤트 삭제
 */
export async function deleteEvent(userId, eventId) {
  try {
    const eventRef = doc(db, `users/${userId}/events`, eventId);
    await deleteDoc(eventRef);
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
}


/**
 * 일일 템플릿 생성
 */
export async function createDailyTemplate(userId, templateData) {
  try {
    const templateRef = doc(collection(db, `users/${userId}/dailyTemplates`));
    await setDoc(templateRef, {
      ...templateData,
      id: templateRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return templateRef.id;
  } catch (error) {
    console.error('Error creating daily template:', error);
    throw error;
  }
}

/**
 * 사용자의 모든 일일 템플릿 조회
 */
export async function getUserDailyTemplates(userId) {
  try {
    const templatesRef = collection(db, `users/${userId}/dailyTemplates`);
    const querySnap = await getDocs(templatesRef);
    return querySnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('Error getting daily templates:', error);
    throw error;
  }
}

/**
 * 일일 템플릿 업데이트
 */
export async function updateDailyTemplate(userId, templateId, templateData) {
  try {
    const templateRef = doc(db, `users/${userId}/dailyTemplates`, templateId);
    await updateDoc(templateRef, {
      ...templateData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating daily template:', error);
    throw error;
  }
}

/**
 * 일일 템플릿 삭제
 */
export async function deleteDailyTemplate(userId, templateId) {
  try {
    const templateRef = doc(db, `users/${userId}/dailyTemplates`, templateId);
    await deleteDoc(templateRef);
  } catch (error) {
    console.error('Error deleting daily template:', error);
    throw error;
  }
}

/**
 * 할일(Todo) 생성
 */
export async function createTodo(userId, todoData) {
  try {
    const todoRef = doc(collection(db, `users/${userId}/todos`));
    await setDoc(todoRef, {
      ...todoData,
      id: todoRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return todoRef.id;
  } catch (error) {
    console.error('Error creating todo:', error);
    throw error;
  }
}

/**
 * 사용자의 모든 할일 조회
 */
export async function getUserTodos(userId) {
  try {
    const todosRef = collection(db, `users/${userId}/todos`);
    const querySnap = await getDocs(todosRef);
    return querySnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('Error getting todos:', error);
    throw error;
  }
}

/**
 * 할일 업데이트
 */
export async function updateTodo(userId, todoId, todoData) {
  try {
    const todoRef = doc(db, `users/${userId}/todos`, todoId);
    await updateDoc(todoRef, {
      ...todoData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    throw error;
  }
}

/**
 * 할일 삭제
 */
export async function deleteTodo(userId, todoId) {
  try {
    const todoRef = doc(db, `users/${userId}/todos`, todoId);
    await deleteDoc(todoRef);
  } catch (error) {
    console.error('Error deleting todo:', error);
    throw error;
  }
}

/**
 * 가계부 항목 생성
 */
export async function createExpense(userId, expenseData) {
  try {
    const expenseRef = doc(collection(db, `users/${userId}/expenses`));
    await setDoc(expenseRef, {
      ...expenseData,
      id: expenseRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return expenseRef.id;
  } catch (error) {
    console.error('Error creating expense:', error);
    throw error;
  }
}

/**
 * 사용자의 모든 가계부 항목 조회
 */
export async function getUserExpenses(userId) {
  try {
    const expensesRef = collection(db, `users/${userId}/expenses`);
    const querySnap = await getDocs(expensesRef);
    return querySnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('Error getting expenses:', error);
    throw error;
  }
}

/**
 * 가계부 항목 업데이트
 */
export async function updateExpense(userId, expenseId, expenseData) {
  try {
    const expenseRef = doc(db, `users/${userId}/expenses`, expenseId);
    await updateDoc(expenseRef, {
      ...expenseData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
}

/**
 * 가계부 항목 삭제
 */
export async function deleteExpense(userId, expenseId) {
  try {
    const expenseRef = doc(db, `users/${userId}/expenses`, expenseId);
    await deleteDoc(expenseRef);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

/**
 * 배치 작업으로 여러 이벤트 동기화
 */
export async function syncUserData(userId, data) {
  try {
    const batch = writeBatch(db);
    
    // 이벤트
    if (data.events) {
      data.events.forEach((event) => {
        const eventRef = doc(db, `users/${userId}/events`, event.id);
        batch.set(eventRef, { ...event, updatedAt: serverTimestamp() }, { merge: true });
      });
    }
    
    // 템플릿
    if (data.dailyTemplates) {
      data.dailyTemplates.forEach((template) => {
        const templateRef = doc(db, `users/${userId}/dailyTemplates`, template.id);
        batch.set(templateRef, { ...template, updatedAt: serverTimestamp() }, { merge: true });
      });
    }
    
    // 할일
    if (data.todos) {
      data.todos.forEach((todo) => {
        const todoRef = doc(db, `users/${userId}/todos`, todo.id);
        batch.set(todoRef, { ...todo, updatedAt: serverTimestamp() }, { merge: true });
      });
    }
    
    // 가계부
    if (data.expenses) {
      data.expenses.forEach((expense) => {
        const expenseRef = doc(db, `users/${userId}/expenses`, expense.id);
        batch.set(expenseRef, { ...expense, updatedAt: serverTimestamp() }, { merge: true });
      });
    }
    
    await batch.commit();
  } catch (error) {
    console.error('Error syncing user data:', error);
    throw error;
  }
}

