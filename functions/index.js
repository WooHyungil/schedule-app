const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

admin.initializeApp();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

async function fetchKakaoUser(accessToken) {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new HttpsError('unauthenticated', `Kakao user verification failed: ${text}`);
  }

  return response.json();
}

exports.createKakaoCustomToken = onCall(async (request) => {
  const accessToken = request.data?.accessToken;

  if (!accessToken || typeof accessToken !== 'string') {
    throw new HttpsError('invalid-argument', 'A Kakao access token is required.');
  }

  const kakaoUser = await fetchKakaoUser(accessToken);
  const kakaoAccount = kakaoUser.kakao_account || {};
  const profile = kakaoAccount.profile || {};
  const uid = `kakao_${kakaoUser.id}`;

  const additionalClaims = {
    provider: 'kakao',
    kakaoId: String(kakaoUser.id),
  };

  const customToken = await admin.auth().createCustomToken(uid, additionalClaims);

  await admin.firestore().collection('users').doc(uid).set(
    {
      uid,
      name: profile.nickname || '카카오 사용자',
      email: kakaoAccount.email || `${uid}@kakao.local`,
      photoURL: profile.profile_image_url || '',
      provider: 'kakao',
      kakaoId: kakaoUser.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    customToken,
    profile: {
      uid,
      email: kakaoAccount.email || `${uid}@kakao.local`,
      displayName: profile.nickname || '카카오 사용자',
      photoURL: profile.profile_image_url || '',
      kakaoId: kakaoUser.id,
      provider: 'kakao',
    },
  };
});
