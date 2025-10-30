# 📱 Quick Mobile Integration - React Native Components

## 🚀 Easy Integration Components

Here are simplified React Native components that you can quickly integrate into your existing mobile app:

### 1. Simple FCM Hook (`src/hooks/useFCM.js`)

```javascript
import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const useFCM = () => {
    const [fcmToken, setFcmToken] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        initializeFCM();
    }, []);

    const initializeFCM = async () => {
        try {
            // Request permission
            const authStatus = await messaging().requestPermission();
            const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                           authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.log('FCM permission not granted');
                return;
            }

            // Get token
            const token = await messaging().getToken();
            setFcmToken(token);
            await AsyncStorage.setItem('fcm_token', token);

            // Register with backend
            await registerTokenWithBackend(token);

            // Set up message handlers
            setupMessageHandlers();

            setIsInitialized(true);
            console.log('FCM initialized successfully');
        } catch (error) {
            console.error('FCM initialization failed:', error);
        }
    };

    const registerTokenWithBackend = async (token) => {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) return;

            const response = await fetch('YOUR_BACKEND_URL/api/fcm/register-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    deviceToken: token,
                    deviceType: 'mobile',
                    platform: Platform.OS,
                    appVersion: '1.0.0'
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('FCM token registered with backend');
            }
        } catch (error) {
            console.error('Error registering FCM token:', error);
        }
    };

    const setupMessageHandlers = () => {
        // Handle foreground messages
        messaging().onMessage(async remoteMessage => {
            console.log('Foreground message:', remoteMessage);
            // Show in-app notification or update UI
        });

        // Handle notification tap
        messaging().onNotificationOpenedApp(remoteMessage => {
            console.log('Notification tapped:', remoteMessage);
            handleNotificationTap(remoteMessage);
        });

        // Handle app opened from notification
        messaging().getInitialNotification().then(remoteMessage => {
            if (remoteMessage) {
                handleNotificationTap(remoteMessage);
            }
        });
    };

    const handleNotificationTap = (remoteMessage) => {
        const { data } = remoteMessage;
        
        // Navigate based on notification type
        if (data?.notification_type === 'workflow_approval') {
            // Navigate to maintenance approval screen
            // navigation.navigate('MaintenanceApproval', { workflowId: data.wfamsh_id });
        } else if (data?.notification_type === 'breakdown_approval') {
            // Navigate to breakdown approval screen
            // navigation.navigate('BreakdownApproval', { workflowId: data.wfamsh_id });
        }
    };

    return {
        fcmToken,
        isInitialized,
        initializeFCM
    };
};

export default useFCM;
```

### 2. Simple Notification Component (`src/components/NotificationBanner.js`)

```javascript
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions
} from 'react-native';

const NotificationBanner = ({ notification, onPress, onDismiss }) => {
    const [slideAnim] = useState(new Animated.Value(-100));

    useEffect(() => {
        // Slide in animation
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Auto dismiss after 5 seconds
        const timer = setTimeout(() => {
            dismiss();
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    const dismiss = () => {
        Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            onDismiss();
        });
    };

    if (!notification) return null;

    return (
        <Animated.View 
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] }
            ]}
        >
            <TouchableOpacity 
                style={styles.banner}
                onPress={() => {
                    onPress(notification);
                    dismiss();
                }}
                activeOpacity={0.8}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>{notification.title}</Text>
                    <Text style={styles.body}>{notification.body}</Text>
                </View>
                
                <TouchableOpacity 
                    style={styles.dismissButton}
                    onPress={dismiss}
                >
                    <Text style={styles.dismissText}>×</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        zIndex: 1000,
    },
    banner: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 4,
    },
    body: {
        fontSize: 14,
        color: '#8E8E93',
        lineHeight: 20,
    },
    dismissButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    dismissText: {
        fontSize: 18,
        color: '#8E8E93',
        fontWeight: 'bold',
    },
});

export default NotificationBanner;
```

### 3. Simple Notification Manager (`src/utils/NotificationManager.js`)

```javascript
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationManager {
    static async updateNotificationPreferences(notificationType, preferences) {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch('YOUR_BACKEND_URL/api/fcm/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    notificationType,
                    preferences
                })
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error updating notification preferences:', error);
            Alert.alert('Error', 'Failed to update notification preferences');
            throw error;
        }
    }

    static async getNotificationPreferences() {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch('YOUR_BACKEND_URL/api/fcm/preferences', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });

            const result = await response.json();
            if (result.success) {
                return result.data.preferences;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            throw error;
        }
    }

    static async sendTestNotification() {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch('YOUR_BACKEND_URL/api/fcm/test-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    title: 'Test Notification',
                    body: 'This is a test notification from your Asset Management System',
                    data: { type: 'test' }
                })
            });

            const result = await response.json();
            if (result.success) {
                Alert.alert('Success', 'Test notification sent!');
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error sending test notification:', error);
            Alert.alert('Error', 'Failed to send test notification');
            throw error;
        }
    }
}

export default NotificationManager;
```

