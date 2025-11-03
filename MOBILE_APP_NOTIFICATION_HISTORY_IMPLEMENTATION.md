# 📱 Mobile App - Notification History API Implementation Guide

## 🎯 Overview

This guide shows how to implement the notification history API (`GET /api/fcm/history`) in your React Native mobile app to display the user's FCM notification history.

---

## 📋 API Endpoint Details

### **Endpoint**
```
GET /api/fcm/history
```

### **Authentication**
```
Authorization: Bearer {JWT_TOKEN}
```

### **Query Parameters (Optional)**
- `notificationType` - Filter by notification type (e.g., 'asset_created', 'workflow_approval')
- `status` - Filter by status ('sent', 'delivered', 'failed', 'clicked')
- `startDate` - Start date for filtering (YYYY-MM-DD format)
- `endDate` - End date for filtering (YYYY-MM-DD format)
- `limit` - Number of records to return (default: 20)
- `offset` - Number of records to skip (default: 0)

### **Response Structure**
```json
{
    "success": true,
    "message": "Notification history retrieved successfully",
    "data": {
        "userId": "USER001",
        "history": [
            {
                "notificationId": "NOT123456789",
                "notificationType": "workflow_approval",
                "title": "Maintenance Approval Required",
                "body": "Asset ABC123 requires your approval",
                "data": {
                    "assetId": "ASSET001",
                    "workflowId": "WF001"
                },
                "status": "sent",
                "sentOn": "2024-01-15T10:30:00Z",
                "deliveredOn": null,
                "clickedOn": null,
                "tokenId": "FCM123456789",
                "device": {
                    "platform": "ios",
                    "deviceType": "mobile",
                    "appVersion": "1.0.0"
                }
            }
        ]
    }
}
```

---

## 🔧 Implementation Steps

### **Step 1: Add Method to FCMService**

Add the `getNotificationHistory` method to your existing `FCMService.js`:

```javascript
/**
 * Get notification history for current user
 * @param {Object} filters - Optional filters (notificationType, status, startDate, endDate, limit, offset)
 * @returns {Promise<Array>} Notification history array
 */
async getNotificationHistory(filters = {}) {
    try {
        const userToken = await AsyncStorage.getItem('user_token');
        if (!userToken) {
            throw new Error('User not authenticated');
        }

        // Build query string from filters
        const queryParams = new URLSearchParams();
        
        if (filters.notificationType) {
            queryParams.append('notificationType', filters.notificationType);
        }
        if (filters.status) {
            queryParams.append('status', filters.status);
        }
        if (filters.startDate) {
            queryParams.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
            queryParams.append('endDate', filters.endDate);
        }
        if (filters.limit) {
            queryParams.append('limit', filters.limit.toString());
        }
        if (filters.offset) {
            queryParams.append('offset', filters.offset.toString());
        }

        const queryString = queryParams.toString();
        const url = `${API_BASE_URL}/fcm/history${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Notification history retrieved:', result.data.history.length, 'items');
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('❌ Error getting notification history:', error);
        throw error;
    }
}
```

**Complete Updated FCMService.js (excerpt):**

```javascript
// Add this method to your existing FCMService class

class FCMService {
    // ... existing methods ...
    
    /**
     * Get notification history for current user
     */
    async getNotificationHistory(filters = {}) {
        try {
            const userToken = await AsyncStorage.getItem('user_token');
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            // Build query string
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    queryParams.append(key, value.toString());
                }
            });

            const queryString = queryParams.toString();
            const url = `${API_BASE_URL}/fcm/history${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Notification history retrieved');
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ Error getting notification history:', error);
            throw error;
        }
    }
}

export default fcmService;
```

---

### **Step 2: Create Notification History Screen**

Create a new screen component `NotificationHistoryScreen.js`:

