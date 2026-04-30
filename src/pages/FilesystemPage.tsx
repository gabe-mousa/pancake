import React, { useState, useRef } from 'react'
import type { VirtualFile } from '../types'

const FS_SERVER = 'http://127.0.0.1:4174'

interface Props {
  virtualFsFiles: VirtualFile[]
  onAddFiles: (files: VirtualFile[]) => void
  onRemoveFile: (name: string) => void
  fsRoot: string
  onFsRootChange: (root: string) => void
  pancakeEnabled: boolean
  onPancakeToggle: () => void
  localEnabled: boolean
  onLocalToggle: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeLabel(type: string, name: string): string {
  if (type.startsWith('image/')) return 'img'
  if (type.startsWith('video/')) return 'vid'
  if (type.startsWith('audio/')) return 'aud'
  if (type === 'application/pdf') return 'pdf'
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext) return ext
  return 'file'
}

async function readFileAsVirtualFile(file: File, nameOverride?: string): Promise<VirtualFile> {
  const isBinary = await new Promise<boolean>(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const buf = e.target?.result as ArrayBuffer
      const bytes = new Uint8Array(buf.slice(0, 8192))
      resolve(bytes.includes(0))
    }
    reader.readAsArrayBuffer(file.slice(0, 8192))
  })

  const content = await new Promise<string>(resolve => {
    const reader = new FileReader()
    if (isBinary) {
      reader.onload = e => resolve((e.target?.result as string).split(',')[1] ?? '')
      reader.readAsDataURL(file)
    } else {
      reader.onload = e => resolve(e.target?.result as string ?? '')
      reader.readAsText(file)
    }
  })

  return {
    name: nameOverride ?? file.name,
    size: file.size,
    type: file.type,
    content,
    isBinary,
    addedAt: Date.now(),
  }
}

// Recursively collect all files from a FileSystemEntry, preserving relative paths
async function collectEntryFiles(entry: FileSystemEntry, prefix = ''): Promise<{ file: File; path: string }[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    return [{ file, path: prefix + entry.name }]
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const allEntries: FileSystemEntry[] = []
    await new Promise<void>((resolve, reject) => {
      function readBatch() {
        reader.readEntries(batch => {
          if (batch.length === 0) { resolve(); return }
          allEntries.push(...batch)
          readBatch()
        }, reject)
      }
      readBatch()
    })
    const results = await Promise.all(
      allEntries.map(e => collectEntryFiles(e, prefix + entry.name + '/'))
    )
    return results.flat()
  }
  return []
}

// ── Virtual filesystem tree builder ───────────────────────────────────────────

interface TreeNode {
  name: string
  path: string       // full path from root
  file?: VirtualFile // present for leaf nodes
  children: Map<string, TreeNode>
  isOpen: boolean
}

function buildTree(files: VirtualFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map(), isOpen: true }
  for (const f of files) {
    const parts = f.name.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const path = parts.slice(0, i + 1).join('/')
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, path, children: new Map(), isOpen: true })
      }
      node = node.children.get(part)!
      if (i === parts.length - 1) node.file = f
    }
  }
  return root
}

