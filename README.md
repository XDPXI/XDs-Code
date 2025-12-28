---

<h1 align="center">XD's Code</h1>
<h4 align="center">XD's Code is a code editor that is inspired by VSC.</h4>

---

# Installing

## macOS

### Homebrew

```bash
brew tap XDPXI/tap && brew install --cask xds-code
```

### Installer

Download the dmg for your version from [releases](https://github.com/XDPXI/XDs-Code/releases/latest)

## Windows

### Winget

```bash
winget install xdpxi.xds-code
```

### Installer

Download the installer or zip from [releases](https://github.com/XDPXI/XDs-Code/releases/latest)

---

# Building from Source

## App

1. Clone the repository:

   ```bash
   git clone https://github.com/XDPXI/XDs-Code.git -b main
   ```

2. Navigate to the project directory:

   ```bash
   cd XDs-Code
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Build the project:

   ```bash
   bun run build
   ```

## Website

1. Clone the repository:

   ```bash
   git clone https://github.com/XDPXI/XDs-Code.git -b 0.6
   ```

2. Navigate to the project directory:

   ```bash
   cd XDs-Code
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Build the project:

   ```bash
   bun run build:site
   ```

---
