import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, Region, UrlTile } from 'react-native-maps';;
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech'; // <-- ADDED: Speech Library
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native'; 
import { supabase } from '../../lib/supabase';

// --- CONSTANTS ---
const BRAND = {
  navy: '#0C3559',      
  lightBlue: '#71A8D7', 
  green: '#2CA959',     
  mintBg: '#F0F7F4',    
  white: '#FFFFFF',
  danger: '#E74C3C',   
  gray: '#95A5A6',
};

const INITIAL_REGION: Region = {
  latitude: 14.6760, 
  longitude: 121.0437,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in meters
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
};

export default function TabOneScreen() {
  // --- REFS ---
  const mapRef = useRef<MapView>(null);
  const announcedMarkers = useRef<Set<number>>(new Set()); // <-- ADDED: Tracks announced facilities

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Auth State
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Reporting Form State (Modal 1)
  const [isModalVisible, setModalVisible] = useState(false);
  const [draftLocation, setDraftLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // View Facility State (Modal 2)
  const [selectedFacility, setSelectedFacility] = useState<any>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    initializeMapAndAuth();
  }, []);

  const initializeMapAndAuth = async () => {
    // 1. Setup Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) console.error("Anonymous Login Failed:", error.message);
      else setCurrentUserId(data.user?.id || null);
    } else {
      setCurrentUserId(session.user.id);
    }

    // 2. Fetch Markers
    fetchFacilities();

    // 3. Request LIVE Location
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      
      // <-- CHANGED: Upgraded to watchPositionAsync for live tracking
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5, // Update state every 5 meters moved
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    } catch (error) {
      console.log("Could not fetch location:", error);
    }
  };

  // --- THE DETECTION ENGINE ---
  // This automatically runs every time the user's location or the markers update
  useEffect(() => {
    if (!location || markers.length === 0) return;

    markers.forEach((marker) => {
      const distance = getDistanceInMeters(
        location.coords.latitude,
        location.coords.longitude,
        marker.latitude,
        marker.longitude
      );

      // If within 15 meters AND we haven't already announced this specific marker
      if (distance <= 15 && !announcedMarkers.current.has(marker.id)) {
        announcedMarkers.current.add(marker.id);

        let phrase = `There is a ${marker.type} approximately ${Math.round(distance)} meters away.`;
        if (marker.description) {
          phrase += ` Notes: ${marker.description}`;
        }

        Speech.speak(phrase, {
          rate: 0.9, // Slightly slower for readability
          pitch: 1.0,
        });
      }
    });
  }, [location, markers]);

  // --- API / DATABASE ACTIONS ---
  const fetchFacilities = async () => {
    try {
      const { data, error } = await supabase.from('facilities').select('*');
      if (error) console.error("Supabase Fetch Error:", error);
      else if (data) setMarkers(data);
    } catch (err) {
      console.error("Network Crash:", err);
    }
  };

  const saveMarkerToDB = async (dbType: string) => {
    if (!draftLocation) return;
    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Authentication Error", "Could not verify your session.");
      setIsUploading(false);
      return;
    }

    let publicImageUrl = null;
    if (image) {
      try {
        const base64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
        const filePath = `${Date.now()}_facility.jpg`; 
        
        const { error: uploadError } = await supabase.storage
          .from('facility_images')
          .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

        if (uploadError) {
          Alert.alert("Upload Failed", "Could not upload photo to the cloud.");
        } else {
          const { data: publicUrlData } = supabase.storage.from('facility_images').getPublicUrl(filePath);
          publicImageUrl = publicUrlData.publicUrl;
        }
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    const { error } = await supabase.from('facilities').insert([{ 
      type: dbType, 
      latitude: draftLocation.latitude, 
      longitude: draftLocation.longitude,
      image_url: publicImageUrl,
      description: description.trim() === '' ? null : description.trim(),
      user_id: user.id 
    }]);

    setIsUploading(false);

    if (error) {
      Alert.alert("Error", "Could not save marker. " + error.message);
    } else {
      fetchFacilities();
      closeModal();
    }
  };

  const deleteMarker = async () => {
    if (!selectedFacility) return;

    Alert.alert("Delete Marker", "Are you sure you want to remove this facility?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          const { error } = await supabase.from('facilities').delete().eq('id', selectedFacility.id);
          if (error) {
            Alert.alert("Error", "Could not delete marker. " + error.message);
          } else {
            Alert.alert("Deleted", "The marker has been removed.");
            setSelectedFacility(null); 
            fetchFacilities(); 
          }
        }
      }
    ]);
  };

  // --- MAP INTERACTIONS ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const geocodedLocation = await Location.geocodeAsync(searchQuery);
      if (geocodedLocation.length > 0) {
        const { latitude, longitude } = geocodedLocation[0];
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      } else {
        Alert.alert("Not Found", "Could not find coordinates for that location.");
      }
    } catch (error) {
      Alert.alert("Search Error", "Unable to search right now. Please check your connection.");
    }
  };

  const handleReportAtCurrentLocation = () => {
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

  // --- UI HELPERS ---
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

    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const confirmSaveMarker = (dbType: string) => {
    const facilityName = dbType === 'ramp' ? 'Ramp' : 'Elevator';
    Alert.alert("Confirm Report", `Save this location as a ${facilityName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Save", style: "default", onPress: () => saveMarkerToDB(dbType) }
    ]);
  };

  const closeModal = () => {
    setModalVisible(false);
    setDraftLocation(null);
    setImage(null); 
    setDescription(''); 
  };

  // --- RENDER ---
  return (
    <View style={styles.container}>
      <MapView 
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation={true}
        onLongPress={handleMapLongPress}
      >
        {markers.map((marker) => {
          const isRamp = marker.type === 'ramp';
          const markerThemeColor = isRamp ? '#007BFF' : BRAND.green; 

          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              onPress={() => setSelectedFacility(marker)}
              anchor={{ x: 0.5, y: 0.9 }} 
            >
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
                <MaterialIcons name="arrow-drop-down" size={30} color={markerThemeColor} style={styles.markerPointer} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* 2. SEARCH BAR */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={BRAND.gray} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place..."
          placeholderTextColor={BRAND.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={BRAND.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. FLOATING ACTION BUTTON */}
      <TouchableOpacity style={styles.reportButton} activeOpacity={0.8} onPress={handleReportAtCurrentLocation}>
        <MaterialIcons name="add-location-alt" size={24} color={BRAND.white} />
        <Text style={styles.reportButtonText}>Report Facility</Text>
      </TouchableOpacity>

      {/* 4. MODAL: ADD REPORT */}
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

            <TextInput
              style={styles.descriptionInput}
              placeholder="Optional description (e.g., 'Behind the main stairs')"
              placeholderTextColor={BRAND.gray}
              value={description}
              onChangeText={setDescription}
              multiline={true}
              numberOfLines={3}
              maxLength={150}
            />

            <View style={styles.divider} />

            {isUploading ? (
              <View style={{alignItems: 'center', marginVertical: 20}}>
                <ActivityIndicator size="large" color={BRAND.navy} />
                <Text style={{marginTop: 10, color: BRAND.gray, fontWeight: '600'}}>Saving to PWD Map...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={[styles.button, styles.buttonElevator]} activeOpacity={0.7} onPress={() => confirmSaveMarker('elevator')}>
                  <MaterialIcons name="elevator" size={20} color={BRAND.white} style={{marginRight: 8}} />
                  <Text style={styles.buttonText}>Save as Elevator</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.button, styles.buttonRamp]} activeOpacity={0.7} onPress={() => confirmSaveMarker('ramp')}>
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

      {/* 5. MODAL: VIEW FACILITY */}
      <Modal animationType="fade" transparent={true} visible={!!selectedFacility} onRequestClose={() => setSelectedFacility(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{selectedFacility?.type?.toUpperCase()} DETAILS</Text>
            
            {selectedFacility?.image_url ? (
              <Image source={{ uri: selectedFacility.image_url }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.noPhotoContainer}>
                <MaterialIcons name="image-not-supported" size={40} color={BRAND.gray} />
                <Text style={styles.noPhotoText}>No photo provided</Text>
              </View>
            )}

            {selectedFacility?.description && (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionLabel}>Notes:</Text>
                <Text style={styles.descriptionText}>{selectedFacility.description}</Text>
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

      {/* 6. ERROR OVERLAY */}
      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  
  // Search Bar
  searchContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: BRAND.white,
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2EBE8',
  },
  searchInput: { flex: 1, fontSize: 16, color: BRAND.navy, fontWeight: '600' },

  // Markers
  hugeBoundingBox: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 5, backgroundColor: 'rgba(255, 255, 255, 0)', 
  },
  iconBubble: {
    width: 30, height: 30, backgroundColor: BRAND.white, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, zIndex: 2, 
  },
  markerImage: { width: 25, height: 25 },
  markerPointer: {
    marginTop: -16, zIndex: 1, textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  
  // Floating Action Button
  reportButton: {
    position: 'absolute', bottom: 110, right: 25,
    backgroundColor: BRAND.navy, paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 30, flexDirection: 'row', alignItems: 'center',
    shadowColor: BRAND.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
    borderWidth: 2, borderColor: BRAND.green 
  },
  reportButtonText: { color: BRAND.white, fontWeight: '800', marginLeft: 8, fontSize: 16 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 53, 89, 0.4)', justifyContent: 'center', alignItems: 'center' },
  modalView: { 
    width: '85%', backgroundColor: BRAND.white, borderRadius: 24, padding: 25, alignItems: 'center', 
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, 
    elevation: 10, borderWidth: 1, borderColor: BRAND.mintBg
  },
  modalTitle: { marginBottom: 5, textAlign: 'center', fontSize: 22, fontWeight: '900', color: BRAND.navy, letterSpacing: 1 },
  coordText: { fontSize: 12, color: BRAND.gray, marginBottom: 10, fontWeight: '500' },
  
  // Inputs & Descriptions
  descriptionInput: {
    width: '100%', backgroundColor: BRAND.mintBg, borderColor: '#D1E3DD', borderWidth: 1,
    borderRadius: 12, padding: 12, marginTop: 10, minHeight: 60, textAlignVertical: 'top', color: BRAND.navy,
  },
  descriptionBox: {
    width: '100%', backgroundColor: BRAND.mintBg, padding: 12, borderRadius: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#D1E3DD',
  },
  descriptionLabel: { fontSize: 12, fontWeight: 'bold', color: BRAND.gray, marginBottom: 4 },
  descriptionText: { fontSize: 14, color: BRAND.navy, lineHeight: 20 },

  // Buttons
  button: { 
    borderRadius: 14, padding: 15, marginBottom: 12, width: '100%', 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2
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
    width: '100%', height: 120, backgroundColor: BRAND.mintBg, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 20 
  },
  noPhotoText: { color: BRAND.gray, marginTop: 8, fontWeight: '600' },
  
  // Misc
  divider: { height: 2, backgroundColor: BRAND.mintBg, width: '100%', marginVertical: 15, borderRadius: 1 },
  errorOverlay: { 
    position: 'absolute', top: 120, backgroundColor: BRAND.danger, padding: 12, 
    borderRadius: 10, alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.2, 
    shadowRadius: 4, elevation: 5
  },
  errorText: { color: BRAND.white, fontWeight: 'bold' },
});
