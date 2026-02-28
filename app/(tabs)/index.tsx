import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase'; // Import our new client!

export default function TabOneScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [markers, setMarkers] = useState<any[]>([]);

  const [draftLocation, setDraftLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);

  const [region, setRegion] = useState({
    latitude: 14.6760, 
    longitude: 121.0437,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
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

  const fetchFacilities = async () => {
    console.log("1. Attempting to fetch facilities from Supabase...");
    
    try {
      const { data, error } = await supabase.from('facilities').select('*');
      
      if (error) {
        console.error("2. Supabase Fetch Error Details:", JSON.stringify(error, null, 2));
      } else if (data) {
        console.log("2. Success! Fetched facilities:", data.length);
        setMarkers(data);
      }
    } catch (err) {
      console.error("2. Hard Network Crash:", err);
    }
  };
  const handleMapLongPress = (event: any) => {
    setDraftLocation(event.nativeEvent.coordinate);
    setModalVisible(true);
  };

  const saveMarkerToDB = async (dbType: string) => {
    if (draftLocation) {
      const { data, error } = await supabase
        .from('facilities')
        .insert([
          { 
            type: dbType, 
            latitude: draftLocation.latitude, 
            longitude: draftLocation.longitude 
          }
        ])
        .select();

      if (error) {
        Alert.alert("Error", "Could not save marker.");
        console.error(error);
      } else {
        // If successful, fetch the updated list from the database
        fetchFacilities();
      }
    }
    setModalVisible(false);
    setDraftLocation(null);
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        initialRegion={region}
        showsUserLocation={true}
        onLongPress={handleMapLongPress}
      >
        {/* Render markers from Supabase */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.type.toUpperCase()}
            // Ramps are blue, Elevators are green
            pinColor={marker.type === 'ramp' ? 'blue' : 'green'} 
          />
        ))}
      </MapView>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>What are you reporting?</Text>
          
          <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={() => saveMarkerToDB('elevator')}>
            <Text style={styles.buttonText}>Working Elevator</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={() => saveMarkerToDB('ramp')}>
            <Text style={styles.buttonText}>Accessible Ramp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={() => setModalVisible(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
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
  overlay: { position: 'absolute', bottom: 40, backgroundColor: 'white', padding: 10, borderRadius: 8, alignSelf: 'center' },
  errorText: { color: 'red' },
  modalView: { margin: 20, marginTop: 'auto', backgroundColor: 'white', borderRadius: 20, padding: 35, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { marginBottom: 15, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  button: { borderRadius: 10, padding: 10, elevation: 2, marginBottom: 10, width: '100%', alignItems: 'center' },
  buttonGreen: { backgroundColor: '#4CAF50' },
  buttonBlue: { backgroundColor: '#2196F3' },
  buttonCancel: { backgroundColor: '#9E9E9E', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold' },
});
