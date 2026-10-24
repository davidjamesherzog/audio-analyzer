#!/usr/bin/env python3
"""Electron proof of concept: separate one local WAV or MP3 into six HTDemucs stems."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Path to one local WAV or MP3 file")
    parser.add_argument("output", type=Path, help="Directory that will receive the six WAV stems")
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    input_path = arguments.input.expanduser().resolve()
    output_directory = arguments.output.expanduser().resolve()

    if sys.version_info < (3, 10):
        print("The six-stem helper requires Python 3.10 or newer.", file=sys.stderr)
        return 2
    if input_path.suffix.lower() not in {".mp3", ".wav"} or not input_path.is_file():
        print(f"Input must be an existing WAV or MP3 file: {input_path}", file=sys.stderr)
        return 2

    try:
        from demucs_onnx import separate
    except ImportError:
        print(
            "demucs-onnx is not installed. Follow sidecar/README.md to create the sidecar environment.",
            file=sys.stderr,
        )
        return 2

    output_directory.mkdir(parents=True, exist_ok=True)
    print(f"Separating {input_path.name} into {output_directory}", flush=True)
    separate(
        str(input_path),
        str(output_directory),
        model="htdemucs_6s",
        precision="fp16weights",
        output_format="wav",
    )
    print("Six-stem separation complete.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
