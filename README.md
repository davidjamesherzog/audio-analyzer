# Audio Analyzer (audio-analyzer)

An audo analyzer project that allows you to upload an audio file and split it between the following tracks:

- Vocals
- Drums
- Bass
- Other (guitars and other instruments)

## Native six-stem sidecar

The Electron app's Advanced separation option uses a local Python sidecar to run the native
six-stem Demucs model. It adds dedicated guitar and piano tracks to the four basic stems and writes
only the selected WAV outputs to a local folder; audio is never uploaded to a server.

See the [sidecar setup guide](sidecar/README.md) for supported Python versions, environment setup,
dependencies, and development instructions.

## Install the dependencies

```bash
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev:electron
```

### Lint the files

```bash
npm run lint
```

### Format the files

```bash
npm run format
```

### Build the app for production

```bash
quasar build
```

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
