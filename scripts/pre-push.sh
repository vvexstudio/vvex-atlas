#!/bin/sh

# Pre-push hook to prevent pushing without explicit permission

# Check if PORTAL_ALLOW_PUSH is set to "true" to bypass
if [ "$PORTAL_ALLOW_PUSH" = "true" ]; then
  exit 0
fi

# Try to prompt the user if running interactively
if exec </dev/tty; then
  echo ""
  echo "⚠️  WARNING: You are attempting to push commits to the remote repository."
  echo "Explicit permission from the user is required to push to this project."
  printf "Do you have explicit permission to push? (type 'yes' to proceed): "
  read -r response
  if [ "$response" = "yes" ]; then
    echo "✅ Push permitted by user. Proceeding..."
    exit 0
  else
    echo "❌ Push aborted. User did not confirm permission."
    exit 1
  fi
else
  # Non-interactive fallback
  echo ""
  echo "❌ ERROR: Git push aborted. This repository is configured to never push without explicit permission."
  echo "To allow pushing, run git push with the PORTAL_ALLOW_PUSH=true environment variable set:"
  echo "  PORTAL_ALLOW_PUSH=true git push"
  echo ""
  exit 1
fi
