# Build Instructions for AutoReminder Windows Application

This document provides detailed instructions for building the AutoReminder Windows executable from source code.

## Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- Windows 10 or 11 (for final build)
- Git

## Development Environment Setup

1. Clone the repository:
```
git clone https://github.com/your-org/autoreminder.git
cd autoreminder
```

2. Install dependencies:
```
npm install
```

3. Start the development environment:
```
npm run dev
```

This will launch the application in development mode with hot reloading.

## Building the Windows Executable

### Option 1: Building Both Installer and Portable Versions

To build both the installer and portable versions:

```
npm run build
```

This will:
1. Build the React application
2. Package the Electron application
3. Create both installer (.exe) and portable (.exe) versions

### Option 2: Building Only the Installer

To build only the installer version:

```
npm run build:installer
```

### Option 3: Building Only the Portable Version

To build only the portable version:

```
npm run build:portable
```

## Build Output

After a successful build, you'll find the output files in the `dist` directory:

- Installer: `dist/AutoReminder-Setup-1.0.0.exe`
- Portable: `dist/AutoReminder-Portable-1.0.0.exe`

## Code Signing (Optional)

For production releases, it's recommended to sign the executables:

1. Obtain a code signing certificate
2. Add the following to electron-builder.json:
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "your-password"
}
```
3. Run the build command

## Troubleshooting

### Common Build Issues

1. **Node version incompatibility**
   - Ensure you're using Node.js 20.x or later
   - Try `nvm use 20` if you have Node Version Manager installed

2. **Missing dependencies**
   - Run `npm install` again
   - Check for errors in the npm log

3. **Build fails with code signing errors**
   - Remove the code signing configuration if you don't have a certificate
   - Check certificate path and password

4. **Electron packager errors**
   - Make sure electron-builder is properly installed
   - Check the electron-builder.json configuration

## Maintaining the Build

### Updating Dependencies

Regularly update dependencies to ensure security and compatibility:

```
npm update
```

### Updating the Application Version

To update the application version:

1. Change the version in package.json
2. Run the build command

This will automatically update the version in the built executables.
