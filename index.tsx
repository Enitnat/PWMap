import { MaterialIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';

export default function TabOneScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [draftLocation, setDraftLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  
  // State for viewing existing markers securely
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  
  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [region, setRegion] = useState({
    latitude: 14.6760, 
    longitude: 121.0437,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    // 1. THE SECURITY FIX: Automated Anonymous Authentication
    const setupAutomatedAuth = async () => {
      // Check if the device already has an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Silently create a secure, temporary anonymous account
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("Anonymous Login Failed:", error.message);
        } else {
          console.log("Success! New Anonymous User ID:", data.user?.id);
        }
      } else {
        console.log("Welcome back! Existing User ID:", session.user.id);
      }
    };

    setupAutomatedAuth();
    fetchFacilities();

    // 2. FETCH LOCATION
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
  // Image uploader
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

  const saveMarkerToDB = async (dbType: string) => {
    if (!draftLocation) return;
    
    setIsUploading(true);

    // This automatically grabs the secure Anonymous ID we generated in useEffect
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

  const closeModal = () => {
    setModalVisible(false);
    setDraftLocation(null);
    setImage(null); 
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        initialRegion={region}
        showsUserLocation={true}
        onLongPress={handleMapLongPress}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            pinColor={marker.type === 'ramp' ? 'blue' : 'green'}
            onPress={() => setSelectedFacility(marker)}
          />
        ))}
      </MapView>

      <TouchableOpacity style={styles.reportButton} onPress={handleReportAtCurrentLocation}>
        <MaterialIcons name="add-location-alt" size={24} color="white" />
        <Text style={styles.reportButtonText}>Report Here</Text>
      </TouchableOpacity>

      {/* Reporting Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>What are you reporting?</Text>
          <Text style={styles.coordText}>
            Target: {draftLocation?.latitude.toFixed(5)}, {draftLocation?.longitude.toFixed(5)}
          </Text>

          {image && <Image source={{ uri: image }} style={styles.previewImage} />}

          <TouchableOpacity style={[styles.button, styles.buttonPhoto]} onPress={pickImage}>
            <MaterialIcons name="photo-camera" size={20} color="white" style={{marginRight: 8}} />
            <Text style={styles.buttonText}>{image ? "Change Photo" : "Attach Photo"}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {isUploading ? (
            <View style={{alignItems: 'center', marginVertical: 20}}>
              <ActivityIndicator size="large" color="#E91E63" />
              <Text style={{marginTop: 10, color: 'gray'}}>Saving to Cloud...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={() => saveMarkerToDB('elevator')}>
                <Text style={styles.buttonText}>Save as Working Elevator</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={() => saveMarkerToDB('ramp')}>
                <Text style={styles.buttonText}>Save as Accessible Ramp</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={closeModal} disabled={isUploading}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Viewing Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedFacility}
        onRequestClose={() => setSelectedFacility(null)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>{selectedFacility?.type?.toUpperCase()} DETAILS</Text>
          
          {selectedFacility?.image_url ? (
            <Image 
              source={{ uri: selectedFacility.image_url }} 
              style={{ width: 250, height: 200, borderRadius: 10, marginBottom: 15 }} 
              resizeMode="cover" 
            />
          ) : (
            <Text style={{ fontStyle: 'italic', color: 'gray', marginBottom: 15 }}>
              No photo provided for this facility.
            </Text>
          )}

          <TouchableOpacity 
            style={[styles.button, styles.buttonCancel]} 
            onPress={() => setSelectedFacility(null)}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {errorMsg && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  reportButton: {
    position: 'absolute', bottom: 30, right: 20,
    backgroundColor: '#E91E63', paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 30, flexDirection: 'row', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  reportButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 8 },
  coordText: { fontSize: 12, color: '#666', marginBottom: 15 },
  overlay: { position: 'absolute', bottom: 40, backgroundColor: 'white', padding: 10, borderRadius: 8, alignSelf: 'center' },
  errorText: { color: 'red' },
  
  modalView: { 
    margin: 20, marginTop: 'auto', marginBottom: 'auto', backgroundColor: 'white', 
    borderRadius: 20, padding: 25, alignItems: 'center', 
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 
  },
  modalTitle: { marginBottom: 10, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  
  button: { 
    borderRadius: 10, padding: 12, elevation: 2, 
    marginBottom: 10, width: '100%', 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center' 
  },
  buttonPhoto: { backgroundColor: '#FF9800' }, 
  buttonGreen: { backgroundColor: '#4CAF50' },
  buttonBlue: { backgroundColor: '#2196F3' },
  buttonCancel: { backgroundColor: '#9E9E9E', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    width: '100%',
    marginVertical: 15,
  }
});