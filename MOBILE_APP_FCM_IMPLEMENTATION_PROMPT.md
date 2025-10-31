# 📱 Mobile App FCM Implementation Prompt

## 🎯 **Project Context**
You are developing a React Native mobile app for an Asset Lifecycle Management system. The backend has FCM (Firebase Cloud Messaging) APIs already implemented. You need to integrate these APIs into your mobile app to enable push notifications.

## 📋 **Available FCM API Endpoints**

Based on the backend routes, here are the APIs you need to implement:

### **1. Register Device Token API**
```http
POST /api/fcm/register-token
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Body:
{
    "deviceToken": "string",
    "deviceType": "mobile",
    "platform": "ios|android",
    "appVersion": "string",
    "deviceInfo": {
        "model": "string",
        "osVersion": "string",
        "manufacturer": "string"
    }
}

Response:
{
    "success": true,
    "message": "Device token registered successfully",
    "data": {
        "tokenId": "string",
        "isUpdate": boolean
    }
}
```

### **2. Unregister Device Token API**
```http
POST /api/fcm/unregister-token
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Body:
{
    "deviceToken": "string"
}

Response:
{
    "success": true,
    "message": "Device token unregistered successfully",
    "data": {
        "affectedRows": number
    }
}
```

### **3. Get User Device Tokens API**
```http
GET /api/fcm/device-tokens?platform=ios|android
Authorization: Bearer {JWT_TOKEN}

Response:
{
    "success": true,
    "message": "Device tokens retrieved successfully",
    "data": {
        "tokens": [
            {
                "tokenId": "string",
                "deviceType": "string",
                "platform": "string",
                "appVersion": "string",
                "isActive": boolean,
                "lastUsed": "timestamp",
                "createdOn": "timestamp"
            }
        ]
    }
}
```

### **4. Update Notification Preferences API**
```http
PUT /api/fcm/preferences
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Body:
{
    "notificationType": "asset_created|asset_updated|maintenance_due|workflow_approval|test_notification",
    "preferences": {
        "isEnabled": boolean,
        "emailEnabled": boolean,
        "pushEnabled": boolean
    }
}

Response:
{
    "success": true,
    "message": "Notification preferences updated successfully",
    "data": {
        "preferenceId": "string",
        "notificationType": "string",
        "isEnabled": boolean,
        "emailEnabled": boolean,
        "pushEnabled": boolean,
        "createdOn": "timestamp",
        "updatedOn": "timestamp"
    }
}
```

### **5. Get Notification Preferences API**
```http
GET /api/fcm/preferences
Authorization: Bearer {JWT_TOKEN}

Response:
{
    "success": true,
    "message": "Notification preferences retrieved successfully",
    "data": {
        "preferences": [
            {
                "preferenceId": "string",
                "notificationType": "string",
                "isEnabled": boolean,
                "emailEnabled": boolean,
                "pushEnabled": boolean,
                "createdOn": "timestamp",
                "updatedOn": "timestamp"
            }
        ]
    }
}
```

### **6. Send Test Notification API**
```http
POST /api/fcm/test-notification
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Body:
{
    "title": "string",
    "body": "string",
    "data": {
        "type": "test"
    }
}

Response:
{
    "success": true,
    "message": "Test notification sent successfully",
    "data": {
        "success": boolean,
        "successCount": number,
        "failureCount": number,
        "totalTokens": number
    }
}
```

## 🚀 **Implementation Requirements**

### **1. Required Dependencies**
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

### **2. Firebase Configuration**
- Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
- Configure Firebase project with Cloud Messaging enabled

### **3. API Base Configuration**
```javascript
const API_BASE_URL = 'http://your-backend-url.com/api';
// or for development: 'http://localhost:5000/api'
```

## 📱 **Implementation Tasks**

### **Task 1: Create FCM Service**
Create a service that handles:
- FCM token generation
- API calls to backend
- Token registration/unregistration
- Message handling (foreground, background, notification taps)

### **Task 2: Create API Client**
Create an API client that:
- Makes HTTP requests to all 6 FCM endpoints
- Handles authentication with JWT tokens
- Manages request/response formatting
- Handles errors gracefully

