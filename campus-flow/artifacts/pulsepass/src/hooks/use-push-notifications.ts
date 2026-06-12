import { api } from "../lib/api";

export function usePushNotifications() {
  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    try {
      const { publicKey } = await api.push.getVapidKey();
      if (!publicKey) return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      await api.push.subscribe(sub.toJSON() as PushSubscriptionJSON);
    } catch (err) {
      console.warn("Push subscription failed:", err);
    }
  }

  async function unsubscribe() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.push.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (err) {
      console.warn("Push unsubscribe failed:", err);
    }
  }

  async function isSubscribed(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  }

  return { subscribe, unsubscribe, isSubscribed };
}
