const axios = require('axios');

// Test the new workflow separation API
async function testWorkflowSeparation() {
  try {
    console.log('Testing workflow separation API...');
    
    // Test with ASS023 (the asset mentioned in the issue)
    const response = await axios.get('http://localhost:5001/api/approval-detail/workflows/ASS023', {
      headers: {
        'Authorization': 'Bearer your-jwt-token-here' // Replace with actual token
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`\n✅ Found ${response.data.count} separate workflows for ASS023:`);
      
      response.data.data.forEach((workflow, index) => {
        console.log(`\n--- Workflow ${index + 1} ---`);
        console.log(`WFAMSH ID: ${workflow.wfamshId}`);
        console.log(`Maintenance Type: ${workflow.maintenanceType}`);
        console.log(`Due Date: ${workflow.dueDate}`);
        console.log(`Status: ${workflow.headerStatus}`);
        console.log(`Approval Steps: ${workflow.workflowSteps.length}`);
        
        workflow.workflowSteps.forEach((step, stepIndex) => {
          console.log(`  Step ${stepIndex + 1}: ${step.title} (${step.status})`);
        });
      });
    } else {
      console.log('❌ API call failed:', response.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.response?.data || error.message);
  }
}

// Run the test
testWorkflowSeparation();
