'use client'

import { useEffect, useState } from 'react'
import {
  DocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@/lib/icons'
import { DocumentMetadata, getIPFSUrl, canAccessDocument } from '@/lib/ipfs'
import { useDocumentContent } from '@/hooks/useDocument'
import { formatFileSize } from '@/lib/utils'

interface DocumentViewerProps {
  doc: DocumentMetadata
  userAddress: string
  userRoles?: string[]
  onClose?: () => void
  onError?: (error: string) => void
  className?: string
}

export default function DocumentViewer({
  doc,
  userAddress,
  userRoles = [],
  onClose,
  onError,
  className = '',
}: DocumentViewerProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Check if user has access
  const hasAccess = canAccessDocument(doc, userAddress, userRoles)

  const {
    content,
    loading,
    error: loadError,
    decrypted,
    previewUrl,
    decrypt,
  } = useDocumentContent(doc, userAddress, userRoles)
  const error = passwordError || loadError

  useEffect(() => {
    if (loadError) onError?.(loadError)
  }, [loadError, onError])

  const handleDecrypt = () => {
    if (!password.trim()) {
      setPasswordError('Password is required to decrypt this doc')
      return
    }
    setPasswordError('')
    decrypt(password)
  }

  const downloadDocument = () => {
    if (!content) return

    const blob = new Blob([new Uint8Array(content)], { type: doc.type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = doc.name
    link.click()
    URL.revokeObjectURL(url)
  }

  const shareDocument = async () => {
    if (navigator.share && previewUrl) {
      try {
        await navigator.share({
          title: doc.name,
          text: `Document: ${doc.name}`,
          url: previewUrl,
        })
      } catch {
        // Fallback to clipboard
        copyToClipboard()
      }
    } else {
      copyToClipboard()
    }
  }

  const copyToClipboard = () => {
    const url = getIPFSUrl(doc.hash)
    navigator.clipboard.writeText(url).then(() => {
      // Show success message
      const originalText = 'Share'
      const button = document.querySelector('[data-share-button]') as HTMLButtonElement
      if (button) {
        button.textContent = 'Copied!'
        setTimeout(() => {
          button.textContent = originalText
        }, 2000)
      }
    })
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.startsWith('video/')) return '🎥'
    if (type.startsWith('audio/')) return '🎵'
    if (type.includes('pdf')) return '📄'
    if (type.includes('text')) return '📝'
    if (type.includes('zip') || type.includes('rar')) return '📦'
    return '📁'
  }

  const canPreview = (type: string) => {
    return (
      type.startsWith('image/') ||
      type.startsWith('text/') ||
      type.includes('pdf') ||
      type.startsWith('video/') ||
      type.startsWith('audio/')
    )
  }

  const renderPreview = () => {
    if (!previewUrl || !content) return null

    if (doc.type.startsWith('image/')) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a blob: URL (URL.createObjectURL) which next/image cannot optimize; using <img> with explicit dimensions and lazy-loading to avoid layout shift
        <img
          src={previewUrl}
          alt={doc.name}
          width={800}
          height={600}
          loading="lazy"
          decoding="async"
          style={{ maxWidth: '100%', height: 'auto', maxHeight: '24rem' }}
          className="mx-auto rounded-lg shadow-lg"
        />
      )
    }

    if (doc.type.startsWith('text/')) {
      const text = new TextDecoder().decode(content)
      return (
        <div className="bg-muted max-h-96 overflow-auto rounded-lg p-4">
          <pre className="text-foreground text-sm whitespace-pre-wrap">
            {text.slice(0, 5000)}
            {text.length > 5000 && '...'}
          </pre>
        </div>
      )
    }

    if (doc.type.includes('pdf')) {
      return (
        <iframe
          src={previewUrl}
          className="border-input h-96 w-full rounded-lg border"
          title={doc.name}
        />
      )
    }

    if (doc.type.startsWith('video/')) {
      return (
        <video
          src={previewUrl}
          controls
          className="mx-auto max-h-96 max-w-full rounded-lg shadow-lg"
          aria-label={doc.name}
        >
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      )
    }

    if (doc.type.startsWith('audio/')) {
      return (
        <audio src={previewUrl} controls className="w-full" aria-label={doc.name}>
          <track kind="captions" />
          Your browser does not support the audio tag.
        </audio>
      )
    }

    return null
  }

  if (!hasAccess) {
    return (
      <div className={`bg-card rounded-lg p-6 shadow-lg ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground flex items-center text-lg font-semibold">
            <ExclamationTriangleIcon className="mr-2 h-5 w-5 text-red-500" />
            Access Denied
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this document. Contact the document owner for
          access.
        </p>
      </div>
    )
  }

  return (
    <div className={`bg-card rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b p-6">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getFileIcon(doc.type)}</span>
          <div>
            <h3 className="text-foreground text-lg font-semibold">{doc.name}</h3>
            <div className="text-muted-foreground flex items-center space-x-4 text-sm">
              <span>{formatFileSize(doc.size)}</span>
              <span>{doc.uploadedAt.toLocaleDateString()}</span>
              {doc.encrypted && (
                <div className="flex items-center space-x-1">
                  <LockClosedIcon className="h-4 w-4" />
                  <span>Encrypted</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {content && (
            <>
              <button
                onClick={downloadDocument}
                className="text-muted-foreground hover:text-foreground p-2"
                title="Download"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
              <button
                onClick={shareDocument}
                data-share-button
                className="text-muted-foreground hover:text-foreground p-2"
                title="Share"
              >
                <ShareIcon className="h-5 w-5" />
              </button>
            </>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground p-2"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Encryption/Decryption Interface */}
        {doc.encrypted && !decrypted && (
          <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="mb-3 flex items-center space-x-2">
              <LockClosedIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                This doc is encrypted
              </span>
            </div>
            <p className="mb-4 text-sm text-blue-700 dark:text-blue-300">
              Enter the password to decrypt and view the doc content.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleDecrypt()
              }}
              className="flex space-x-2"
            >
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Enter decryption password"
                  placeholder="Enter decryption password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <EyeIcon className="text-muted-foreground h-4 w-4" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={!password.trim() || loading}
                className="flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <LockOpenIcon className="h-4 w-4" />
                )}
                <span>Decrypt</span>
              </button>
            </form>
          </div>
        )}

        {/* Success message for decrypted content */}
        {decrypted && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <div className="flex items-center space-x-2">
              <LockOpenIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Document decrypted successfully
              </span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <span className="text-muted-foreground ml-3">Loading document...</span>
          </div>
        )}

        {/* Content preview */}
        {content && !loading && (
          <div className="space-y-4">
            {canPreview(doc.type) ? (
              <div className="space-y-4">
                <h4 className="text-foreground font-medium">Preview</h4>
                {renderPreview()}
              </div>
            ) : (
              <div className="bg-muted rounded-lg py-12 text-center">
                <DocumentIcon className="text-muted-foreground mx-auto h-12 w-12" />
                <p className="text-muted-foreground mt-4 text-sm">
                  Preview not available for this file type
                </p>
                <button
                  onClick={downloadDocument}
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Download to View
                </button>
              </div>
            )}
          </div>
        )}

        {/* Document metadata */}
        {!loading && (
          <div className="border-border mt-6 border-t pt-4">
            <h4 className="text-foreground mb-3 font-medium">Document Information</h4>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-foreground font-medium">Type</dt>
                <dd className="text-muted-foreground">{doc.type || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Size</dt>
                <dd className="text-muted-foreground">{formatFileSize(doc.size)}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Uploaded</dt>
                <dd className="text-muted-foreground">{doc.uploadedAt.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">IPFS Hash</dt>
                <dd className="text-muted-foreground font-mono text-xs break-all">{doc.hash}</dd>
              </div>
              {doc.tags && doc.tags.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-foreground font-medium">Tags</dt>
                  <dd className="text-muted-foreground">
                    <div className="mt-1 flex flex-wrap gap-2">
                      {doc.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-muted text-foreground rounded px-2 py-1 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
