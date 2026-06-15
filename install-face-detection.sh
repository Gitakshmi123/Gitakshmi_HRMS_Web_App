#!/bin/bash
# Face Validation & Coordinates Fix - Installation Script
# Run this script to automatically install and configure real face detection

echo "🎯 Face Validation & Coordinates Setup Script"
echo "=============================================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
node --version
if [ $? -ne 0 ]; then
  echo "❌ Node.js not found. Please install Node.js first."
  exit 1
fi
echo "✅ Node.js found"
echo ""

# Navigate to server directory
echo "📁 Navigating to server directory..."
cd "$(dirname "$0")/server" || exit 1
echo "✅ In server directory"
echo ""

# Install dependencies
echo "📥 Installing face detection libraries..."
echo "This will download face detection models (~100MB)"
echo ""
npm install @tensorflow/tfjs-core @vladmandic/face-api canvas
if [ $? -ne 0 ]; then
  echo "❌ Installation failed. Check internet connection."
  exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Verify installation
echo "🔍 Verifying installation..."
node -e "require('@vladmandic/face-api'); console.log('✅ face-api loaded successfully')" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "⚠️ Warning: face-api verification failed"
  echo "Try running: npm install @vladmandic/face-api"
fi
echo ""

# Create backup of controller
echo "💾 Creating backup of face-attendance.controller.js..."
if [ -f "controllers/face-attendance.controller.js" ]; then
  cp "controllers/face-attendance.controller.js" "controllers/face-attendance.controller.js.backup"
  echo "✅ Backup created at controllers/face-attendance.controller.js.backup"
else
  echo "⚠️ Controller file not found"
fi
echo ""

# Instructions
echo "📝 Next Steps:"
echo "=============================================="
echo "1. Open server/controllers/face-attendance.controller.js"
echo "   - Change line 1 import from faceRecognition.service to realFaceRecognition.service"
echo "   - Update geofence validation function"
echo ""
echo "2. Open server/app.js"
echo "   - Add model loading to app.listen()"
echo ""
echo "3. Open client/src/components/FaceAttendanceAdvanced.jsx"
echo "   - Add location.accuracy to verification request"
echo ""
echo "4. See SETUP_CHANGES_CHECKLIST.md for exact code changes"
echo ""
echo "5. Start server:"
echo "   npm run dev"
echo ""
echo "6. Models will load automatically (30-60 seconds)"
echo ""

echo "✅ Installation complete!"
echo "=============================================="
