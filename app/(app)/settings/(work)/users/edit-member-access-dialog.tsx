'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { PermissionMatrix } from '@/components/settings/permission-matrix'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/roles'
import { updateMemberAccess } from './actions'

type AccessMode = 'preset' | 'apps'

export function EditMemberAccessDialog({
  open,
  onOpenChange,
  membershipId,
  name,
  initialRole,
  initialPermissions,
  roles,
  roleTemplates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  membershipId: string
  name: string
  initialRole: string
  initialPermissions: string[]
  roles: string[]
  roleTemplates: Record<string, string[]>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const wasCustom = initialRole === 'CUSTOM' || initialPermissions.length > 0
  const [mode, setMode] = useState<AccessMode>(wasCustom ? 'apps' : 'preset')
  const [role, setRole] = useState(wasCustom ? roles[0] ?? 'VIEWER' : initialRole)
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        wasCustom
          ? initialPermissions
          : (roleTemplates[initialRole] ?? []),
      ),
  )

  const count = useMemo(() => selected.size, [selected])

  function applyTemplate(nextRole: string) {
    setRole(nextRole)
    setSelected(new Set(roleTemplates[nextRole] ?? []))
  }

  function save() {
    start(async () => {
      const result = await updateMemberAccess({
        membershipId,
        role: mode === 'apps' ? 'CUSTOM' : role,
        permissionsOverride: mode === 'apps' ? [...selected] : [],
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`Access updated for ${name}.`)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Access · {name}</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Choose a ready-made role, or tick the Apps this person may open — the same apps on the
          home screen.
        </p>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'apps' ? 'default' : 'outline'}
              onClick={() => {
                if (mode !== 'apps') {
                  setSelected(
                    new Set(
                      initialPermissions.length > 0
                        ? initialPermissions
                        : (roleTemplates[role] ?? []),
                    ),
                  )
                }
                setMode('apps')
              }}
            >
              Apps & permissions
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'preset' ? 'default' : 'outline'}
              onClick={() => setMode('preset')}
            >
              Ready-made role
            </Button>
          </div>

          {mode === 'preset' ? (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-role">
                Role
              </label>
              <NativeSelect
                id="edit-role"
                value={roles.includes(role) ? role : (roles[0] ?? 'VIEWER')}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[(roles.includes(role) ? role : roles[0]) as keyof typeof ROLE_DESCRIPTIONS]}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="edit-template">
                  Start from template
                </label>
                <NativeSelect
                  id="edit-template"
                  value={roles.includes(role) ? role : (roles[0] ?? 'VIEWER')}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-xs text-muted-foreground">
                {count} permission{count === 1 ? '' : 's'} selected
              </p>
              <PermissionMatrix selected={selected} onChange={setSelected} disabled={pending} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? 'Saving…' : 'Save access'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
