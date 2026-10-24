# Native six-stem proof of concept

This development-only helper separates one local WAV or MP3 into drums, bass, other, vocals,
guitar, and piano using native ONNX Runtime. Audio remains on the local machine, and the six output
stems are written as WAV files.

Python 3.10–3.13 is supported on platforms with matching ONNX Runtime wheels. On an Intel Mac, use
Python 3.10 because the dependency file pins the last ONNX Runtime release with a compatible
universal macOS wheel.

# Install `pyenv`

Install `pyenv` via Homebrew

```bash
brew install pyenv
```

Put `pyenv` in your $PATH

```bash
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
```

Install Python 3.10.13

```bash
pyenv install 3.10.13
```

Set current version to 3.10.13
```bash
pyenv local 3.12.4
```

An existing virtual environment keeps the interpreter it was originally created with. If
`sidecar/.venv` already exists, remove it before recreating it. From the repository root:

```bash
rm -rf sidecar/.venv
python -m venv sidecar/.venv
sidecar/.venv/bin/python --version
sidecar/.venv/bin/python -m pip install --upgrade pip setuptools wheel
sidecar/.venv/bin/python -m pip install -r sidecar/requirements.txt
npm run dev:electron
```

The version check must print Python 3.10.x before continuing. If `python3.10` is managed by pyenv and
is not available in the current shell, select it first:

```bash
pyenv local 3.10.13
python3.10 --version
```

The Intel macOS pin is conditional, so Apple silicon, Linux, and Windows continue to use the ONNX
Runtime version selected by `demucs-onnx`.

In the Electron app, choose **Advanced · 6 stems**, select the tracks to create, select **Separate 6
stems**, choose one WAV or MP3, and choose an output directory. The first run downloads and caches
the model. You can override the interpreter with
`AUDIO_ANALYZER_PYTHON=/absolute/path/to/python`.

This milestone intentionally does not include progress, cancellation, or packaging the Python
runtime and model.