function downloadVirtualFile(file: VirtualFile) {
  let url: string
  if (file.isBinary) {
    const mime = file.type || 'application/octet-stream'
    const byteChars = atob(file.content)
    const byteArr = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
    url = URL.createObjectURL(new Blob([byteArr], { type: mime }))
  } else {
    url = URL.createObjectURL(new Blob([file.content], { type: file.type || 'text/plain' }))
  }
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

// ── Pancake's Filesystem section ──────────────────────────────────────────────

function PancakeFilesystem({ files, onAddFiles, onRemoveFile, enabled, onToggle }: {
  files: VirtualFile[]
  onAddFiles: (files: VirtualFile[]) => void
  onRemoveFile: (name: string) => void
  enabled: boolean
  onToggle: () => void
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [previewFile, setPreviewFile] = useState<VirtualFile | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function processFileEntries(rawFiles: { file: File; path: string }[]) {
    const parsed = await Promise.all(rawFiles.map(({ file, path }) => readFileAsVirtualFile(file, path)))

    const existingKeys = new Set(files.map(f => `${f.name}:${f.size}`))
    const dupes = parsed.filter(f => existingKeys.has(`${f.name}:${f.size}`))
    const toAdd = parsed.filter(f => !existingKeys.has(`${f.name}:${f.size}`))

    if (dupes.length > 0) {
      setDuplicateWarning(`Skipped ${dupes.length} duplicate file${dupes.length > 1 ? 's' : ''}: ${dupes.map(f => f.name).join(', ')}`)
      setTimeout(() => setDuplicateWarning(null), 4000)
    }
    if (toAdd.length > 0) onAddFiles(toAdd)
  }

  async function processFileList(rawFiles: FileList | File[]) {
    const arr = Array.from(rawFiles)
    const entries = arr.map(f => ({
      file: f,
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }))
    await processFileEntries(entries)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDraggingOver(true)
  }
  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDraggingOver(false)

    // Use DataTransferItem API to handle folders recursively
    const items = Array.from(e.dataTransfer.items)
    const entries = items
      .map(item => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => entry != null)

    if (entries.length > 0) {
      const collected = (await Promise.all(entries.map(entry => collectEntryFiles(entry)))).flat()
      await processFileEntries(collected)
    } else if (e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files)
    }
  }

  function onFilePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files)
      e.target.value = ''
    }
  }

  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())

  function toggleFolder(path: string) {
    setClosedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    const sortedChildren = [...node.children.entries()].sort(([, a], [, b]) => {
      // Folders before files, then alphabetically
      const aIsDir = a.file === undefined
      const bIsDir = b.file === undefined
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return sortedChildren.map(([, child]) => {
      const isDir = child.file === undefined
      const isClosed = closedFolders.has(child.path)
      const indent = depth * 16

      if (isDir) {
        return (
          <div key={child.path}>
            <div
              className="fs-tree-row fs-tree-dir-row"
              style={{ paddingLeft: `${10 + indent}px` }}
            >
              <button className="fs-tree-dir-toggle" onClick={() => toggleFolder(child.path)}>
                {isClosed ? '▶' : '▼'}
              </button>
              <span className="fs-tree-dir-icon">dir</span>
              <span className="fs-tree-dir-name">{child.name}</span>
            </div>
            {!isClosed && (
              <div className="fs-tree-dir-children">
                {renderNode(child, depth + 1)}
              </div>
            )}
          </div>
        )
      }

      const f = child.file!
      return (
        <div key={child.path}>
          <div
            className={`fs-tree-row${previewFile?.name === f.name ? ' fs-tree-row-active' : ''}`}
            style={{ paddingLeft: `${10 + indent}px` }}
          >
            <span className="fs-tree-type-badge">{fileTypeLabel(f.type, f.name)}</span>
            <button
              className="fs-tree-name"
              onClick={() => setPreviewFile(previewFile?.name === f.name ? null : f)}
              title={f.isBinary ? 'Binary file — no text preview' : 'Click to preview'}
              disabled={f.isBinary}
            >
              {child.name}
            </button>
            <span className="fs-tree-size">{formatBytes(f.size)}</span>
            <div className="fs-tree-actions">
              <button
                className="fs-tree-action"
                onClick={() => downloadVirtualFile(f)}
                title="Download"
              >
                dl
              </button>
              <button
                className="fs-tree-action fs-tree-action-remove"
                onClick={() => { onRemoveFile(f.name); if (previewFile?.name === f.name) setPreviewFile(null) }}
                title="Remove from Pancake's Filesystem"
              >
                rm
              </button>
            </div>
          </div>
          {previewFile?.name === f.name && !f.isBinary && (
            <div className="fs-preview" style={{ marginLeft: `${10 + indent}px` }}>
              <div className="fs-preview-header">
                <span>{f.name}</span>
                <button onClick={() => setPreviewFile(null)}>close</button>
              </div>
              <pre className="fs-preview-body">{f.content}</pre>
            </div>
          )}
        </div>
      )
    })
  }

  const tree = buildTree(files)

  return (
    <div className="fs-card">
      <div className="fs-section-header">
        <button
          className={`fs-toggle-btn${enabled ? ' fs-toggle-btn-on' : ''}`}
          onClick={onToggle}
        >
          <span className="fs-toggle-indicator">{enabled ? '●' : '○'}</span>
          <span className="fs-toggle-label">Pancake's Filesystem</span>
        </button>
        <p className="fs-section-subtitle">
          A private virtual filesystem inside the app. Files live here until you remove them — nothing is written to your machine.
        </p>
      </div>

      {enabled && (
        <div className="fs-section-body">
          {duplicateWarning && (
            <div className="fs-warning-banner">{duplicateWarning}</div>
          )}

          {/* Drop zone — click anywhere inside or drag files/folders */}
          <div
            className={`fs-dropzone${isDraggingOver ? ' fs-dropzone-active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <span className="fs-dropzone-text">
              {isDraggingOver ? 'Drop to add' : 'Drag & drop files or folders here, or click to upload'}
            </span>
          </div>

          <div className="fs-toolbar">
            <button className="fs-upload-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
              Upload files
            </button>
            {files.length > 0 && (
              <span className="fs-file-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            style={{ display: 'none' }}
            onChange={onFilePickerChange}
          />

          {/* Tree view */}
          {files.length === 0 ? (
            <p className="fs-empty-state">No files yet — drag some in or click "Upload files"</p>
          ) : (
            <div className="fs-tree">
              <div className="fs-tree-root-label">
                <span className="fs-tree-root-icon">root</span>
                / (virtual root)
              </div>
              {renderNode(tree, 0)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Local Filesystem section ──────────────────────────────────────────────────

function LocalFilesystem({ fsRoot, onFsRootChange, enabled, onToggle }: {
  fsRoot: string
  onFsRootChange: (root: string) => void
  enabled: boolean
  onToggle: () => void
}) {
  const [pathInput, setPathInput] = useState(fsRoot)
  const [resolvedRoot, setResolvedRoot] = useState(fsRoot)
  const [error, setError] = useState<string | null>(null)
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null)

  async function checkServer() {
    try {
      const res = await fetch(`${FS_SERVER}/health`)
      if (res.ok) {
        const data = await res.json()
        setResolvedRoot(data.root ?? '')
        setPathInput(data.root ?? '')
        onFsRootChange(data.root ?? '')
        setServerAvailable(true)
      } else {
        setServerAvailable(false)
      }
    } catch {
      setServerAvailable(false)
    }
  }

  function handleToggle() {
    onToggle()
    if (!enabled) checkServer()
  }

  async function commitRoot() {
    const trimmed = pathInput.trim()
    if (!trimmed) return
    setError(null)
    try {
      const res = await fetch(`${FS_SERVER}/fs/set-root`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to set root')
        return
      }
      setResolvedRoot(data.resolved)
      onFsRootChange(data.resolved)
      localStorage.setItem('pancake_fs_root', data.resolved)
    } catch {
      setError('Cannot reach the FS server. Use npm run dev or npm start to start it.')
    }
  }

  const isSensitive = resolvedRoot === '/' || resolvedRoot === (window as unknown as { __HOME__?: string }).__HOME__

  return (
    <div className="fs-card">
      <div className="fs-section-header">
        <button
          className={`fs-toggle-btn${enabled ? ' fs-toggle-btn-on' : ''}`}
          onClick={handleToggle}
        >
          <span className="fs-toggle-indicator">{enabled ? '●' : '○'}</span>
          <span className="fs-toggle-label">Local Filesystem</span>
        </button>
        <p className="fs-section-subtitle">
          Give the agent access to a directory on your actual machine. Changes made here affect real files on disk.
        </p>
      </div>

      {enabled && (
        <div className="fs-section-body">
          {serverAvailable === false && (
            <div className="fs-error-banner">
              FS server not available. Run <code>npm run dev</code> during development, or <code>npm start</code> in production, to start the local filesystem server.
            </div>
          )}

          {serverAvailable !== false && (
            <>
              <div className="fs-root-row">
                <input
                  className="fs-root-input"
                  type="text"
                  value={pathInput}
                  placeholder="Enter absolute path, e.g. /Users/alice/project"
                  onChange={e => setPathInput(e.target.value)}
                  onBlur={commitRoot}
                  onKeyDown={e => e.key === 'Enter' && commitRoot()}
                />
              </div>
              {resolvedRoot && (
                <p className="fs-resolved-root">Active root: <code>{resolvedRoot}</code></p>
              )}
              {isSensitive && resolvedRoot && (
                <div className="fs-warning-banner fs-warning-danger">
                  Warning: The root is set to "{resolvedRoot}" — this gives the agent very broad filesystem access. Consider using a project subdirectory.
                </div>
              )}
              {error && (
                <div className="fs-error-banner">{error}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function FilesystemPage({ virtualFsFiles, onAddFiles, onRemoveFile, fsRoot, onFsRootChange, pancakeEnabled, onPancakeToggle, localEnabled, onLocalToggle }: Props) {
  return (
    <div className="filesystem-page">
      <div className="filesystem-page-header">
        <h1>Filesystem</h1>
        <p className="filesystem-page-desc">
          Manage the files your agent sessions can access. Two independent systems — Pancake's virtual filesystem lives in the app; Local filesystem bridges to your real machine.
        </p>
      </div>

      <PancakeFilesystem
        files={virtualFsFiles}
        onAddFiles={onAddFiles}
        onRemoveFile={onRemoveFile}
        enabled={pancakeEnabled}
        onToggle={onPancakeToggle}
      />

      <LocalFilesystem
        fsRoot={fsRoot}
        onFsRootChange={onFsRootChange}
        enabled={localEnabled}
        onToggle={onLocalToggle}
      />
    </div>
  )
}
