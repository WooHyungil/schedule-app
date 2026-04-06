import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '../utils';
import {
  createOrUpdateUser,
  replaceUserCollection,
  saveUserProfile,
  subscribeUserCollection,
  subscribeUserProfile,
} from '../firestore-service';

function stableStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

function useLatestRef(value) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
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
}) {
  const localValueRef = useLatestRef(localValue);

  useEffect(() => {
    if (!uid) return undefined;

    readyRef.current[syncKey] = false;

    return subscribeUserCollection(uid, collectionName, async (remoteItems) => {
      const normalizedItems = remoteItems || [];
      const remoteHash = stableStringify(normalizedItems);
      remoteHashesRef.current[syncKey] = remoteHash;
      readyRef.current[syncKey] = true;

      const localHash = stableStringify(localValueRef.current || []);
      if (normalizedItems.length === 0 && (localValueRef.current || []).length > 0) {
        await replaceUserCollection(uid, collectionName, localValueRef.current).catch(() => {});
        return;
      }

      if (localHash !== remoteHash) {
        setLocalValue(normalizedItems);
      }

      setSyncState({
        status: 'online',
        lastSyncedAt: new Date().toISOString(),
        error: '',
      });
    });
  }, [collectionName, localValueRef, readyRef, remoteHashesRef, setLocalValue, setSyncState, syncKey, uid]);

  useEffect(() => {
    if (!uid || !readyRef.current[syncKey]) return;

    const nextHash = stableStringify(localValue);
    if (nextHash === remoteHashesRef.current[syncKey]) return;

    setSyncState((prev) => ({ ...prev, status: 'syncing', error: '' }));
    remoteHashesRef.current[syncKey] = nextHash;

    replaceUserCollection(uid, collectionName, localValue)
      .then(() => {
        setSyncState({
          status: 'online',
          lastSyncedAt: new Date().toISOString(),
          error: '',
        });
      })
      .catch((error) => {
        setSyncState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || '데이터 동기화에 실패했습니다.',
        }));
      });
  }, [collectionName, localValue, readyRef, remoteHashesRef, setSyncState, syncKey, uid]);
}

