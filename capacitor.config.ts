import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deteksimaling.app',
  appName: 'Securo',
  webDir: 'dist',
  server: {
    url: 'https://webdashboardptapt.web.app',
    cleartext: true
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '383764904540-qvo1e4vt1c5744b3i09ua77gjf5evff8.apps.googleusercontent.com',  // dari Firebase Console
      forceCodeForRefreshToken: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    OneSignal: {
      appId: 'd14e617b-e55d-4350-af1f-c8c59af36d69',  // dari OneSignal Dashboard
    },
  }
};

export default config;