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
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { WaveformMark } from '../../components/icons/WaveformMark';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      let message = signInError.message;
      if (message.includes('Invalid login credentials')) {
        message = 'Adresse mail ou mot de passe incorrect';
      } else if (message.includes('Email not confirmed')) {
        message = 'Confirme ton email avant de te connecter.';
      }
      setError(message);
      return;
    }

    router.replace('/(tabs)/explore');
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
          Connecte-toi à ton compte
        </Text>

        {error && (
          <View className="bg-like/10 border border-like rounded-card px-3 py-2 mb-4">
            <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-like text-sm">
              {error}
            </Text>
          </View>
        )}

        <View className="mb-4">
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

        <View className="mb-6">
          <Text
            style={{ fontFamily: 'Inter_500Medium' }}
            className="text-sm text-text-secondary mb-1"
          >
            Mot de passe
          </Text>
          <View className="relative justify-center">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••"
              placeholderTextColor="#9A9A9A"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={{ fontFamily: 'Inter_400Regular' }}
              className="bg-background-secondary border border-border rounded-input px-3 py-3 pr-10 text-text-primary"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              className="absolute right-3"
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={18} color="#9A9A9A" />
              ) : (
                <Eye size={18} color="#9A9A9A" />
              )}
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={loading || !email || !password}
          className="bg-text-warm rounded-button py-3 items-center disabled:opacity-40"
        >
          {loading ? (
            <ActivityIndicator color="#FAF8F4" />
          ) : (
            <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-paper-hi">
              Se connecter
            </Text>
          )}
        </Pressable>

        <View className="items-center mt-6 gap-3">
          <View className="flex-row">
            <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-text-secondary text-sm">
              Pas encore de compte ?{' '}
            </Text>
            <Link href="/(auth)/signup">
              <Text
                style={{ fontFamily: 'Inter_400Regular' }}
                className="text-text-primary underline text-sm"
              >
                Créer un compte
              </Text>
            </Link>
          </View>
          <Link href="/(auth)/reset-password">
            <Text
              style={{ fontFamily: 'Inter_400Regular' }}
              className="text-text-primary underline text-sm"
            >
              Mot de passe oublié ?
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
