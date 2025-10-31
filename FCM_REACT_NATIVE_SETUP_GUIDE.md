# 📱 FCM React Native Setup Guide

This guide will help you implement Firebase Cloud Messaging (FCM) push notifications in your React Native mobile app for the Asset Lifecycle Management system.

## 🚀 Prerequisites

1. **Firebase Project Setup**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Cloud Messaging in your Firebase project
   - Download `google-services.json` for Android and `GoogleService-Info.plist` for iOS

2. **React Native Project**
   - React Native 0.60+ (recommended)
   - iOS 10.0+ / Android API 21+

## 📦 Installation

### 1. Install Required Packages

```bash
# Install React Native Firebase
npm install @react-native-firebase/app @react-native-firebase/messaging

# For iOS, install pods
cd ios && pod install && cd ..

# For Android, no additional steps needed (auto-linking)
```

### 2. Firebase Configuration Files

#### Android Setup
1. Place `google-services.json` in `android/app/` directory
2. Update `android/build.gradle`:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```
3. Update `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation 'com.google.firebase:firebase-messaging'
}
```

#### iOS Setup
1. Place `GoogleService-Info.plist` in `ios/YourAppName/` directory
2. Add the file to Xcode project (drag and drop)
3. Enable Push Notifications capability in Xcode

## 🔧 Implementation

### 1. Create FCM Service

Create `src/services/FCMService.js`:

```javascript
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

class FCMService {
    constructor() {
        this.fcmToken = null;
        this.userId = null;
    }

    /**
     * Initialize FCM service
     */
    async initialize(userId) {
        try {
            this.userId = userId;
            
            // Request permission for notifications
            await this.requestPermission();
            
            // Get FCM token
            await this.getFCMToken();
            
            // Set up message handlers
            this.setupMessageHandlers();
            
            console.log('FCM Service initialized successfully');
        } catch (error) {
            console.error('Error initializing FCM service:', error);
        }
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        try {
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                console.log('Notification permission granted');
            } else {
                console.log('Notification permission denied');
            }

            return enabled;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    /**
     * Get FCM token
     */
    async getFCMToken() {
        try {
            const token = await messaging().getToken();
            this.fcmToken = token;
            
            // Store token locally
            await AsyncStorage.setItem('fcm_token', token);
            
            // Register token with backend
            if (this.userId) {
                await this.registerTokenWithBackend(token);
            }
            
            console.log('FCM Token:', token);
            return token;
        } catch (error) {
            console.error('Error getting FCM token:', error);
            throw error;
        }
    }

    /**
     * Register token with backend
     */
    async registerTokenWithBackend(token) {
        try {
            const deviceInfo = await this.getDeviceInfo();
            
            const response = await fetch(`${API_BASE_URL}/fcm/register-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`,
                },
                body: JSON.stringify({
                    deviceToken: token,
                    deviceType: 'mobile',
                    platform: Platform.OS,
                    appVersion: deviceInfo.appVersion,
                    deviceInfo: {
                        model: deviceInfo.model,
                        osVersion: deviceInfo.osVersion,
                        manufacturer: deviceInfo.manufacturer,
                    }
                }),
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('FCM token registered with backend');
            } else {
                console.error('Failed to register FCM token:', result.message);
            }
            
            return result;
        } catch (error) {
            console.error('Error registering FCM token with backend:', error);
            throw error;
        }
    }

