import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function TabOneScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [markers, setMarkers] = useState([
    { id: '1', lat: 14.6760, lng: 121.0437, title: "Elevator", type: "working_elevator" },
    { id: '2', lat: 14.6507, lng: 121.0315, title: "Broken Ramp", type: "broken_ramp" }
  ]);

  const [draftLocation, setDraftLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);

  const [region, setRegion] = useState({
    latitude: 14.6760, 
    longitude: 121.0437,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        // We wrap this in a try/catch so the app doesn't crash if GPS is off
        let userLocation = await Location.getCurrentPositionAsync({});
        setLocation(userLocation);
      } catch (error) {
        // If it fails (e.g., location services are disabled), we catch the error here
        console.log("Could not fetch location:", error);
        setErrorMsg("Location unavailable. Using default map center.");
      }
    })();
  }, []);

  const handleMapLongPress = (event: any) => {
    setDraftLocation(event.nativeEvent.coordinate);
    setModalVisible(true);
  };

  const addMarker = (type: string, title: string) => {
    if (draftLocation) {
      const newMarker = {
        id: Math.random().toString(),
        lat: draftLocation.latitude,
        lng: draftLocation.longitude,
        title: title,
        type: type
      };
      setMarkers([...markers, newMarker]);
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
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.title}
            pinColor={marker.type.includes('broken') ? 'red' : 'green'}
          />
        ))}
      </MapView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>What are you reporting?</Text>
          
          <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={() => addMarker('working_elevator', 'Working Elevator')}>
            <Text style={styles.buttonText}>Working Elevator</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={() => addMarker('working_ramp', 'Accessible Ramp')}>
            <Text style={styles.buttonText}>Accessible Ramp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.buttonRed]} onPress={() => addMarker('broken_facility', 'Broken Facility')}>
            <Text style={styles.buttonText}>Broken Facility</Text>
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
  modalView: {
    margin: 20,
    marginTop: 'auto',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: { marginBottom: 15, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  button: { borderRadius: 10, padding: 10, elevation: 2, marginBottom: 10, width: '100%', alignItems: 'center' },
  buttonGreen: { backgroundColor: '#4CAF50' },
  buttonRed: { backgroundColor: '#F44336' },
  buttonCancel: { backgroundColor: '#9E9E9E', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold' },
});
