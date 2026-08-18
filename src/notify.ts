/**
 * The morning signal.
 *
 * The intended flow: a notification lands around 06:00, the athlete taps it,
 * the app fetches that morning's briefing and shows it in the coach thread.
 *
 * WHAT WORKS TODAY AND WHAT DOES NOT
 *
 *  - LOCAL notifications (scheduled by this app, on this device) work,
 *    including inside Expo Go. That is what `scheduleMorningReminder` uses,
 *    and it is enough to build and test the whole flow.
 *
 *  - REMOTE push (a server waking the app) does NOT work in Expo Go — Expo
 *    removed it in SDK 53. It needs a development build AND a server holding
 *    the push tokens. Both are on the other side of the Mac day.
 *
 * There is a second, harder constraint that no amount of app code fixes:
 * **iOS will not run this app at 05:30 to compute anything.** A notification
 * can wake the athlete, not the engine. So either the briefing is computed
 * elsewhere and fetched, or it is computed when the app is opened. The seam
 * for both is `fetchBriefing` in src/athlete.ts.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Show the banner even when the app happens to be open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const MORNING_HOUR = 6;
export const MORNING_MINUTE = 0;

/** Identifies our own reminder so re-scheduling never stacks duplicates. */
const CHANNEL = 'morning-brief';

export type NotifyStatus = {
  granted: boolean;
  /** Why it is not fully working, in words the athlete can act on. */
  limitation: string | null;
};

export async function requestPermission(): Promise<NotifyStatus> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    return {
      granted,
      limitation: granted
        ? 'Erinnerung läuft lokal auf diesem Gerät. Echte Push-Nachrichten vom Server brauchen einen Development Build.'
        : 'Ohne Erlaubnis kommt keine Erinnerung. In den iOS-Einstellungen unter Mitteilungen nachholbar.',
    };
  } catch (e) {
    return { granted: false, limitation: `Mitteilungen nicht verfügbar: ${String(e)}` };
  }
}

/** One repeating local notification each morning. Replaces any earlier one. */
export async function scheduleMorningReminder(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Morgenbriefing',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await cancelMorningReminder();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dein Briefing ist bereit',
        body: 'Tippen, um die Zahlen von heute Morgen zu holen.',
        data: { action: 'fetch-briefing' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: MORNING_HOUR,
        minute: MORNING_MINUTE,
        channelId: CHANNEL,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelMorningReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.action === 'fetch-briefing')
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Nothing scheduled, or notifications unavailable. Not worth surfacing.
  }
}

export async function isReminderScheduled(): Promise<boolean> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some((n) => n.content.data?.action === 'fetch-briefing');
  } catch {
    return false;
  }
}

/**
 * Run `onTap` when the athlete opens a briefing notification. Returns the
 * unsubscribe function. This is the seam a remote push will use unchanged —
 * only the sender differs.
 */
export function onBriefingTapped(onTap: () => void): () => void {
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      if (res.notification.request.content.data?.action === 'fetch-briefing') {
        onTap();
      }
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
