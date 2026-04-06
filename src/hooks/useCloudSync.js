import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '../utils';
import {
  createOrUpdateUser,
  getUser,
  getUserCollection,
  migrateWorkspaceData,
  replaceUserCollection,
  saveUserProfile,
  subscribeUserCollection,
  subscribeUserProfile,
} from '../firestore-service';
import { performanceAgent } from '../services/performanceAgent';

function stableStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

function normalizeCollectionItems(items) {
  const source = Array.isArray(items) ? items : [];
  const byId = new Map();

  for (let i = 0; i < source.length; i += 1) {
    const item = source[i];
    if (!item || typeof item !== 'object') continue;
    const id = item.id;
    if (!id) continue;
    byId.set(id, item);
  }

  return Array.from(byId.values());
}

function createWorkspaceKey(value, prefix) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '');

  if (!normalized) return null;

  const base = btoa(unescape(encodeURIComponent(normalized)))
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${prefix}_${base}`;
}

function useLatestRef(value) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function markSyncing(setSyncState) {
  setSyncState((prev) => {
    if (prev.status === 'syncing' && !prev.error) return prev;
    return { ...prev, status: 'syncing', error: '' };
  });
}

function markOnline(setSyncState) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  setSyncState((prev) => {
    if (prev.status === 'online' && prev.lastSyncedAt) {
      const prevMs = new Date(prev.lastSyncedAt).getTime();
      if (!Number.isNaN(prevMs) && nowMs - prevMs < 15000) {
        return prev;
      }
    }
    return { status: 'online', lastSyncedAt: nowIso, error: '' };
  });
}

function useSyncedCollection({
  uid,
  syncKey,
  collectionName,
  localValue,
  setLocalValue,
  setSyncState,
  remoteHashesRef,
  readyRef,
  isOptional = false, // 선택적 동기화 플래그
}) {
  const localValueRef = useLatestRef(localValue);
  const lastSubscriptionRef = useRef(null);

  // 배치 업데이트를 위한 동기화 함수
  const performSync = async (itemsToSync) => {
    try {
      await replaceUserCollection(uid, collectionName, itemsToSync);
      markOnline(setSyncState);
    } catch (error) {
      setSyncState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message || '데이터 동기화에 실패했습니다.',
      }));
      throw error;
    }
  };

  // 리스너 구독 (선택적)
  useEffect(() => {
    if (!uid || isOptional) return undefined; // 선택적 컬렉션은 구독하지 않음

    readyRef.current[syncKey] = false;

    lastSubscriptionRef.current = subscribeUserCollection(uid, collectionName, async (remoteItems) => {
      const normalizedItems = normalizeCollectionItems(remoteItems);
      const remoteHash = stableStringify(normalizedItems);
      remoteHashesRef.current[syncKey] = remoteHash;
      readyRef.current[syncKey] = true;

      const normalizedLocalValue = normalizeCollectionItems(localValueRef.current);
      const localHash = stableStringify(normalizedLocalValue);
      if (normalizedItems.length === 0 && (localValueRef.current || []).length > 0) {
        await replaceUserCollection(uid, collectionName, normalizedLocalValue).catch(() => {});
        return;
      }

      if (localHash !== remoteHash) {
        setLocalValue(normalizedItems);
      }

      markOnline(setSyncState);
    });

    return () => {
      if (lastSubscriptionRef.current) {
        lastSubscriptionRef.current();
      }
    };
  }, [collectionName, isOptional, localValueRef, readyRef, remoteHashesRef, setLocalValue, setSyncState, syncKey, uid]);

  // 배치 업데이트 (로컬 변경사항 동기화)
  useEffect(() => {
    if (!uid || !readyRef.current[syncKey]) return;

    const normalizedLocalValue = normalizeCollectionItems(localValue);

    const nextHash = stableStringify(normalizedLocalValue);
    if (nextHash === remoteHashesRef.current[syncKey]) return;

    markSyncing(setSyncState);
    remoteHashesRef.current[syncKey] = nextHash;

    // 성능 에이전트를 통한 배치 업데이트 (디바운싱됨)
    performanceAgent.enqueueBatchUpdate(collectionName, normalizedLocalValue, performSync);
  }, [collectionName, localValue, readyRef, remoteHashesRef, setSyncState, syncKey, uid]);
}

export function useCloudSync() {
  const [currentUser, setCurrentUser] = useStorage('currentUser', null);
  const [accounts, setAccounts] = useStorage('accounts', ['현금', '국민은행', '신한은행', '카카오뱅크']);
  const [quickTitles, setQuickTitles] = useStorage('quickTitles', []);
  const [dailyCompletionMap, setDailyCompletionMap] = useStorage('dailyCompletionMap', {});
  const [events, setEvents] = useStorage('events', []);
  const [expenses, setExpenses] = useStorage('expenses', []);
  const [dailyTemplates, setDailyTemplates] = useStorage('dailyTemplates', []);
  const [meetings, setMeetings] = useStorage('meetings', []);
  const [memos, setMemos] = useStorage('memos', []);
  const [syncState, setSyncState] = useState({ status: 'idle', lastSyncedAt: null, error: '' });

  // 이메일 기반 개인 동기화
  // 같은 이메일로 로그인하면 본인 데이터를 어디서든 동기화
  const cloudUid = createWorkspaceKey(currentUser?.email, 'email');
  const legacyLocalUid = currentUser?.uid || null;

  const remoteHashesRef = useRef({});
  const readyRef = useRef({ profile: false });
  const currentUserRef = useLatestRef(currentUser);
  const accountsRef = useLatestRef(accounts);
  const quickTitlesRef = useLatestRef(quickTitles);
  const dailyCompletionMapRef = useLatestRef(dailyCompletionMap);

  const profilePayload = useMemo(
    () => ({
      name: currentUser?.name || currentUser?.displayName || '사용자',
      email: currentUser?.email || '',
      photoURL: currentUser?.photoURL || '',
      provider: currentUser?.provider || 'guest',
      kakaoId: currentUser?.kakaoId || null,
      accounts,
      quickTitles,
      dailyCompletionMap,
    }),
    [accounts, currentUser?.displayName, currentUser?.email, currentUser?.kakaoId, currentUser?.name, currentUser?.photoURL, currentUser?.provider, dailyCompletionMap, quickTitles]
  );

  useEffect(() => {
    if (!cloudUid) {
      setSyncState({ status: 'idle', lastSyncedAt: null, error: '' });
      readyRef.current = { profile: false };
      remoteHashesRef.current = {};
      return;
    }

    setSyncState((prev) => ({ ...prev, status: 'connecting', error: '' }));

    (async () => {
      try {
        const targetProfile = await getUser(cloudUid).catch(() => null);
        const targetEvents = await getUserCollection(cloudUid, 'events').catch(() => []);
        const shouldTryMigration = !targetProfile && targetEvents.length === 0;

        if (shouldTryMigration) {
          const candidates = [legacyLocalUid].filter((value) => value && value !== cloudUid);
          for (const candidateUid of candidates) {
            const migration = await migrateWorkspaceData(candidateUid, cloudUid, {
              uid: cloudUid,
              ...profilePayload,
              joinedAt: currentUser.joinedAt || currentUser.createdAt || new Date().toISOString(),
            }).catch(() => ({ migrated: false }));

            if (migration?.migrated) {
              break;
            }
          }
        }

        await createOrUpdateUser(cloudUid, {
          uid: cloudUid,
          ...profilePayload,
          joinedAt: currentUser.joinedAt || currentUser.createdAt || new Date().toISOString(),
        });
      } catch (error) {
        setSyncState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || '사용자 정보를 저장하지 못했습니다.',
        }));
      }
    })();

    return subscribeUserProfile(cloudUid, async (remoteProfile) => {
      const nextProfile = remoteProfile || {};
      remoteHashesRef.current.profile = stableStringify(nextProfile);
      readyRef.current.profile = true;

      if (!remoteProfile || Object.keys(remoteProfile).length === 0) {
        await saveUserProfile(cloudUid, profilePayload).catch(() => {});
      } else {
        const mergedUser = {
          ...currentUserRef.current,
          uid: currentUserRef.current?.uid || currentUser?.uid,
          name: nextProfile.name || currentUserRef.current?.name || currentUserRef.current?.displayName || '사용자',
          email: nextProfile.email || currentUserRef.current?.email || '',
          photoURL: nextProfile.photoURL || currentUserRef.current?.photoURL || '',
          provider: nextProfile.provider || currentUserRef.current?.provider || 'guest',
          kakaoId: nextProfile.kakaoId || currentUserRef.current?.kakaoId || null,
        };

        if (stableStringify(mergedUser) !== stableStringify(currentUserRef.current)) {
          setCurrentUser(mergedUser);
        }
        if (stableStringify(nextProfile.accounts || ['현금', '국민은행', '신한은행', '카카오뱅크']) !== stableStringify(accountsRef.current)) {
          setAccounts(nextProfile.accounts || ['현금', '국민은행', '신한은행', '카카오뱅크']);
        }
        if (stableStringify(nextProfile.quickTitles || []) !== stableStringify(quickTitlesRef.current)) {
          setQuickTitles(nextProfile.quickTitles || []);
        }
        if (stableStringify(nextProfile.dailyCompletionMap || {}) !== stableStringify(dailyCompletionMapRef.current)) {
          setDailyCompletionMap(nextProfile.dailyCompletionMap || {});
        }
      }

      markOnline(setSyncState);
    });
  }, [accountsRef, cloudUid, currentUser, currentUserRef, dailyCompletionMapRef, legacyLocalUid, profilePayload, quickTitlesRef, setAccounts, setCurrentUser, setDailyCompletionMap, setQuickTitles]);

  useEffect(() => {
    if (!cloudUid || !readyRef.current.profile) return;

    const nextHash = stableStringify(profilePayload);
    if (nextHash === remoteHashesRef.current.profile) return;

    markSyncing(setSyncState);
    remoteHashesRef.current.profile = nextHash;

    saveUserProfile(cloudUid, profilePayload)
      .then(() => {
        markOnline(setSyncState);
      })
      .catch((error) => {
        setSyncState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || '프로필 동기화에 실패했습니다.',
        }));
      });
  }, [cloudUid, profilePayload]);

  // 모든 핵심 데이터를 실시간 동기화하여 기기 간 즉시 반영
  useSyncedCollection({
    uid: cloudUid,
    syncKey: 'events',
    collectionName: 'events',
    localValue: events,
    setLocalValue: setEvents,
    setSyncState,
    remoteHashesRef,
    readyRef,
    isOptional: false,
  });

  useSyncedCollection({
    uid: cloudUid,
    syncKey: 'expenses',
    collectionName: 'expenses',
    localValue: expenses,
    setLocalValue: setExpenses,
    setSyncState,
    remoteHashesRef,
    readyRef,
    isOptional: false,
  });

  useSyncedCollection({
    uid: cloudUid,
    syncKey: 'dailyTemplates',
    collectionName: 'dailyTemplates',
    localValue: dailyTemplates,
    setLocalValue: setDailyTemplates,
    setSyncState,
    remoteHashesRef,
    readyRef,
    isOptional: false,
  });

  useSyncedCollection({
    uid: cloudUid,
    syncKey: 'meetings',
    collectionName: 'meetings',
    localValue: meetings,
    setLocalValue: setMeetings,
    setSyncState,
    remoteHashesRef,
    readyRef,
    isOptional: false,
  });

  useSyncedCollection({
    uid: cloudUid,
    syncKey: 'memos',
    collectionName: 'memos',
    localValue: memos,
    setLocalValue: setMemos,
    setSyncState,
    remoteHashesRef,
    readyRef,
    isOptional: false,
  });

  return syncState;
}
