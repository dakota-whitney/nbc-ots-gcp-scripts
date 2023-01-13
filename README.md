# **NBC Google Cloud Platform Scripts**
## This repo contains all NBC OTS automation scripts written for and deployed with Google Cloud Platform
## GCP Services Used:
* Cloud Functions for Firebase: https://firebase.google.com/docs/functions
* Google Apps Script: https://developers.google.com/apps-script/overview
## Projects:
* **MSL4 Active Alerting**: This automation leverages Akamai's Node.js library and Firebase Functions to fetch encoder ingest usage for all NBC OTS markets and send a daily usage report to stakeholders for billing management.
* **Vendor Status**: This is an automation concept for an OTS 3rd party vendor status monitoring service. This POC leverages publicly published vendor XML status feeds, and Google Apps Script's time-driven triggers and native XML parser, to send live vendor status alerts to stakeholders through Slack and Gmail.
* **App Releases**: This is a POC for an app release automation concept that leverages a combination of a browser extension with an Apps Script web app. This extension fetches app store metadata from a shared Google Spreadsheet through Apps Script, and autofills the metadata on app store front-ends Apple, Android, and Roku. The autofill provides a means of visual verification of metadata for each app release.