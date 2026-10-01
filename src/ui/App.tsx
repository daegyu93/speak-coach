import { useEffect, useMemo, useState } from 'preact/hooks';
import { WebSpeechOutput } from '../speech/webSpeech';
import { loadSettings, saveSettings } from '../storage/db';
import type { Mode, Scenario, SessionReview, Settings } from '../types';
import { ChatScreen } from './ChatScreen';
import { HomeScreen } from './HomeScreen';
import { NotesScreen } from './NotesScreen';
import { ReviewScreen } from './ReviewScreen';
import { SettingsScreen } from './SettingsScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'notes' }
  | { name: 'chat'; scenario: Scenario; mode: Mode }
  | { name: 'review'; review: SessionReview };

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const output = useMemo(() => new WebSpeechOutput(), []);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return null;
  const home = () => setScreen({ name: 'home' });
  const notes = () => setScreen({ name: 'notes' });

  switch (screen.name) {
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          output={output}
          onBack={home}
          onSave={async (s) => {
            await saveSettings(s);
            setSettings(s);
            home();
          }}
        />
      );
    case 'chat':
      return (
        <ChatScreen
          scenario={screen.scenario}
          mode={screen.mode}
          settings={settings}
          output={output}
          onExit={home}
          onDone={(review) => setScreen({ name: 'review', review })}
        />
      );
    case 'review':
      return <ReviewScreen review={screen.review} onHome={home} onNotes={notes} />;
    case 'notes':
      return <NotesScreen onBack={home} />;
    default:
      return (
        <HomeScreen
          hasKey={settings.apiKey.length > 0}
          onStart={(scenario, mode) => setScreen({ name: 'chat', scenario, mode })}
          onNotes={notes}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
  }
}
