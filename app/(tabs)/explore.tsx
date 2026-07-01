// /PWMap/app/(tabs)/explore.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { CustomModal } from '@/components/ui/custom-modal';
import { CustomAlert } from '@/components/ui/custom-alert';
import { BRAND } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [adminReports, setAdminReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [adminFilter, setAdminFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // User Reports (Contributions) States
  const [userReports, setUserReports] = useState<any[]>([]);
  const [loadingUserReports, setLoadingUserReports] = useState(false);
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({});
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }>;
  } | null>(null);

  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }>
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons,
    });
  };
  const [userReportsFilter, setUserReportsFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchUserReports(session.user.id);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchUserReports(session.user.id);
      } else {
        setUserProfile(null);
        setUserReports([]);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchUserReports(session.user.id);
      }
    }, [session?.user?.id])
  );

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) setUserProfile(data);
  };

  const fetchUserReports = async (userId: string) => {
    setLoadingUserReports(true);
    const { data, error } = await supabase
      .from('location_reports')
      .select('*')
      .eq('submitted_by', userId)
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching user reports:", error);
    } else if (data) {
      setUserReports(data);
      geocodeReports(data);
      checkReportStatusNotifications(userId, data);
    }
    setLoadingUserReports(false);
  };

  const checkReportStatusNotifications = async (userId: string, fetchedReports: any[]) => {
    try {
      const storageKey = `notified_reports_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      const notifiedMap = stored ? JSON.parse(stored) : {};
      const isFirstRun = !stored;

      const updatedMap = { ...notifiedMap };
      const statusChanges: Array<{ title: string, message: string }> = [];

      for (const report of fetchedReports) {
        const previousStatus = notifiedMap[report.id];
        const currentStatus = report.status;

        // Trigger notification only if transitioning from pending to approved/rejected
        if (!isFirstRun && previousStatus === 'pending' && currentStatus !== 'pending') {
          const typeName = report.type === 'ramp' ? 'Ramp' : 'Elevator';
          const coordinates = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`;

          if (currentStatus === 'approved') {
            statusChanges.push({
              title: 'Report Approved! 🎉',
              message: `Your PWD facility report for a ${typeName} at (${coordinates}) has been approved and is now live on the map!`
            });
          } else if (currentStatus === 'rejected') {
            statusChanges.push({
              title: 'Report Moderated ⚠️',
              message: `Your PWD facility report for a ${typeName} at (${coordinates}) has been reviewed and rejected by the moderation team.`
            });
          }
        }

        // Keep map updated
        updatedMap[report.id] = currentStatus;
      }

      // Save updated map to AsyncStorage
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedMap));

      // Display custom alert notifications
      if (statusChanges.length > 0) {
        if (statusChanges.length === 1) {
          showAlert(statusChanges[0].title, statusChanges[0].message);
        } else {
          showAlert(
            'Report Updates!',
            `You have ${statusChanges.length} report updates. Check your contribution list for details.`
          );
        }
      }
    } catch (err) {
      console.error("Error checking report notifications:", err);
    }
  };

  const geocodeReports = async (reports: any[]) => {
    const newAddresses: Record<string, string> = {};
    for (const report of reports) {
      const key = `${report.latitude},${report.longitude}`;
      if (resolvedAddresses[key]) continue;
      try {
        const addressResult = await Location.reverseGeocodeAsync({
          latitude: report.latitude,
          longitude: report.longitude
        });
        if (addressResult && addressResult.length > 0) {
          const addr = addressResult[0];
          const name = addr.name || addr.street || '';
          const subregion = addr.subregion || addr.district || '';
          const city = addr.city || addr.subregion || '';
          const formatted = [name, subregion, city].filter(p => p.trim() !== '').join(', ');
          newAddresses[key] = formatted || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
        } else {
          newAddresses[key] = `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
        }
      } catch (err) {
        newAddresses[key] = `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
      }
    }
    if (Object.keys(newAddresses).length > 0) {
      setResolvedAddresses(prev => ({ ...prev, ...newAddresses }));
    }
  };

  const fetchAdminReports = async (status: 'pending' | 'approved' | 'rejected') => {
    setLoadingReports(true);
    const { data, error } = await supabase
      .from('location_reports')
      .select('*, profiles!location_reports_submitted_by_fkey(email)')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      showAlert("Dashboard Error", error.message);
      console.error(error);
    } else if (data) {
      setAdminReports(data);
      geocodeReports(data);
    }
    setLoadingReports(false);
  };

  const openAdminDashboard = () => {
    setIsAdminModalVisible(true);
    setAdminFilter('pending');
    fetchAdminReports('pending');
  };

  const handleAdminFilterChange = (status: 'pending' | 'approved' | 'rejected') => {
    setAdminFilter(status);
    fetchAdminReports(status);
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
      showAlert("Error", "Could not update report: " + error.message);
    } else {
      showAlert("Success", `Report marked as ${newStatus.toUpperCase()}`);
      fetchAdminReports(adminFilter);
    }
  };

  const handleSignOutClick = () => {
    setIsSignOutModalVisible(true);
  };

  const confirmSignOut = async () => {
    setIsSignOutModalVisible(false);
    await supabase.auth.signOut();
  };

  async function signInWithEmail() {
    if (!email || !password) return showAlert("Error", "Please enter both email and password.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showAlert("Login Failed", error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!email || !password || !confirmPassword) return showAlert("Error", "Please fill in all fields.");
    if (password !== confirmPassword) return showAlert("Error", "Passwords do not match.");
    setLoading(true);
    const { data: { session }, error } = await supabase.auth.signUp({ email, password });
    if (error) showAlert("Sign Up Failed", error.message);
    else if (!session) {
      showAlert("Check your email", "Please check your inbox for verification!");
      setIsLoginMode(true);
    } else showAlert("Success!", "Account created.");
    setLoading(false);
  }

  // Check if user is logged in with a registered account (not anonymous)
  const isAnonymous = session?.user?.is_anonymous || !session?.user?.email;
  const isLoggedIn = session && session.user && !isAnonymous;

  // --- UI FOR LOGGED IN USERS ---
  if (isLoggedIn) {
    const isAdmin = userProfile?.role === 'city_admin' || userProfile?.role === 'super_admin';

    const totalCount = userReports.length;
    const pendingCount = userReports.filter(r => r.status === 'pending').length;
    const approvedCount = userReports.filter(r => r.status === 'approved').length;

    const filteredUserReports = userReports.filter(report => {
      if (userReportsFilter === 'all') return true;
      return report.status === userReportsFilter;
    });

    return (
      <LinearGradient colors={['#EBF5F3', '#C6E3D8']} style={styles.gradientBackground}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* PROFILE CARD */}
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Ionicons name="person-circle" size={54} color={BRAND.navy} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileEmail} numberOfLines={1}>{session.user.email}</Text>
                {isAdmin ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>{userProfile?.role?.replace('_', ' ').toUpperCase() || 'ADMIN'}</Text>
                  </View>
                ) : (
                  <Text style={styles.profileRoleText}>Community Contributor</Text>
                )}
              </View>
              <TouchableOpacity style={styles.logoutIconButton} onPress={handleSignOutClick} activeOpacity={0.7}>
                <MaterialIcons name="logout" size={22} color={BRAND.danger} />
              </TouchableOpacity>
            </View>

            {isAdmin && (
              <TouchableOpacity style={[styles.button, styles.buttonWarning, { marginTop: 16, marginBottom: 0 }]} onPress={openAdminDashboard} activeOpacity={0.8}>
                <MaterialIcons name="admin-panel-settings" size={20} color={BRAND.white} style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Open Admin Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* MODERN FILTER PILLS */}
          {userReports.length > 0 && (
            <View style={styles.filterContainer}>
              {[
                { key: 'all', label: 'All', count: totalCount },
                { key: 'pending', label: 'Pending', count: pendingCount },
                { key: 'approved', label: 'Approved', count: approvedCount },
              ].map((pill) => {
                const isActive = userReportsFilter === pill.key;
                return (
                  <TouchableOpacity
                    key={pill.key}
                    style={[
                      styles.filterPill,
                      isActive && styles.filterPillActive
                    ]}
                    onPress={() => setUserReportsFilter(pill.key as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.filterPillText,
                      isActive && styles.filterPillTextActive
                    ]}>
                      {pill.label} <Text style={[styles.filterPillCount, { color: isActive ? BRAND.white : BRAND.gray }]}>({pill.count})</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {loadingUserReports ? (
            <ActivityIndicator size="large" color={BRAND.navy} style={{ marginTop: 20 }} />
          ) : userReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="map" size={48} color={BRAND.gray} />
              <Text style={styles.emptyText}>You haven&apos;t submitted any marks yet.</Text>
              <Text style={styles.emptySubtext}>Report a ramp or elevator on the Map screen!</Text>
            </View>
          ) : filteredUserReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="filter-list-off" size={48} color={BRAND.gray} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>No {userReportsFilter} marks found.</Text>
              <Text style={styles.emptySubtext}>Adjust your filter settings above.</Text>
            </View>
          ) : (
            filteredUserReports.map((report) => {
              const key = `${report.latitude},${report.longitude}`;
              const locationName = resolvedAddresses[key] || 'Resolving address...';
              const isRamp = report.type === 'ramp';

              return (
                <View key={report.id} style={styles.reportCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.typeBadgeContainer}>
                      <MaterialIcons 
                        name={isRamp ? "accessible" : "elevator"} 
                        size={18} 
                        color={isRamp ? '#007BFF' : BRAND.green} 
                      />
                      <Text style={[styles.cardType, { color: isRamp ? '#007BFF' : BRAND.green }]}>
                        {report.type.toUpperCase()}
                      </Text>
                    </View>
                    <View 
                      style={[
                        styles.statusBadge, 
                        { 
                          backgroundColor: report.status === 'approved' 
                            ? '#D4EDDA' 
                            : report.status === 'rejected' 
                            ? '#F8D7DA' 
                            : '#FFF3CD' 
                        }
                      ]}
                    >
                      <Text 
                        style={[
                          styles.statusText, 
                          { 
                            color: report.status === 'approved' 
                              ? '#155724' 
                              : report.status === 'rejected' 
                              ? '#721C24' 
                              : '#856404' 
                          }
                        ]}
                      >
                        {report.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {report.image_url ? (
                    <Image source={{ uri: report.image_url }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.cardNoPhoto}>
                      <MaterialIcons name="image-not-supported" size={32} color={BRAND.gray} />
                      <Text style={styles.cardNoPhotoText}>No photo provided</Text>
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="place" size={16} color={BRAND.navy} style={styles.infoIcon} />
                      <Text style={styles.infoText}>{locationName}</Text>
                    </View>

                    {report.description && (
                      <View style={styles.infoRow}>
                        <MaterialIcons name="chat-bubble-outline" size={16} color={BRAND.gray} style={styles.infoIcon} />
                        <Text style={styles.descText}>&quot;{report.description}&quot;</Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <MaterialIcons name="event" size={16} color={BRAND.gray} style={styles.infoIcon} />
                      <Text style={styles.dateText}>
                        Submitted on {new Date(report.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* --- SIGN OUT CONFIRMATION MODAL --- */}
        <CustomModal visible={isSignOutModalVisible} onClose={() => setIsSignOutModalVisible(false)} title="SIGN OUT">
          <View style={styles.warningIconContainer}>
            <MaterialIcons name="logout" size={40} color={BRAND.danger} />
          </View>
          <Text style={styles.confirmText}>
            Are you sure you want to sign out?
          </Text>
          
          <View style={styles.modalButtonRow}>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setIsSignOutModalVisible(false)} activeOpacity={0.7}>
              <Text style={[styles.buttonText, { color: BRAND.navy }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={confirmSignOut} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </CustomModal>

        {/* --- ADMIN MODAL --- */}
        <CustomModal visible={isAdminModalVisible} onClose={() => setIsAdminModalVisible(false)} variant="fullscreen" title="Admin Dashboard">
          {/* ADMIN FILTER PILLS */}
          <View style={styles.adminFilterContainer}>
            {[
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map((pill) => {
              const isActive = adminFilter === pill.key;
              return (
                <TouchableOpacity
                  key={pill.key}
                  style={[
                    styles.adminFilterPill,
                    isActive && styles.adminFilterPillActive
                  ]}
                  onPress={() => handleAdminFilterChange(pill.key as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.adminFilterPillText,
                    isActive && styles.adminFilterPillTextActive
                  ]}>
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loadingReports ? (
            <ActivityIndicator size="large" color={BRAND.navy} style={{ marginTop: 50 }} />
          ) : adminReports.length === 0 ? (
            <Text style={styles.emptyText}>No {adminFilter} reports found! 🎉</Text>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {adminReports.map((report) => {
                const key = `${report.latitude},${report.longitude}`;
                const locationName = resolvedAddresses[key] || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;

                return (
                  <View key={report.id} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportType}>{report.type.toUpperCase()}</Text>
                      <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleDateString()}</Text>
                    </View>

                    {report.image_url && (
                      <Image source={{ uri: report.image_url }} style={styles.reportImage} resizeMode="cover" />
                    )}

                    <Text style={styles.reportLabel}>Location: <Text style={styles.reportValue}>{locationName}</Text></Text>
                    <Text style={styles.reportLabel}>Submitted by: <Text style={styles.reportValue}>{report.profiles?.email || 'Unknown'}</Text></Text>
                    {report.description && (
                      <Text style={styles.reportLabel}>Notes: <Text style={styles.reportValue}>{report.description}</Text></Text>
                    )}

                    {report.status === 'pending' && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleModeration(report.id, 'rejected')}>
                          <MaterialIcons name="close" size={18} color={BRAND.white} />
                          <Text style={styles.actionBtnText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleModeration(report.id, 'approved')}>
                          <MaterialIcons name="check" size={18} color={BRAND.white} />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {report.status === 'approved' && (
                      <View style={styles.actionRow}>
                        <View style={[styles.statusBadgeTextContainer, { backgroundColor: '#D4EDDA' }]}>
                          <Text style={{ color: '#155724', fontWeight: 'bold', fontSize: 13 }}>APPROVED</Text>
                        </View>
                        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleModeration(report.id, 'rejected')}>
                          <MaterialIcons name="close" size={18} color={BRAND.white} />
                          <Text style={styles.actionBtnText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {report.status === 'rejected' && (
                      <View style={styles.actionRow}>
                        <View style={[styles.statusBadgeTextContainer, { backgroundColor: '#F8D7DA' }]}>
                          <Text style={{ color: '#721C24', fontWeight: 'bold', fontSize: 13 }}>REJECTED</Text>
                        </View>
                        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleModeration(report.id, 'approved')}>
                          <MaterialIcons name="check" size={18} color={BRAND.white} />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </CustomModal>

        {/* --- CUSTOM ALERT CONTAINER --- */}
        {alertConfig && (
          <CustomAlert
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            buttons={alertConfig.buttons}
            onClose={() => setAlertConfig(null)}
          />
        )}
      </LinearGradient>
    );
  }

  // --- UI FOR GUESTS (LOGIN / SIGNUP) ---
  return (
    <LinearGradient colors={['#EBF5F3', '#C6E3D8']} style={styles.gradientBackground}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.headerContainer}>
          <Image source={require('../../assets/images/pwd-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardHeaderTitle}>{isLoginMode ? "Welcome Back" : "Create Account"}</Text>
          <Text style={styles.cardHeaderSubtitle}>
            {isLoginMode ? "Sign in to access community accessibility features." : "Join us to help map accessibility for PWDs."}
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail" size={20} color={BRAND.navy} style={styles.inputIcon} />
              <TextInput 
                style={styles.cardInput} 
                onChangeText={setEmail} 
                value={email} 
                placeholder="email@address.com" 
                placeholderTextColor={BRAND.gray} 
                autoCapitalize="none" 
                keyboardType="email-address" 
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={20} color={BRAND.navy} style={styles.inputIcon} />
              <TextInput 
                style={[styles.cardInput, { paddingRight: 50 }]} 
                onChangeText={setPassword} 
                value={password} 
                secureTextEntry={!showPassword} 
                placeholder="Enter password" 
                placeholderTextColor={BRAND.gray} 
                autoCapitalize="none" 
              />
              <TouchableOpacity style={styles.eyeIconContainer} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={BRAND.gray} />
              </TouchableOpacity>
            </View>
          </View>

          {!isLoginMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={20} color={BRAND.navy} style={styles.inputIcon} />
                <TextInput 
                  style={[styles.cardInput, { paddingRight: 50 }]} 
                  onChangeText={setConfirmPassword} 
                  value={confirmPassword} 
                  secureTextEntry={!showConfirmPassword} 
                  placeholder="Confirm password" 
                  placeholderTextColor={BRAND.gray} 
                  autoCapitalize="none" 
                />
                <TouchableOpacity style={styles.eyeIconContainer} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={BRAND.gray} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isLoginMode ? (
            <TouchableOpacity style={[styles.submitButton, styles.submitButtonNavy]} onPress={signInWithEmail} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.submitButtonText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.submitButton, styles.submitButtonGreen]} onPress={signUpWithEmail} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.submitButtonText}>{loading ? "Creating..." : "Create Account"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.toggleModeButton} onPress={() => setIsLoginMode(!isLoginMode)} activeOpacity={0.6}>
            <Text style={styles.toggleModeText}>
              {isLoginMode ? "Don't have an account yet? " : "Already have an account? "}
              <Text style={styles.toggleModeTextLink}>{isLoginMode ? "Sign Up" : "Sign In"}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* --- CUSTOM ALERT CONTAINER --- */}
      {alertConfig && (
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig(null)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, padding: 25, justifyContent: 'center' },
  formContainer: { width: '100%' },
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
  toggleModeText: {
    color: BRAND.gray,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },

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

  // --- NEW USER CONTRIBUTIONS STYLES ---
  scrollContainer: {
    padding: 25,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  divider: {
    height: 1,
    backgroundColor: '#D1E3DD',
    width: '100%',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.navy,
    marginBottom: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: BRAND.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1E3DD',
    borderStyle: 'dashed',
  },
  emptySubtext: {
    fontSize: 14,
    color: BRAND.gray,
    marginTop: 4,
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardNoPhoto: {
    width: '100%',
    height: 100,
    backgroundColor: BRAND.mintBg,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2EBE8',
  },
  cardNoPhotoText: {
    color: BRAND.gray,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  infoText: {
    fontSize: 14,
    color: BRAND.darkText,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  descText: {
    fontSize: 13,
    color: BRAND.darkText,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 17,
  },
  dateText: {
    fontSize: 12,
    color: BRAND.gray,
    fontWeight: '500',
  },

  // --- NEW PROFILE & SIGN OUT MODAL STYLES ---
  profileCard: {
    backgroundColor: BRAND.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2EBE8',
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.navy,
    marginBottom: 4,
  },
  profileRoleText: {
    fontSize: 13,
    color: BRAND.gray,
    fontWeight: '600',
  },
  logoutIconButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FDEDEC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modalButtonCancel: {
    backgroundColor: BRAND.mintBg,
    borderWidth: 1,
    borderColor: '#D1E3DD',
  },
  modalButtonConfirm: {
    backgroundColor: BRAND.danger,
  },
  warningIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FDEDEC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  confirmText: {
    fontSize: 14,
    color: BRAND.darkText,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 53, 89, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '85%',
    backgroundColor: BRAND.white,
    borderRadius: 24,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: BRAND.mintBg,
  },
  modalTitle: {
    marginBottom: 5,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.navy,
    letterSpacing: 1,
  },

  // --- USER/ADMIN FILTER STYLES ---
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
    width: '100%',
  },
  filterPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: BRAND.white,
    borderWidth: 1.5,
    borderColor: '#E2EBE8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: BRAND.navy,
    borderColor: BRAND.navy,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.navy,
  },
  filterPillTextActive: {
    color: BRAND.white,
  },
  filterPillCount: {
    fontWeight: '500',
    fontSize: 12,
  },

  adminFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#D1E3DD',
    gap: 10,
  },
  adminFilterPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: BRAND.mintBg,
    borderWidth: 1.5,
    borderColor: '#D1E3DD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminFilterPillActive: {
    backgroundColor: BRAND.navy,
    borderColor: BRAND.navy,
  },
  adminFilterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.navy,
  },
  adminFilterPillTextActive: {
    color: BRAND.white,
  },
  statusBadgeTextContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- SIGN IN / SIGN UP UI IMPROVEMENTS ---
  formCard: {
    backgroundColor: BRAND.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2EBE8',
  },
  cardHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.navy,
    marginBottom: 6,
    textAlign: 'center',
  },
  cardHeaderSubtitle: {
    fontSize: 14,
    color: BRAND.gray,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.mintBg,
    borderWidth: 1,
    borderColor: '#D1E3DD',
    borderRadius: 14,
    paddingLeft: 14,
    overflow: 'hidden',
  },
  inputIcon: {
    marginRight: 10,
  },
  cardInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    fontSize: 15,
    color: BRAND.darkText,
    fontWeight: '600',
  },
  submitButton: {
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  submitButtonNavy: {
    backgroundColor: BRAND.navy,
  },
  submitButtonGreen: {
    backgroundColor: BRAND.green,
  },
  submitButtonText: {
    color: BRAND.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  toggleModeTextLink: {
    color: BRAND.navy,
    fontWeight: '800',
  },
});
