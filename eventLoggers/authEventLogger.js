const eventLogger = require('../services/eventLogger');

/**
 * Auth Event Logger
 * Centralized logging for authentication-related events
 * All log level decisions for auth events are made here
 */

// ==================== DETAILED FLOW LOGGING ====================

/**
 * Log API call started (INFO)
 */
async function logLoginApiCalled(options) {
    const { email, method, url } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'API_CALL',
        module: 'AUTH',
        message: `INFO: ${method} ${url} - Login API called`,
        logLevel: 'INFO',
        requestData: { email, method, url },
        responseData: { status: 'processing' },
        duration: null,
        userId: null
    });
}

/**
 * Log database query to check user (INFO)
 */
async function logCheckingUserInDatabase(options) {
    const { email } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'DB_QUERY',
        module: 'AUTH',
        message: `INFO: Querying database to find user by email`,
        logLevel: 'INFO',
        requestData: { email, query: 'SELECT * FROM tblUsers WHERE email = $1' },
        responseData: { status: 'executing' },
        duration: null,
        userId: null
    });
}

/**
 * Log user found in database (INFO)
 */
async function logUserFound(options) {
    const { email, userId, userData } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'DB_QUERY',
        module: 'AUTH',
        message: `INFO: User found in database`,
        logLevel: 'INFO',
        requestData: { email, query: 'SELECT * FROM tblUsers WHERE email = $1' },
        responseData: { 
            userFound: true, 
            userId,
            fullName: userData?.full_name,
            orgId: userData?.org_id,
            jobRoleId: userData?.job_role_id
        },
        duration: null,
        userId
    });
}

/**
 * Log user not found (WARNING)
 */
async function logUserNotFound(options) {
    const { email } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'DB_QUERY',
        module: 'AUTH',
        message: `WARNING: User not found in database`,
        logLevel: 'WARNING',
        requestData: { email },
        responseData: { userFound: false },
        duration: null,
        userId: null
    });
}

/**
 * Log password comparison started (INFO)
 */
async function logComparingPassword(options) {
    const { email, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'AUTH',
        module: 'AUTH',
        message: `INFO: Comparing password hash for user`,
        logLevel: 'INFO',
        requestData: { email, userId },
        responseData: { status: 'comparing' },
        duration: null,
        userId
    });
}

/**
 * Log password matched (INFO)
 */
async function logPasswordMatched(options) {
    const { email, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'AUTH',
        module: 'AUTH',
        message: `INFO: Password matched successfully`,
        logLevel: 'INFO',
        requestData: { email, userId, operation: 'bcrypt.compare' },
        responseData: { 
            passwordMatch: true,
            authenticationSuccess: true,
            nextStep: 'Generate JWT token'
        },
        duration: null,
        userId
    });
}

/**
 * Log password not matched (WARNING)
 */
async function logPasswordNotMatched(options) {
    const { email, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'AUTH',
        module: 'AUTH',
        message: `WARNING: Password did not match`,
        logLevel: 'WARNING',
        requestData: { email, userId, operation: 'bcrypt.compare' },
        responseData: { 
            passwordMatch: false,
            authenticationFailed: true,
            reason: 'Password hash does not match'
        },
        duration: null,
        userId
    });
}

/**
 * Log token generation started (INFO)
 */
async function logGeneratingToken(options) {
    const { email, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'AUTH',
        module: 'AUTH',
        message: `INFO: Generating JWT token for user`,
        logLevel: 'INFO',
        requestData: { email, userId },
        responseData: { status: 'generating token' },
        duration: null,
        userId
    });
}

/**
 * Log token generated successfully (INFO)
 */
async function logTokenGenerated(options) {
    const { email, userId, tokenPayload } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'AUTH',
        module: 'AUTH',
        message: `INFO: JWT token generated successfully`,
        logLevel: 'INFO',
        requestData: { 
            email, 
            userId,
            tokenPayload: {
                org_id: tokenPayload?.org_id,
                user_id: tokenPayload?.user_id,
                email: tokenPayload?.email,
                expiresIn: '7d'
            }
        },
        responseData: { 
            tokenGenerated: true,
            tokenType: 'JWT',
            expiryDuration: '7 days'
        },
        duration: null,
        userId
    });
}

/**
 * Log successful login (INFO)
 */
async function logSuccessfulLogin(options) {
    const { email, userId, duration, responseData } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'LOGIN',
        module: 'AUTH',
        message: `INFO: User successfully logged in with email: ${email}`,
        logLevel: 'INFO',
        requestData: { email },
        responseData: {
            success: true,
            userId,
            userName: responseData?.full_name,
            orgId: responseData?.org_id,
            branchId: responseData?.branch_id,
            branchName: responseData?.branch_name,
            roles: responseData?.roles,
            tokenProvided: true
        },
        duration,
        userId
    });
}

/**
 * Log failed login attempt (WARNING)
 */
async function logFailedLogin(options) {
    const { email, userId = null, reason, duration } = options;
    
    await eventLogger.logLogin({
        appId: 'LOGIN',
        email,
        success: false,
        userId,
        error: { message: reason },
        duration
    });
}

/**
 * Log critical error during login (CRITICAL)
 */
async function logLoginCriticalError(options) {
    const { email, error, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'SYSTEM_FAILURE',
        module: 'AUTH',
        message: `CRITICAL: System failure during login - ${error.message}`,
        logLevel: 'CRITICAL',
        requestData: { email },
        responseData: { 
            error: error.message, 
            stack: error.stack?.substring(0, 200) 
        },
        duration,
        userId: null
    });
}

module.exports = {
    // Detailed flow logging
    logLoginApiCalled,
    logCheckingUserInDatabase,
    logUserFound,
    logUserNotFound,
    logComparingPassword,
    logPasswordMatched,
    logPasswordNotMatched,
    logGeneratingToken,
    logTokenGenerated,
    // Summary logging
    logSuccessfulLogin,
    logFailedLogin,
    logLoginCriticalError
};
