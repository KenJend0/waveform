import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { WaveformMark } from '../../components/icons/WaveformMark';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleReset = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'waveform://auth/callback',
    });

    setLoading(false);

    if (resetError) {
      setError("Impossible d'envoyer l'email de réinitialisation pour l'instant.");
      return;
    }

    setInfo('Email de réinitialisation envoyé ! Vérifie ta boîte mail.');
    setEmail('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-4">
          <WaveformMark />
        </View>
        <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-text-secondary text-center mb-8">
          Réinitialise ton mot de passe
        </Text>

        {error && (
          <View className="bg-like/10 border border-like rounded-card px-3 py-2 mb-4">
            <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-like text-sm">
              {error}
            </Text>
          </View>
        )}
        {info && (
          <View className="bg-sage/10 border border-sage rounded-card px-3 py-2 mb-4">
            <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-sage text-sm">
              {info}
            </Text>
          </View>
        )}

        <View className="mb-2">
          <Text
            style={{ fontFamily: 'Inter_500Medium' }}
            className="text-sm text-text-secondary mb-1"
          >
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="vous@example.com"
            placeholderTextColor="#9A9A9A"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{ fontFamily: 'Inter_400Regular' }}
            className="bg-background-secondary border border-border rounded-input px-3 py-3 text-text-primary"
          />
        </View>
        <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-xs text-text-tertiary mb-6">
          Nous t'enverrons un lien pour réinitialiser ton mot de passe.
        </Text>

        <Pressable
          onPress={handleReset}
          disabled={loading || !email}
          className="bg-text-warm rounded-button py-3 items-center disabled:opacity-40"
        >
          {loading ? (
            <ActivityIndicator color="#FAF8F4" />
          ) : (
            <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-paper-hi">
              Envoyer le lien
            </Text>
          )}
        </Pressable>

        <View className="items-center mt-6">
          <Link href="/(auth)/login">
            <Text
              style={{ fontFamily: 'Inter_400Regular' }}
              className="text-text-secondary underline text-sm"
            >
              Retour à la connexion
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
