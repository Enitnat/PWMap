import React from 'react';
import {
  Modal as RNModal,
  ModalProps as RNModalProps,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  SafeAreaView,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND } from '@/constants/theme';

export interface CustomModalProps extends Omit<RNModalProps, 'onRequestClose'> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  variant?: 'dialog' | 'fullscreen';
  showCloseButton?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function CustomModal({
  visible,
  onClose,
  title,
  variant = 'dialog',
  showCloseButton = false,
  animationType,
  contentContainerStyle,
  children,
  ...rest
}: CustomModalProps) {
  // Determine standard animation based on variant
  const defaultAnimation = variant === 'fullscreen' ? 'slide' : 'fade';
  const selectedAnimation = animationType || defaultAnimation;

  if (variant === 'fullscreen') {
    return (
      <RNModal
        visible={visible}
        animationType={selectedAnimation}
        transparent={false}
        onRequestClose={onClose}
        {...rest}
      >
        <SafeAreaView style={styles.fullscreenContainer}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>
              {title || ''}
            </Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButtonCircle}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={32} color={BRAND.navy} />
            </TouchableOpacity>
          </View>
          <View style={[styles.fullscreenContent, contentContainerStyle]}>
            {children}
          </View>
        </SafeAreaView>
      </RNModal>
    );
  }

  // Dialog variant
  return (
    <RNModal
      visible={visible}
      animationType={selectedAnimation}
      transparent={true}
      onRequestClose={onClose}
      {...rest}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, contentContainerStyle]}>
              {(title || showCloseButton) && (
                <View style={styles.dialogHeader}>
                  {title ? (
                    <Text style={styles.dialogTitle}>{title}</Text>
                  ) : (
                    <View />
                  )}
                  {showCloseButton && (
                    <TouchableOpacity 
                      onPress={onClose} 
                      style={styles.dialogCloseButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={24} color={BRAND.navy} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.dialogContent}>
                {children}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  // Fullscreen Modal Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: BRAND.mintBg,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#D1E3DD',
    ...Platform.select({
      android: {
        paddingTop: 15,
      },
    }),
  },
  fullscreenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.navy,
    letterSpacing: 0.5,
    flex: 1,
  },
  closeButtonCircle: {
    marginLeft: 15,
  },
  fullscreenContent: {
    flex: 1,
  },

  // Dialog Modal Styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 53, 89, 0.55)', // Semi-transparent Navy backdrop
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogCard: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: BRAND.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2EBE8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.navy,
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },
  dialogCloseButton: {
    padding: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  dialogContent: {
    width: '100%',
    alignItems: 'center',
  },
});
