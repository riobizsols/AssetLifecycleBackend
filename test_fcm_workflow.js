const fcmService = require('./services/fcmService');

async function testFCMWithWorkflowNotification() {
    try {
        console.log('🧪 Testing FCM Service with workflow notification...\n');
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('FCM Service initialized:', fcmService.initialized);
        
        if (fcmService.initialized) {
            console.log('✅ FCM Service is ready');
            
            // Test with workflow_approval notification type
            console.log('\n📱 Testing workflow notification...');
            
            const testResult = await fcmService.sendNotificationToUser({
                userId: 'USR020', // Chief Officer
                title: 'Test Workflow Notification',
                body: 'This is a test workflow notification',
                data: { 
                    type: 'workflow_approval',
                    wfamsh_id: 'TEST_WFAMSH_001',
                    asset_id: 'ASS001'
                },
                notificationType: 'workflow_approval'
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
    testFCMWithWorkflowNotification();
}

module.exports = { testFCMWithWorkflowNotification };
