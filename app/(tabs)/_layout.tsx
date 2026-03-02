import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';


const BRAND = {
  navy: '#0c3559',      
  lightBlue: '#71A8D7', 
  green: '#05a841',     
  white: '#FFFFFF',
  gray: '#95A5A6',
  mintBg: '#F0F7F4',    
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND.white,      // Active text/icon is crisp white
        tabBarInactiveTintColor: BRAND.lightBlue, // Inactive tabs are light blue
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideOnKeyboard: true, 
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeWrapper]}>
              <Ionicons 
                name={focused ? "map" : "map-outline"} 
                size={24} 
                color={color} 
              />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeWrapper]}>
              <Ionicons 
                name={focused ? "compass" : "compass-outline"} 
                size={26} 
                color={color} 
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

// --- NEW STRIKING STYLES ---
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: BRAND.navy, // Changed from White to Navy!
    borderTopWidth: 0, 
    elevation: 25, 
    shadowColor: '#000', // Deep shadow to separate it from the map
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    height: Platform.OS === 'ios' ? 88 : 70, 
    paddingBottom: Platform.OS === 'ios' ? 28 : 10, 
    paddingTop: 10,
    borderTopLeftRadius: 30, // Slightly rounder for a sleeker look
    borderTopRightRadius: 30,
    position: 'absolute', 
    bottom: 0, 
    left: 0,   
    right: 0,
    zIndex: 1000, 
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '800', 
    marginTop: 4,
  },
  iconWrapper: {
    width: 50,  
    height: 32, 
    borderRadius: 16,
    alignItems: 'center',    
    justifyContent: 'center',
  },
  activeWrapper: {
    backgroundColor: BRAND.green, // Bright green pill for the selected tab!
    shadowColor: BRAND.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  }
});