    /**
     * Unregister token from backend
     */
    async unregisterToken() {
        try {
            if (!this.fcmToken) {
                this.fcmToken = await AsyncStorage.getItem('fcm_token');
            }

            if (this.fcmToken) {
                const response = await fetch(`${API_BASE_URL}/fcm/unregister-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`,
                    },
                    body: JSON.stringify({
                        deviceToken: this.fcmToken
                    }),
                });

                const result = await response.json();
                
                if (result.success) {
                    console.log('FCM token unregistered from backend');
                    // Clear local token
                    await AsyncStorage.removeItem('fcm_token');
                    this.fcmToken = null;
                }
                
                return result;
            }
        } catch (error) {
            console.error('Error unregistering FCM token:', error);
            throw error;
        }
    }

    /**
     * Set up message handlers
     */
    setupMessageHandlers() {
        // Handle background messages
        messaging().setBackgroundMessageHandler(async remoteMessage => {
            console.log('Background message received:', remoteMessage);
            
            // Handle background notification logic here
            // Note: This handler must be registered before the app is mounted
        });

        // Handle foreground messages
        messaging().onMessage(async remoteMessage => {
            console.log('Foreground message received:', remoteMessage);
            
            // Show local notification for foreground messages
            this.showLocalNotification(remoteMessage);
        });

        // Handle notification taps
        messaging().onNotificationOpenedApp(remoteMessage => {
            console.log('Notification opened app:', remoteMessage);
            this.handleNotificationTap(remoteMessage);
        });

        // Handle notification tap when app is completely closed
        messaging()
            .getInitialNotification()
            .then(remoteMessage => {
                if (remoteMessage) {
                    console.log('App opened from notification:', remoteMessage);
                    this.handleNotificationTap(remoteMessage);
                }
            });
    }

    /**
     * Show local notification for foreground messages
     */
    showLocalNotification(remoteMessage) {
        // You can use react-native-push-notification or other libraries
        // This is a basic implementation
        const { notification } = remoteMessage;
        
        if (notification) {
            // Show alert or use a notification library
            Alert.alert(
                notification.title,
                notification.body,
                [
                    {
                        text: 'View',
                        onPress: () => this.handleNotificationTap(remoteMessage)
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    }
                ]
            );
        }
    }

    /**
     * Handle notification tap
     */
    handleNotificationTap(remoteMessage) {
        const { data } = remoteMessage;
        
        if (data) {
            // Navigate based on notification type
            switch (data.type) {
                case 'asset_assigned':
                case 'asset_updated':
                    // Navigate to asset details
                    this.navigateToAsset(data.assetId);
                    break;
                case 'maintenance_due':
                case 'maintenance_completed':
                    // Navigate to maintenance details
                    this.navigateToMaintenance(data.maintenanceId);
                    break;
                case 'workflow_approval':
                    // Navigate to workflow approval
                    this.navigateToWorkflowApproval(data.workflowId);
                    break;
                case 'breakdown_reported':
                    // Navigate to breakdown details
                    this.navigateToBreakdown(data.breakdownId);
                    break;
                default:
                    // Navigate to home or notifications screen
                    this.navigateToHome();
                    break;
            }
        }
    }

    /**
     * Navigation helper methods
     */
    navigateToAsset(assetId) {
        // Implement navigation to asset details
        // Example: navigation.navigate('AssetDetails', { assetId });
    }

    navigateToMaintenance(maintenanceId) {
        // Implement navigation to maintenance details
        // Example: navigation.navigate('MaintenanceDetails', { maintenanceId });
    }

    navigateToWorkflowApproval(workflowId) {
        // Implement navigation to workflow approval
        // Example: navigation.navigate('WorkflowApproval', { workflowId });
    }

    navigateToBreakdown(breakdownId) {
        // Implement navigation to breakdown details
        // Example: navigation.navigate('BreakdownDetails', { breakdownId });
    }

    navigateToHome() {
        // Implement navigation to home
        // Example: navigation.navigate('Home');
    }

    /**
     * Get device information
     */
    async getDeviceInfo() {
        const DeviceInfo = require('react-native-device-info');
        
        return {
            model: await DeviceInfo.getModel(),
            osVersion: await DeviceInfo.getSystemVersion(),
            manufacturer: await DeviceInfo.getManufacturer(),
            appVersion: await DeviceInfo.getVersion(),
        };
    }

    /**
     * Update notification preferences
     */
    async updateNotificationPreferences(notificationType, preferences) {
        try {
            const response = await fetch(`${API_BASE_URL}/fcm/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`,
                },
                body: JSON.stringify({
                    notificationType,
                    preferences
                }),
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error updating notification preferences:', error);
            throw error;
        }
    }

    /**
     * Get notification preferences
     */
    async getNotificationPreferences() {
        try {
            const response = await fetch(`${API_BASE_URL}/fcm/preferences`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`,
                },
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            throw error;
        }
    }

    /**
     * Send test notification
     */
    async sendTestNotification() {
        try {
            const response = await fetch(`${API_BASE_URL}/fcm/test-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`,
                },
                body: JSON.stringify({
                    title: 'Test Notification',
                    body: 'This is a test notification from your app',
                    data: { type: 'test' }
                }),
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error sending test notification:', error);
            throw error;
        }
    }
}

export default new FCMService();
```

### 2. Create FCM Context

Create `src/contexts/FCMContext.js`:

```javascript
import React, { createContext, useContext, useEffect, useState } from 'react';
import FCMService from '../services/FCMService';
import { useAuth } from './AuthContext';

const FCMContext = createContext();

export const useFCM = () => {
    const context = useContext(FCMContext);
    if (!context) {
        throw new Error('useFCM must be used within an FCMProvider');
    }
    return context;
};

export const FCMProvider = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [fcmToken, setFcmToken] = useState(null);
    const [notificationPreferences, setNotificationPreferences] = useState([]);
    const { user } = useAuth();

    useEffect(() => {
        if (user && !isInitialized) {
            initializeFCM();
        }
    }, [user, isInitialized]);

    const initializeFCM = async () => {
        try {
            await FCMService.initialize(user.user_id);
            setIsInitialized(true);
            
            // Get notification preferences
            await loadNotificationPreferences();
        } catch (error) {
            console.error('Error initializing FCM:', error);
        }
    };

    const loadNotificationPreferences = async () => {
        try {
            const result = await FCMService.getNotificationPreferences();
            if (result.success) {
                setNotificationPreferences(result.data.preferences);
            }
        } catch (error) {
            console.error('Error loading notification preferences:', error);
        }
    };

    const updateNotificationPreference = async (notificationType, preferences) => {
        try {
            const result = await FCMService.updateNotificationPreferences(notificationType, preferences);
            if (result.success) {
                await loadNotificationPreferences(); // Reload preferences
            }
            return result;
        } catch (error) {
            console.error('Error updating notification preference:', error);
            throw error;
        }
    };

    const sendTestNotification = async () => {
        try {
            return await FCMService.sendTestNotification();
        } catch (error) {
            console.error('Error sending test notification:', error);
            throw error;
        }
    };

    const value = {
        isInitialized,
        fcmToken,
        notificationPreferences,
        updateNotificationPreference,
        sendTestNotification,
        loadNotificationPreferences,
    };

    return (
        <FCMContext.Provider value={value}>
            {children}
        </FCMContext.Provider>
    );
};
```

### 3. App Integration

Update your main `App.js`:

```javascript
import React, { useEffect } from 'react';
import { FCMProvider } from './src/contexts/FCMContext';
import FCMService from './src/services/FCMService';

// Register background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message received:', remoteMessage);
});

const App = () => {
    return (
        <FCMProvider>
            {/* Your app components */}
        </FCMProvider>
    );
};

export default App;
```

### 4. Notification Settings Screen

Create `src/screens/NotificationSettingsScreen.js`:

```javascript
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Switch,
    ScrollView,
    StyleSheet,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useFCM } from '../contexts/FCMContext';

const NotificationSettingsScreen = () => {
    const { notificationPreferences, updateNotificationPreference } = useFCM();
    const [loading, setLoading] = useState(false);

    const handleTogglePreference = async (notificationType, field, value) => {
        try {
            setLoading(true);
            
            const preference = notificationPreferences.find(p => p.notificationType === notificationType);
            const updatedPreferences = {
                isEnabled: preference.isEnabled,
                emailEnabled: preference.emailEnabled,
                pushEnabled: preference.pushEnabled,
                [field]: value,
            };

            const result = await updateNotificationPreference(notificationType, updatedPreferences);
            
            if (!result.success) {
                Alert.alert('Error', 'Failed to update notification preference');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update notification preference');
        } finally {
            setLoading(false);
        }
    };

    const renderPreferenceItem = (preference) => {
        const getNotificationTypeLabel = (type) => {
            const labels = {
                'asset_created': 'Asset Created',
                'asset_updated': 'Asset Updated',
                'asset_deleted': 'Asset Deleted',
                'maintenance_due': 'Maintenance Due',
                'maintenance_completed': 'Maintenance Completed',
                'workflow_approval': 'Workflow Approval',
                'workflow_escalated': 'Workflow Escalated',
                'breakdown_reported': 'Breakdown Reported',
                'user_assigned': 'User Assigned',
                'asset_depreciation': 'Asset Depreciation',
            };
            return labels[type] || type;
        };

        return (
            <View key={preference.notificationType} style={styles.preferenceItem}>
                <Text style={styles.preferenceTitle}>
                    {getNotificationTypeLabel(preference.notificationType)}
                </Text>
                
                <View style={styles.preferenceRow}>
                    <Text style={styles.preferenceLabel}>Enable Notifications</Text>
                    <Switch
                        value={preference.isEnabled}
                        onValueChange={(value) => handleTogglePreference(preference.notificationType, 'isEnabled', value)}
                        disabled={loading}
                    />
                </View>
                
                {preference.isEnabled && (
                    <>
                        <View style={styles.preferenceRow}>
                            <Text style={styles.preferenceLabel}>Push Notifications</Text>
                            <Switch
                                value={preference.pushEnabled}
                                onValueChange={(value) => handleTogglePreference(preference.notificationType, 'pushEnabled', value)}
                                disabled={loading}
                            />
                        </View>
                        
                        <View style={styles.preferenceRow}>
                            <Text style={styles.preferenceLabel}>Email Notifications</Text>
                            <Switch
                                value={preference.emailEnabled}
                                onValueChange={(value) => handleTogglePreference(preference.notificationType, 'emailEnabled', value)}
                                disabled={loading}
                            />
                        </View>
                    </>
                )}
            </View>
        );
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Notification Settings</Text>
            
            {notificationPreferences.map(renderPreferenceItem)}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        padding: 20,
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    preferenceItem: {
        backgroundColor: '#fff',
        marginBottom: 10,
        padding: 15,
    },
    preferenceTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    preferenceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    preferenceLabel: {
        fontSize: 16,
        color: '#666',
    },
});

export default NotificationSettingsScreen;
```

## 🔧 Additional Dependencies

Add these packages to your `package.json`:

```json
{
  "dependencies": {
    "@react-native-firebase/app": "^18.6.1",
    "@react-native-firebase/messaging": "^18.6.1",
    "@react-native-async-storage/async-storage": "^1.19.5",
    "react-native-device-info": "^10.11.0"
  }
}
```

## 📱 Usage Examples

### 1. Initialize FCM in your app

```javascript
import { useFCM } from './src/contexts/FCMContext';

const HomeScreen = () => {
    const { isInitialized, sendTestNotification } = useFCM();

    const handleTestNotification = async () => {
        try {
            const result = await sendTestNotification();
            if (result.success) {
                Alert.alert('Success', 'Test notification sent!');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to send test notification');
        }
    };

    return (
        <View>
            <Text>FCM Status: {isInitialized ? 'Initialized' : 'Not Initialized'}</Text>
            <TouchableOpacity onPress={handleTestNotification}>
                <Text>Send Test Notification</Text>
            </TouchableOpacity>
        </View>
    );
};
```

### 2. Handle notification navigation

```javascript
// In your navigation setup
import { useFCM } from './src/contexts/FCMContext';

const AppNavigator = () => {
    const { isInitialized } = useFCM();

    useEffect(() => {
        if (isInitialized) {
            // FCM is ready, you can now handle notifications
        }
    }, [isInitialized]);

    return (
        // Your navigation structure
    );
};
```

## 🚀 Testing

### 1. Test FCM Integration

```javascript
// Add this to your test screen
const TestFCMScreen = () => {
    const { sendTestNotification } = useFCM();

    const testNotification = async () => {
        const result = await sendTestNotification();
        console.log('Test notification result:', result);
    };

    return (
        <TouchableOpacity onPress={testNotification}>
            <Text>Test Notification</Text>
        </TouchableOpacity>
    );
};
```

### 2. Test Backend Integration

Use the backend API endpoints to test:

```bash
# Register device token
curl -X POST http://localhost:5000/api/fcm/register-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "deviceToken": "YOUR_FCM_TOKEN",
    "deviceType": "mobile",
    "platform": "android",
    "appVersion": "1.0.0"
  }'

# Send test notification
curl -X POST http://localhost:5000/api/fcm/test-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test notification"
  }'
```

## 🔧 Troubleshooting

### Common Issues:

1. **Token not registering**: Check Firebase configuration and network connectivity
2. **Notifications not received**: Verify notification permissions and FCM token validity
3. **Background messages not working**: Ensure background message handler is registered before app mount
4. **iOS notifications not working**: Check APNs certificate and push notification capability

### Debug Tips:

1. Enable FCM debug logs in development
2. Check Firebase Console for message delivery status
3. Use FCM testing tools in Firebase Console
4. Monitor backend logs for FCM service errors

## 📚 Next Steps

1. **Implement notification history**: Store and display notification history in the app
2. **Add rich notifications**: Implement notification actions and rich media
3. **Batch notifications**: Group related notifications to avoid spam
4. **Analytics**: Track notification open rates and user engagement
5. **A/B testing**: Test different notification formats and timing

This implementation provides a complete FCM integration for your React Native app with the Asset Lifecycle Management backend system.
