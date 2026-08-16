export {};

declare global {
  interface Window {
    LoveCheckAndroid?: {
      updateWidget?: (streak: number, partnerName: string) => void;
      getFcmToken?: () => string;
      getFcmDebugInfo?: () => string;
      showLocalNotification?: (
        title: string,
        body: string,
        targetUrl: string,
        photoUrl: string | null,
      ) => void;
      signInWithGoogle?: () => void;
    };
    onFcmTokenReceived?: (token: string) => void;
  }
}
