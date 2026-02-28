import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qcid, setQcid] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);

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
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login Failed", error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data: { session }, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      Alert.alert("Sign Up Failed", error.message);
    } else if (!session) {
      Alert.alert("Check your email", "Please check your inbox for verification!");
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
      <View style={styles.container}>
        <Text style={styles.header}>Welcome to PWMap</Text>
        <Text style={styles.subtext}>Logged in as: {session.user.email}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Link your Quezon City ID (QCID)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter QCID Number"
            value={qcid}
            onChangeText={setQcid}
          />
          <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={updateQCID} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Saving..." : "Verify QCID"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.buttonCancel]} 
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- UI FOR GUESTS (LOGIN / SIGNUP) ---
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Join PWMap</Text>
      <Text style={styles.subtext}>Sign in to verify facilities and build your trust score.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          onChangeText={setEmail}
          value={email}
          placeholder="email@address.com"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={signInWithEmail} disabled={loading}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={signUpWithEmail} disabled={loading}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f5f5f5' },
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  subtext: { fontSize: 14, color: '#666', marginBottom: 30, textAlign: 'center' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 20, elevation: 2 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 10 },
  button: { padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  buttonGreen: { backgroundColor: '#4CAF50' },
  buttonBlue: { backgroundColor: '#2196F3' },
  buttonCancel: { backgroundColor: '#FF5252', marginTop: 20 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
