# Clasp Integration for Portal Sync

This directory handles Apps Script code deployment via clasp.

## Instructions:
1. Install clasp globally:
   `npm install -g @google/clasp`
2. Enable the Google Apps Script API:
   https://script.google.com/home/usersettings
3. Authenticate:
   `clasp login`
4. Set scriptId in the `.clasp.json` at the root.
5. Push changes:
   `clasp push`