### **Task 3: Create Notification Context**
Create a React Context that:
- Manages FCM state across the app
- Provides methods for all FCM operations
- Handles initialization and cleanup
- Manages notification preferences

### **Task 4: Create Notification Settings Screen**
Create a UI screen that:
- Displays all notification preferences
- Allows users to toggle preferences
- Shows device tokens (for debugging)
- Provides test notification functionality

### **Task 5: Integrate with App Lifecycle**
Implement:
- Automatic token registration on app launch
- Token refresh handling
- Background message handling
- Notification tap navigation

## 🎯 **Expected Features**

### **1. Automatic Token Management**
- Register token when user logs in
- Update token when it refreshes
- Unregister token when user logs out

### **2. Notification Preferences Management**
- Allow users to enable/disable notifications by type
- Separate controls for push and email notifications
- Persist preferences locally

### **3. Message Handling**
- Handle foreground messages (show in-app notification)
- Handle background messages (process in background)
- Handle notification taps (navigate to relevant screen)

### **4. Testing Features**
- Send test notifications
- View notification history
- Debug device tokens

## 🔧 **Technical Requirements**

### **1. Authentication Integration**
- Use existing JWT authentication system
- Include JWT token in all API requests
- Handle token expiration

### **2. Error Handling**
- Handle network errors
- Handle API errors
- Show user-friendly error messages
- Implement retry logic

### **3. Performance**
- Cache notification preferences
- Optimize API calls
- Handle large notification lists

### **4. Security**
- Validate FCM tokens
- Secure API communication
- Handle sensitive data properly

## 📊 **Notification Types to Support**

Based on the backend, support these notification types:
- `asset_created` - New asset created
- `asset_updated` - Asset information updated
- `asset_deleted` - Asset deleted
- `maintenance_due` - Maintenance due
- `maintenance_completed` - Maintenance completed
- `workflow_approval` - Workflow approval required
- `workflow_escalated` - Workflow escalated
- `breakdown_reported` - Asset breakdown reported
- `user_assigned` - User assigned to asset
- `test_notification` - Test notifications

## 🎨 **UI/UX Requirements**

### **1. Notification Settings Screen**
- Clean, intuitive interface
- Toggle switches for each notification type
- Separate controls for push and email
- Save/cancel functionality

### **2. Notification Handling**
- In-app notification banners
- Notification badges
- Sound and vibration settings
- Deep linking to relevant screens

### **3. Testing Interface**
- Test notification button
- Device token display (for debugging)
- Notification history view

## 🧪 **Testing Requirements**

### **1. Unit Tests**
- Test FCM service methods
- Test API client functions
- Test notification handling

### **2. Integration Tests**
- Test token registration flow
- Test notification sending
- Test preference management

### **3. Manual Testing**
- Test on both iOS and Android
- Test with different notification types
- Test background/foreground scenarios

## 📚 **Documentation Requirements**

### **1. Code Documentation**
- Document all FCM service methods
- Document API client functions
- Document notification handling logic

### **2. User Documentation**
- How to enable/disable notifications
- How to manage notification preferences
- Troubleshooting guide

## 🎯 **Success Criteria**

The implementation is successful when:
1. ✅ Users can register device tokens successfully
2. ✅ Users can manage notification preferences
3. ✅ Push notifications are received and handled properly
4. ✅ Notification taps navigate to correct screens
5. ✅ Test notifications work correctly
6. ✅ All API endpoints are properly integrated
7. ✅ Error handling works gracefully
8. ✅ Performance is optimized
9. ✅ Code is well-documented and maintainable

## 🚀 **Implementation Priority**

1. **High Priority**: Token registration, basic notification handling
2. **Medium Priority**: Notification preferences, settings screen
3. **Low Priority**: Advanced features, testing tools

## 💡 **Additional Considerations**

- Handle app updates (token might change)
- Handle device changes (new device, same user)
- Handle network connectivity issues
- Handle Firebase service availability
- Implement notification analytics
- Consider notification scheduling
- Implement notification grouping

---

**Note**: This prompt provides a comprehensive guide for implementing FCM APIs in your React Native mobile app. Follow the requirements and implement the features step by step to ensure a robust push notification system.
