// /PWMap/app/(tabs)/explore.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

const BRAND = {
  navy: '#0C3559',
  lightBlue: '#71A8D7',
  green: '#2CA959',
  white: '#FFFFFF',
  danger: '#E74C3C',
  gray: '#95A5A6',
  darkText: '#2C3E50',
  mintBg: '#F0F7F4',
};

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Auth UI States
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin UI States
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
      else setUserProfile(null);
    });
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) setUserProfile(data);
  };

  const fetchPendingReports = async () => {
    setLoadingReports(true);
    const { data, error } = await supabase
      .from('location_reports')
      // NOTE THE CHANGE HERE: explicitly linking via the submitted_by column
      .select('*, profiles!location_reports_submitted_by_fkey(email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert("Dashboard Error", error.message);
      console.error(error);
    } else if (data) {
      setPendingReports(data);
    }
    setLoadingReports(false);
  };

  const openAdminDashboard = () => {
    setIsAdminModalVisible(true);
    fetchPendingReports();
  };

  const handleModeration = async (reportId: string, newStatus: 'approved' | 'rejected') => {
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from('location_reports')
      .update({
        status: newStatus,
        reviewed_by: session.user.id,
        review_date: new Date().toISOString()
      })
      .eq('id', reportId);

    if (error) {
      Alert.alert("Error", "Could not update report: " + error.message);
    } else {
      Alert.alert("Success", `Report marked as ${newStatus.toUpperCase()}`);
      fetchPendingReports(); // Refresh the list
    }
  };

  async function signInWithEmail() {
    if (!email || !password) return Alert.alert("Error", "Please enter both email and password.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login Failed", error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!email || !password || !confirmPassword) return Alert.alert("Error", "Please fill in all fields.");
    if (password !== confirmPassword) return Alert.alert("Error", "Passwords do not match.");
    setLoading(true);
    const { data: { session }, error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert("Sign Up Failed", error.message);
    else if (!session) {
      Alert.alert("Check your email", "Please check your inbox for verification!");
      setIsLoginMode(true);
    } else Alert.alert("Success!", "Account created.");
    setLoading(false);
  }

  // --- UI FOR LOGGED IN USERS ---
  if (session && session.user) {
    const isAdmin = userProfile?.role === 'city_admin' || userProfile?.role === 'super_admin';

    return (
      <LinearGradient colors={['#EBF5F3', '#C6E3D8']} style={styles.gradientBackground}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <Image source={require('../../assets/images/pwd-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtext}>Logged in as: {session.user.email}</Text>
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>{userProfile.role.replace('_', ' ').toUpperCase()}</Text>
              </View>
            )}
          </View>

          {isAdmin && (
            <TouchableOpacity style={[styles.button, styles.buttonWarning]} onPress={openAdminDashboard} activeOpacity={0.8}>
              <MaterialIcons name="admin-panel-settings" size={24} color={BRAND.white} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Open Admin Dashboard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={() => supabase.auth.signOut()} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* --- ADMIN MODAL --- */}
        <Modal animationType="slide" visible={isAdminModalVisible} onRequestClose={() => setIsAdminModalVisible(false)}>
          <View style={styles.adminModalContainer}>
            <View style={styles.adminHeader}>
              <Text style={styles.adminTitle}>Pending Reports</Text>
              <TouchableOpacity onPress={() => setIsAdminModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color={BRAND.navy} />
              </TouchableOpacity>
            </View>

            {loadingReports ? (
              <ActivityIndicator size="large" color={BRAND.navy} style={{ marginTop: 50 }} />
            ) : pendingReports.length === 0 ? (
              <Text style={styles.emptyText}>No pending reports to review! 🎉</Text>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {pendingReports.map((report) => (
                  <View key={report.id} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportType}>{report.type.toUpperCase()}</Text>
                      <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleDateString()}</Text>
                    </View>

                    {report.image_url && (
                      <Image source={{ uri: report.image_url }} style={styles.reportImage} resizeMode="cover" />
                    )}

                    <Text style={styles.reportLabel}>Submitted by: <Text style={styles.reportValue}>{report.profiles?.email || 'Unknown'}</Text></Text>
                    {report.description && (
                      <Text style={styles.reportLabel}>Notes: <Text style={styles.reportValue}>{report.description}</Text></Text>
                    )}

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleModeration(report.id, 'rejected')}>
                        <MaterialIcons name="close" size={20} color={BRAND.white} />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleModeration(report.id, 'approved')}>
                        <MaterialIcons name="check" size={20} color={BRAND.white} />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>
      </LinearGradient>
    );
  }

  // --- UI FOR GUESTS (LOGIN / SIGNUP) ---
  return (
    <LinearGradient colors={['#EBF5F3', '#C6E3D8']} style={styles.gradientBackground}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.headerContainer}>
          <Image source={require('../../assets/images/pwd-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.subtext}>
            {isLoginMode ? "Sign in to verify facilities." : "Create an account to verify facilities."}
          </Text>
        </View>
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} onChangeText={setEmail} value={email} placeholder="email@address.com" placeholderTextColor={BRAND.gray} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput style={[styles.input, styles.passwordInput]} onChangeText={setPassword} value={password} secureTextEntry={!showPassword} placeholder="••••••••" placeholderTextColor={BRAND.gray} autoCapitalize="none" />
              <TouchableOpacity style={styles.eyeIconContainer} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color={BRAND.gray} />
              </TouchableOpacity>
            </View>
          </View>
          {!isLoginMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput style={[styles.input, styles.passwordInput]} onChangeText={setConfirmPassword} value={confirmPassword} secureTextEntry={!showConfirmPassword} placeholder="••••••••" placeholderTextColor={BRAND.gray} autoCapitalize="none" />
                <TouchableOpacity style={styles.eyeIconContainer} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color={BRAND.gray} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {isLoginMode ? (
            <TouchableOpacity style={[styles.button, styles.buttonNavy]} onPress={signInWithEmail} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.buttonLightBlue]} onPress={signUpWithEmail} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Account"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.toggleModeButton} onPress={() => setIsLoginMode(!isLoginMode)} activeOpacity={0.6}>
            <Text style={styles.toggleModeText}>{isLoginMode ? "Don't have an account yet? Sign up" : "Already have an account? Sign in"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, padding: 25, justifyContent: 'center' },
  headerContainer: { marginBottom: 40, alignItems: 'center' },
  logo: { width: 250, height: 120, marginBottom: 10 },
  subtext: { fontSize: 15, color: BRAND.navy, marginTop: 8, textAlign: 'center', fontWeight: '600', lineHeight: 22 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '800', marginBottom: 8, color: BRAND.navy, marginLeft: 4 },
  input: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: '#D1E3DD', borderRadius: 14, padding: 16, fontSize: 16, color: BRAND.darkText },
  passwordWrapper: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 50 },
  eyeIconContainer: { position: 'absolute', right: 15, padding: 5 },
  button: { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12, flexDirection: 'row', justifyContent: 'center' },
  buttonNavy: { backgroundColor: BRAND.navy },
  buttonLightBlue: { backgroundColor: BRAND.lightBlue },
  buttonGreen: { backgroundColor: BRAND.green },
  buttonDanger: { backgroundColor: BRAND.danger },
  buttonWarning: { backgroundColor: '#F39C12' },
  buttonText: { color: BRAND.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  toggleModeButton: { marginTop: 15, alignItems: 'center', padding: 10 },
  toggleModeText: { color: BRAND.navy, fontSize: 14, fontWeight: '600' },

  // --- NEW ADMIN STYLES ---
  adminBadge: { backgroundColor: BRAND.navy, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  adminBadgeText: { color: BRAND.white, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  adminModalContainer: { flex: 1, backgroundColor: BRAND.mintBg },
  adminHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, backgroundColor: BRAND.white, borderBottomWidth: 1, borderBottomColor: '#D1E3DD' },
  adminTitle: { fontSize: 24, fontWeight: '900', color: BRAND.navy },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 18, color: BRAND.gray, fontWeight: '600' },
  reportCard: { backgroundColor: BRAND.white, padding: 15, borderRadius: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  reportType: { fontSize: 16, fontWeight: 'bold', color: BRAND.navy },
  reportDate: { fontSize: 14, color: BRAND.gray },
  reportImage: { width: '100%', height: 150, borderRadius: 10, marginBottom: 10 },
  reportLabel: { fontSize: 14, fontWeight: 'bold', color: BRAND.gray, marginBottom: 4 },
  reportValue: { fontWeight: 'normal', color: BRAND.darkText },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: BRAND.danger, marginRight: 8 },
  approveBtn: { backgroundColor: BRAND.green, marginLeft: 8 },
  actionBtnText: { color: BRAND.white, fontWeight: 'bold', marginLeft: 6 },
});
