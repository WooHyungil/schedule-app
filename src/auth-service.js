import { 
  onAuthStateChanged, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase-config';

const LOCAL_AUTH_USERS_KEY = 'localAuthUsers';
const LOCAL_AUTH_SESSION_KEY = 'localAuthSession';

function getLocalAuthUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalAuthUsers(users) {
  localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
}

function setLocalAuthSession(user) {
  localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(user));
}

function getLocalAuthSession() {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearLocalAuthSession() {
  localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createEmailUid(email) {
  const normalized = normalizeEmail(email);
  const base = btoa(unescape(encodeURIComponent(normalized)))
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `local_${base}`;
}

function isFirebaseApiKeyError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'auth/api-key-not-valid' ||
    code === 'auth/invalid-api-key' ||
    message.includes('api-key-not-valid') ||
    message.includes('invalid-api-key')
  );
}

function localSignUp(email, password, displayName) {
  const users = getLocalAuthUsers();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (users.some((item) => item.email === normalizedEmail)) {
    throw new Error('이미 사용 중인 이메일입니다.');
  }

  const newUser = {
    uid: `local_${Date.now().toString(36)}`,
    email: normalizedEmail,
    password,
    displayName: displayName || '사용자',
    photoURL: '',
    provider: 'email',
    createdAt: new Date().toISOString(),
  };

  setLocalAuthUsers([newUser, ...users]);
  const sessionUser = { ...newUser };
  delete sessionUser.password;
  setLocalAuthSession(sessionUser);
  return sessionUser;
}

function localSignIn(email, password) {
  const users = getLocalAuthUsers();
  const normalizedEmail = normalizeEmail(email);
  const found = users.find((item) => item.email === normalizedEmail);

  if (!found) {
    throw new Error('등록되지 않은 이메일입니다.');
  }

  if (found.password !== password) {
    throw new Error('비밀번호가 일치하지 않습니다.');
  }

  const sessionUser = {
    uid: found.uid,
    email: found.email,
    displayName: found.displayName || '사용자',
    photoURL: found.photoURL || '',
    provider: 'email',
    createdAt: found.createdAt || new Date().toISOString(),
  };

  setLocalAuthSession(sessionUser);
  return sessionUser;
}

/**
 * 이메일만으로 시작 (가입/로그인 통합)
 */
export function signInOrCreateWithEmailOnly(email, displayName) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('유효한 이메일 형식을 입력해주세요.');
  }

  const deterministicUid = createEmailUid(normalizedEmail);

  const users = getLocalAuthUsers();
  const existing = users.find((item) => normalizeEmail(item.email) === normalizedEmail);

  if (existing) {
    const mergedUser = {
      ...existing,
      uid: deterministicUid,
      displayName: displayName?.trim() || existing.displayName || '사용자',
      provider: 'email-only',
      updatedAt: new Date().toISOString(),
    };

    const nextUsers = users.map((item) =>
      normalizeEmail(item.email) === normalizedEmail ? mergedUser : item
    );
    setLocalAuthUsers(nextUsers);

    const sessionUser = {
      uid: mergedUser.uid,
      email: mergedUser.email,
      displayName: mergedUser.displayName,
      photoURL: mergedUser.photoURL || '',
      provider: 'email-only',
      createdAt: mergedUser.createdAt || new Date().toISOString(),
    };
    setLocalAuthSession(sessionUser);
    return sessionUser;
  }

  const newUser = {
    uid: deterministicUid,
    email: normalizedEmail,
    displayName: displayName?.trim() || '사용자',
    photoURL: '',
    provider: 'email-only',
    createdAt: new Date().toISOString(),
  };

  setLocalAuthUsers([newUser, ...users]);
  setLocalAuthSession(newUser);
  return newUser;
}

/**
 * 이메일로 회원가입
 */
export async function signUpWithEmail(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // displayName 설정
    if (displayName) {
      try {
        await updateProfile(user, { displayName });
      } catch (err) {
        console.warn('Profile update warning:', err);
        // 프로필 업데이트 실패해도 진행
      }
    }

    // 최신 사용자 정보 반환
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || '사용자',
      photoURL: user.photoURL || '',
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    setLocalAuthSession(userData);
    return userData;
  } catch (error) {
    console.error('Signup error:', error);
    if (isFirebaseApiKeyError(error)) {
      return localSignUp(email, password, displayName);
    }
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('이미 사용 중인 이메일입니다.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('유효하지 않은 이메일 형식입니다.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('이메일/비밀번호 로그인이 비활성화되어 있습니다. 관리자에게 문의하세요.');
    }
    throw new Error('회원가입에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
  }
}

/**
 * 이메일로 로그인
 */
export async function signInWithEmailPassword(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '사용자',
      photoURL: user.photoURL || '',
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    setLocalAuthSession(userData);
    return userData;
  } catch (error) {
    console.error('Login error:', error);
    if (isFirebaseApiKeyError(error)) {
      return localSignIn(email, password);
    }
    if (error.code === 'auth/user-not-found') {
      throw new Error('등록되지 않은 이메일입니다.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('비밀번호가 일치하지 않습니다.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('유효하지 않은 이메일 형식입니다.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('이메일/비밀번호 로그인이 비활성화되어 있습니다. 관리자에게 문의하세요.');
    }
    throw new Error('로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
  }
}

/**
 * 로그아웃
 */
export async function signOutUser() {
  try {
    clearLocalAuthSession();
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    if (!isFirebaseApiKeyError(error)) {
      throw error;
    }
  }
}

/**
 * 현재 로그인 상태 감시
 */
export function watchAuthState(callback) {
  const localSession = getLocalAuthSession();
  if (localSession) {
    callback(localSession);
  }

  try {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else if (!localSession) {
        callback(null);
      }
    });
  } catch {
    return () => {};
  }
}

/**
 * Firebase 현재 사용자 가져오기
 */
export function getCurrentUser() {
  return auth.currentUser || getLocalAuthSession();
}