export function useCloudSync() {
  const [currentUser, setCurrentUser] = useStorage('currentUser', null);
  const [shareConnections, setShareConnections] = useStorage('shareConnections', []);
  const [shareOptions, setShareOptions] = useStorage('shareOptions', { events: true, expenses: true, daily: true });
  const [notificationSettings, setNotificationSettings] = useStorage('notificationSettings', { enabled: false, defaultReminderMinutes: 10 });
  const [accounts, setAccounts] = useStorage('accounts', ['현금', '국민은행', '신한은행', '카카오뱅크']);
  const [salarySettings, setSalarySettings] = useStorage('salarySettings', { day: 25 });
  const [quickTitles, setQuickTitles] = useStorage('quickTitles', []);
  const [dailyCompletionMap, setDailyCompletionMap] = useStorage('dailyCompletionMap', {});
  const [events, setEvents] = useStorage('events', []);
  const [expenses, setExpenses] = useStorage('expenses', []);
  const [dailyTemplates, setDailyTemplates] = useStorage('dailyTemplates', []);
  const [meetings, setMeetings] = useStorage('meetings', []);
  const [memos, setMemos] = useStorage('memos', []);
  const [syncState, setSyncState] = useState({ status: 'idle', lastSyncedAt: null, error: '' });
  const isLocalFallbackUser = String(currentUser?.uid || '').startsWith('local_');
  const cloudUid = isLocalFallbackUser ? null : currentUser?.uid;

  const remoteHashesRef = useRef({});
  const readyRef = useRef({ profile: false });
  const currentUserRef = useLatestRef(currentUser);
  const shareConnectionsRef = useLatestRef(shareConnections);
  const shareOptionsRef = useLatestRef(shareOptions);
  const notificationSettingsRef = useLatestRef(notificationSettings);
  const accountsRef = useLatestRef(accounts);
  const salarySettingsRef = useLatestRef(salarySettings);
  const quickTitlesRef = useLatestRef(quickTitles);
  const dailyCompletionMapRef = useLatestRef(dailyCompletionMap);

  const profilePayload = useMemo(
    () => ({
      name: currentUser?.name || currentUser?.displayName || '사용자',
      email: currentUser?.email || '',
      photoURL: currentUser?.photoURL || '',
      provider: currentUser?.provider || 'guest',
      kakaoId: currentUser?.kakaoId || null,
      shareConnections,
      shareOptions,
      notificationSettings,
      accounts,
      salarySettings,
      quickTitles,
      dailyCompletionMap,
    }),
    [accounts, currentUser?.displayName, currentUser?.email, currentUser?.kakaoId, currentUser?.name, currentUser?.photoURL, currentUser?.provider, dailyCompletionMap, notificationSettings, quickTitles, salarySettings, shareConnections, shareOptions]
  );

  useEffect(() => {
    if (!cloudUid) {
      setSyncState({ status: 'idle', lastSyncedAt: null, error: '' });
      readyRef.current = { profile: false };
      remoteHashesRef.current = {};
      return;
    }

    setSyncState((prev) => ({ ...prev, status: 'connecting', error: '' }));

    createOrUpdateUser(cloudUid, {
      uid: cloudUid,
      ...profilePayload,
      joinedAt: currentUser.joinedAt || currentUser.createdAt || new Date().toISOString(),
    }).catch((error) => {
      setSyncState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message || '사용자 정보를 저장하지 못했습니다.',
      }));
    });

    return subscribeUserProfile(cloudUid, async (remoteProfile) => {
      const nextProfile = remoteProfile || {};
      remoteHashesRef.current.profile = stableStringify(nextProfile);
      readyRef.current.profile = true;

      if (!remoteProfile || Object.keys(remoteProfile).length === 0) {
        await saveUserProfile(cloudUid, profilePayload).catch(() => {});
      } else {
        const mergedUser = {
          ...currentUserRef.current,
          uid: cloudUid,
          name: nextProfile.name || currentUserRef.current?.name || currentUserRef.current?.displayName || '사용자',
          email: nextProfile.email || currentUserRef.current?.email || '',
          photoURL: nextProfile.photoURL || currentUserRef.current?.photoURL || '',
          provider: nextProfile.provider || currentUserRef.current?.provider || 'guest',
          kakaoId: nextProfile.kakaoId || currentUserRef.current?.kakaoId || null,
        };

        if (stableStringify(mergedUser) !== stableStringify(currentUserRef.current)) {
          setCurrentUser(mergedUser);
        }
        if (stableStringify(nextProfile.shareConnections || []) !== stableStringify(shareConnectionsRef.current)) {
          setShareConnections(nextProfile.shareConnections || []);
        }
        if (stableStringify(nextProfile.shareOptions || { events: true, expenses: true, daily: true }) !== stableStringify(shareOptionsRef.current)) {
          setShareOptions(nextProfile.shareOptions || { events: true, expenses: true, daily: true });
        }
        if (stableStringify(nextProfile.notificationSettings || { enabled: false, defaultReminderMinutes: 10 }) !== stableStringify(notificationSettingsRef.current)) {
          setNotificationSettings(nextProfile.notificationSettings || { enabled: false, defaultReminderMinutes: 10 });
        }
        if (stableStringify(nextProfile.accounts || ['현금', '국민은행', '신한은행', '카카오뱅크']) !== stableStringify(accountsRef.current)) {
          setAccounts(nextProfile.accounts || ['현금', '국민은행', '신한은행', '카카오뱅크']);
        }
        if (stableStringify(nextProfile.salarySettings || { day: 25 }) !== stableStringify(salarySettingsRef.current)) {
          setSalarySettings(nextProfile.salarySettings || { day: 25 });
        }
        if (stableStringify(nextProfile.quickTitles || []) !== stableStringify(quickTitlesRef.current)) {
          setQuickTitles(nextProfile.quickTitles || []);
        }
        if (stableStringify(nextProfile.dailyCompletionMap || {}) !== stableStringify(dailyCompletionMapRef.current)) {
          setDailyCompletionMap(nextProfile.dailyCompletionMap || {});
        }
      }

      setSyncState({ status: 'online', lastSyncedAt: new Date().toISOString(), error: '' });
    });
  }, [accountsRef, cloudUid, currentUser, currentUserRef, dailyCompletionMapRef, notificationSettingsRef, profilePayload, quickTitlesRef, salarySettingsRef, setAccounts, setCurrentUser, setDailyCompletionMap, setNotificationSettings, setQuickTitles, setSalarySettings, setShareConnections, setShareOptions, shareConnectionsRef, shareOptionsRef]);

  useEffect(() => {
    if (!cloudUid || !readyRef.current.profile) return;

    const nextHash = stableStringify(profilePayload);
    if (nextHash === remoteHashesRef.current.profile) return;

    setSyncState((prev) => ({ ...prev, status: 'syncing', error: '' }));
    remoteHashesRef.current.profile = nextHash;

    saveUserProfile(cloudUid, profilePayload)
      .then(() => {
        setSyncState({ status: 'online', lastSyncedAt: new Date().toISOString(), error: '' });
      })
      .catch((error) => {
        setSyncState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || '프로필 동기화에 실패했습니다.',
        }));
      });
  }, [cloudUid, profilePayload]);

  useSyncedCollection({ uid: cloudUid, syncKey: 'events', collectionName: 'events', localValue: events, setLocalValue: setEvents, setSyncState, remoteHashesRef, readyRef });
  useSyncedCollection({ uid: cloudUid, syncKey: 'expenses', collectionName: 'expenses', localValue: expenses, setLocalValue: setExpenses, setSyncState, remoteHashesRef, readyRef });
  useSyncedCollection({ uid: cloudUid, syncKey: 'dailyTemplates', collectionName: 'dailyTemplates', localValue: dailyTemplates, setLocalValue: setDailyTemplates, setSyncState, remoteHashesRef, readyRef });
  useSyncedCollection({ uid: cloudUid, syncKey: 'meetings', collectionName: 'meetings', localValue: meetings, setLocalValue: setMeetings, setSyncState, remoteHashesRef, readyRef });
  useSyncedCollection({ uid: cloudUid, syncKey: 'memos', collectionName: 'memos', localValue: memos, setLocalValue: setMemos, setSyncState, remoteHashesRef, readyRef });

  return syncState;
}
