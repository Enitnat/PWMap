// /PWMap/app/(tabs)/index.tsx

// /PWMap/app/(tabs)/index.tsx

import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View, TextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import RNMapView, { Marker, Region, Geojson, Polyline } from 'react-native-maps';
import MapView from 'react-native-map-clustering';
import { supabase } from '../../lib/supabase';
import { CustomModal } from '@/components/ui/custom-modal';
import { CustomAlert } from '@/components/ui/custom-alert';
import { BRAND } from '@/constants/theme';

import lrt2Data from '../../assets/data/lrt2.json';
import busStopsData from '../../assets/data/busstops.json';

import route1Data from '../../assets/data/QCity_Route1.json';
import route2Data from '../../assets/data/QCity_Route2.json';
import route3Data from '../../assets/data/QCity_Route3.json';
import route4Data from '../../assets/data/QCity_Route4.json';
import route5Data from '../../assets/data/QCity_Route5.json';
import route6Data from '../../assets/data/QCity_Route6.json';
import route7Data from '../../assets/data/QCity_Route7.json';
import route8Data from '../../assets/data/QCity_Route8.json';

const BUS_ROUTES: Record<number, any> = {
  1: {
    name: 'QC Hall - Cubao',
    data: {
      ...route1Data,
      features: (route1Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route1Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#E63946'
  },
  2: {
    name: 'QC Hall - Litex',
    data: {
      ...route2Data,
      features: (route2Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route2Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#D81B60'
  },
  3: {
    name: 'Welcome - Aurora',
    data: {
      ...route3Data,
      features: (route3Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route3Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#FFCA28'
  },
  4: {
    name: 'QC Hall - Gen Luis',
    data: {
      ...route4Data,
      features: (route4Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route4Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#8E44AD'
  },
  5: {
    name: 'QC Hall - Mindanao',
    data: {
      ...route5Data,
      features: (route5Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route5Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#F39C12'
  },
  6: {
    name: 'QC Hall - Gilmore',
    data: {
      ...route6Data,
      features: (route6Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route6Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#27AE60'
  },
  7: {
    name: 'QC Hall - Ortigas',
    data: {
      ...route7Data,
      features: (route7Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route7Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#2980B9'
  },
  8: {
    name: 'QC Hall - Muñoz',
    data: {
      ...route8Data,
      features: (route8Data as any).features.filter((f: any) => f.geometry.type !== 'Point')
    },
    stops: (route8Data as any).features.filter((f: any) => f.geometry.type === 'Point'),
    color: '#00BCD4'
  },
};

const lrt2TracksOnly = {
  ...(lrt2Data as any),
  features: (lrt2Data as any).features.filter(
    (feature: any) => feature.geometry.type !== 'Point'
  )
};



const INITIAL_REGION: Region = {
  latitude: 14.6760,
  longitude: 121.0437,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const getEstimatedWaitTime = (intervalMinutes: number, offsetMinutes: number) => {
  const currentMinute = new Date().getMinutes();
  const cyclePosition = currentMinute % intervalMinutes;
  if (cyclePosition <= offsetMinutes) return offsetMinutes - cyclePosition;
  return intervalMinutes - (cyclePosition - offsetMinutes);
};

const getCurrentBusInterval = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const mins = now.getMinutes();
  const timeFloat = hour + (mins / 60);

  if (day === 0) {
    if (timeFloat >= 8 && timeFloat <= 20) return 60;
    return null;
  } else if (day === 6) {
    if (timeFloat >= 6.5 && timeFloat <= 20.5) return 30;
    return null;
  } else {
    if (timeFloat >= 6 && timeFloat < 11.5) return 10;
    if (timeFloat >= 11.5 && timeFloat < 16) return 30;
    if (timeFloat >= 16 && timeFloat < 20) return 10;
    if (timeFloat >= 20 && timeFloat <= 21) return 30;
    return null;
  }
};

const LRT2_Stations = [
  { id: 'lrt_ant', name: 'Antipolo Station', latitude: 14.6251, longitude: 121.1213, offsetMins: 0 },
  { id: 'lrt_mar', name: 'Marikina-Pasig Station', latitude: 14.6200, longitude: 121.1000, offsetMins: 4 },
  { id: 'lrt_san', name: 'Santolan Station', latitude: 14.6220, longitude: 121.0860, offsetMins: 8 },
  { id: 'lrt_kat', name: 'Katipunan Station', latitude: 14.6315, longitude: 121.0733, offsetMins: 12 },
  { id: 'lrt_ano', name: 'Anonas Station', latitude: 14.6280, longitude: 121.0645, offsetMins: 14 },
  { id: 'lrt_cub', name: 'Araneta Center-Cubao', latitude: 14.6225, longitude: 121.0536, offsetMins: 16 },
  { id: 'lrt_bet', name: 'Betty Go-Belmonte', latitude: 14.6185, longitude: 121.0425, offsetMins: 18 },
  { id: 'lrt_gil', name: 'Gilmore Station', latitude: 14.6135, longitude: 121.0340, offsetMins: 20 },
  { id: 'lrt_jruiz', name: 'J. Ruiz Station', latitude: 14.6105, longitude: 121.0265, offsetMins: 22 },
  { id: 'lrt_vmapa', name: 'V. Mapa Station', latitude: 14.6041, longitude: 121.0170, offsetMins: 25 },
  { id: 'lrt_pur', name: 'Pureza Station', latitude: 14.6015, longitude: 121.0055, offsetMins: 28 },
  { id: 'lrt_leg', name: 'Legarda Station', latitude: 14.6010, longitude: 120.9925, offsetMins: 30 },
  { id: 'lrt_rec', name: 'Recto Station', latitude: 14.6036, longitude: 120.9838, offsetMins: 33 },
];

const QCity_Route1 = [
  { id: 'qc1_1', name: 'QC Hall Gate 3 Kalayaan Ave.', latitude: 14.6465, longitude: 121.0498, offsetMins: 0 },
  { id: 'qc1_2', name: 'Kalayaan Ave. Cor. Masigla St.', latitude: 14.6410, longitude: 121.0515, offsetMins: 4 },
  { id: 'qc1_3', name: 'Kalayaan Ave. Cor. Kamias Rd.', latitude: 14.6360, longitude: 121.0530, offsetMins: 8 },
  { id: 'qc1_4', name: 'Barangay Silangan Hall', latitude: 14.6285, longitude: 121.0550, offsetMins: 14 },
  { id: 'qc1_5', name: '15th Ave. Cor. Aurora Blvd.', latitude: 14.6215, longitude: 121.0610, offsetMins: 20 },
  { id: 'qc1_6', name: 'Cubao (Araneta City)', latitude: 14.6212, longitude: 121.0565, offsetMins: 25 },
];

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
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
  const mapRef = useRef<RNMapView>(null);
  const router = useRouter();
  const announcedMarkers = useRef<Set<number>>(new Set());

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTransit, setShowTransit] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isModalVisible, setModalVisible] = useState(false);
  const [draftLocation, setDraftLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const [selectedFacility, setSelectedFacility] = useState<any>(null);

  // Search recommendation states
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<any>(null);
  const regionTimerRef = useRef<any>(null);
  const [searchMarker, setSearchMarker] = useState<{ latitude: number, longitude: number, label: string } | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);

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


  useEffect(() => {
    initializeMapAndAuth();
    const splashTimer = setTimeout(() => {
      setIsSplashActive(false);
    }, 2500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [markers, showTransit, activeRouteId, searchMarker]);

  const handleRegionChangeComplete = () => {
    if (regionTimerRef.current) {
      clearTimeout(regionTimerRef.current);
    }
    setTracksViewChanges(true);
    regionTimerRef.current = setTimeout(() => {
      setTracksViewChanges(false);
    }, 1500);
  };

  const handleSearchQueryChange = (text: string) => {
    setSearchQuery(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length >= 1) {
      debounceTimerRef.current = setTimeout(() => {
        fetchRecommendations(text);
      }, 300); // Fast 300ms response
    } else {
      setRecommendations([]);
    }
  };

  const fetchRecommendations = async (query: string) => {
    if (!query.trim()) {
      setRecommendations([]);
      return;
    }

    setIsSearching(true);
    try {
      // Prioritize results near the user's current position or map center
      const biasLat = location?.coords?.latitude || INITIAL_REGION.latitude;
      const biasLon = location?.coords?.longitude || INITIAL_REGION.longitude;

      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${biasLat}&lon=${biasLon}&limit=5`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.features) {
        const resolved = data.features.map((feature: any) => {
          const p = feature.properties;
          const coords = feature.geometry.coordinates; // [longitude, latitude]

          // Construct a nice address string
          const parts = [
            p.name,
            p.street,
            p.city || p.town || p.district,
            p.state || p.county,
            p.country
          ].filter(Boolean);

          // Remove duplicates in label text
          const uniqueParts: string[] = [];
          parts.forEach(part => {
            if (!uniqueParts.includes(part)) {
              uniqueParts.push(part);
            }
          });

          return {
            label: uniqueParts.join(', '),
            latitude: coords[1], // Latitude is second element in GeoJSON
            longitude: coords[0], // Longitude is first element in GeoJSON
          };
        });

        // Filter duplicates by label
        const uniqueResolved = resolved.filter(
          (value: any, index: number, self: any[]) =>
            self.findIndex((t) => t.label === value.label) === index
        );

        setRecommendations(uniqueResolved);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.log("Error fetching autocomplete recommendations:", error);
      setRecommendations([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectRecommendation = (item: any) => {
    setSearchQuery(item.label);
    setRecommendations([]);
    setSearchMarker({
      latitude: item.latitude,
      longitude: item.longitude,
      label: item.label,
    });
    mapRef.current?.animateToRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  };

  useFocusEffect(
    useCallback(() => {
      fetchFacilities();
    }, [])
  );

  const initializeMapAndAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) console.error("Anonymous Login Failed:", error.message);
      else setCurrentUserId(data.user?.id || null);
    } else {
      setCurrentUserId(session.user.id);
    }

    fetchFacilities();

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    } catch (error) {
      console.log("Could not fetch location:", error);
    }
  };

  useEffect(() => {
    if (!location || markers.length === 0) return;

    markers.forEach((marker) => {
      const distance = getDistanceInMeters(
        location.coords.latitude,
        location.coords.longitude,
        marker.latitude,
        marker.longitude
      );

      if (distance <= 15 && !announcedMarkers.current.has(marker.id)) {
        announcedMarkers.current.add(marker.id);
        let phrase = `There is a ${marker.type} approximately ${Math.round(distance)} meters away.`;
        if (marker.description) phrase += ` Notes: ${marker.description}`;

        Speech.speak(phrase, { rate: 0.9, pitch: 1.0 });
      }
    });
  }, [location, markers]);

  const fetchFacilities = async () => {
    try {
      const { data, error } = await supabase.from('locations').select('*');
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
      showAlert("Authentication Error", "Could not verify your session.");
      setIsUploading(false);
      return;
    }

    let targetCityId = null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('city_id')
      .eq('id', user.id)
      .single();

    if (profile?.city_id) {
      targetCityId = profile.city_id;
    } else {
      const { data: qcData } = await supabase
        .from('cities')
        .select('id')
        .eq('name', 'Quezon City')
        .single();
      targetCityId = qcData?.id;
    }

    if (!targetCityId) {
      showAlert("Error", "Could not determine your city for this report.");
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

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('facility_images').getPublicUrl(filePath);
          publicImageUrl = publicUrlData.publicUrl;
        } else {
          console.error("Storage upload error:", uploadError);
        }
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    const { error } = await supabase.from('location_reports').insert([{
      city_id: targetCityId,
      submitted_by: user.id,
      type: dbType,
      latitude: draftLocation.latitude,
      longitude: draftLocation.longitude,
      image_url: publicImageUrl,
      description: description.trim() === '' ? null : description.trim(),
      status: 'pending'
    }]);

    setIsUploading(false);

    if (error) {
      showAlert("Error", "Could not submit report. " + error.message);
    } else {
      showAlert(
        "Report Submitted!",
        "Thank you! Your facility report has been sent to the community admins for review. It will appear on the map once verified."
      );
      closeModal();
    }
  };

  const deleteMarker = async () => {
    if (!selectedFacility) return;

    showAlert("Delete Marker", "Are you sure you want to remove this facility?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from('locations').delete().eq('id', selectedFacility.id);
          if (error) showAlert("Error", "Could not delete marker. " + error.message);
          else {
            showAlert("Deleted", "The marker has been removed.");
            setSelectedFacility(null);
            fetchFacilities();
          }
        }
      }
    ]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setRecommendations([]);
    try {
      const geocodedLocation = await Location.geocodeAsync(searchQuery);
      if (geocodedLocation.length > 0) {
        const { latitude, longitude } = geocodedLocation[0];
        setSearchMarker({
          latitude,
          longitude,
          label: searchQuery,
        });
        mapRef.current?.animateToRegion({
          latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01,
        }, 1000);
      } else showAlert("Not Found", "Could not find coordinates for that location.");
    } catch (error) {
      showAlert("Search Error", "Unable to search right now. Please check your connection.");
    }
  };

  const handleReportAtCurrentLocation = async () => {
    if (!location) {
      showAlert("Location not ready", "Still getting your GPS coordinates...");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      setIsAuthModalVisible(true);
      return;
    }
    setDraftLocation({
      latitude: location.coords.latitude, longitude: location.coords.longitude,
    });
    setModalVisible(true);
  };

  const handleMapLongPress = async (event: any) => {
    // Extract coordinate synchronously before any asynchronous calls.
    // React Native pools event objects, meaning event.nativeEvent will be nullified
    // while the async Supabase getUser check is waiting.
    const coordinate = event.nativeEvent?.coordinate;
    if (!coordinate) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      setIsAuthModalVisible(true);
      return;
    }
    setDraftLocation(coordinate);
    setModalVisible(true);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert('Permission required', 'We need access to your gallery to upload photos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [4, 3], quality: 0.5,
    });

    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const confirmSaveMarker = (dbType: string) => {
    const facilityName = dbType === 'ramp' ? 'Ramp' : 'Elevator';
    showAlert("Confirm Report", `Save this location as a ${facilityName}?`, [
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

  const recenterToUserLocation = () => {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      showAlert("Location not ready", "Still getting your GPS coordinates...");
    }
  };

  const resetMapRotation = () => {
    mapRef.current?.animateCamera({
      heading: 0,
    }, { duration: 1000 });
  };

  if (isSplashActive) {
    return (
      <LinearGradient colors={['#0C3559', '#71A8D7']} style={styles.splashContainer}>
        <View style={styles.splashLogoContainer}>
          <Image
            source={require('../../assets/images/pwd-logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="large" color={BRAND.white} style={styles.splashLoader} />
        <Text style={styles.splashSubtext}>Accessibility Mapping for PWDs</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        onLongPress={handleMapLongPress}
        clusterColor={BRAND.navy}
        clusterTextColor={BRAND.white}
        animationEnabled={false}
        radius={40}
        maxZoom={15}
        minPoints={3}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {/* LAYERS FIRST: Routes Geojson */}
        {showTransit && (
          <Geojson geojson={lrt2TracksOnly} strokeColor="#800080" strokeWidth={5} />
        )}
        
        {showTransit && activeRouteId && (
          <Geojson
            geojson={BUS_ROUTES[activeRouteId].data}
            strokeColor={BUS_ROUTES[activeRouteId].color}
            strokeWidth={5}
          />
        )}

        {/* LRT2 STATION MARKERS (Direct children for clustering) */}
        {showTransit && LRT2_Stations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{ latitude: station.latitude, longitude: station.longitude }}
            title={station.name}
            description={`Next train arriving in: ${getEstimatedWaitTime(7, station.offsetMins)} mins`}
            anchor={{ x: 0.5, y: 1.0 }}
            tracksViewChanges={tracksViewChanges}
          >
            <View style={styles.stationMarkerContainer}>
              <View style={[styles.stationMarkerBubble, { backgroundColor: '#800080', borderColor: BRAND.white }]}>
                <MaterialIcons name="train" size={16} color={BRAND.white} />
              </View>
              <View style={[styles.trianglePointer, styles.trianglePointerSmall, { borderTopColor: '#800080' }]} />
            </View>
          </Marker>
        ))}

        {/* BUS STOP MARKERS (Direct children for clustering - extracted dynamically from route GeoJSON) */}
        {showTransit && activeRouteId && 
          BUS_ROUTES[activeRouteId].stops.map((stopFeature: any, index: number) => {
            const stopName = stopFeature.properties?.label || `Stop ${index + 1}`;
            const cleanStopName = stopName.split(',')[0].trim();
            const coords = stopFeature.geometry.coordinates; // [longitude, latitude]
            const routeColor = BUS_ROUTES[activeRouteId].color;

            const currentInterval = getCurrentBusInterval();
            const offsetMins = index * 4;
            const etaText = currentInterval
              ? `Next bus arriving in: ${getEstimatedWaitTime(currentInterval, offsetMins)} mins`
              : "Buses are currently offline.";

            return (
              <Marker
                key={`${activeRouteId}_stop_${index}`}
                coordinate={{ latitude: coords[1], longitude: coords[0] }}
                title={cleanStopName}
                description={etaText}
                anchor={{ x: 0.5, y: 1.0 }}
                tracksViewChanges={tracksViewChanges}
              >
                <View style={styles.busMarkerContainer}>
                  <View style={[styles.busMarkerBubble, { backgroundColor: routeColor, borderColor: BRAND.white }]}>
                    <MaterialIcons name="directions-bus" size={16} color={BRAND.white} />
                  </View>
                  <View style={[styles.trianglePointer, styles.trianglePointerSmall, { borderTopColor: routeColor }]} />
                </View>
              </Marker>
            );
          })
        }

        {/* FACILITY MARKERS */}
        {markers.map((marker) => {
          const isRamp = marker.type === 'ramp';
          const markerThemeColor = isRamp ? '#007BFF' : BRAND.green;

          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              onPress={() => setSelectedFacility(marker)}
              anchor={{ x: 0.5, y: 1.0 }}
              tracksViewChanges={tracksViewChanges}
            >
              <View style={styles.hugeBoundingBox}>
                <View style={[styles.iconBubble, { backgroundColor: markerThemeColor, borderColor: BRAND.white }]}>
                  <MaterialIcons
                    name={isRamp ? "accessible" : "elevator"}
                    size={18}
                    color={BRAND.white}
                  />
                </View>
                <View style={[styles.trianglePointer, { borderTopColor: markerThemeColor }]} />
              </View>
            </Marker>
          );
        })}

        {/* SEARCH MARKER */}
        {searchMarker && (
          <Marker
            coordinate={{ latitude: searchMarker.latitude, longitude: searchMarker.longitude }}
            title={searchMarker.label}
            anchor={{ x: 0.5, y: 1.0 }}
            tracksViewChanges={tracksViewChanges}
          >
            <View style={styles.searchMarkerContainer}>
              <View style={[styles.searchMarkerBubble, { backgroundColor: BRAND.danger, borderColor: BRAND.white }]}>
                <Ionicons name="location" size={18} color={BRAND.white} />
              </View>
              <View style={[styles.trianglePointer, { borderTopColor: BRAND.danger }]} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.searchContainer}>
        {isSearching ? (
          <ActivityIndicator size="small" color={BRAND.navy} style={styles.searchingIndicator} />
        ) : (
          <Ionicons name="search" size={20} color={BRAND.gray} style={{ marginRight: 8 }} />
        )}
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place..."
          placeholderTextColor={BRAND.gray}
          value={searchQuery}
          onChangeText={handleSearchQueryChange}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            setRecommendations([]);
            setSearchMarker(null);
          }}>
            <Ionicons name="close-circle" size={20} color={BRAND.gray} />
          </TouchableOpacity>
        )}
      </View>

      {recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {recommendations.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.recommendationItem,
                  index === recommendations.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => handleSelectRecommendation(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-sharp" size={18} color={BRAND.lightBlue} style={styles.recommendationIcon} />
                <Text style={styles.recommendationText} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showTransit && (
        <View style={{ position: 'absolute', bottom: 100, left: 0, right: 0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => {
              const isActive = activeRouteId === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setActiveRouteId(isActive ? null : id)} // Toggle on/off
                  style={{
                    backgroundColor: isActive ? BUS_ROUTES[id].color : BRAND.white,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    marginRight: 10,
                    borderWidth: 2,
                    borderColor: BUS_ROUTES[id].color,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Text style={{
                    color: isActive ? BRAND.white : BUS_ROUTES[id].color,
                    fontWeight: 'bold'
                  }}>
                    Route {id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <TouchableOpacity
        style={[styles.reportButton, { bottom: showTransit ? 170 : 100, backgroundColor: showTransit ? BRAND.danger : BRAND.white }]}
        activeOpacity={0.8}
        onPress={() => setShowTransit(!showTransit)}
      >
        <MaterialIcons name="directions-transit" size={24} color={showTransit ? BRAND.white : BRAND.navy} />
        <Text style={[styles.reportButtonText, { color: showTransit ? BRAND.white : BRAND.navy }]}>
          {showTransit ? "Hide Transit" : "Show Transit"}
        </Text>
      </TouchableOpacity>

      {/* --- LOGIN REQUIRED PROMPT MODAL --- */}
      <CustomModal visible={isAuthModalVisible} onClose={() => setIsAuthModalVisible(false)} title="LOGIN REQUIRED">
        <View style={styles.warningIconContainer}>
          <Ionicons name="lock-open" size={40} color={BRAND.navy} />
        </View>
        <Text style={styles.confirmText}>
          Please sign in to submit facility reports and contribute to mapping accessibility for PWDs.
        </Text>
        
        <View style={styles.modalButtonRow}>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setIsAuthModalVisible(false)} activeOpacity={0.7}>
            <Text style={[styles.buttonText, { color: BRAND.navy }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: BRAND.navy }]} onPress={() => {
            setIsAuthModalVisible(false);
            router.push('/explore');
          }} activeOpacity={0.7}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </CustomModal>

      <CustomModal visible={isModalVisible} onClose={closeModal} title="NEW REPORT">
        <Text style={styles.coordText}>
          Target: {draftLocation?.latitude.toFixed(5)}, {draftLocation?.longitude.toFixed(5)}
        </Text>

        {image && <Image source={{ uri: image }} style={styles.previewImage} />}

        <TouchableOpacity style={[styles.button, styles.buttonPhoto]} activeOpacity={0.7} onPress={pickImage}>
          <MaterialIcons name="photo-camera" size={20} color={BRAND.white} style={{ marginRight: 8 }} />
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
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <ActivityIndicator size="large" color={BRAND.navy} />
            <Text style={{ marginTop: 10, color: BRAND.gray, fontWeight: '600' }}>Saving to PWD Map...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={[styles.button, styles.buttonElevator]} activeOpacity={0.7} onPress={() => confirmSaveMarker('elevator')}>
              <MaterialIcons name="elevator" size={20} color={BRAND.white} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Save as Elevator</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.buttonRamp]} activeOpacity={0.7} onPress={() => confirmSaveMarker('ramp')}>
              <MaterialIcons name="accessible" size={20} color={BRAND.white} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Save as Ramp</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[styles.button, styles.buttonCancel]} activeOpacity={0.7} onPress={closeModal} disabled={isUploading}>
          <Text style={[styles.buttonText, { color: BRAND.navy }]}>Cancel</Text>
        </TouchableOpacity>
      </CustomModal>

      <CustomModal visible={!!selectedFacility} onClose={() => setSelectedFacility(null)} title={`${selectedFacility?.type?.toUpperCase()} DETAILS`}>
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
            <MaterialIcons name="delete-outline" size={20} color={BRAND.white} style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Delete Marker</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.button, styles.buttonCancel]} activeOpacity={0.7} onPress={() => setSelectedFacility(null)}>
          <Text style={[styles.buttonText, { color: BRAND.navy }]}>Close</Text>
        </TouchableOpacity>
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

      {/* MAP CONTROLS */}
      <View style={styles.mapControlsContainer}>
        <TouchableOpacity style={styles.mapControlBtn} activeOpacity={0.8} onPress={recenterToUserLocation}>
          <MaterialIcons name="my-location" size={24} color={BRAND.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} activeOpacity={0.8} onPress={resetMapRotation}>
          <MaterialIcons name="explore" size={24} color={BRAND.navy} />
        </TouchableOpacity>
      </View>

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

  searchContainer: {
    position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row',
    backgroundColor: BRAND.white, borderRadius: 25, paddingHorizontal: 18,
    paddingVertical: 14, alignItems: 'center', shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12,
    elevation: 8, borderWidth: 1, borderColor: '#E2EBE8',
  },
  searchInput: { flex: 1, fontSize: 16, color: BRAND.navy, fontWeight: '600' },

  hugeBoundingBox: {
    width: 36, height: 40, alignItems: 'center', justifyContent: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  iconBubble: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
    zIndex: 2,
  },
  trianglePointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -2,
    zIndex: 1,
  },
  trianglePointerSmall: {
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
  },

  reportButton: {
    position: 'absolute',
    right: 25,
    bottom: 100,
    backgroundColor: BRAND.navy, paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 30, flexDirection: 'row', alignItems: 'center',
    shadowColor: BRAND.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
    borderWidth: 2, borderColor: BRAND.green
  },
  reportButtonText: { color: BRAND.white, fontWeight: '800', marginLeft: 8, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 53, 89, 0.4)', justifyContent: 'center', alignItems: 'center' },
  modalView: {
    width: '85%', backgroundColor: BRAND.white, borderRadius: 24, padding: 25, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20,
    elevation: 10, borderWidth: 1, borderColor: BRAND.mintBg
  },
  modalTitle: { marginBottom: 5, textAlign: 'center', fontSize: 22, fontWeight: '900', color: BRAND.navy, letterSpacing: 1 },
  coordText: { fontSize: 12, color: BRAND.gray, marginBottom: 10, fontWeight: '500' },

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

  previewImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 20 },
  noPhotoContainer: {
    width: '100%', height: 120, backgroundColor: BRAND.mintBg, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20
  },
  noPhotoText: { color: BRAND.gray, marginTop: 8, fontWeight: '600' },

  divider: { height: 2, backgroundColor: BRAND.mintBg, width: '100%', marginVertical: 15, borderRadius: 1 },
  errorOverlay: {
    position: 'absolute', top: 120, backgroundColor: BRAND.danger, padding: 12,
    borderRadius: 10, alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 4, elevation: 5
  },
  errorText: { color: BRAND.white, fontWeight: 'bold' },

  // --- SEARCH RECOMMENDATIONS STYLES ---
  recommendationsContainer: {
    position: 'absolute',
    top: 122,
    left: 20,
    right: 20,
    backgroundColor: BRAND.white,
    borderRadius: 20,
    maxHeight: 250,
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2EBE8',
    zIndex: 9999,
    overflow: 'hidden',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F7F4',
  },
  recommendationText: {
    fontSize: 14,
    color: BRAND.navy,
    fontWeight: '600',
    flex: 1,
  },
  recommendationIcon: {
    marginRight: 10,
  },
  searchingIndicator: {
    marginRight: 8,
  },
  searchMarkerContainer: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  searchMarkerBubble: {
    width: 32,
    height: 32,
    backgroundColor: BRAND.white,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: BRAND.danger,
    zIndex: 2,
  },
  stationMarkerContainer: {
    width: 32,
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stationMarkerBubble: {
    width: 28,
    height: 28,
    backgroundColor: BRAND.white,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#800080',
    zIndex: 2,
  },
  busMarkerContainer: {
    width: 32,
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  busMarkerBubble: {
    width: 28,
    height: 28,
    backgroundColor: BRAND.white,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    zIndex: 2,
  },

  // --- SPLASH SCREEN STYLES ---
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  splashLogoContainer: {
    width: 260,
    height: 140,
    backgroundColor: BRAND.white,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 12,
  },
  splashLogo: {
    width: '100%',
    height: '100%',
  },
  splashLoader: {
    marginTop: 40,
  },
  splashSubtext: {
    marginTop: 20,
    fontSize: 16,
    color: BRAND.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // --- AUTHORIZATION PROMPT STYLES ---
  warningIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EBF5F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  confirmText: {
    fontSize: 14,
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
    lineHeight: 20,
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
  },
  modalButtonCancel: {
    backgroundColor: BRAND.mintBg,
    borderWidth: 1,
    borderColor: '#D1E3DD',
  },
  modalButtonConfirm: {
    backgroundColor: BRAND.danger,
  },

  // --- CUSTOM MAP CONTROLS ---
  mapControlsContainer: {
    position: 'absolute',
    bottom: 240, // Above bottom buttons
    right: 25,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    zIndex: 999,
  },
  mapControlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E2EBE8',
  },
});
