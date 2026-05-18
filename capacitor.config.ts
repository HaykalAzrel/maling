import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deteksimaling.app',
  appName: 'Deteksi Maling',
  webDir: 'dist',
  server: {
    url: 'https://maling-git-main-chelixs-projects.vercel.app',
    cleartext: true
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '383764904540-qvo1e4vt1c5744b3i09ua77gjf5evff8.apps.googleusercontent.com',  // dari Firebase Console
      forceCodeForRefreshToken: true
    }
  }
};

export default config;