### 4. Simple Settings Screen (`src/screens/NotificationSettings.js`)

```javascript
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Switch,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert
} from 'react-native';
import NotificationManager from '../utils/NotificationManager';

const NotificationSettings = () => {
    const [preferences, setPreferences] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const prefs = await NotificationManager.getNotificationPreferences();
            setPreferences(prefs);
        } catch (error) {
            Alert.alert('Error', 'Failed to load preferences');
        } finally {
            setLoading(false);
        }
    };

    const updatePreference = async (notificationType, field, value) => {
        try {
            const pref = preferences.find(p => p.notificationType === notificationType);
            const updatedPreferences = {
                isEnabled: pref?.isEnabled || true,
                emailEnabled: pref?.emailEnabled || true,
                pushEnabled: pref?.pushEnabled || true,
                [field]: value
            };

            await NotificationManager.updateNotificationPreferences(
                notificationType, 
                updatedPreferences
            );
            
            setPreferences(prev => 
                prev.map(p => 
                    p.notificationType === notificationType 
                        ? { ...p, [field]: value }
                        : p
                )
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to update preferences');
        }
    };

    const sendTestNotification = async () => {
        try {
            await NotificationManager.sendTestNotification();
        } catch (error) {
            // Error already handled in NotificationManager
        }
    };

    const getNotificationTypeLabel = (type) => {
        const labels = {
            'workflow_approval': 'Maintenance Approval',
            'breakdown_approval': 'Breakdown Approval',
            'asset_created': 'Asset Created',
            'maintenance_due': 'Maintenance Due'
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading preferences...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Notification Settings</Text>
            
            {preferences.map((pref) => (
                <View key={pref.notificationType} style={styles.preferenceCard}>
                    <View style={styles.preferenceHeader}>
                        <Text style={styles.preferenceTitle}>
                            {getNotificationTypeLabel(pref.notificationType)}
                        </Text>
                        <Switch
                            value={pref.isEnabled}
                            onValueChange={(value) => 
                                updatePreference(pref.notificationType, 'isEnabled', value)
                            }
                        />
                    </View>
                    
                    {pref.isEnabled && (
                        <View style={styles.subPreferences}>
                            <View style={styles.subPreferenceRow}>
                                <Text>Push Notifications</Text>
                                <Switch
                                    value={pref.pushEnabled}
                                    onValueChange={(value) => 
                                        updatePreference(pref.notificationType, 'pushEnabled', value)
                                    }
                                />
                            </View>
                            
                            <View style={styles.subPreferenceRow}>
                                <Text>Email Notifications</Text>
                                <Switch
                                    value={pref.emailEnabled}
                                    onValueChange={(value) => 
                                        updatePreference(pref.notificationType, 'emailEnabled', value)
                                    }
                                />
                            </View>
                        </View>
                    )}
                </View>
            ))}

            <TouchableOpacity 
                style={styles.testButton}
                onPress={sendTestNotification}
            >
                <Text style={styles.testButtonText}>Send Test Notification</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#F5F5F5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    preferenceCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    preferenceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    preferenceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    subPreferences: {
        marginTop: 8,
    },
    subPreferenceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    testButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    },
    testButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default NotificationSettings;
```

## 🚀 Quick Integration Steps

### 1. Install Dependencies
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging @react-native-async-storage/async-storage
```

### 2. Add to Your App.js
```javascript
import useFCM from './src/hooks/useFCM';

const App = () => {
    const { isInitialized } = useFCM();
    
    // Your existing app code
    return (
        // Your existing app structure
    );
};
```

### 3. Add Notification Settings to Your Menu
```javascript
import NotificationSettings from './src/screens/NotificationSettings';

// Add to your navigation stack
<Stack.Screen name="NotificationSettings" component={NotificationSettings} />
```

### 4. Update Backend URL
Replace `YOUR_BACKEND_URL` in the components with your actual backend URL.

## 🎯 What This Gives You

✅ **Automatic FCM Setup**: Token registration and message handling  
✅ **Notification Preferences**: Users can control notification types  
✅ **Test Notifications**: Send test notifications to verify setup  
✅ **Simple Integration**: Easy to add to existing React Native apps  
✅ **Error Handling**: Comprehensive error handling and user feedback  

## 🔧 Customization

You can easily customize:
- **Notification styling** in `NotificationBanner.js`
- **Backend API endpoints** in `NotificationManager.js`
- **Navigation logic** in `useFCM.js`
- **UI components** in `NotificationSettings.js`

This simplified implementation provides all the core functionality you need to receive push notifications from your Asset Lifecycle Management system!
