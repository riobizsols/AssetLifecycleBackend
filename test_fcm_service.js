const fcmService = require('./services/fcmService');

async function testFCMService() {
    try {
        console.log('🧪 Testing FCM Service...\n');
        
        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('FCM Service initialized:', fcmService.initialized);
        
        if (fcmService.initialized) {
            console.log('✅ FCM Service is ready');
            
            // Test sending a notification
            console.log('\n📱 Testing notification sending...');
            
            const testResult = await fcmService.sendNotificationToUser({
                userId: 'test-user-id',
                title: 'Test Notification',
                body: 'This is a test from FCM Service',
                data: { type: 'test' },
                notificationType: 'test_notification'
            });
            
            console.log('Test result:', testResult);
            
        } else {
            console.log('❌ FCM Service not initialized');
        }
        
    } catch (error) {
        console.error('❌ FCM Service test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testFCMService();
}

module.exports = { testFCMService };
