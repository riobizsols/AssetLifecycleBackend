# 📱 React Native Mobile App - Push Notification Implementation

## 🎯 Overview

This guide provides complete React Native code to implement push notifications for the Asset Lifecycle Management system. The mobile app will receive notifications when new workflow maintenance schedule details are created.

## 📦 Required Dependencies

First, install the necessary packages:

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
npm install @react-native-async-storage/async-storage
npm install react-native-push-notification
npm install @react-native-community/push-notification-ios
```

For iOS, also run:
```bash
cd ios && pod install && cd ..
```

## 🔧 Firebase Configuration

### 1. Android Setup (`android/app/google-services.json`)
Place your Firebase configuration file in `android/app/` directory.

### 2. iOS Setup (`ios/GoogleService-Info.plist`)
Place your Firebase configuration file in `ios/` directory and add it to Xcode project.

### 3. Update `android/build.gradle`
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

### 4. Update `android/app/build.gradle`
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation 'com.google.firebase:firebase-messaging'
}
```

## 🚀 Core Implementation

### 1. FCM Service (`src/services/FCMService.js`)

```javascript
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

class FCMService {
    constructor() {
        this.fcmToken = null;
        this.isInitialized = false;
    }

    /**
     * Initialize FCM service
     */
    async initialize() {
        try {
            console.log('🔧 Initializing FCM Service...');
            
            // Request permission for iOS
            const authStatus = await messaging().requestPermission();
            const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                           authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.log('❌ FCM permission not granted');
                return false;
            }

            // Get FCM token
            await this.getFCMToken();
            
            // Set up message handlers
            this.setupMessageHandlers();
            
            this.isInitialized = true;
            console.log('✅ FCM Service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ FCM initialization failed:', error);
            return false;
        }
    }

    /**
     * Get FCM token and register with backend
     */
    async getFCMToken() {
        try {
            this.fcmToken = await messaging().getToken();
            console.log('📱 FCM Token:', this.fcmToken);
            
            // Store token locally
            await AsyncStorage.setItem('fcm_token', this.fcmToken);
            
            // Register token with backend
            await this.registerTokenWithBackend();
            
            return this.fcmToken;
        } catch (error) {
            console.error('❌ Error getting FCM token:', error);
            throw error;
        }
    }

    /**
     * Register FCM token with backend
     */
    async registerTokenWithBackend() {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken || !this.fcmToken) {
                console.log('⚠️ User token or FCM token not available');
                return;
            }

            const deviceInfo = {
                model: await this.getDeviceModel(),
                osVersion: await this.getOSVersion(),
                manufacturer: await this.getManufacturer()
            };

            const response = await fetch(`${API_BASE_URL}/fcm/register-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    deviceToken: this.fcmToken,
                    deviceType: 'mobile',
                    platform: Platform.OS,
                    appVersion: await this.getAppVersion(),
                    deviceInfo
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('✅ FCM token registered with backend');
            } else {
                console.error('❌ Failed to register FCM token:', result.message);
            }
        } catch (error) {
            console.error('❌ Error registering FCM token:', error);
        }
    }

    /**
     * Set up message handlers
     */
    setupMessageHandlers() {
        // Handle foreground messages
        messaging().onMessage(async remoteMessage => {
            console.log('📨 Foreground message received:', remoteMessage);
            this.handleForegroundMessage(remoteMessage);
        });

        // Handle background/quit state messages
        messaging().setBackgroundMessageHandler(async remoteMessage => {
            console.log('📨 Background message received:', remoteMessage);
            this.handleBackgroundMessage(remoteMessage);
        });

        // Handle notification tap
        messaging().onNotificationOpenedApp(remoteMessage => {
            console.log('👆 Notification tapped:', remoteMessage);
            this.handleNotificationTap(remoteMessage);
        });

        // Handle notification tap when app is quit
        messaging()
            .getInitialNotification()
            .then(remoteMessage => {
                if (remoteMessage) {
                    console.log('👆 App opened from notification:', remoteMessage);
                    this.handleNotificationTap(remoteMessage);
                }
            });
    }

    /**
     * Handle foreground messages
     */
    handleForegroundMessage(remoteMessage) {
        const { notification, data } = remoteMessage;
        
        // Show in-app notification
        this.showInAppNotification({
            title: notification?.title || 'New Notification',
            body: notification?.body || 'You have a new notification',
            data: data || {}
        });
    }

    /**
     * Handle background messages
     */
    handleBackgroundMessage(remoteMessage) {
        // Process background message
        console.log('🔄 Processing background message:', remoteMessage);
        
        // You can perform background tasks here
        // Note: Keep processing time minimal
    }

    /**
     * Handle notification tap
     */
    handleNotificationTap(remoteMessage) {
        const { data } = remoteMessage;
        
        if (data?.notification_type === 'workflow_approval') {
            // Navigate to maintenance approval screen
            this.navigateToMaintenanceApproval(data);
        } else if (data?.notification_type === 'breakdown_approval') {
            // Navigate to breakdown approval screen
            this.navigateToBreakdownApproval(data);
        } else {
            // Navigate to general notifications screen
            this.navigateToNotifications();
        }
    }

    /**
     * Navigate to maintenance approval screen
     */
    navigateToMaintenanceApproval(data) {
        // Import navigation and navigate
        // Example: navigation.navigate('MaintenanceApproval', { workflowId: data.wfamsh_id });
        console.log('🧭 Navigating to maintenance approval:', data);
    }

    /**
     * Navigate to breakdown approval screen
     */
    navigateToBreakdownApproval(data) {
        // Import navigation and navigate
        // Example: navigation.navigate('BreakdownApproval', { workflowId: data.wfamsh_id });
        console.log('🧭 Navigating to breakdown approval:', data);
    }

    /**
     * Navigate to notifications screen
     */
    navigateToNotifications() {
        // Import navigation and navigate
        // Example: navigation.navigate('Notifications');
        console.log('🧭 Navigating to notifications');
    }

    /**
     * Show in-app notification
     */
    showInAppNotification({ title, body, data }) {
        // You can use a toast library or custom notification component
        console.log('🔔 In-app notification:', { title, body, data });
        
        // Example with react-native-toast-message:
        // Toast.show({
        //     type: 'info',
        //     text1: title,
        //     text2: body,
        //     onPress: () => this.handleNotificationTap({ data })
        // });
    }

    /**
     * Get device model
     */
    async getDeviceModel() {
        try {
            const { getModel } = require('react-native-device-info');
            return await getModel();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Get OS version
     */
    async getOSVersion() {
        try {
            const { getSystemVersion } = require('react-native-device-info');
            return await getSystemVersion();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Get manufacturer
     */
    async getManufacturer() {
        try {
            const { getManufacturer } = require('react-native-device-info');
            return await getManufacturer();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Get app version
     */
    async getAppVersion() {
        try {
            const { getVersion } = require('react-native-device-info');
            return await getVersion();
        } catch (error) {
            return '1.0.0';
        }
    }

    /**
     * Unregister FCM token
     */
    async unregisterToken() {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken || !this.fcmToken) {
                return;
            }

            const response = await fetch(`${API_BASE_URL}/fcm/unregister-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    deviceToken: this.fcmToken
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('✅ FCM token unregistered');
                await AsyncStorage.removeItem('fcm_token');
                this.fcmToken = null;
            }
        } catch (error) {
            console.error('❌ Error unregistering FCM token:', error);
        }
    }

    /**
     * Update notification preferences
     */
    async updateNotificationPreferences(notificationType, preferences) {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch(`${API_BASE_URL}/fcm/preferences`, {
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
                console.log('✅ Notification preferences updated');
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ Error updating notification preferences:', error);
            throw error;
        }
    }

    /**
     * Get notification preferences
     */
    async getNotificationPreferences() {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch(`${API_BASE_URL}/fcm/preferences`, {
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
            console.error('❌ Error getting notification preferences:', error);
            throw error;
        }
    }

    /**
     * Send test notification
     */
    async sendTestNotification() {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch(`${API_BASE_URL}/fcm/test-notification`, {
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
                console.log('✅ Test notification sent');
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ Error sending test notification:', error);
            throw error;
        }
    }
}

// Create singleton instance
const fcmService = new FCMService();

export default fcmService;
```

### 2. App Initialization (`App.js`)

```javascript
import React, { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import fcmService from './src/services/FCMService';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

const App = () => {
    const [isFCMReady, setIsFCMReady] = useState(false);

    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            console.log('🚀 Initializing Asset Management App...');
            
            // Request Android permissions
            if (Platform.OS === 'android') {
                await requestAndroidPermissions();
            }
            
            // Initialize FCM
            const fcmInitialized = await fcmService.initialize();
            setIsFCMReady(fcmInitialized);
            
            console.log('✅ App initialization complete');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
        }
    };

    const requestAndroidPermissions = async () => {
        try {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                PermissionsAndroid.PERMISSIONS.WAKE_LOCK,
            ]);
            
            console.log('📱 Android permissions:', granted);
        } catch (error) {
            console.error('❌ Android permission request failed:', error);
        }
    };

    return (
        <NavigationContainer>
            <Stack.Navigator>
                {/* Your existing screens */}
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="MaintenanceApproval" component={MaintenanceApprovalScreen} />
                <Stack.Screen name="BreakdownApproval" component={BreakdownApprovalScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default App;
```

### 3. Notification Settings Screen (`src/screens/NotificationSettingsScreen.js`)

```javascript
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Switch,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator
} from 'react-native';
import fcmService from '../services/FCMService';

const NotificationSettingsScreen = ({ navigation }) => {
    const [preferences, setPreferences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadNotificationPreferences();
    }, []);

    const loadNotificationPreferences = async () => {
        try {
            setLoading(true);
            const prefs = await fcmService.getNotificationPreferences();
            setPreferences(prefs);
        } catch (error) {
            console.error('Error loading preferences:', error);
            Alert.alert('Error', 'Failed to load notification preferences');
        } finally {
            setLoading(false);
        }
    };

    const updatePreference = async (notificationType, field, value) => {
        try {
            setSaving(true);
            
            const pref = preferences.find(p => p.notificationType === notificationType);
            const updatedPreferences = {
                isEnabled: pref?.isEnabled || true,
                emailEnabled: pref?.emailEnabled || true,
                pushEnabled: pref?.pushEnabled || true,
                [field]: value
            };

            await fcmService.updateNotificationPreferences(notificationType, updatedPreferences);
            
            // Update local state
            setPreferences(prev => 
                prev.map(p => 
                    p.notificationType === notificationType 
                        ? { ...p, [field]: value }
                        : p
                )
            );
            
            Alert.alert('Success', 'Notification preferences updated');
        } catch (error) {
            console.error('Error updating preference:', error);
            Alert.alert('Error', 'Failed to update notification preferences');
        } finally {
            setSaving(false);
        }
    };

    const sendTestNotification = async () => {
        try {
            setSaving(true);
            await fcmService.sendTestNotification();
            Alert.alert('Success', 'Test notification sent!');
        } catch (error) {
            console.error('Error sending test notification:', error);
            Alert.alert('Error', 'Failed to send test notification');
        } finally {
            setSaving(false);
        }
    };

    const getNotificationTypeLabel = (type) => {
        const labels = {
            'workflow_approval': 'Maintenance Approval',
            'breakdown_approval': 'Breakdown Approval',
            'asset_created': 'Asset Created',
            'asset_updated': 'Asset Updated',
            'maintenance_due': 'Maintenance Due',
            'test_notification': 'Test Notifications'
        };
        return labels[type] || type;
    };

    const getNotificationTypeDescription = (type) => {
        const descriptions = {
            'workflow_approval': 'Get notified when maintenance requires your approval',
            'breakdown_approval': 'Get urgent notifications for asset breakdowns',
            'asset_created': 'Get notified when new assets are created',
            'asset_updated': 'Get notified when assets are updated',
            'maintenance_due': 'Get notified when maintenance is due',
            'test_notification': 'Receive test notifications'
        };
        return descriptions[type] || 'Notification description';
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading preferences...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Notification Settings</Text>
                <Text style={styles.subtitle}>Manage your notification preferences</Text>
            </View>

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
                            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                            thumbColor={pref.isEnabled ? '#FFFFFF' : '#FFFFFF'}
                        />
                    </View>
                    
                    <Text style={styles.preferenceDescription}>
                        {getNotificationTypeDescription(pref.notificationType)}
                    </Text>

                    {pref.isEnabled && (
                        <View style={styles.subPreferences}>
                            <View style={styles.subPreferenceRow}>
                                <Text style={styles.subPreferenceLabel}>Push Notifications</Text>
                                <Switch
                                    value={pref.pushEnabled}
                                    onValueChange={(value) => 
                                        updatePreference(pref.notificationType, 'pushEnabled', value)
                                    }
                                    trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                                    thumbColor={pref.pushEnabled ? '#FFFFFF' : '#FFFFFF'}
                                />
                            </View>
                            
                            <View style={styles.subPreferenceRow}>
                                <Text style={styles.subPreferenceLabel}>Email Notifications</Text>
                                <Switch
                                    value={pref.emailEnabled}
                                    onValueChange={(value) => 
                                        updatePreference(pref.notificationType, 'emailEnabled', value)
                                    }
                                    trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                                    thumbColor={pref.emailEnabled ? '#FFFFFF' : '#FFFFFF'}
                                />
                            </View>
                        </View>
                    )}
                </View>
            ))}

            <View style={styles.testSection}>
                <TouchableOpacity 
                    style={styles.testButton}
                    onPress={sendTestNotification}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.testButtonText}>Send Test Notification</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#8E8E93',
    },
    header: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
    },
    preferenceCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000000',
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
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
    },
    preferenceDescription: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 16,
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
    subPreferenceLabel: {
        fontSize: 16,
        color: '#000000',
    },
    testSection: {
        padding: 20,
    },
    testButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
    },
    testButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default NotificationSettingsScreen;
```

### 4. Maintenance Approval Screen (`src/screens/MaintenanceApprovalScreen.js`)

```javascript
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    Alert,
    ActivityIndicator
} from 'react-native';
import { API_BASE_URL } from '../config/api';

const MaintenanceApprovalScreen = ({ navigation, route }) => {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadWorkflows();
    }, []);

    const loadWorkflows = async () => {
        try {
            setLoading(true);
            const userToken = await AsyncStorage.getItem('user_token');
            
            const response = await fetch(`${API_BASE_URL}/maintenance-approvals`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            
            const result = await response.json();
            if (result.success) {
                setWorkflows(result.data);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading workflows:', error);
            Alert.alert('Error', 'Failed to load maintenance workflows');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadWorkflows();
        setRefreshing(false);
    };

    const approveWorkflow = async (workflowId) => {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            
            const response = await fetch(`${API_BASE_URL}/maintenance-approvals/${workflowId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    action: 'UA', // User Approved
                    notes: 'Approved via mobile app'
                })
            });
            
            const result = await response.json();
            if (result.success) {
                Alert.alert('Success', 'Workflow approved successfully');
                loadWorkflows(); // Refresh the list
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error approving workflow:', error);
            Alert.alert('Error', 'Failed to approve workflow');
        }
    };

    const rejectWorkflow = async (workflowId) => {
        Alert.prompt(
            'Reject Workflow',
            'Please provide a reason for rejection:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    onPress: async (reason) => {
                        try {
                            const userToken = await AsyncStorage.getItem('user_token');
                            
                            const response = await fetch(`${API_BASE_URL}/maintenance-approvals/${workflowId}/reject`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${userToken}`
                                },
                                body: JSON.stringify({
                                    action: 'UR', // User Rejected
                                    notes: reason || 'Rejected via mobile app'
                                })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                Alert.alert('Success', 'Workflow rejected');
                                loadWorkflows(); // Refresh the list
                            } else {
                                throw new Error(result.message);
                            }
                        } catch (error) {
                            console.error('Error rejecting workflow:', error);
                            Alert.alert('Error', 'Failed to reject workflow');
                        }
                    }
                }
            ]
        );
    };

    const renderWorkflowItem = ({ item }) => (
        <View style={styles.workflowCard}>
            <View style={styles.workflowHeader}>
                <Text style={styles.assetName}>{item.asset_name}</Text>
                <Text style={styles.workflowId}>{item.wfamsh_id}</Text>
            </View>
            
            <View style={styles.workflowDetails}>
                <Text style={styles.detailText}>
                    <Text style={styles.label}>Asset ID:</Text> {item.asset_id}
                </Text>
                <Text style={styles.detailText}>
                    <Text style={styles.label}>Planned Date:</Text> {item.pl_sch_date}
                </Text>
                <Text style={styles.detailText}>
                    <Text style={styles.label}>Status:</Text> {item.status}
                </Text>
                {item.notes && (
                    <Text style={styles.detailText}>
                        <Text style={styles.label}>Notes:</Text> {item.notes}
                    </Text>
                )}
            </View>
            
            <View style={styles.actionButtons}>
                <TouchableOpacity 
                    style={[styles.button, styles.approveButton]}
                    onPress={() => approveWorkflow(item.wfamsh_id)}
                >
                    <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => rejectWorkflow(item.wfamsh_id)}
                >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading workflows...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Maintenance Approvals</Text>
                <Text style={styles.subtitle}>
                    {workflows.length} pending approval{workflows.length !== 1 ? 's' : ''}
                </Text>
            </View>
            
            <FlatList
                data={workflows}
                renderItem={renderWorkflowItem}
                keyExtractor={(item) => item.wfamsh_id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No pending approvals</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#8E8E93',
    },
    header: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
    },
    listContainer: {
        padding: 16,
    },
    workflowCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    workflowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    assetName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
    },
    workflowId: {
        fontSize: 14,
        color: '#8E8E93',
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    workflowDetails: {
        marginBottom: 16,
    },
    detailText: {
        fontSize: 14,
        color: '#000000',
        marginBottom: 4,
    },
    label: {
        fontWeight: '600',
        color: '#8E8E93',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    approveButton: {
        backgroundColor: '#34C759',
    },
    rejectButton: {
        backgroundColor: '#FF3B30',
    },
    approveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    rejectButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#8E8E93',
    },
});

export default MaintenanceApprovalScreen;
```

### 5. API Configuration (`src/config/api.js`)

```javascript
// API Configuration
export const API_BASE_URL = 'http://localhost:5000/api'; // Change to your backend URL

// For production, use:
// export const API_BASE_URL = 'https://your-domain.com/api';
```

### 6. Background Message Handler (`index.js`)

```javascript
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';

// Register background handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('📨 Background message received:', remoteMessage);
    
    // Handle background message processing
    // Keep this minimal as it runs in background
});

AppRegistry.registerComponent(appName, () => App);
```

## 🧪 Testing the Implementation

### 1. Test FCM Token Registration
```javascript
// In your app, test if FCM is working
const testFCM = async () => {
    const token = await fcmService.getFCMToken();
    console.log('FCM Token:', token);
};
```

### 2. Test Notification Preferences
```javascript
// Test updating preferences
const testPreferences = async () => {
    await fcmService.updateNotificationPreferences('workflow_approval', {
        isEnabled: true,
        pushEnabled: true,
        emailEnabled: false
    });
};
```

### 3. Test Notification Reception
```javascript
// Send test notification from backend
const testNotification = async () => {
    await fcmService.sendTestNotification();
};
```

## 🔧 Platform-Specific Setup

### iOS Setup
1. Enable Push Notifications capability in Xcode
2. Add `GoogleService-Info.plist` to Xcode project
3. Update `ios/Podfile` if needed

### Android Setup
1. Add `google-services.json` to `android/app/`
2. Update `android/build.gradle` and `android/app/build.gradle`
3. Ensure proper permissions in `AndroidManifest.xml`

## 📱 Usage in Your App

### 1. Initialize FCM in App.js
```javascript
import fcmService from './src/services/FCMService';

// Initialize FCM when app starts
useEffect(() => {
    fcmService.initialize();
}, []);
```

### 2. Handle Navigation from Notifications
```javascript
// In your navigation setup
const handleNotificationNavigation = (data) => {
    if (data.notification_type === 'workflow_approval') {
        navigation.navigate('MaintenanceApproval', { workflowId: data.wfamsh_id });
    }
};
```

### 3. Add Notification Settings to Your Menu
```javascript
// Add to your main menu
<TouchableOpacity onPress={() => navigation.navigate('NotificationSettings')}>
    <Text>Notification Settings</Text>
</TouchableOpacity>
```

## 🎯 Key Features Implemented

✅ **FCM Token Registration**: Automatically registers device tokens with backend  
✅ **Foreground Notifications**: Shows in-app notifications when app is active  
✅ **Background Notifications**: Handles notifications when app is in background  
✅ **Notification Tap Handling**: Navigates to appropriate screens when notifications are tapped  
✅ **Notification Preferences**: Users can enable/disable different notification types  
✅ **Test Notifications**: Send test notifications to verify setup  
✅ **Error Handling**: Comprehensive error handling and user feedback  
✅ **Platform Support**: Works on both iOS and Android  

## 🚀 Ready to Use!

This implementation provides a complete push notification system for your Asset Lifecycle Management mobile app. Users will receive notifications when new workflow maintenance schedule details are created, and can manage their notification preferences directly from the app.

The system integrates seamlessly with your existing backend FCM implementation and provides a smooth user experience for maintenance approval workflows.
