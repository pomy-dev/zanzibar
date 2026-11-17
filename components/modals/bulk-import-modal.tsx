
'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

import { Member, UserRole } from '@/lib/types'
import { getAllBranches } from '@/services/branch-service'
import { useAuth } from '@/lib/auth-context'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface BulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (members: Partial<Member>[]) => void | Promise<void>
  isLoading?: boolean
  branchId?: string
}

interface Branch {
  id: string
  name: string
}

interface ParsedMember {
  member_id: string
  name: string
  email: string
  phone: string
  gender: 'Male' | 'Female' | 'Other'
  dob: string
  workplace: string
  address: string
  next_of_kin: string
  next_of_kin_phone: string
  branch_name: string
  branch_id: string
  error?: string
}

export function BulkImportModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  branchId,
}: BulkImportModalProps) {

  const { user } = useAuth()

  const [branches, setBranches] = useState<Branch[]>([])
  const [preview, setPreview] = useState<ParsedMember[]>([])
  const [fileName, setFileName] = useState('')
  const [hasValidationErrors, setHasValidationErrors] = useState(false)
  const [isReading, setIsReading] = useState(false)

  const isBranchAdmin = user?.role.toLowerCase() === "Branch Admin".toLowerCase()
  const assignedBranchId = branchId ?? user?.branchId

  // Load branches when modal opens
  useEffect(() => {
    if (open) {
      void fetchBranches()
    }
  }, [open])

  const fetchBranches = async () => {
    try {
      const supabase = getSupabaseBrowserClient()

      if (!supabase) {
        throw new Error('Supabase is not configured.')
      }

      const result = await getAllBranches(supabase)

      const normalized: Branch[] = result.map((branch: any) => ({
        id: branch.id,
        name: branch.branch_name,
      }))

      setBranches(normalized)

    } catch (error) {
      console.error('Error fetching branches:', error)
      alert('Unable to load branches. Please try again.')
    }
  }

  // Normalize column names to support different Excel/CSV headings
  const normalizeHeader = (header: string) => {
    return header
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, '')
  }

  // Find a value using alternative column names
  const getValue = (
    row: Record<string, unknown>,
    ...aliases: string[]
  ): string => {

    for (const alias of aliases) {
      const key = normalizeHeader(alias)

      const foundKey = Object.keys(row).find(
        header => normalizeHeader(header) === key
      )

      if (foundKey !== undefined) {
        const value = row[foundKey]

        if (value !== null && value !== undefined) {
          return String(value).trim()
        }
      }
    }

    return ''
  }

  // Match imported branch name against system branches
  const findBranch = (branchName: string): Branch | undefined => {

    const normalizedName = branchName.trim().toLowerCase()

    if (!normalizedName) return undefined

    const matches = branches.filter(
      branch => branch.name.trim().toLowerCase() === normalizedName
    )

    // Avoid assigning an arbitrary branch if names are duplicated
    return matches.length === 1 ? matches[0] : undefined
  }

  // Convert imported date to YYYY-MM-DD
  const normalizeDate = (value: string): string => {
    if (!value) return ''

    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return date.toISOString().split('T')[0]
  }

  // Read CSV or Excel
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file = e.target.files?.[0]

    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!['csv', 'xlsx', 'xls'].includes(extension ?? '')) {
      alert('Please upload a CSV or Excel file.')
      e.target.value = ''
      return
    }

    if (branches.length === 0) {
      alert('Branches have not loaded. Please wait and try again.')
      e.target.value = ''
      return
    }

    setIsReading(true)
    setFileName(file.name)
    setPreview([])
    setHasValidationErrors(false)

    try {

      const buffer = await file.arrayBuffer()

      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
      })

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

      if (!firstSheet) {
        throw new Error('The uploaded file does not contain a worksheet.')
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        {
          defval: '',
          raw: false,
        }
      )

      if (rows.length === 0) {
        throw new Error('The uploaded file contains no member records.')
      }

      const importedMembers: ParsedMember[] = rows.map((row: any, index: any) => {

        const name = getValue(row, 'name', 'full_name')
        const email = getValue(row, 'email')
        const phone = getValue(row, 'phone')
        const genderValue = getValue(row, 'gender')
        const dob = normalizeDate(
          getValue(row, 'dob', 'dateOfBirth', 'date_of_birth')
        )

        const workplace = getValue(row, 'workplace')
        const address = getValue(
          row,
          'address',
          'physicalAddress',
          'physical_address'
        )

        const nextOfKin = getValue(
          row,
          'nextOfKin',
          'next_of_kin',
          'nextOfKinName'
        )

        const nextOfKinPhone = getValue(
          row,
          'nextOfKinPhone',
          'next_of_kin_phone'
        )

        const importedBranchName = getValue(
          row,
          'branch',
          'branchName',
          'branch_name'
        )

        const memberId = getValue(
          row,
          'memberId',
          'member_id'
        )

        const gender = (
          ['Male', 'Female', 'Other'].find(
            value => value.toLowerCase() === genderValue.toLowerCase()
          ) ?? 'Other'
        ) as 'Male' | 'Female' | 'Other'

        let matchedBranch: Branch | undefined

        const missingFields: string[] = []

        if (!memberId) missingFields.push('Member ID')
        if (!name) missingFields.push('Name')
        if (!email) missingFields.push('Email')
        if (!phone) missingFields.push('Phone')
        if (!genderValue) missingFields.push('Gender')
        if (!dob) missingFields.push('Date of Birth')
        if (!workplace) missingFields.push('Workplace')
        if (!address) missingFields.push('Physical Address')
        if (!nextOfKin) missingFields.push('Next of Kin')
        if (!nextOfKinPhone) missingFields.push('Next of Kin Phone')

        if (!isBranchAdmin && !importedBranchName) {
          missingFields.push('Branch')
        }

        let error = ''

        if (missingFields.length > 0) {
          error = `Missing fields: ${missingFields.join(', ')}`
        }

        if (isBranchAdmin) {

          matchedBranch = branches.find(
            branch => branch.id === assignedBranchId
          )

          if (!matchedBranch) {
            if (!matchedBranch) {
              error = error
                ? `${error} | Your assigned branch could not be identified.`
                : 'Your assigned branch could not be identified.'
            }
          } else if (
            importedBranchName &&
            importedBranchName.toLowerCase().trim() !==
            matchedBranch.name.toLowerCase().trim()
          ) {
            error = `Branch mismatch. This user can only import members into ${matchedBranch.name}.`
          }

        } else if (importedBranchName) {

          const matchingBranches = branches.filter(
            branch =>
              branch.name.toLowerCase().trim() ===
              importedBranchName.toLowerCase().trim()
          )

          if (matchingBranches.length === 0) {
            error = `Branch "${importedBranchName}" does not exist in the system.`
          } else if (matchingBranches.length > 1) {
            error = `Branch "${importedBranchName}" is duplicated in the system.`
          } else {
            matchedBranch = matchingBranches[0]
          }
        }

        return {
          member_id: memberId || `MEM-${Date.now()}-${index + 1}`,
          name,
          email,
          phone,
          gender,
          dob,
          workplace,
          address,
          next_of_kin: nextOfKin,
          next_of_kin_phone: nextOfKinPhone,
          branch_name: importedBranchName || matchedBranch?.name || '',
          branch_id: matchedBranch?.id ?? '',
          error,
        }
      })

      setPreview(importedMembers)

      setHasValidationErrors(
        importedMembers.some(member => !!member.error)
      )

    } catch (error) {

      console.error('Error reading import file:', error)

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to read the uploaded file.'
      )

      setFileName('')

    } finally {
      setIsReading(false)
      e.target.value = ''
    }
  }

  // Import validated members
  const handleSubmit = async () => {

    const validMembers = preview
      .filter(member => !member.error)
      .map(member => ({
        member_id: member.member_id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        gender: member.gender,
        dob: member.dob,
        workplace: member.workplace,
        address: member.address,
        next_of_kin: member.next_of_kin,
        next_of_kin_phone: member.next_of_kin_phone,
        branch_id: member.branch_id,
      }))

    if (validMembers.length === 0) {
      alert('There are no valid members to import.')
      return
    }

    try {
      await onSubmit(validMembers)

      resetForm()
      onOpenChange(false)

    } catch (error) {
      console.error('Error importing members:', error)
    }
  }

  const resetForm = () => {
    setPreview([])
    setFileName('')
    setHasValidationErrors(false)
  }

  const validCount = preview.filter(member => !member.error).length
  const invalidCount = preview.filter(member => !!member.error).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">

        <DialogHeader>
          <DialogTitle>Bulk Import Members</DialogTitle>
        </DialogHeader>

        {preview.length === 0 ? (

          <div className="space-y-4">

            <div className="text-sm text-muted-foreground">

              <p className="mb-2">
                Upload an Excel or CSV file containing member information.
              </p>

              <div className="bg-secondary/50 p-3 rounded-md space-y-2">

                <p className="font-medium">
                  Required columns:
                </p>

                <code className="block text-xs break-words">
                  name, email, phone, branch
                </code>

                <p className="font-medium">
                  Optional columns:
                </p>

                <code className="block text-xs break-words">
                  memberId, gender, dob, workplace, address,
                  nextOfKin, nextOfKinPhone
                </code>

              </div>

              <p className="mt-2 text-xs">
                The branch column must contain a branch name that matches
                a branch registered in the system.
              </p>

            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="member-file-upload"
                disabled={isReading || isLoading}
              />

              <label
                htmlFor="member-file-upload"
                className="cursor-pointer"
              >

                {isReading ? (
                  <div className="flex justify-center items-center gap-2">
                    <Spinner className="w-5 h-5" />
                    <span>Reading file...</span>
                  </div>
                ) : (
                  <>
                    <p className="font-medium mb-1">
                      Click to upload Excel or CSV
                    </p>

                    <p className="text-muted-foreground text-xs">
                      Supported formats: .xlsx, .xls, .csv
                    </p>
                  </>
                )}

              </label>

            </div>

          </div>

        ) : (

          <div className="space-y-4">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <p className="text-sm font-medium">
                {fileName}
              </p>

              <div className="flex flex-wrap gap-2">

                <Badge variant="default">
                  {validCount} Valid
                </Badge>

                <Badge variant={invalidCount > 0 ? 'destructive' : 'secondary'}>
                  {invalidCount} Invalid
                </Badge>

              </div>

            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">

              {preview.map((member, index) => (

                <div
                  key={`${member.member_id}-${index}`}
                  className={`text-sm p-3 rounded-md border ${member.error
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-green-500/50 bg-green-500/10'
                    }`}
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="flex-1 min-w-0">

                      <p className="font-medium">
                        {member.name || 'Unnamed member'}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {member.email} • {member.phone}
                      </p>

                      <p className="text-xs text-muted-foreground mt-1">
                        Branch: {member.branch_name || 'Not specified'}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Member ID: {member.member_id}
                      </p>

                    </div>

                    {member.error && (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        {member.error}
                      </Badge>
                    )}

                    {!member.error && (
                      <Badge variant="default">
                        Valid
                      </Badge>
                    )}

                  </div>

                </div>

              ))}

            </div>

            {hasValidationErrors && (
              <p className="text-sm text-destructive">
                Please correct the invalid records in your file and upload
                it again later importing.
              </p>
            )}

            <div className="flex gap-3 justify-end pt-4">

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={resetForm}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={
                  isLoading ||
                  isReading ||
                  validCount === 0
                }
              >

                {isLoading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Importing...
                  </>
                ) : (
                  `Import ${validCount} Members`
                )}

              </Button>

            </div>

          </div>

        )}

      </DialogContent>

    </Dialog>
  )
}
