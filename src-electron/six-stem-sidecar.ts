import { spawn } from 'node:child_process'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'

export interface SixStemSidecarOptions {
  inputPath: string
  outputDirectory: string
  pythonExecutable: string
  scriptPath: string
}

export interface SixStemSidecarResult {
  outputDirectory: string
  stderr: string
  stdout: string
}

export interface SidecarDirectoryOptions {
  isDevelopment: boolean
  processWorkingDirectory: string
  resourcesPath: string
}

export function resolveSidecarDirectory(options: SidecarDirectoryOptions): string {
  return options.isDevelopment
    ? path.join(options.processWorkingDirectory, 'sidecar')
    : path.join(options.resourcesPath, 'sidecar')
}

export async function runSixStemSidecar(
  options: SixStemSidecarOptions,
): Promise<SixStemSidecarResult> {
  const supportedExtensions = new Set(['.mp3', '.wav'])
  if (!supportedExtensions.has(path.extname(options.inputPath).toLowerCase())) {
    throw new Error('Advanced six-stem separation accepts WAV and MP3 files only.')
  }

  await Promise.all([access(options.inputPath), access(options.scriptPath)])
  await mkdir(options.outputDirectory, { recursive: true })

  return new Promise((resolve, reject) => {
    const child = spawn(
      options.pythonExecutable,
      [options.scriptPath, options.inputPath, options.outputDirectory],
      { shell: false, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      reject(new Error(`The native six-stem helper could not start: ${error.message}`))
    })
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve({ outputDirectory: options.outputDirectory, stderr, stdout })
        return
      }

      reject(
        new Error(
          stderr.trim() ||
            stdout.trim() ||
            `The native six-stem helper exited with code ${String(exitCode)}.`,
        ),
      )
    })
  })
}
