import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CustomModal } from './custom-modal';
import { BRAND } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export function CustomAlert({
  visible,
  title,
  message,
  buttons,
  onClose,
}: CustomAlertProps) {
  // If no buttons are provided, default to a single "OK" button
  const alertButtons = buttons && buttons.length > 0 
    ? buttons 
    : [{ text: 'OK', onPress: onClose }];

  // Auto-detect icon based on title
  const renderIcon = () => {
    const t = title.toLowerCase();
    let iconName: keyof typeof Ionicons.mappings | any = 'information-circle';
    let iconColor = BRAND.navy;

    if (t.includes('success') || t.includes('submitted') || t.includes('complete') || t.includes('created') || t.includes('deleted')) {
      iconName = 'checkmark-circle';
      iconColor = BRAND.green;
    } else if (t.includes('error') || t.includes('fail') || t.includes('denied') || t.includes('invalid')) {
      iconName = 'alert-circle';
      iconColor = BRAND.danger;
    } else if (t.includes('confirm') || t.includes('delete') || t.includes('sign out') || t.includes('logout') || t.includes('remove')) {
      iconName = 'help-circle';
      iconColor = BRAND.lightBlue;
    }

    return (
      <View style={[styles.iconContainer, { borderColor: iconColor }]}>
        <Ionicons name={iconName} size={42} color={iconColor} />
      </View>
    );
  };

  const handleButtonPress = (btn: AlertButton) => {
    onClose();
    if (btn.onPress) {
      btn.onPress();
    }
  };

  const isTwoButtons = alertButtons.length === 2;

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      variant="dialog"
      animationType="fade"
    >
      <View style={styles.container}>
        {renderIcon()}
        
        <Text style={styles.title}>{title}</Text>
        
        <ScrollView style={styles.messageScrollView} contentContainerStyle={styles.messageContent}>
          <Text style={styles.message}>{message}</Text>
        </ScrollView>

        <View style={[
          styles.buttonRow, 
          isTwoButtons ? styles.rowLayout : styles.columnLayout
        ]}>
          {alertButtons.map((btn, index) => {
            const isCancel = btn.style === 'cancel';
            const isDestructive = btn.style === 'destructive';
            
            let btnStyle: any = styles.defaultBtn;
            let textStyle: any = styles.defaultBtnText;

            if (isCancel) {
              btnStyle = styles.cancelBtn;
              textStyle = styles.cancelBtnText;
            } else if (isDestructive) {
              btnStyle = styles.destructiveBtn;
              textStyle = styles.destructiveBtnText;
            }

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button, 
                  btnStyle,
                  isTwoButtons ? styles.halfWidth : styles.fullWidth,
                  index > 0 && !isTwoButtons && { marginTop: 8 }
                ]}
                onPress={() => handleButtonPress(btn)}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnText, textStyle]}>{btn.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </CustomModal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: BRAND.mintBg,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.navy,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  messageScrollView: {
    maxHeight: 180,
    width: '100%',
    marginBottom: 20,
  },
  messageContent: {
    paddingHorizontal: 5,
  },
  message: {
    fontSize: 15,
    color: BRAND.gray,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonRow: {
    width: '100%',
    justifyContent: 'center',
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnLayout: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  halfWidth: {
    flex: 1,
    marginHorizontal: 4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Default Button (Navy primary)
  defaultBtn: {
    backgroundColor: BRAND.navy,
  },
  defaultBtnText: {
    color: BRAND.white,
  },
  // Cancel Button (Mint / Outline)
  cancelBtn: {
    backgroundColor: BRAND.mintBg,
    borderWidth: 1,
    borderColor: '#D1E3DD',
  },
  cancelBtnText: {
    color: BRAND.navy,
  },
  // Destructive Button (Red warning)
  destructiveBtn: {
    backgroundColor: BRAND.danger,
  },
  destructiveBtnText: {
    color: BRAND.white,
  },
});
