/** The three tabs. Adding a screen = adding a file in this folder. */
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { SessionProvider } from '../src/session';
import { c } from '../src/theme';

function icon(glyph: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{glyph}</Text>
  );
}

export default function Layout() {
  return (
    // Above the tabs on purpose: both the dashboard and the onboarding read
    // the same setup state, and a screen kept mounted in the background must
    // not go on believing a stale copy of it.
    <SessionProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: { color: c.text },
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
          tabBarActiveTintColor: c.accentText,
          tabBarInactiveTintColor: c.dim,
          sceneStyle: { backgroundColor: c.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Heute', tabBarIcon: icon('◎') }}
        />
        <Tabs.Screen
          name="chat"
          options={{ title: 'Coach', tabBarIcon: icon('✎') }}
        />
        <Tabs.Screen
          name="calendar"
          options={{ title: 'Kalender', tabBarIcon: icon('▦') }}
        />
        {/* A route, not a tab: the first run redirects here and back. The
            tab bar is hidden too — three tabs to nowhere would invite the
            athlete to skip a setup the engine needs completed. */}
        <Tabs.Screen
          name="onboarding"
          options={{
            href: null,
            title: 'Einrichtung',
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </SessionProvider>
  );
}
