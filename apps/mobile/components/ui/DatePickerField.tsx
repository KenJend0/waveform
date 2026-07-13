import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';

type Props = {
  /** Date au format YYYY-MM-DD (même format que le `<input type="date">` web). */
  value: string;
  onChange: (value: string) => void;
  /** Date la plus tardive sélectionnable — miroir du `max={today}` web. */
  maxDate?: Date;
};

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function fromDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Champ "Date d'écoute" — miroir visuel du `<input type="date">` web (boîte avec icône
 * calendrier), branché sur le vrai picker natif de @react-native-community/datetimepicker
 * (pas @expo/ui/community/datetime-picker : bug de crash confirmé sur Android au moment
 * de l'écriture, voir github.com/expo/expo/issues/39424 — cette lib est mature et
 * largement éprouvée dans l'écosystème RN/Expo à la place).
 */
export function DatePickerField({ value, onChange, maxDate }: Props) {
  const [show, setShow] = useState(false);
  const dateObj = toDateOnly(value);

  return (
    <View>
      <Pressable
        onPress={() => setShow(true)}
        className="flex-row items-center justify-between bg-background-secondary border border-border rounded-input px-4 py-3"
      >
        <Text className="text-text-primary" style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
          {dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
        <Calendar size={16} color="#9A9A9A" />
      </Pressable>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          maximumDate={maxDate}
          display="default"
          onValueChange={(_event, selectedDate) => {
            setShow(false);
            if (selectedDate) onChange(fromDate(selectedDate));
          }}
          onDismiss={() => setShow(false)}
        />
      )}

      {/* Modal séparée sur iOS : le mode "inline" s'affiche dans le flux normal, ce qui
          poussait les boutons Enregistrer/Annuler hors du bottom sheet compact et ne se
          refermait que via "Terminé" — ici la calendrier est un vrai overlay qui se ferme
          au tap ailleurs, sans jamais déplacer le layout du sheet en dessous. */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(28,28,28,0.45)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShow(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="bg-background rounded-card px-4 pt-2 pb-1"
              style={{ width: '90%' }}
            >
              <DateTimePicker
                value={dateObj}
                mode="date"
                maximumDate={maxDate}
                display="inline"
                onValueChange={(_event, selectedDate) => {
                  if (selectedDate) onChange(fromDate(selectedDate));
                }}
              />
              <Pressable onPress={() => setShow(false)} className="self-end mt-1 px-3 py-1.5">
                <Text className="text-accent" style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}>Terminé</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
