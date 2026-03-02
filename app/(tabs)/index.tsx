import { MaterialIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';

// --- BRAND COLORS EXTRACTED FROM YOUR PRESENTATION ---
const BRAND = {
  navy: '#0C3559',      // Dark blue from the wheelchair icon and "PWD" text
  lightBlue: '#71A8D7', // Light blue from the "MAP" text
  green: '#2CA959',     // Green from the elevator arrow and borders
  mintBg: '#F0F7F4',    // Subtle geometric mint background tint
  white: '#FFFFFF',
  danger: '#E74C3C',    // Red for deletion
  gray: '#95A5A6',
};

export default function TabOneScreen() {
  // --- STATE MANAGEMENT ---
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [draftLocation, setDraftLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  
  // Auth & Viewing States
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  
  // Uploading States
  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Map State
  const [region, setRegion] = useState({
    latitude: 14.6760, 
    longitude: 121.0437,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // --- BOOT SEQUENCE ---
  useEffect(() => {
    const setupAutomatedAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("Anonymous Login Failed:", error.message);
        } else {
          console.log("Success! New Anonymous User ID:", data.user?.id);
          setCurrentUserId(data.user?.id || null);
        }
      } else {
        console.log("Welcome back! Existing User ID:", session.user.id);
        setCurrentUserId(session.user.id);
      }
    };

    setupAutomatedAuth();
    fetchFacilities();

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }
        let userLocation = await Location.getCurrentPositionAsync({});
        setLocation(userLocation);
      } catch (error) {
        console.log("Could not fetch location:", error);
      }
    })();
  }, []);

  // --- MAP ACTIONS ---
  const fetchFacilities = async () => {
    try {
      const { data, error } = await supabase.from('facilities').select('*');
      if (error) {
        console.error("Supabase Fetch Error:", error);
      } else if (data) {
        setMarkers(data);
      }
    } catch (err) {
      console.error("Network Crash:", err);
    }
  };

  const handleReportAtCurrentLocation = async () => {
    if (!location) {
      Alert.alert("Location not ready", "Still getting your GPS coordinates...");
      return;
    }
    setDraftLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
    setModalVisible(true);
  };

  const handleMapLongPress = (event: any) => {
    setDraftLocation(event.nativeEvent.coordinate);
    setModalVisible(true);
  };

  // --- MEDIA ACTIONS ---
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need access to your gallery to upload photos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, 
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // --- DATABASE ACTIONS ---
  const saveMarkerToDB = async (dbType: string) => {
    if (!draftLocation) return;
    
    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Authentication Error", "Could not verify your anonymous session.");
      setIsUploading(false);
      return;
    }

    let publicImageUrl = null;

    if (image) {
      try {
        console.log("Reading file...");
        const base64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
        const filePath = `${Date.now()}_facility.jpg`; 
        
        console.log("Uploading to Supabase...");
        const { error: uploadError } = await supabase.storage
          .from('facility_images')
          .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

        if (uploadError) {
          Alert.alert("Upload Failed", "Could not upload photo to the cloud.");
          console.error(uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage.from('facility_images').getPublicUrl(filePath);
          publicImageUrl = publicUrlData.publicUrl;
          console.log("Image uploaded! URL:", publicImageUrl);
        }
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    console.log("Saving marker to database...");
    const { error } = await supabase.from('facilities').insert([{ 
      type: dbType, 
      latitude: draftLocation.latitude, 
      longitude: draftLocation.longitude,
      image_url: publicImageUrl,
      user_id: user.id 
    }]);

    setIsUploading(false);

    if (error) {
      Alert.alert("Error", "Could not save marker. " + error.message);
      console.error(error);
    } else {
      fetchFacilities();
      closeModal();
    }
  };

  const deleteMarker = async () => {
    if (!selectedFacility) return;

    Alert.alert(
      "Delete Marker",
      "Are you sure you want to remove this facility from the map?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            console.log("Deleting marker...");
            
            const { error } = await supabase
              .from('facilities')
              .delete()
              .eq('id', selectedFacility.id);

            if (error) {
              Alert.alert("Error", "Could not delete marker. " + error.message);
              console.error(error);
            } else {
              Alert.alert("Deleted", "The marker has been removed.");
              setSelectedFacility(null); 
              fetchFacilities(); 
            }
          }
        }
      ]
    );
  };

  const closeModal = () => {
    setModalVisible(false);
    setDraftLocation(null);
    setImage(null); 
  };

  // --- UI RENDER ---
  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        initialRegion={region}
        showsUserLocation={true}
        onLongPress={handleMapLongPress}
      >
{markers.map((marker) => {
          const isRamp = marker.type === 'ramp';
          // Define dynamic colors based on type
          const markerThemeColor = isRamp ? '#007BFF' : BRAND.green; // #007BFF matches the blue ramp icon

return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              onPress={() => setSelectedFacility(marker)}
              // Adjusted anchor to match the new 80x80 oversized box
              anchor={{ x: 0.5, y: 0.9 }} 
            >
              {/* THE ULTIMATE FIX: An oversized 80x80 invisible box */}
              <View style={styles.hugeBoundingBox}>
                
                <View style={[styles.iconBubble, { borderColor: markerThemeColor }]}>
                  <Image 
                    source={
                      isRamp 
                        ? require('../../assets/images/RmpPWD.png') 
                        : require('../../assets/images/ElevatorPW.png') 
                    }
                    style={styles.markerImage}
                    resizeMode="contain" 
                  />
                </View>
                
                <MaterialIcons 
                  name="arrow-drop-down" 
                  size={30} 
                  color={markerThemeColor} 
                  style={styles.markerPointer} 
                />

              </View>
            </Marker>
          );
        })}
      </MapView>

      <TouchableOpacity 
        style={styles.reportButton} 
        activeOpacity={0.8}
        onPress={handleReportAtCurrentLocation}
      >
        <MaterialIcons name="add-location-alt" size={24} color={BRAND.white} />
        <Text style={styles.reportButtonText}>Report Facility</Text>
      </TouchableOpacity>

      {/* MODAL 1: Reporting Form */}
      <Modal animationType="slide" transparent={true} visible={isModalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>NEW REPORT</Text>
            <Text style={styles.coordText}>
              Target: {draftLocation?.latitude.toFixed(5)}, {draftLocation?.longitude.toFixed(5)}
            </Text>

            {image && <Image source={{ uri: image }} style={styles.previewImage} />}

            <TouchableOpacity style={[styles.button, styles.buttonPhoto]} activeOpacity={0.7} onPress={pickImage}>
              <MaterialIcons name="photo-camera" size={20} color={BRAND.white} style={{marginRight: 8}} />
              <Text style={styles.buttonText}>{image ? "Change Photo" : "Attach Photo"}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {isUploading ? (
              <View style={{alignItems: 'center', marginVertical: 20}}>
                <ActivityIndicator size="large" color={BRAND.navy} />
                <Text style={{marginTop: 10, color: BRAND.gray, fontWeight: '600'}}>Saving to PWD Map...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={[styles.button, styles.buttonElevator]} activeOpacity={0.7} onPress={() => saveMarkerToDB('elevator')}>
                  <MaterialIcons name="elevator" size={20} color={BRAND.white} style={{marginRight: 8}} />
                  <Text style={styles.buttonText}>Save as Elevator</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.button, styles.buttonRamp]} activeOpacity={0.7} onPress={() => saveMarkerToDB('ramp')}>
                  <MaterialIcons name="accessible" size={20} color={BRAND.white} style={{marginRight: 8}} />
                  <Text style={styles.buttonText}>Save as Ramp</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[styles.button, styles.buttonCancel]} activeOpacity={0.7} onPress={closeModal} disabled={isUploading}>
              <Text style={[styles.buttonText, { color: BRAND.navy }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Viewing & Deleting Facility */}
      <Modal animationType="fade" transparent={true} visible={!!selectedFacility} onRequestClose={() => setSelectedFacility(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>
              {selectedFacility?.type?.toUpperCase()} DETAILS
            </Text>
            
            {selectedFacility?.image_url ? (
              <Image source={{ uri: selectedFacility.image_url }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.noPhotoContainer}>
                <MaterialIcons name="image-not-supported" size={40} color={BRAND.gray} />
                <Text style={styles.noPhotoText}>No photo provided</Text>
              </View>
            )}

            {currentUserId === selectedFacility?.user_id && (
              <TouchableOpacity style={[styles.button, styles.buttonDelete]} activeOpacity={0.7} onPress={deleteMarker}>
                <MaterialIcons name="delete-outline" size={20} color={BRAND.white} style={{marginRight: 8}} />
                <Text style={styles.buttonText}>Delete Marker</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.button, styles.buttonCancel]} activeOpacity={0.7} onPress={() => setSelectedFacility(null)}>
              <Text style={[styles.buttonText, { color: BRAND.navy }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  
// --- NEW MAP MARKER STYLES ---
  hugeBoundingBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 5,
    backgroundColor: 'rgba(255, 255, 255, 0)', 
  },
  iconBubble: {
    width: 30,
    height: 30,
    backgroundColor: BRAND.white,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 2, 
  },
  markerImage: {
    width: 25, 
    height: 25,
  },
  markerPointer: {
    marginTop: -16, 
    zIndex: 1,      
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // -----------------------------

  // Floating Action Button
  reportButton: {
    position: 'absolute', bottom: 110, right: 25,
    backgroundColor: BRAND.navy, 
    paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 30, flexDirection: 'row', alignItems: 'center',
    shadowColor: BRAND.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
    borderWidth: 2, borderColor: BRAND.green 
  },
  reportButtonText: { color: BRAND.white, fontWeight: '800', marginLeft: 8, fontSize: 16 },
  
  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(12, 53, 89, 0.4)', 
    justifyContent: 'center', alignItems: 'center'
  },
  modalView: { 
    width: '85%', backgroundColor: BRAND.white, 
    borderRadius: 24, padding: 25, alignItems: 'center', 
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: BRAND.mintBg
  },
  modalTitle: { 
    marginBottom: 5, textAlign: 'center', fontSize: 22, 
    fontWeight: '900', color: BRAND.navy, letterSpacing: 1 
  },
  coordText: { fontSize: 12, color: BRAND.gray, marginBottom: 20, fontWeight: '500' },
  
  // Buttons
  button: { 
    borderRadius: 14, padding: 15, 
    marginBottom: 12, width: '100%', 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2
  },
  buttonText: { color: BRAND.white, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  
  buttonPhoto: { backgroundColor: BRAND.lightBlue }, 
  buttonElevator: { backgroundColor: BRAND.green },
  buttonRamp: { backgroundColor: BRAND.navy },
  buttonDelete: { backgroundColor: BRAND.danger },
  buttonCancel: { backgroundColor: BRAND.mintBg, elevation: 0, borderWidth: 1, borderColor: '#D1E3DD' },
  
  // Images
  previewImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 20 },
  noPhotoContainer: { 
    width: '100%', height: 120, backgroundColor: BRAND.mintBg, 
    borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 
  },
  noPhotoText: { color: BRAND.gray, marginTop: 8, fontWeight: '600' },
  
  divider: { height: 2, backgroundColor: BRAND.mintBg, width: '100%', marginVertical: 15, borderRadius: 1 },
  
  // Errors
  errorOverlay: { 
    position: 'absolute', top: 50, backgroundColor: BRAND.danger, 
    padding: 12, borderRadius: 10, alignSelf: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5
  },
  errorText: { color: BRAND.white, fontWeight: 'bold' },
});