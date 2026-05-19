// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for Firebase v10 "Component auth has not been registered yet" on mobile
config.resolver.sourceExts.push('cjs');

// Disable package exports to force Metro to resolve react-native fields properly for Firebase
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
