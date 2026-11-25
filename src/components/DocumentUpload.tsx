'use client'

import { useState, useCallback, useRef } from 'react'
import { useOptionalWallet } from '@/lib/wallet'
import { CloudArrowUpIcon, EyeIcon, EyeSlashIcon, LockClosedIcon, XMarkIcon } from '@/lib/icons'
import { uploadMultipleDocuments, DocumentMetadata } from '@/lib/ipfs'
import { formatFileSize } from '@/lib/utils'

interface DocumentUploadProps {
  onUpload?: (documents: DocumentMetadata[]) => void
  onError?: (error: string) => void
  multiple?: boolean
  accept?: string
  maxSize?: number // in MB
  className?: string
  allowEncryption?: boolean
  requireEncryption?: boolean
  showPermissions?: boolean
}

export default function DocumentUpload({
  onUpload,
  onError,
  multiple = false,
  accept,
  maxSize = 10,
  className = '',
  allowEncryption = true,
  requireEncryption = false,
  showPermissions = true,
}: DocumentUploadProps) {
  const { address, signMessage } = useOptionalWallet()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [encrypt, setEncrypt] = useState(requireEncryption)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [permissions, setPermissions] = useState({
    public: false,
    allowedUsers: [] as string[],
    allowedRoles: [] as string[],
  })
  const [newUser, setNewUser] = useState('')
  const [newRole, setNewRole] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFiles = Array.from(e.dataTransfer.files)

      if (!multiple) {
        setFiles([droppedFiles[0]].filter(Boolean))
      } else {
        setFiles((prev) => [...prev, ...droppedFiles])
      }
    },
    [multiple]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    // Validate file sizes
    const oversizedFiles = selectedFiles.filter((file) => file.size > maxSize * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      onError?.(
        `Some files exceed the ${maxSize}MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`
      )
      return
    }

    if (!multiple) {
      setFiles([selectedFiles[0]].filter(Boolean))
    } else {
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      onError?.('Please select files to upload')
      return
    }

    if (encrypt && !password.trim()) {
      onError?.('Password is required for encrypted uploads')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const wallet = address && signMessage ? { address, signMessage } : undefined
      const uploadedDocuments = await uploadMultipleDocuments(
        files,
        encrypt,
        password || undefined,
        setUploadProgress,
        wallet
      )

      // Apply permissions to metadata. Unencrypted uploads are always public:
      // there is nothing to reveal to the permission set, and leaving
      // `permissions` undefined marks them closed-by-default (see ipfs.ts).
      const documentsWithPermissions = uploadedDocuments.map((doc) => ({
        ...doc,
        permissions: {
          public: permissions.public,
          allowedUsers: permissions.allowedUsers,
          allowedRoles: permissions.allowedRoles,
        },
      }))

      onUpload?.(documentsWithPermissions)
      setFiles([])
      setPassword('')
      setUploadProgress(0)
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const addAllowedUser = () => {
    if (newUser.trim() && !permissions.allowedUsers.includes(newUser.trim())) {
      setPermissions((prev) => ({
        ...prev,
        allowedUsers: [...prev.allowedUsers, newUser.trim()],
      }))
      setNewUser('')
    }
  }

  const addAllowedRole = () => {
    if (newRole.trim() && !permissions.allowedRoles.includes(newRole.trim())) {
      setPermissions((prev) => ({
        ...prev,
        allowedRoles: [...prev.allowedRoles, newRole.trim()],
      }))
      setNewRole('')
    }
  }

  const removeAllowedUser = (user: string) => {
    setPermissions((prev) => ({
      ...prev,
      allowedUsers: prev.allowedUsers.filter((u) => u !== user),
    }))
  }

  const removeAllowedRole = (role: string) => {
    setPermissions((prev) => ({
      ...prev,
      allowedRoles: prev.allowedRoles.filter((r) => r !== role),
    }))
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        className="border-input relative cursor-pointer rounded-lg border-2 border-dashed p-6 transition-colors hover:border-blue-500 dark:hover:border-blue-400"
      >
        <div className="text-center">
          <CloudArrowUpIcon className="text-muted-foreground mx-auto h-12 w-12" />
          <div className="mt-4">
            <p className="text-muted-foreground text-sm">
              <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span>{' '}
              or drag and drop
            </p>
            <p className="text-muted-foreground text-xs">
              {accept ? `Supported: ${accept}` : 'All file types supported'} • Max {maxSize}MB{' '}
              {multiple ? 'per file' : ''}
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          aria-label={multiple ? 'Choose files to upload' : 'Choose a file to upload'}
          multiple={multiple}
          accept={accept}
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-foreground font-medium">Selected Files ({files.length})</h4>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="bg-muted flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{getFileIcon(file.type)}</span>
                  <div>
                    <p className="text-foreground text-sm font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(file.size)} • {file.type || 'Unknown'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encryption Settings */}
      {allowEncryption && (
        <div className="space-y-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="encrypt"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              disabled={requireEncryption}
              className="border-input h-4 w-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <label
              htmlFor="encrypt"
              className="text-foreground flex items-center space-x-2 text-sm font-medium"
            >
              <LockClosedIcon className="h-4 w-4" />
              <span>Encrypt files</span>
              {requireEncryption && (
                <span className="text-xs text-blue-600 dark:text-blue-400">(Required)</span>
              )}
            </label>
          </div>

          {encrypt && (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Enter encryption password"
                  placeholder="Enter encryption password"
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
              <p className="text-muted-foreground text-xs">
                Choose a strong password. This will be required to decrypt and view the files.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Permissions */}
      {showPermissions && (
        <div className="bg-muted space-y-4 rounded-lg p-4">
          <h4 className="text-foreground font-medium">Access Permissions</h4>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="public"
              checked={permissions.public}
              onChange={(e) => setPermissions((prev) => ({ ...prev, public: e.target.checked }))}
              className="border-input h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="public" className="text-foreground text-sm">
              Allow public access{encrypt ? ' (with password)' : ''}
            </label>
          </div>

          <div className="space-y-2">
            <label htmlFor="allowed-user" className="text-foreground block text-sm font-medium">
              Allowed Users (Addresses)
            </label>
            <div className="flex space-x-2">
              <input
                id="allowed-user"
                type="text"
                placeholder="0x..."
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                className="border-input dark:bg-muted dark:text-foreground flex-1 rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addAllowedUser}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {permissions.allowedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {permissions.allowedUsers.map((user, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {user.slice(0, 8)}...
                    <button
                      onClick={() => removeAllowedUser(user)}
                      className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      aria-label={`Remove user ${user.slice(0, 8)}...`}
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="allowed-role" className="text-foreground block text-sm font-medium">
              Allowed Roles
            </label>
            <div className="flex space-x-2">
              <select
                id="allowed-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="border-input dark:bg-muted dark:text-foreground flex-1 rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select role...</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="member">Member</option>
                <option value="borrower">Borrower</option>
                <option value="lender">Lender</option>
              </select>
              <button
                type="button"
                onClick={addAllowedRole}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {permissions.allowedRoles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {permissions.allowedRoles.map((role, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    {role}
                    <button
                      onClick={() => removeAllowedRole(role)}
                      className="ml-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      aria-label={`Remove role ${role}`}
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="bg-muted h-2 w-full rounded-full">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading || (encrypt && !password.trim())}
        className="flex w-full items-center justify-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <CloudArrowUpIcon className="h-4 w-4" />
            <span>
              Upload{' '}
              {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Files'}
            </span>
          </>
        )}
      </button>
    </div>
  )
}
