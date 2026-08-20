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
        senderAvatar?: string | null,
      ) => void;
      signInWithGoogle?: () => void;
      getPendingShareData?: () => string;
    };
    onFcmTokenReceived?: (token: string) => void;
  }
}
