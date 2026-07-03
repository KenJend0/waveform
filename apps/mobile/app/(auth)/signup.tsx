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

export default function SignupScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignup = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: firstName.trim() || null,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      let message = signUpError.message;
      if (message.includes('already registered')) {
        message = 'Cet email est déjà utilisé';
      } else if (message.includes('Password')) {
        message = 'Le mot de passe doit contenir au moins 8 caractères';
      }
      setError(message);
      return;
    }

    if (data.user && data.session) {
      router.replace('/(tabs)/explore');
      return;
    }

    setInfo('Compte créé ! Vérifie ta boîte mail et clique sur le lien pour activer ton compte.');
    setEmail('');
    setPassword('');
    setFirstName('');
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
          Crée ton compte Waveform
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

        <View className="mb-4">
          <Text
            style={{ fontFamily: 'Inter_500Medium' }}
            className="text-sm text-text-secondary mb-1"
          >
            Prénom
          </Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ton prénom"
            placeholderTextColor="#9A9A9A"
            style={{ fontFamily: 'Inter_400Regular' }}
            className="bg-background-secondary border border-border rounded-input px-3 py-3 text-text-primary"
          />
        </View>

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

        <View className="mb-2">
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
        <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-xs text-text-tertiary mb-6">
          Minimum 8 caractères
        </Text>

        <Pressable
          onPress={handleSignup}
          disabled={loading || !email || !password}
          className="bg-text-warm rounded-button py-3 items-center disabled:opacity-40"
        >
          {loading ? (
            <ActivityIndicator color="#FAF8F4" />
          ) : (
            <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-paper-hi">
              Créer un compte
            </Text>
          )}
        </Pressable>

        <View className="flex-row justify-center mt-6">
          <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-text-secondary text-sm">
            Déjà un compte ?{' '}
          </Text>
          <Link href="/(auth)/login">
            <Text
              style={{ fontFamily: 'Inter_400Regular' }}
              className="text-text-primary underline text-sm"
            >
              Se connecter
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