```javascript
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Modal,
    ScrollView
} from 'react-native';
import fcmService from '../services/FCMService';

const NotificationHistoryScreen = ({ navigation }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [filters, setFilters] = useState({
        limit: 20,
        offset: 0
    });

    useEffect(() => {
        loadNotificationHistory();
    }, []);

    const loadNotificationHistory = async () => {
        try {
            setLoading(true);
            const data = await fcmService.getNotificationHistory(filters);
            setHistory(data.history || []);
        } catch (error) {
            console.error('Error loading notification history:', error);
            Alert.alert('Error', 'Failed to load notification history');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotificationHistory();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'sent': return '#007AFF';
            case 'delivered': return '#34C759';
            case 'failed': return '#FF3B30';
            case 'clicked': return '#5856D6';
            default: return '#8E8E93';
        }
    };

    const getNotificationTypeLabel = (type) => {
        const labels = {
            'workflow_approval': 'Maintenance Approval',
            'breakdown_approval': 'Breakdown Approval',
            'asset_created': 'Asset Created',
            'asset_updated': 'Asset Updated',
            'maintenance_due': 'Maintenance Due',
            'test_notification': 'Test Notification'
        };
        return labels[type] || type;
    };

    const openNotificationDetails = (notification) => {
        setSelectedNotification(notification);
        setModalVisible(true);
    };

    const renderNotificationItem = ({ item }) => (
        <TouchableOpacity
            style={styles.notificationCard}
            onPress={() => openNotificationDetails(item)}
        >
            <View style={styles.notificationHeader}>
                <View style={styles.notificationTitleContainer}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.notificationType}>
                        {getNotificationTypeLabel(item.notificationType)}
                    </Text>
                </View>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) }
                    ]}
                >
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
            
            <Text style={styles.notificationBody} numberOfLines={2}>
                {item.body}
            </Text>
            
            <View style={styles.notificationFooter}>
                <Text style={styles.dateText}>
                    📅 {formatDate(item.sentOn)}
                </Text>
                <Text style={styles.deviceText}>
                    📱 {item.device?.platform || 'Unknown'}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading && history.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading notification history...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Notification History</Text>
                <Text style={styles.subtitle}>
                    {history.length} notification{history.length !== 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={history}
                renderItem={renderNotificationItem}
                keyExtractor={(item) => item.notificationId}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No notification history</Text>
                        <Text style={styles.emptySubtext}>
                            Your notification history will appear here
                        </Text>
                    </View>
                }
            />

            {/* Notification Details Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Notification Details</Text>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedNotification && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Title</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedNotification.title}
                                    </Text>
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Body</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedNotification.body}
                                    </Text>
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Type</Text>
                                    <Text style={styles.detailValue}>
                                        {getNotificationTypeLabel(selectedNotification.notificationType)}
                                    </Text>
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <View
                                        style={[
                                            styles.statusBadgeInline,
                                            { backgroundColor: getStatusColor(selectedNotification.status) }
                                        ]}
                                    >
                                        <Text style={styles.statusText}>
                                            {selectedNotification.status}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Sent On</Text>
                                    <Text style={styles.detailValue}>
                                        {formatDate(selectedNotification.sentOn)}
                                    </Text>
                                </View>

                                {selectedNotification.deliveredOn && (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailLabel}>Delivered On</Text>
                                        <Text style={styles.detailValue}>
                                            {formatDate(selectedNotification.deliveredOn)}
                                        </Text>
                                    </View>
                                )}

                                {selectedNotification.clickedOn && (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailLabel}>Clicked On</Text>
                                        <Text style={styles.detailValue}>
                                            {formatDate(selectedNotification.clickedOn)}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Device</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedNotification.device?.platform || 'Unknown'} • {' '}
                                        {selectedNotification.device?.deviceType || 'Unknown'} • {' '}
                                        v{selectedNotification.device?.appVersion || 'N/A'}
                                    </Text>
                                </View>

                                {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailLabel}>Data</Text>
                                        <Text style={styles.detailValue}>
                                            {JSON.stringify(selectedNotification.data, null, 2)}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
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
    listContainer: {
        padding: 16,
    },
    notificationCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    notificationTitleContainer: {
        flex: 1,
        marginRight: 8,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 4,
    },
    notificationType: {
        fontSize: 12,
        color: '#8E8E93',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    notificationBody: {
        fontSize: 14,
        color: '#000000',
        marginBottom: 12,
        lineHeight: 20,
    },
    notificationFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 12,
        color: '#8E8E93',
    },
    deviceText: {
        fontSize: 12,
        color: '#8E8E93',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#8E8E93',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000',
    },
    closeButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 24,
        color: '#8E8E93',
    },
    modalBody: {
        padding: 20,
    },
    detailSection: {
        marginBottom: 20,
    },
    detailLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    detailValue: {
        fontSize: 16,
        color: '#000000',
    },
    statusBadgeInline: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
});

export default NotificationHistoryScreen;
```

---

### **Step 3: Add Route to Navigation**

Add the notification history screen to your navigation:

```javascript
import NotificationHistoryScreen from './screens/NotificationHistoryScreen';

// In your Stack Navigator
<Stack.Screen 
    name="NotificationHistory" 
    component={NotificationHistoryScreen} 
    options={{ title: 'Notification History' }}
/>
```

