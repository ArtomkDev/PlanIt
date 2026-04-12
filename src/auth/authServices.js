import { auth } from '../config/firebase';
import { GoogleAuthProvider, OAuthProvider, linkWithCredential, unlink } from 'firebase/auth';

export const linkGoogleAccount = async (idToken) => {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await linkWithCredential(auth.currentUser, credential);
    return { success: true, user: userCredential.user };
  } catch (error) {
    if (error.code === 'auth/credential-already-in-use') {
       throw new Error("Цей Google акаунт вже прив'язаний до іншого профілю.");
    }
    throw error;
  }
};

export const linkAppleAccount = async (idToken) => {
  try {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken });
    const userCredential = await linkWithCredential(auth.currentUser, credential);
    return { success: true, user: userCredential.user };
  } catch (error) {
    throw error;
  }
};

export const unlinkProvider = async (providerId) => {
  try {
    await unlink(auth.currentUser, providerId);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const getLinkedProviders = () => {
  const user = auth.currentUser;
  if (!user) return [];
  return user.providerData.map(provider => provider.providerId);
};