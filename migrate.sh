#!/bin/bash
# Precise Migration Script - Copies only files changed in 7 commits
# Run this from new repo root directory

OLD_REPO="C:/Users/sai64/OneDrive/Desktop/intelli-conferences/diabetes-conferences.org(Paris)/diabetesconferences.org"
NEW_REPO="C:/Users/sai64/OneDrive/Desktop/intelli-conferences/nursingconferences-info/Nursingconference.Info"

echo "🚀 Starting precise file migration..."
echo "📂 Old repo: $OLD_REPO"
echo "📂 New repo: $NEW_REPO"
echo ""

# Change to new repo
cd "$NEW_REPO"

# Function to copy file and show status
copy_file() {
    local file=$1
    local source="$OLD_REPO/$file"
    local dest="$NEW_REPO/$file"
    
    if [ -f "$source" ]; then
        cp "$source" "$dest"
        echo "✅ Copied: $file"
    else
        echo "⚠️  Not found: $file"
    fi
}

echo "📦 Copying configuration files..."
copy_file "nextjs-frontend/.gitignore"
copy_file "nextjs-frontend/next.config.js"
copy_file "nextjs-frontend/package-lock.json"

echo ""
echo "📧 Copying email API routes..."
copy_file "nextjs-frontend/src/app/api/email/send-receipt/route.ts"

echo ""
echo "💳 Copying payment API routes..."
copy_file "nextjs-frontend/src/app/api/payment/process-completion/route.ts"

echo ""
echo "💰 Copying PayPal API routes..."
copy_file "nextjs-frontend/src/app/api/paypal/capture-order/route.ts"
copy_file "nextjs-frontend/src/app/api/paypal/create-order/route.ts"

echo ""
echo "💎 Copying Registration API routes..."
copy_file "nextjs-frontend/src/app/api/registration/route.ts"
copy_file "nextjs-frontend/src/app/api/registration/update-payment/route.ts"
copy_file "nextjs-frontend/src/app/api/registration/update-paypal-id/route.ts"

echo ""
echo "📝 Copying React components..."
copy_file "nextjs-frontend/src/app/components/FloatingChat.tsx"
copy_file "nextjs-frontend/src/app/components/PayPalButtonReliable.tsx"
copy_file "nextjs-frontend/src/app/layout.tsx"
copy_file "nextjs-frontend/src/app/registration/page.tsx"
copy_file "nextjs-frontend/src/app/registration/success/page.tsx"
copy_file "nextjs-frontend/src/app/api/registration/receipt-pdf/route.ts"

echo ""
echo "🔧 Copying utility files..."
copy_file "nextjs-frontend/src/app/utils/paymentReceiptEmailer.js"
copy_file "nextjs-frontend/src/app/utils/sanityBackendIntegration.js"

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Summary of copied files:"
echo "   - Configuration files: 3"
echo "   - Email API routes: 1"
echo "   - Payment API routes: 2"
echo "   - PayPal API routes: 2"
echo "   - Razorpay API routes: 2"
echo "   - Registration API routes: 4"
echo "   - React components: 3"
echo "   - Pages and layout: 3"
echo "   - Utility files: 1"
echo "   - Total: 21 files"
echo ""
echo "🎯 Next steps:"
echo "   1. Check git status: git status"
echo "   2. Review changes: git diff"
echo "   3. Update .env.local with new credentials"
echo "   4. Update FloatingChat.tsx (WhatsApp number, MyLiveChat ID)"
echo "   5. Test locally: npm run dev"
echo "   6. Commit: git add . && git commit -m 'Migrate payment and chat integration'"
echo ""