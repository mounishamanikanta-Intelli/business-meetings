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
        local dest_dir

        # Get destination directory
        dest_dir="$(dirname "$dest")"

        # Create destination directory if missing
        if [ ! -d "$dest_dir" ]; then
            mkdir -p "$dest_dir"
            echo "📁 Created directory: $dest_dir"
        fi

        # If source exists, copy it
        if [ -f "$source" ]; then
            # Create destination file if missing
            if [ ! -f "$dest" ]; then
                touch "$dest"
                echo "🆕 Created file: $file"
            fi

            cp "$source" "$dest"
            echo "✅ Copied: $file"
        else
            # Source missing → create empty file anyway
            if [ ! -f "$dest" ]; then
                touch "$dest"
                echo "⚠️  Source missing. Created empty file: $file"
            else
                echo "⚠️  Source missing. File already exists: $file"
            fi
        fi
    }

    echo ""
    echo ""
    echo "💰 Copying Redis Caching routes "
    copy_file "SanityBackend/components/ScientificProgramTableView.js"
    copy_file "SanityBackend/deskStructure.js"
    copy_file "SanityBackend/schemaTypes/index.ts"
    copy_file "SanityBackend/schemaTypes/scientificProgramDownload.ts"
    copy_file "SanityBackend/schemaTypes/scientificProgramSettings.ts"
    copy_file "nextjs-frontend/src/app/api/scientific-program/download/route.ts"
    copy_file "nextjs-frontend/src/app/api/scientific-program/submit/route.ts"
    copy_file "nextjs-frontend/src/app/components/HeroSlideshow.tsx"
    copy_file "nextjs-frontend/src/app/page.tsx"
    copy_file "nextjs-frontend/src/app/scientific-program/ScientificProgramForm.tsx"
    copy_file "nextjs-frontend/src/app/scientific-program/page.tsx"
    copy_file "nextjs-frontend/src/app/types/brochure.ts"





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