---

### **Step 4: Add Filter Options (Optional)**

To add filtering functionality, you can create a filter modal:

```javascript
const [showFilters, setShowFilters] = useState(false);
const [tempFilters, setTempFilters] = useState(filters);

const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilters(false);
    loadNotificationHistory();
};

// In your component, add a filter button in the header
<TouchableOpacity onPress={() => setShowFilters(true)}>
    <Text>Filter</Text>
</TouchableOpacity>
```

---

## 📱 Usage Examples

### **1. Basic Usage**

```javascript
import fcmService from './services/FCMService';

// Get all notification history
const loadHistory = async () => {
    try {
        const data = await fcmService.getNotificationHistory();
        console.log('History:', data.history);
        console.log('User ID:', data.userId);
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### **2. With Filters**

```javascript
// Get filtered history
const loadFilteredHistory = async () => {
    try {
        const data = await fcmService.getNotificationHistory({
            notificationType: 'workflow_approval',
            status: 'sent',
            limit: 10,
            offset: 0
        });
        console.log('Filtered history:', data.history);
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### **3. With Date Range**

```javascript
// Get history for specific date range
const loadDateRangeHistory = async () => {
    try {
        const data = await fcmService.getNotificationHistory({
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            limit: 50
        });
        console.log('Date range history:', data.history);
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### **4. Pagination**

```javascript
// Load more notifications (pagination)
const loadMore = async () => {
    try {
        const nextPage = {
            ...filters,
            offset: filters.offset + filters.limit
        };
        const data = await fcmService.getNotificationHistory(nextPage);
        
        if (data.history.length > 0) {
            setHistory(prev => [...prev, ...data.history]);
            setFilters(nextPage);
        }
    } catch (error) {
        console.error('Error loading more:', error);
    }
};
```

---

## 🎨 Integration with Existing Screens

### **Add Link from Notification Settings**

```javascript
// In NotificationSettingsScreen.js
<TouchableOpacity
    onPress={() => navigation.navigate('NotificationHistory')}
    style={styles.historyButton}
>
    <Text>View Notification History</Text>
</TouchableOpacity>
```

### **Add to Navigation Menu**

```javascript
// In your main menu/drawer
<MenuItem
    title="Notification History"
    icon="bell"
    onPress={() => navigation.navigate('NotificationHistory')}
/>
```

---

## ✅ Features Implemented

- ✅ **Full History Display**: Shows all notifications for the current user
- ✅ **Filter Support**: Filter by type, status, date range
- ✅ **Pagination**: Load more notifications with offset/limit
- ✅ **Pull to Refresh**: Refresh notification history
- ✅ **Detail View**: Modal showing full notification details
- ✅ **Status Badges**: Color-coded status indicators
- ✅ **Date Formatting**: User-friendly date/time display
- ✅ **Empty State**: Helpful message when no history exists
- ✅ **Error Handling**: Graceful error handling with alerts
- ✅ **Loading States**: Activity indicators during loading

---

## 🔧 Customization Options

### **1. Change Default Limit**
```javascript
const [filters, setFilters] = useState({
    limit: 50, // Change from 20 to 50
    offset: 0
});
```

### **2. Add Search Functionality**
```javascript
const [searchQuery, setSearchQuery] = useState('');

const filteredHistory = history.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.body.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### **3. Group by Date**
```javascript
const groupByDate = (history) => {
    const grouped = {};
    history.forEach(item => {
        const date = new Date(item.sentOn).toDateString();
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(item);
    });
    return grouped;
};
```

---

## 🚀 Testing

### **1. Test Basic Loading**
```javascript
// Test loading notification history
await fcmService.getNotificationHistory();
```

### **2. Test Filters**
```javascript
// Test filtering
await fcmService.getNotificationHistory({
    notificationType: 'workflow_approval',
    status: 'sent'
});
```

### **3. Test Pagination**
```javascript
// Test pagination
await fcmService.getNotificationHistory({
    limit: 10,
    offset: 0
});
await fcmService.getNotificationHistory({
    limit: 10,
    offset: 10
});
```

---

## 📝 Summary

You now have a complete implementation of the notification history feature in your mobile app:

1. ✅ Added `getNotificationHistory` method to FCMService
2. ✅ Created NotificationHistoryScreen component
3. ✅ Added filtering and pagination support
4. ✅ Implemented pull-to-refresh functionality
5. ✅ Added notification detail modal
6. ✅ Included error handling and loading states

The implementation follows the same patterns as your existing FCM service and integrates seamlessly with your navigation structure.

