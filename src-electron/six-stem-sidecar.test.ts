import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  spawn: vi.fn(),
}))

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('node:fs/promises', () => ({ access: mocks.access, mkdir: mocks.mkdir }))

import {
  resolveSidecarDirectory,
  runSixStemSidecar,
  type SixStemName,
} from './six-stem-sidecar'

function createChildProcess(exitCode: number | null = 0, stdoutText = '', stderrText = '') {
  const childListeners = new Map<string, (value: unknown) => void>()
  const stdoutListeners = new Map<string, (value: string) => void>()
  const stderrListeners = new Map<string, (value: string) => void>()
  const child = {
    stdout: {
      setEncoding: vi.fn(),
      on: vi.fn((event: string, listener: (value: string) => void) => {
        stdoutListeners.set(event, listener)
      }),
    },
    stderr: {
      setEncoding: vi.fn(),
      on: vi.fn((event: string, listener: (value: string) => void) => {
        stderrListeners.set(event, listener)
      }),
    },
    on: vi.fn((event: string, listener: (value: unknown) => void) => {
      childListeners.set(event, listener)
      if (event === 'close' && exitCode !== null) {
        queueMicrotask(() => {
          stdoutListeners.get('data')?.(stdoutText)
          stderrListeners.get('data')?.(stderrText)
          listener(exitCode)
        })
      }
    }),
  }
  return { child, childListeners }
}

const options = {
  inputPath: '/music/song.wav',
  outputDirectory: '/music/stems',
  pythonExecutable: '/project/sidecar/.venv/bin/python',
  scriptPath: '/project/sidecar/separate_6stems.py',
  stemNames: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'] as SixStemName[],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue(undefined)
  mocks.mkdir.mockResolvedValue(undefined)
})

describe('runSixStemSidecar', () => {
  test('resolves development and packaged sidecar directories', () => {
    const baseOptions = {
      processWorkingDirectory: '/project',
      resourcesPath: '/Applications/Audio Analyzer.app/Contents/Resources',
    }

    expect(resolveSidecarDirectory({ ...baseOptions, isDevelopment: true })).toBe(
      '/project/sidecar',
    )
    expect(resolveSidecarDirectory({ ...baseOptions, isDevelopment: false })).toBe(
      '/Applications/Audio Analyzer.app/Contents/Resources/sidecar',
    )
  })

  test('runs the helper without a shell and returns its output directory', async () => {
    const { child } = createChildProcess(0, 'complete\n')
    mocks.spawn.mockReturnValue(child)

    await expect(runSixStemSidecar(options)).resolves.toEqual({
      outputDirectory: '/music/stems',
      stderr: '',
      stdout: 'complete\n',
    })
    expect(mocks.mkdir).toHaveBeenCalledWith('/music/stems', { recursive: true })
    expect(mocks.spawn).toHaveBeenCalledWith(
      '/project/sidecar/.venv/bin/python',
      [
        '/project/sidecar/separate_6stems.py',
        '/music/song.wav',
        '/music/stems',
        '--stems',
        'vocals',
        'drums',
        'bass',
        'guitar',
        'piano',
        'other',
      ],
      { shell: false, stdio: ['ignore', 'pipe', 'pipe'] },
    )
  })

  test('accepts MP3 input while retaining WAV support', async () => {
    mocks.spawn.mockReturnValue(createChildProcess().child)

    await runSixStemSidecar({ ...options, inputPath: '/music/song.MP3' })

    expect(mocks.spawn).toHaveBeenCalledWith(
      options.pythonExecutable,
      [
        options.scriptPath,
        '/music/song.MP3',
        options.outputDirectory,
        '--stems',
        ...options.stemNames,
      ],
      expect.any(Object),
    )
  })

  test('rejects unsupported inputs before starting the helper', async () => {
    await expect(runSixStemSidecar({ ...options, inputPath: '/music/song.flac' })).rejects.toThrow(
      'accepts WAV and MP3 files only',
    )
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  test.each([
    [[], 'at least one valid stem'],
    [['vocals', 'noise'], 'at least one valid stem'],
  ])('rejects an invalid stem selection %#', async (stemNames, expectedMessage) => {
    await expect(
      runSixStemSidecar({ ...options, stemNames: stemNames as SixStemName[] }),
    ).rejects.toThrow(expectedMessage)
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  test('reports helper stderr when the process exits unsuccessfully', async () => {
    mocks.spawn.mockReturnValue(createChildProcess(2, '', 'Python 3.10 is required.').child)

    await expect(runSixStemSidecar(options)).rejects.toThrow('Python 3.10 is required.')
  })

  test('reports process startup failures', async () => {
    const { child, childListeners } = createChildProcess(null)
    mocks.spawn.mockReturnValue(child)
    const promise = runSixStemSidecar(options)

    await vi.waitFor(() => expect(childListeners.has('error')).toBe(true))
    childListeners.get('error')?.(new Error('ENOENT'))

    await expect(promise).rejects.toThrow('could not start: ENOENT')
  })
})
