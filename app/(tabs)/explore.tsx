import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // <-- Added for the eye icon
import { supabase } from '../../lib/supabase';

// --- BRAND COLORS EXTRACTED FROM PPT ---
const BRAND = {
  navy: '#0C3559',      
  lightBlue: '#71A8D7', 
  green: '#2CA959',      
  white: '#FFFFFF',
  danger: '#E74C3C',    
  gray: '#95A5A6',
  darkText: '#2C3E50',
};

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); 
  const [qcid, setQcid] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  
  // --- NEW UI STATES ---
  const [isLoginMode, setIsLoginMode] = useState(true); 
  const [showPassword, setShowPassword] = useState(false); 
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); 

  // Check if a user is already logged in when the tab opens
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login Failed", error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    // --- ADDED VALIDATION ---
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    const { data: { session }, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      Alert.alert("Sign Up Failed", error.message);
    } else if (!session) {
      Alert.alert("Check your email", "Please check your inbox for verification!");
      setIsLoginMode(true); // Switch back to login after successful signup
    } else {
      Alert.alert("Success!", "Account created.");
    }
    setLoading(false);
  }

  async function updateQCID() {
    if (!session?.user?.id) return;
    setLoading(true);
    
    // Upsert the QCID into the profiles table we created earlier
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, qcid_number: qcid, is_verified_pwd: true });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "QCID Linked Successfully! You are now a verified mapper.");
    }
    setLoading(false);
  }

  // --- UI FOR LOGGED IN USERS ---
  if (session && session.user) {
    return (
      <LinearGradient 
        colors={['#EBF5F3', '#C6E3D8']} 
        style={styles.gradientBackground}
      >
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <Image 
              source={require('../../assets/images/pwd-logo.png')} 
              style={styles.logo} 
              resizeMode="contain" 
            />
            <Text style={styles.subtext}>Logged in as: {session.user.email}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Link your Quezon City ID (QCID)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter QCID Number"
              placeholderTextColor={BRAND.gray}
              value={qcid}
              onChangeText={setQcid}
            />
            <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={updateQCID} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{loading ? "Saving..." : "Verify QCID"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.buttonDanger]} 
            onPress={() => supabase.auth.signOut()}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // --- UI FOR GUESTS (LOGIN / SIGNUP) ---
  return (
    <LinearGradient 
      colors={['#EBF5F3', '#C6E3D8']} 
      style={styles.gradientBackground}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerContainer}>
          <Image 
            source={require('../../assets/images/pwd-logo.png')} 
            style={styles.logo} 
            resizeMode="contain" 
          />
          <Text style={styles.subtext}>
            {isLoginMode 
              ? "Sign in to verify facilities and build your trust score." 
              : "Create an account to verify facilities and build your trust score."}
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              placeholder="email@address.com"
              placeholderTextColor={BRAND.gray}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                onChangeText={setPassword}
                value={password}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor={BRAND.gray}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.eyeIconContainer} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color={BRAND.gray} />
              </TouchableOpacity>
            </View>
          </View>


          {!isLoginMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  onChangeText={setConfirmPassword}
                  value={confirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor={BRAND.gray}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.eyeIconContainer} 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color={BRAND.gray} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Primary Action Button */}
          {isLoginMode ? (
            <TouchableOpacity style={[styles.button, styles.buttonNavy]} onPress={signInWithEmail} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.buttonLightBlue]} onPress={signUpWithEmail} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Account"}</Text>
            </TouchableOpacity>
          )}

          {/* Toggle View Mode Button */}
          <TouchableOpacity 
            style={styles.toggleModeButton} 
            onPress={() => setIsLoginMode(!isLoginMode)}
            activeOpacity={0.6}
          >
            <Text style={styles.toggleModeText}>
              {isLoginMode ? "Don't have an account yet? Sign up" : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// --- NEW BRAND STYLES ---
const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: { 
    flex: 1, 
    padding: 25, 
    justifyContent: 'center', 
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 250,      
    height: 120,     
    marginBottom: 10,
  },
  subtext: { 
    fontSize: 15, 
    color: BRAND.navy,
    marginTop: 8, 
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
  },
  card: { 
    backgroundColor: BRAND.white, 
    padding: 25, 
    borderRadius: 20, 
    marginBottom: 30, 
    shadowColor: BRAND.navy, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 15, 
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2EBE8'
  },
  inputGroup: { 
    marginBottom: 20 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '800', 
    marginBottom: 8, 
    color: BRAND.navy,
    marginLeft: 4, 
  },
  input: { 
    backgroundColor: BRAND.white, 
    borderWidth: 1, 
    borderColor: '#D1E3DD', 
    borderRadius: 14, 
    padding: 16, 
    fontSize: 16, 
    color: BRAND.darkText,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50, 
  },
  eyeIconContainer: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  button: { 
    padding: 16, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonNavy: { backgroundColor: BRAND.navy },
  buttonLightBlue: { backgroundColor: BRAND.lightBlue },
  buttonGreen: { backgroundColor: BRAND.green },
  buttonDanger: { backgroundColor: BRAND.danger },
  buttonText: { color: BRAND.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  toggleModeButton: {
    marginTop: 15,
    alignItems: 'center',
    padding: 10,
  },
  toggleModeText: {
    color: BRAND.navy,
    fontSize: 14,
    fontWeight: '600',
  }
});