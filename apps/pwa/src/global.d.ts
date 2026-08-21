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
        messageId?: string | null,
      ) => void;
      setAuthToken?: (token: string) => void;
      signInWithGoogle?: () => void;
      getPendingShareData?: () => string;
      openPhotoViewer?: (
        photoUrl: string,
        caption: string,
        ownerName: string,
        dateStr: string,
        fileName: string,
      ) => void;
    };
    onFcmTokenReceived?: (token: string) => void;
  }
}
