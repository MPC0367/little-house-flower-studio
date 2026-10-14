import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = path.join(root, 'output/macos/Little House Flower.app');
const contents = path.join(app, 'Contents');
const resources = path.join(contents, 'Resources');
const executable = path.join(contents, 'MacOS/LittleHouseFlower');
const iconset = path.join(root, 'native/build/AppIcon.iconset');
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plist = entries => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${Object.entries(entries).map(([key,value]) => `<key>${xml(key)}</key>${typeof value === 'boolean' ? `<${value}/>` : `<string>${xml(value)}</string>`}`).join('')}</dict></plist>\n`;
fs.mkdirSync(resources, {recursive: true});
fs.mkdirSync(path.dirname(executable), {recursive: true});
fs.mkdirSync(iconset, {recursive: true});

for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    await sharp(path.join(root, 'customer/img/original-logo.jpg')).resize(size * scale, size * scale, {fit: 'contain', background: '#f7f6f3'}).png().toFile(path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`));
  }
}
execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'AppIcon.icns')], {stdio: 'inherit'});
const sdk = execFileSync('/usr/bin/xcrun', ['--show-sdk-path'], {encoding: 'utf8'}).trim();
const architecture = process.arch === 'arm64' ? 'arm64' : 'x86_64';
execFileSync('/usr/bin/xcrun', ['swiftc', '-O', '-parse-as-library', '-sdk', sdk, '-target', `${architecture}-apple-macos14.0`, '-framework', 'AppKit', '-framework', 'WebKit', path.join(root, 'native/AdminApp.swift'), '-o', executable], {stdio: 'inherit'});

let info = plist({CFBundleDevelopmentRegion: 'en', CFBundleIdentifier: 'com.littlehouseflower.studio.local', CFBundleName: 'Little House Flower Admin', CFBundleDisplayName: 'Little House Flower Admin', CFBundleExecutable: 'LittleHouseFlower', CFBundlePackageType: 'APPL', CFBundleShortVersionString: '1.0.0', CFBundleVersion: '1', CFBundleIconFile: 'AppIcon', LSMinimumSystemVersion: '14.0', NSHighResolutionCapable: true, NSPrincipalClass: 'NSApplication'});
info = info.replace('</dict></plist>', '<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>');
fs.writeFileSync(path.join(contents, 'Info.plist'), info);
fs.writeFileSync(path.join(resources, 'LocalConfiguration.plist'), plist({WorkspacePath: root, NodePath: process.execPath, AdminURL: 'http://127.0.0.1:5174/#today'}));
fs.writeFileSync(path.join(contents, 'PkgInfo'), 'APPL????');
execFileSync('/usr/bin/plutil', ['-lint', path.join(contents, 'Info.plist'), path.join(resources, 'LocalConfiguration.plist')], {stdio: 'inherit'});
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app], {stdio: 'inherit'});
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], {stdio: 'inherit'});
console.log(`Built and verified local macOS app:\n${app}\nThis build does not launch, install, publish or deploy the app.`);
