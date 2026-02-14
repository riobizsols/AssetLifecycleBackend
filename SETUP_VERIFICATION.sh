#!/bin/bash

# 🎓 Certificate Management - Full Setup Verification
# This script verifies that the certificate management system is fully integrated

echo "================================"
echo "🎓 Certificate Integration Check"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Backend
echo "📦 Backend Components:"
echo ""

# Check models
echo -n "  ✓ TechCertModel... "
if [ -f "models/techCertModel.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo -n "  ✓ EmployeeTechCertModel... "
if [ -f "models/employeeTechCertModel.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# Check controllers
echo -n "  ✓ TechCertController... "
if [ -f "controllers/techCertController.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo -n "  ✓ EmployeeTechCertController... "
if [ -f "controllers/employeeTechCertController.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# Check routes
echo -n "  ✓ TechCertRoutes... "
if [ -f "routes/techCertRoutes.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo -n "  ✓ EmployeeTechCertRoutes... "
if [ -f "routes/employeeTechCertRoutes.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# Check migration
echo -n "  ✓ CertificationsApps Migration... "
if [ -f "migrations/addCertificationsApps.js" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo ""
echo "📄 Frontend Components:"
echo ""

# Check frontend pages (from repository root)
FRONTEND_DIR="../AssetLifecycleWebFrontend/src/pages"

echo -n "  ✓ Certifications.jsx... "
if [ -f "${FRONTEND_DIR}/adminSettings/Certifications.jsx" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo -n "  ✓ TechnicianCertificates.jsx... "
if [ -f "${FRONTEND_DIR}/TechnicianCertificates.jsx" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo -n "  ✓ TechCertApprovals.jsx... "
if [ -f "${FRONTEND_DIR}/TechCertApprovals.jsx" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo ""
echo "🔗 Routes & Navigation:"
echo ""

echo -n "  ✓ Routes registered in AppRoutes.jsx... "
if grep -q "TechnicianCertificates\|Certifications\|TechCertApprovals" "../AssetLifecycleWebFrontend/src/routes/AppRoutes.jsx" 2>/dev/null; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${YELLOW}⚠️${NC}"
fi

echo -n "  ✓ Routes registered in server.js... "
if grep -q "techCertRoutes\|employeeTechCertRoutes" "server.js" 2>/dev/null; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo ""
echo "📊 Database Setup:"
echo ""

echo -e "${YELLOW}Database Verification${NC} (run after migrations):"
echo ""
echo "  Run this SQL to verify navigation entries:"
echo "  ---"
echo "  SELECT COUNT(*) FROM \"tblJobRoleNav\" WHERE app_id IN ('CERTIFICATIONS', 'TECHCERTUPLOAD', 'HR/MANAGERAPPROVAL');"
echo "  ---"
echo ""
echo "  Expected: 39 entries across all job roles"

echo ""
echo "================================"
echo "🚀 Next Steps:"
echo "================================"
echo ""
echo "1️⃣  Backend Setup:"
echo "   • Ensure database is running"
echo "   • Run: npm install"
echo "   • Run: node migrations/addCertificationsApps.js"
echo "   • Start: npm start"
echo ""
echo "2️⃣  Frontend Setup:"
echo "   • cd ../AssetLifecycleWebFrontend"
echo "   • npm install"
echo "   • npm run dev"
echo ""
echo "3️⃣  Testing:"
echo "   • Login with your user account"
echo "   • Check if these menus appear in sidebar:"
echo "     - Certifications"
echo "     - Technician Certificates"
echo "     - HR/Manager Approval"
echo ""
echo "4️⃣  Verification:"
echo "   • Test each page functionality:"
echo "     - Create/Edit/Delete certificates"
echo "     - Upload employee certificates"
echo "     - Approve/Reject certificates"
echo "     - Map certificates to asset types"
echo ""
echo "================================"
echo "📚 Documentation:"
echo "================================"
echo ""
echo "✅ Complete integration guide: CERTIFICATE_INTEGRATION_GUIDE.md"
echo "✅ API verification script: scripts/verify-certificate-apis.js"
echo ""
echo "================================"
