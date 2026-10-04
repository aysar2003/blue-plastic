/**
 * Settings screens share a narrow column and one heading. The hub at /settings
 * sits outside this group so it can use the full launcher.
 */
export default function SettingsWorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Settings</h1>
      {children}
    </div>
  )
}
